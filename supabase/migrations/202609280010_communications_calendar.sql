-- Fase 10: comunicados y calendario con destinatarios segmentados.

create type public.audience_target as enum ('all_school', 'education_level', 'grade', 'group', 'student', 'guardian');
create type public.calendar_event_type as enum ('exam', 'meeting', 'festival', 'vacation', 'suspension', 'grade_delivery', 'sports', 'payment_due', 'other');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcement_recipients (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  target public.audience_target not null,
  education_level_id uuid references public.education_levels(id) on delete cascade,
  grade_id uuid references public.grades(id) on delete cascade,
  group_id uuid references public.school_groups(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint announcement_target_valid check (
    (target = 'all_school' and education_level_id is null and grade_id is null and group_id is null and student_id is null and guardian_id is null) or
    (target = 'education_level' and education_level_id is not null) or
    (target = 'grade' and grade_id is not null) or
    (target = 'group' and group_id is not null) or
    (target = 'student' and student_id is not null) or
    (target = 'guardian' and guardian_id is not null)
  )
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type public.calendar_event_type not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_all_day boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_dates_valid check (ends_at is null or ends_at >= starts_at)
);

create table public.calendar_event_recipients (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid not null references public.calendar_events(id) on delete cascade,
  target public.audience_target not null,
  education_level_id uuid references public.education_levels(id) on delete cascade,
  grade_id uuid references public.grades(id) on delete cascade,
  group_id uuid references public.school_groups(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint calendar_target_valid check (
    (target = 'all_school' and education_level_id is null and grade_id is null and group_id is null and student_id is null and guardian_id is null) or
    (target = 'education_level' and education_level_id is not null) or
    (target = 'grade' and grade_id is not null) or
    (target = 'group' and group_id is not null) or
    (target = 'student' and student_id is not null) or
    (target = 'guardian' and guardian_id is not null)
  )
);

create index announcement_recipients_announcement_idx on public.announcement_recipients(announcement_id);
create index calendar_recipients_event_idx on public.calendar_event_recipients(calendar_event_id);
create index calendar_events_starts_at_idx on public.calendar_events(starts_at);

create trigger announcements_set_updated_at before update on public.announcements for each row execute procedure public.set_updated_at();
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute procedure public.set_updated_at();

create function public.can_manage_communications()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control');
$$;

create function public.can_view_target(target public.audience_target, level_id uuid, target_grade_id uuid, target_group_id uuid, target_student_id uuid, target_guardian_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or target = 'all_school'
    or (target = 'guardian' and exists (select 1 from public.guardians g where g.id = target_guardian_id and g.user_id = auth.uid()))
    or (target = 'student' and public.is_guardian_of_student(target_student_id))
    or (target = 'group' and exists (select 1 from public.student_enrollments e where e.group_id = target_group_id and public.is_guardian_of_student(e.student_id)))
    or (target = 'grade' and exists (select 1 from public.student_enrollments e where e.grade_id = target_grade_id and public.is_guardian_of_student(e.student_id)))
    or (target = 'education_level' and exists (select 1 from public.student_enrollments e join public.grades gr on gr.id = e.grade_id where gr.education_level_id = level_id and public.is_guardian_of_student(e.student_id)));
$$;

create function public.can_view_announcement(target_announcement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.announcement_recipients r where r.announcement_id = target_announcement_id and public.can_view_target(r.target, r.education_level_id, r.grade_id, r.group_id, r.student_id, r.guardian_id));
$$;
create function public.can_view_calendar_event(target_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.calendar_event_recipients r where r.calendar_event_id = target_event_id and public.can_view_target(r.target, r.education_level_id, r.grade_id, r.group_id, r.student_id, r.guardian_id));
$$;

alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_event_recipients enable row level security;

create policy "announcements: audience read" on public.announcements for select to authenticated using (is_published and public.can_view_announcement(id));
create policy "announcements: managers write" on public.announcements for all to authenticated using (public.can_manage_communications()) with check (public.can_manage_communications());
create policy "announcement recipients: managers read" on public.announcement_recipients for select to authenticated using (public.can_manage_communications());
create policy "announcement recipients: managers write" on public.announcement_recipients for all to authenticated using (public.can_manage_communications()) with check (public.can_manage_communications());
create policy "calendar events: audience read" on public.calendar_events for select to authenticated using (public.can_view_calendar_event(id));
create policy "calendar events: managers write" on public.calendar_events for all to authenticated using (public.can_manage_communications()) with check (public.can_manage_communications());
create policy "calendar recipients: managers read" on public.calendar_event_recipients for select to authenticated using (public.can_manage_communications());
create policy "calendar recipients: managers write" on public.calendar_event_recipients for all to authenticated using (public.can_manage_communications()) with check (public.can_manage_communications());
