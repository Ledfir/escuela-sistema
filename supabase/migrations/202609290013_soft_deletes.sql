-- Borrado lógico de alumnos y docentes: conserva expedientes e historial.

alter table public.students
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.teachers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists students_active_name_idx
  on public.students (paternal_surname, maternal_surname, first_names)
  where deleted_at is null;

create index if not exists teachers_active_name_idx
  on public.teachers (paternal_surname, maternal_surname, first_names)
  where deleted_at is null;

-- Se sustituye la política "for all" para impedir eliminaciones físicas desde la API.
drop policy if exists "students: academic managers write" on public.students;
create policy "students: academic managers insert" on public.students for insert to authenticated
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));
create policy "students: academic managers update" on public.students for update to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

drop policy if exists "teachers: academic managers write" on public.teachers;
create policy "teachers: academic managers insert" on public.teachers for insert to authenticated
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));
create policy "teachers: academic managers update" on public.teachers for update to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));
