-- Fase 6: asistencia por grupo y fecha.

create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');

-- Vincula un expediente docente con su cuenta de acceso cuando el docente usará el portal.
alter table public.teachers add column user_id uuid unique references auth.users(id) on delete set null;

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.school_groups(id) on delete restrict,
  attendance_date date not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, attendance_date)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  status public.attendance_status not null default 'present',
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendance_session_id, student_id)
);

create index attendance_sessions_group_date_idx on public.attendance_sessions(group_id, attendance_date);
create index attendance_records_student_idx on public.attendance_records(student_id);

create trigger attendance_sessions_set_updated_at before update on public.attendance_sessions
  for each row execute procedure public.set_updated_at();
create trigger attendance_records_set_updated_at before update on public.attendance_records
  for each row execute procedure public.set_updated_at();

create function public.can_record_attendance(target_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control')
    or exists (
      select 1 from public.group_subjects gs
      join public.teachers t on t.id = gs.teacher_id
      where gs.group_id = target_group_id and t.user_id = auth.uid() and t.status = 'active'
    );
$$;

-- Evita registrar asistencia para alguien que no está inscrito en el grupo.
create function public.validate_attendance_record_group()
returns trigger language plpgsql security definer set search_path = public as $$
declare session_group_id uuid;
begin
  select group_id into session_group_id from public.attendance_sessions where id = new.attendance_session_id;
  if not exists (
    select 1 from public.student_enrollments
    where student_id = new.student_id and group_id = session_group_id
  ) then
    raise exception 'El alumno no pertenece al grupo de esta asistencia';
  end if;
  return new;
end;
$$;

create trigger attendance_records_validate_group before insert or update on public.attendance_records
  for each row execute procedure public.validate_attendance_record_group();

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

create policy "attendance_sessions: permitted read" on public.attendance_sessions for select to authenticated
  using (public.can_record_attendance(group_id));
create policy "attendance_sessions: permitted write" on public.attendance_sessions for all to authenticated
  using (public.can_record_attendance(group_id)) with check (public.can_record_attendance(group_id));

create policy "attendance_records: permitted read" on public.attendance_records for select to authenticated
  using (exists (select 1 from public.attendance_sessions s where s.id = attendance_session_id and public.can_record_attendance(s.group_id)));
create policy "attendance_records: permitted write" on public.attendance_records for all to authenticated
  using (exists (select 1 from public.attendance_sessions s where s.id = attendance_session_id and public.can_record_attendance(s.group_id)))
  with check (exists (select 1 from public.attendance_sessions s where s.id = attendance_session_id and public.can_record_attendance(s.group_id)));

-- Para dar acceso a un docente, enlaza su usuario de Auth con el expediente:
-- update public.teachers set user_id = 'UUID-DEL-USUARIO' where id = 'UUID-DEL-DOCENTE';
