-- Fase 9: portal de familias y permisos de consulta para tutores.

alter table public.guardians add column user_id uuid unique references auth.users(id) on delete set null;

create function public.is_guardian_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.guardians where user_id = auth.uid());
$$;

create function public.is_guardian_of_student(target_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.student_guardians sg
    join public.guardians g on g.id = sg.guardian_id
    where sg.student_id = target_student_id and g.user_id = auth.uid()
  );
$$;

create function public.is_guardian_of_enrollment(target_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.student_enrollments e
    where e.id = target_enrollment_id and public.is_guardian_of_student(e.student_id)
  );
$$;

create function public.can_view_student_document(path text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_guardian_of_student(split_part(path, '/', 1)::uuid);
exception when others then return false;
end;
$$;

-- Permisos de consulta del tutor, siempre limitados por la relación tutor-alumno.
create policy "students: guardian reads own children" on public.students for select to authenticated using (public.is_guardian_of_student(id));
create policy "guardians: own portal profile" on public.guardians for select to authenticated using (user_id = auth.uid());
create policy "student_guardians: guardian reads own children" on public.student_guardians for select to authenticated using (public.is_guardian_of_student(student_id));
create policy "student_enrollments: guardian reads own children" on public.student_enrollments for select to authenticated using (public.is_guardian_of_student(student_id));
create policy "student_documents: guardian reads own children" on public.student_documents for select to authenticated using (public.is_guardian_of_student(student_id));
create policy "student_charges: guardian reads own children" on public.student_charges for select to authenticated using (public.is_guardian_of_student(student_id));
create policy "payments: guardian reads own children" on public.payments for select to authenticated using (public.is_guardian_of_student(student_id));
create policy "attendance_records: guardian reads own children" on public.attendance_records for select to authenticated using (public.is_guardian_of_student(student_id));
create function public.can_guardian_view_attendance_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.attendance_records record where record.attendance_session_id = target_session_id and public.is_guardian_of_student(record.student_id));
$$;
create policy "attendance_sessions: guardian reads related sessions" on public.attendance_sessions for select to authenticated using (public.can_guardian_view_attendance_session(id));
create policy "period_grades: guardian reads own children" on public.period_grades for select to authenticated using (public.is_guardian_of_enrollment(student_enrollment_id));

create policy "school_years: guardian catalog read" on public.school_years for select to authenticated using (public.is_guardian_user());
create policy "education_levels: guardian catalog read" on public.education_levels for select to authenticated using (public.is_guardian_user());
create policy "grades: guardian catalog read" on public.grades for select to authenticated using (public.is_guardian_user());
create policy "school_groups: guardian related read" on public.school_groups for select to authenticated using (
  exists (select 1 from public.student_enrollments e where e.group_id = school_groups.id and public.is_guardian_of_student(e.student_id))
);
create policy "grading_periods: guardian catalog read" on public.grading_periods for select to authenticated using (public.is_guardian_user());
create policy "subjects: guardian catalog read" on public.subjects for select to authenticated using (public.is_guardian_user());
create policy "billing_concepts: guardian catalog read" on public.billing_concepts for select to authenticated using (public.is_guardian_user());
create policy "group_subjects: guardian related read" on public.group_subjects for select to authenticated using (
  exists (select 1 from public.student_enrollments e where e.group_id = group_subjects.group_id and public.is_guardian_of_student(e.student_id))
);

create policy "student documents: guardian read" on storage.objects for select to authenticated
  using (bucket_id = 'student-documents' and public.can_view_student_document(name));

-- Para activar el portal, relaciona la cuenta Auth con el expediente del tutor:
-- update public.guardians set user_id = 'UUID-DEL-USUARIO' where id = 'UUID-DEL-TUTOR';
