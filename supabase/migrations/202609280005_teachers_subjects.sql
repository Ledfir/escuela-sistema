-- Fase 5: docentes, materias y carga académica.

create type public.teacher_status as enum ('active', 'inactive', 'on_leave');

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  first_names text not null,
  paternal_surname text not null,
  maternal_surname text,
  curp text unique,
  rfc text unique,
  email text,
  phone text not null,
  address text,
  hire_date date,
  status public.teacher_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teachers_curp_format check (curp is null or char_length(curp) = 18)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  weekly_hours smallint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_weekly_hours_positive check (weekly_hours is null or weekly_hours > 0)
);

create table public.teacher_subjects (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (teacher_id, subject_id)
);

create table public.group_subjects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.school_groups(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, subject_id)
);

create index teacher_subjects_subject_idx on public.teacher_subjects(subject_id);
create index group_subjects_group_idx on public.group_subjects(group_id);
create index group_subjects_teacher_idx on public.group_subjects(teacher_id);

create trigger teachers_set_updated_at before update on public.teachers
  for each row execute procedure public.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute procedure public.set_updated_at();
create trigger group_subjects_set_updated_at before update on public.group_subjects
  for each row execute procedure public.set_updated_at();

alter table public.teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.teacher_subjects enable row level security;
alter table public.group_subjects enable row level security;

create policy "teachers: staff read" on public.teachers for select to authenticated using (public.is_staff());
create policy "teachers: academic managers write" on public.teachers for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "subjects: staff read" on public.subjects for select to authenticated using (public.is_staff());
create policy "subjects: academic managers write" on public.subjects for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "teacher_subjects: staff read" on public.teacher_subjects for select to authenticated using (public.is_staff());
create policy "teacher_subjects: academic managers write" on public.teacher_subjects for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "group_subjects: staff read" on public.group_subjects for select to authenticated using (public.is_staff());
create policy "group_subjects: academic managers write" on public.group_subjects for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));
