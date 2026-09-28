-- Fase 12: auditoría, endurecimiento de acceso y optimización.

create type public.audit_action as enum ('INSERT', 'UPDATE', 'DELETE');

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action public.audit_action not null,
  table_name text not null,
  record_identifier text,
  old_data jsonb,
  new_data jsonb
);

create index audit_logs_occurred_at_idx on public.audit_logs(occurred_at desc);
create index audit_logs_table_occurred_at_idx on public.audit_logs(table_name, occurred_at desc);
create index audit_logs_actor_occurred_at_idx on public.audit_logs(actor_user_id, occurred_at desc);
create index guardians_user_id_idx on public.guardians(user_id) where user_id is not null;
create index payments_paid_on_idx on public.payments(paid_on desc);
create index attendance_records_session_status_idx on public.attendance_records(attendance_session_id, status);
create index period_grades_enrollment_period_idx on public.period_grades(student_enrollment_id, grading_period_id);

alter table public.audit_logs enable row level security;

-- Sólo Superadministrador puede consultar la bitácora. Las inserciones se realizan desde el trigger.
create policy "audit logs: superadmin read" on public.audit_logs for select to authenticated using (public.has_role('superadmin'));

create function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_row jsonb; new_row jsonb; record_key text;
begin
  if TG_OP = 'DELETE' then old_row := to_jsonb(old); new_row := null; else old_row := case when TG_OP = 'UPDATE' then to_jsonb(old) else null end; new_row := to_jsonb(new); end if;
  record_key := coalesce(new_row ->> 'id', old_row ->> 'id');
  insert into public.audit_logs (actor_user_id, action, table_name, record_identifier, old_data, new_data)
  values (auth.uid(), TG_OP::public.audit_action, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, record_key, old_row, new_row);
  return coalesce(new, old);
end;
$$;

-- Tablas que contienen operaciones académicas, financieras y de seguridad relevantes.
create trigger audit_students after insert or update or delete on public.students for each row execute procedure public.write_audit_log();
create trigger audit_guardians after insert or update or delete on public.guardians for each row execute procedure public.write_audit_log();
create trigger audit_student_enrollments after insert or update or delete on public.student_enrollments for each row execute procedure public.write_audit_log();
create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute procedure public.write_audit_log();
create trigger audit_attendance_sessions after insert or update or delete on public.attendance_sessions for each row execute procedure public.write_audit_log();
create trigger audit_attendance_records after insert or update or delete on public.attendance_records for each row execute procedure public.write_audit_log();
create trigger audit_period_grades after insert or update or delete on public.period_grades for each row execute procedure public.write_audit_log();
create trigger audit_student_charges after insert or update or delete on public.student_charges for each row execute procedure public.write_audit_log();
create trigger audit_payments after insert or update or delete on public.payments for each row execute procedure public.write_audit_log();
create trigger audit_announcements after insert or update or delete on public.announcements for each row execute procedure public.write_audit_log();

-- Limita la invocación directa: estas funciones se usan por triggers y políticas RLS.
revoke all on function public.write_audit_log() from public;
revoke all on table public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
