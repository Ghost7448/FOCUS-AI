-- FOCUS AI Phase 1 schema
-- Run this file in the Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('student','teacher','admin')),
  preferred_language text not null default 'en' check (preferred_language in ('ar','en')),
  education_level text,
  grade text,
  teaching_subject text,
  institution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
using (auth.uid() = id);

-- Profile role is not editable by the user. Add narrowly scoped update
-- policies/column grants only after deciding which profile fields are editable.
create index if not exists profiles_role_idx on public.profiles(role);

-- Create student/teacher profiles from verified Auth signup metadata.
-- Public signup cannot create an admin profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
  if requested_role not in ('student', 'teacher') then
    requested_role := 'student';
  end if;

  insert into public.profiles (
    id, full_name, role, preferred_language, education_level, grade,
    teaching_subject, institution
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    requested_role,
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en'),
    new.raw_user_meta_data ->> 'education_level',
    new.raw_user_meta_data ->> 'grade',
    new.raw_user_meta_data ->> 'teaching_subject',
    new.raw_user_meta_data ->> 'institution'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin role assignment must be performed only by a trusted project owner
-- using the Supabase dashboard/service-side administration, never public signup.
