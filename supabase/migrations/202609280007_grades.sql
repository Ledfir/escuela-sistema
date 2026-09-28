-- Fase 7: períodos, evaluaciones y calificaciones.

create table public.grading_periods (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  name text not null,
  sort_order smallint not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, name),
  unique (school_year_id, sort_order),
  constraint grading_period_dates_valid check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create unique index grading_periods_one_active_per_year_idx on public.grading_periods(school_year_id) where is_active;

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  group_subject_id uuid not null references public.group_subjects(id) on delete restrict,
  grading_period_id uuid not null references public.grading_periods(id) on delete restrict,
  name text not null,
  weight numeric(5,2) not null default 100,
  max_score numeric(5,2) not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluations_weight_valid check (weight > 0 and weight <= 100),
  constraint evaluations_max_score_valid check (max_score > 0),
  unique (group_subject_id, grading_period_id, name)
);

create table public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  score numeric(5,2) not null,
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, student_id),
  constraint evaluation_scores_nonnegative check (score >= 0)
);

-- Calificación final editable del período, útil para captura directa o para una boleta.
create table public.period_grades (
  id uuid primary key default gen_random_uuid(),
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete restrict,
  group_subject_id uuid not null references public.group_subjects(id) on delete restrict,
  grading_period_id uuid not null references public.grading_periods(id) on delete restrict,
  score numeric(5,2) not null,
  remarks text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_enrollment_id, group_subject_id, grading_period_id),
  constraint period_grades_range check (score >= 0 and score <= 100)
);

create index grading_periods_year_idx on public.grading_periods(school_year_id);
create index evaluations_group_subject_idx on public.evaluations(group_subject_id, grading_period_id);
create index period_grades_lookup_idx on public.period_grades(group_subject_id, grading_period_id);

create trigger grading_periods_set_updated_at before update on public.grading_periods
  for each row execute procedure public.set_updated_at();
create trigger evaluations_set_updated_at before update on public.evaluations
  for each row execute procedure public.set_updated_at();
create trigger evaluation_scores_set_updated_at before update on public.evaluation_scores
  for each row execute procedure public.set_updated_at();
create trigger period_grades_set_updated_at before update on public.period_grades
  for each row execute procedure public.set_updated_at();

create function public.can_grade_group_subject(target_group_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_subjects gs
    where gs.id = target_group_subject_id and public.can_record_attendance(gs.group_id)
  );
$$;

-- Comprueba grupo y ciclo antes de aceptar una calificación final.
create function public.validate_period_grade_context()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1
    from public.student_enrollments enrollment
    join public.group_subjects gs on gs.group_id = enrollment.group_id
    join public.grading_periods period on period.school_year_id = enrollment.school_year_id
    where enrollment.id = new.student_enrollment_id
      and gs.id = new.group_subject_id
      and period.id = new.grading_period_id
  ) then raise exception 'La inscripción, materia y período no pertenecen al mismo grupo y ciclo'; end if;
  return new;
end;
$$;

create function public.validate_evaluation_score_context()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.evaluations evaluation
    join public.group_subjects gs on gs.id = evaluation.group_subject_id
    join public.student_enrollments enrollment on enrollment.group_id = gs.group_id
    where evaluation.id = new.evaluation_id and enrollment.student_id = new.student_id
  ) then raise exception 'El alumno no pertenece al grupo de esta evaluación'; end if;
  if new.score > (select max_score from public.evaluations where id = new.evaluation_id) then
    raise exception 'La calificación supera el máximo permitido';
  end if;
  return new;
end;
$$;

create function public.validate_evaluation_period_context()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.group_subjects gs
    join public.school_groups group_item on group_item.id = gs.group_id
    join public.grading_periods period on period.school_year_id = group_item.school_year_id
    where gs.id = new.group_subject_id and period.id = new.grading_period_id
  ) then raise exception 'La evaluación debe pertenecer al mismo ciclo que el grupo'; end if;
  return new;
end;
$$;

create trigger period_grades_validate_context before insert or update on public.period_grades
  for each row execute procedure public.validate_period_grade_context();
create trigger evaluation_scores_validate_context before insert or update on public.evaluation_scores
  for each row execute procedure public.validate_evaluation_score_context();
create trigger evaluations_validate_period_context before insert or update on public.evaluations
  for each row execute procedure public.validate_evaluation_period_context();

alter table public.grading_periods enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.period_grades enable row level security;

create policy "grading_periods: staff read" on public.grading_periods for select to authenticated using (public.is_staff());
create policy "grading_periods: managers write" on public.grading_periods for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "evaluations: staff read" on public.evaluations for select to authenticated using (public.is_staff());
create policy "evaluations: permitted write" on public.evaluations for all to authenticated
  using (public.can_grade_group_subject(group_subject_id)) with check (public.can_grade_group_subject(group_subject_id));

create policy "evaluation_scores: permitted read" on public.evaluation_scores for select to authenticated
  using (exists (select 1 from public.evaluations e where e.id = evaluation_id and public.can_grade_group_subject(e.group_subject_id)));
create policy "evaluation_scores: permitted write" on public.evaluation_scores for all to authenticated
  using (exists (select 1 from public.evaluations e where e.id = evaluation_id and public.can_grade_group_subject(e.group_subject_id)))
  with check (exists (select 1 from public.evaluations e where e.id = evaluation_id and public.can_grade_group_subject(e.group_subject_id)));

create policy "period_grades: permitted read" on public.period_grades for select to authenticated using (public.can_grade_group_subject(group_subject_id));
create policy "period_grades: permitted write" on public.period_grades for all to authenticated
  using (public.can_grade_group_subject(group_subject_id)) with check (public.can_grade_group_subject(group_subject_id));
