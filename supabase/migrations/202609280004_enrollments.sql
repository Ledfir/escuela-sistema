-- Fase 4: inscripciones y asignación académica por ciclo.

create type public.enrollment_status as enum ('preinscribed', 'enrolled', 'active', 'withdrawn', 'completed');

alter table public.school_groups
  add constraint school_groups_id_grade_unique unique (id, grade_id),
  add constraint school_groups_id_year_unique unique (id, school_year_id);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  group_id uuid references public.school_groups(id) on delete restrict,
  enrollment_date date not null default current_date,
  status public.enrollment_status not null default 'enrolled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (student_id, school_year_id),
  foreign key (group_id, grade_id) references public.school_groups(id, grade_id),
  foreign key (group_id, school_year_id) references public.school_groups(id, school_year_id)
);

create index student_enrollments_year_idx on public.student_enrollments(school_year_id, grade_id, group_id);
create index student_enrollments_student_idx on public.student_enrollments(student_id);

create sequence public.enrollment_number_seq start 1;

-- Se genera una matrícula sólo para alumnos que todavía no cuentan con una.
-- Ejemplo: 2026-PRIMARIA-00001
create function public.assign_enrollment_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare generated_number text;
begin
  if exists (select 1 from public.students where id = new.student_id and enrollment_number is null) then
    select concat(to_char(sy.starts_on, 'YYYY'), '-', level.code, '-', lpad(nextval('public.enrollment_number_seq')::text, 5, '0'))
    into generated_number
    from public.school_years sy
    join public.grades grade on grade.id = new.grade_id
    join public.education_levels level on level.id = grade.education_level_id
    where sy.id = new.school_year_id;

    update public.students set enrollment_number = generated_number where id = new.student_id;
  end if;
  return new;
end;
$$;

create trigger student_enrollments_assign_number before insert on public.student_enrollments
  for each row execute procedure public.assign_enrollment_number();
create trigger student_enrollments_set_updated_at before update on public.student_enrollments
  for each row execute procedure public.set_updated_at();

alter table public.student_enrollments enable row level security;

create policy "student_enrollments: staff read" on public.student_enrollments for select to authenticated
  using (public.is_staff());
create policy "student_enrollments: academic managers write" on public.student_enrollments for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));
