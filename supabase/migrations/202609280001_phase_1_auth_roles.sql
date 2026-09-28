-- Fase 1: identidades, roles y políticas de seguridad.
-- Ejecuta este archivo en Supabase SQL Editor o con `supabase db push`.

create type public.app_role as enum (
  'superadmin', 'administrator', 'school_control', 'finance', 'teacher', 'guardian', 'student'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id smallint generated always as identity primary key,
  code public.app_role not null unique,
  name text not null unique,
  description text not null
);

insert into public.roles (code, name, description) values
  ('superadmin', 'Superadministrador', 'Configuración global y acceso total'),
  ('administrator', 'Administrador / Dirección', 'Administración general del plantel'),
  ('school_control', 'Control escolar', 'Inscripciones y expedientes'),
  ('finance', 'Finanzas / Caja', 'Cargos, pagos y cartera'),
  ('teacher', 'Docente', 'Grupos, asistencia y calificaciones asignadas'),
  ('guardian', 'Tutor / Padre', 'Consulta de información de sus hijos'),
  ('student', 'Alumno', 'Consulta de su propia información');

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id smallint not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

-- SECURITY DEFINER evita una recursión de RLS al comprobar privilegios.
create function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = required_role
  );
$$;

create function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('superadmin') or public.has_role('administrator')
      or public.has_role('school_control') or public.has_role('finance') or public.has_role('teacher');
$$;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Cada persona puede leer/editar sólo su perfil. Dirección y superadmin pueden verlo todo.
create policy "profiles: own read or staff read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role('superadmin') or public.has_role('administrator'));
create policy "profiles: own update or admin update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role('superadmin') or public.has_role('administrator'))
  with check (id = auth.uid() or public.has_role('superadmin') or public.has_role('administrator'));

-- Los roles son catálogo de sólo lectura. Sólo superadmin administra asignaciones.
create policy "roles: authenticated read" on public.roles for select to authenticated using (true);
create policy "user_roles: own read or admin read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role('superadmin') or public.has_role('administrator'));
create policy "user_roles: superadmin manages" on public.user_roles for all to authenticated
  using (public.has_role('superadmin')) with check (public.has_role('superadmin'));

-- Después de crear tu primer usuario desde Auth, asígnalo como superadmin desde SQL Editor:
-- insert into public.user_roles (user_id, role_id)
-- select 'UUID-DEL-USUARIO', id from public.roles where code = 'superadmin';
