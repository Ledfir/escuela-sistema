-- Corrección: evita recursión RLS entre attendance_sessions y attendance_records.

drop policy if exists "attendance_sessions: guardian reads related sessions" on public.attendance_sessions;

create or replace function public.can_guardian_view_attendance_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.attendance_records record
    where record.attendance_session_id = target_session_id
      and public.is_guardian_of_student(record.student_id)
  );
$$;

create policy "attendance_sessions: guardian reads related sessions" on public.attendance_sessions for select to authenticated
  using (public.can_guardian_view_attendance_session(id));
