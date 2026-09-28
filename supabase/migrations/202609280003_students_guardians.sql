-- Fase 3: expedientes de alumnos, tutores y documentos.

create type public.student_status as enum ('preinscribed', 'enrolled', 'active', 'withdrawn', 'graduated');
create type public.student_sex as enum ('female', 'male', 'unspecified');
create type public.document_status as enum ('pending', 'approved', 'rejected');

create table public.students (
  id uuid primary key default gen_random_uuid(),
  enrollment_number text unique,
  first_names text not null,
  paternal_surname text not null,
  maternal_surname text,
  birth_date date not null,
  curp text unique,
  sex public.student_sex not null default 'unspecified',
  status public.student_status not null default 'preinscribed',
  entry_date date,
  photo_path text,
  address text,
  medical_notes text,
  allergies text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_curp_format check (curp is null or char_length(curp) = 18)
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  first_names text not null,
  paternal_surname text not null,
  maternal_surname text,
  curp text unique,
  email text,
  phone text not null,
  alternate_phone text,
  address text,
  occupation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardians_curp_format check (curp is null or char_length(curp) = 18)
);

create table public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  relationship text not null,
  is_primary boolean not null default false,
  is_authorized_pickup boolean not null default true,
  receives_communications boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);

create unique index one_primary_guardian_per_student_idx
  on public.student_guardians(student_id) where is_primary;

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null unique,
  status public.document_status not null default 'pending',
  notes text,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null
);

create index students_full_name_idx on public.students(paternal_surname, maternal_surname, first_names);
create index student_guardians_guardian_idx on public.student_guardians(guardian_id);
create index student_documents_student_idx on public.student_documents(student_id);

create trigger students_set_updated_at before update on public.students
  for each row execute procedure public.set_updated_at();
create trigger guardians_set_updated_at before update on public.guardians
  for each row execute procedure public.set_updated_at();

alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_documents enable row level security;

create policy "students: staff read" on public.students for select to authenticated using (public.is_staff());
create policy "students: academic managers write" on public.students for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "guardians: staff read" on public.guardians for select to authenticated using (public.is_staff());
create policy "guardians: academic managers write" on public.guardians for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "student_guardians: staff read" on public.student_guardians for select to authenticated using (public.is_staff());
create policy "student_guardians: academic managers write" on public.student_guardians for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

create policy "student_documents: staff read" on public.student_documents for select to authenticated using (public.is_staff());
create policy "student_documents: academic managers write" on public.student_documents for all to authenticated
  using (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'))
  with check (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control'));

-- Almacenamiento privado. Sólo el personal puede cargar o consultar documentos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('student-documents', 'student-documents', false, 10485760)
on conflict (id) do nothing;

create policy "student documents: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'student-documents' and public.is_staff());
create policy "student documents: academic managers insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-documents' and (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control')));
create policy "student documents: academic managers update" on storage.objects for update to authenticated
  using (bucket_id = 'student-documents' and (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control')))
  with check (bucket_id = 'student-documents' and (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control')));
create policy "student documents: academic managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'student-documents' and (public.has_role('superadmin') or public.has_role('administrator') or public.has_role('school_control')));
