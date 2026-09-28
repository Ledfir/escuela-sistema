-- Fase 8: colegiaturas, cargos, pagos y becas.

create type public.billing_frequency as enum ('one_time', 'monthly', 'annual', 'other');
create type public.charge_status as enum ('pending', 'partial', 'paid', 'cancelled');
create type public.payment_method as enum ('cash', 'transfer', 'card', 'deposit', 'other');

create table public.billing_concepts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  default_amount numeric(12,2),
  frequency public.billing_frequency not null default 'one_time',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_concepts_amount_valid check (default_amount is null or default_amount >= 0)
);

create table public.student_scholarships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  name text not null,
  percentage numeric(5,2),
  fixed_amount numeric(12,2),
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scholarship_value_valid check ((percentage is not null and percentage > 0 and percentage <= 100) or (fixed_amount is not null and fixed_amount > 0)),
  constraint scholarship_dates_valid check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create table public.student_charges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  billing_concept_id uuid not null references public.billing_concepts(id) on delete restrict,
  due_date date not null,
  amount numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  surcharge_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  status public.charge_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint charges_amount_valid check (amount >= 0 and discount_amount >= 0 and surcharge_amount >= 0 and paid_amount >= 0),
  constraint charges_discount_valid check (discount_amount <= amount)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_charge_id uuid not null references public.student_charges(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  paid_on date not null default current_date,
  amount numeric(12,2) not null,
  method public.payment_method not null,
  reference text,
  notes text,
  received_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint payments_amount_valid check (amount > 0)
);

create index student_charges_student_status_idx on public.student_charges(student_id, status, due_date);
create index payments_charge_idx on public.payments(student_charge_id);
create index student_scholarships_student_idx on public.student_scholarships(student_id);

create trigger billing_concepts_set_updated_at before update on public.billing_concepts
  for each row execute procedure public.set_updated_at();
create trigger student_scholarships_set_updated_at before update on public.student_scholarships
  for each row execute procedure public.set_updated_at();
create trigger student_charges_set_updated_at before update on public.student_charges
  for each row execute procedure public.set_updated_at();

create function public.can_manage_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('superadmin') or public.has_role('administrator') or public.has_role('finance');
$$;

create function public.validate_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare charge_student uuid; total_due numeric; existing_paid numeric;
begin
  select student_id, amount - discount_amount + surcharge_amount, paid_amount
  into charge_student, total_due, existing_paid from public.student_charges where id = new.student_charge_id;
  if charge_student is null or charge_student <> new.student_id then raise exception 'El pago no corresponde al alumno del cargo'; end if;
  if existing_paid - coalesce(old.amount, 0) + new.amount > total_due then raise exception 'El pago supera el saldo del cargo'; end if;
  return new;
end;
$$;

create function public.refresh_charge_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_charge uuid; total_paid numeric; total_due numeric;
begin
  target_charge := coalesce(new.student_charge_id, old.student_charge_id);
  select coalesce(sum(amount), 0) into total_paid from public.payments where student_charge_id = target_charge;
  select amount - discount_amount + surcharge_amount into total_due from public.student_charges where id = target_charge;
  update public.student_charges set paid_amount = total_paid,
    status = case when total_paid >= total_due then 'paid'::public.charge_status when total_paid > 0 then 'partial'::public.charge_status else 'pending'::public.charge_status end
  where id = target_charge;
  return coalesce(new, old);
end;
$$;

create trigger payments_validate before insert or update on public.payments
  for each row execute procedure public.validate_payment();
create trigger payments_refresh_charge after insert or update or delete on public.payments
  for each row execute procedure public.refresh_charge_balance();

alter table public.billing_concepts enable row level security;
alter table public.student_scholarships enable row level security;
alter table public.student_charges enable row level security;
alter table public.payments enable row level security;

create policy "billing_concepts: finance access" on public.billing_concepts for all to authenticated
  using (public.can_manage_finance()) with check (public.can_manage_finance());
create policy "student_scholarships: finance access" on public.student_scholarships for all to authenticated
  using (public.can_manage_finance()) with check (public.can_manage_finance());
create policy "student_charges: finance access" on public.student_charges for all to authenticated
  using (public.can_manage_finance()) with check (public.can_manage_finance());
create policy "payments: finance access" on public.payments for all to authenticated
  using (public.can_manage_finance()) with check (public.can_manage_finance());
