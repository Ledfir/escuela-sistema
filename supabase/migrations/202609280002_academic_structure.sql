-- Fase 2: ciclos escolares y estructura académica.

create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_year_dates_valid check (ends_on > starts_on)
);

create unique index school_years_one_current_idx
  on public.school_years (is_current) where is_current;

create table public.education_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_levels_sort_order_positive check (sort_order > 0)
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  education_level_id uuid not null references public.education_levels(id) on delete restrict,
  name text not null,
  sort_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (education_level_id, name),
  unique (education_level_id, sort_order),
  constraint grades_sort_order_positive check (sort_order > 0)
);

create table public.school_groups (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  name text not null,
  capacity smallint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, grade_id, name),
  constraint school_groups_capacity_positive check (capacity is null or capacity > 0)
);

create index grades_level_idx on public.grades(education_level_id);
create index school_groups_year_grade_idx on public.school_groups(school_year_id, grade_id);

create trigger school_years_set_updated_at before update on public.school_years
  for each row execute procedure public.set_updated_at();
create trigger education_levels_set_updated_at before update on public.education_levels
  for each row execute procedure public.set_updated_at();
create trigger grades_set_updated_at before update on public.grades
  for each row execute procedure public.set_updated_at();
create trigger school_groups_set_updated_at before update on public.school_groups
  for each row execute procedure public.set_updated_at();

-- Catálogos iniciales. Se pueden renombrar o reordenar desde el portal.
insert into public.education_levels (name, code, sort_order) values
  ('Pre-kínder', 'PREK', 1),
  ('Kínder', 'KINDER', 2),
  ('Primaria', 'PRIMARIA', 3),
  ('Secundaria', 'SECUNDARIA', 4);

insert into public.grades (education_level_id, name, sort_order)
select id, 'Pre-kínder', 1 from public.education_levels where code = 'PREK';
insert into public.grades (education_level_id, name, sort_order)
select id, '1° de kínder', 1 from public.education_levels where code = 'KINDER';
insert into public.grades (education_level_id, name, sort_order)
select id, '2° de kínder', 2 from public.education_levels where code = 'KINDER';
insert into public.grades (education_level_id, name, sort_order)
select id, '3° de kínder', 3 from public.education_levels where code = 'KINDER';
insert into public.grades (education_level_id, name, sort_order)
select id, concat(series.number, '° de primaria'), series.number
from generate_series(1, 6) as series(number), public.education_levels where code = 'PRIMARIA';
insert into public.grades (education_level_id, name, sort_order)
select id, concat(series.number, '° de secundaria'), series.number
from generate_series(1, 3) as series(number), public.education_levels where code = 'SECUNDARIA';

alter table public.school_years enable row level security;
alter table public.education_levels enable row level security;
alter table public.grades enable row level security;
alter table public.school_groups enable row level security;

-- Lectura para el personal. Escritura limitada a los responsables de estructura escolar.
create policy "school_years: staff read" on public.school_years for select to authenticated
  using (public.is_staff());
create policy "school_years: academic managers write" on public.school_years for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "education_levels: staff read" on public.education_levels for select to authenticated
  using (public.is_staff());
create policy "education_levels: academic managers write" on public.education_levels for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "grades: staff read" on public.grades for select to authenticated
  using (public.is_staff());
create policy "grades: academic managers write" on public.grades for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "school_groups: staff read" on public.school_groups for select to authenticated
  using (public.is_staff());
create policy "school_groups: academic managers write" on public.school_groups for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));
