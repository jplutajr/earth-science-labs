-- Earth Science Labs classroom backend, schema v1.
-- Run once in a dedicated Supabase project. No student records belong in GitHub.
begin;
create schema if not exists lab_private;
revoke all on schema lab_private from public, anon, authenticated;

create table if not exists public.lab_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('teacher','student')),
 display_name text not null check (length(display_name) between 1 and 80)
);
create table if not exists public.lab_classrooms (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null unique references public.lab_profiles(user_id) on delete cascade,
 label text not null default 'Earth & Space Science',
 current_phase integer not null default 0 check(current_phase between 0 and 4),
 phase_revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table if not exists public.lab_enrollments (
 classroom_id uuid not null references public.lab_classrooms(id) on delete cascade,
 student_id uuid not null unique references public.lab_profiles(user_id) on delete cascade,
 primary key (classroom_id,student_id)
);
create table if not exists public.lab_progress (
 classroom_id uuid not null,
 student_id uuid not null,
 lab_id text not null default 'balloon' check(lab_id='balloon'),
 state jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(student_id,lab_id),
 foreign key(classroom_id,student_id) references public.lab_enrollments(classroom_id,student_id) on delete cascade,
 check (octet_length(state::text)<=64000)
);
create table if not exists lab_private.invites (
 email text primary key check(email=lower(email) and length(email)<=254),
 role text not null check(role in ('teacher','student')),
 display_name text not null check(length(display_name) between 1 and 80),
 classroom_id uuid references public.lab_classrooms(id) on delete cascade,
 check ((role='teacher' and classroom_id is null) or (role='student' and classroom_id is not null))
);
alter table public.lab_profiles enable row level security;
alter table public.lab_classrooms enable row level security;
alter table public.lab_enrollments enable row level security;
alter table public.lab_progress enable row level security;
alter table lab_private.invites enable row level security;
-- No direct browser table access. All data routes below authorize auth.uid().
revoke all on public.lab_profiles,public.lab_classrooms,public.lab_enrollments,public.lab_progress from public,anon,authenticated;
revoke all on lab_private.invites from public,anon,authenticated;

create or replace function lab_private.require_teacher(p_classroom uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.lab_classrooms c join public.lab_profiles p on p.user_id=c.teacher_id
  where c.id=p_classroom and c.teacher_id=auth.uid() and p.role='teacher'
 ) then raise exception 'Teacher access required' using errcode='42501'; end if;
end $$;

create or replace function lab_private.require_student(p_classroom uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.lab_enrollments e join public.lab_profiles p on p.user_id=e.student_id
  where e.classroom_id=p_classroom and e.student_id=auth.uid() and p.role='student'
 ) then raise exception 'Student enrollment required' using errcode='42501'; end if;
end $$;

create or replace function lab_private.ensure_profile() returns void
language plpgsql security definer set search_path='' as $$
declare v_invite lab_private.invites%rowtype; v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if exists(select 1 from public.lab_profiles where user_id=auth.uid()) then return; end if;
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into v_invite from lab_private.invites where email=v_email;
 if not found then return; end if;
 insert into public.lab_profiles(user_id,role,display_name) values(auth.uid(),v_invite.role,v_invite.display_name) on conflict(user_id) do nothing;
 if v_invite.role='teacher' then
  insert into public.lab_classrooms(teacher_id) values(auth.uid()) on conflict(teacher_id) do nothing;
 else
  insert into public.lab_enrollments(classroom_id,student_id) values(v_invite.classroom_id,auth.uid()) on conflict(student_id) do nothing;
 end if;
end $$;

create or replace function public.lab_context() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_profile public.lab_profiles%rowtype; v_class public.lab_classrooms%rowtype;
begin
 perform lab_private.ensure_profile();
 select * into v_profile from public.lab_profiles where user_id=auth.uid();
 if not found then return jsonb_build_object('profile',null,'classroom',null); end if;
 if v_profile.role='teacher' then select * into v_class from public.lab_classrooms where teacher_id=auth.uid();
 else select c.* into v_class from public.lab_classrooms c join public.lab_enrollments e on e.classroom_id=c.id where e.student_id=auth.uid();
 end if;
 return jsonb_build_object('profile',to_jsonb(v_profile),'classroom',case when v_class.id is null then null else to_jsonb(v_class) end);
end $$;

create or replace function public.lab_load(p_classroom uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.lab_progress%rowtype;
begin
 perform lab_private.require_student(p_classroom);
 select * into v_row from public.lab_progress where classroom_id=p_classroom and student_id=auth.uid() and lab_id='balloon';
 if not found then return jsonb_build_object('state',null,'revision',0,'updated_at',null); end if;
 return jsonb_build_object('state',v_row.state,'revision',v_row.revision,'updated_at',v_row.updated_at);
end $$;

create or replace function public.lab_save(p_classroom uuid,p_state jsonb,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.lab_progress%rowtype;
begin
 perform lab_private.require_student(p_classroom);
 if p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>64000
 or p_state->>'protocol' is distinct from 'balloon-A-J-20-30-8-v1'
 or p_state->>'version' is distinct from '1'
 or jsonb_typeof(p_state->'measurements') is distinct from 'object'
 or jsonb_typeof(p_state->'math') is distinct from 'object'
 or jsonb_typeof(p_state->'answers') is distinct from 'object'
 or p_expected_revision is null or p_expected_revision<0
 then raise exception 'Invalid work file' using errcode='22023'; end if;
 if p_expected_revision=0 then
  insert into public.lab_progress(classroom_id,student_id,state)
  values(p_classroom,auth.uid(),p_state)
  on conflict(student_id,lab_id) do nothing returning * into v_row;
 else
  update public.lab_progress set state=p_state,revision=revision+1,updated_at=clock_timestamp()
  where classroom_id=p_classroom and student_id=auth.uid() and lab_id='balloon' and revision=p_expected_revision returning * into v_row;
 end if;
 if v_row.student_id is null then raise exception 'Work changed on another device' using errcode='40001'; end if;
 return jsonb_build_object('revision',v_row.revision,'updated_at',v_row.updated_at);
end $$;

create or replace function public.lab_set_step(p_classroom uuid,p_phase integer,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_class public.lab_classrooms%rowtype;
begin
 perform lab_private.require_teacher(p_classroom);
 if p_phase is null or p_phase not between 0 and 4 then raise exception 'Invalid step' using errcode='22023'; end if;
 update public.lab_classrooms set current_phase=p_phase,phase_revision=phase_revision+1,updated_at=clock_timestamp()
 where id=p_classroom and phase_revision=p_expected_revision returning * into v_class;
 if v_class.id is null then raise exception 'Classroom changed in another tab' using errcode='40001'; end if;
 return to_jsonb(v_class);
end $$;

create or replace function public.lab_dashboard(p_classroom uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_students jsonb; v_class public.lab_classrooms%rowtype;
begin
 perform lab_private.require_teacher(p_classroom);
 select * into v_class from public.lab_classrooms where id=p_classroom;
 select coalesce(jsonb_agg(jsonb_build_object(
  'student_id',p.user_id,'display_name',p.display_name,'state',w.state,'revision',coalesce(w.revision,0),'updated_at',w.updated_at
 ) order by p.display_name),'[]'::jsonb) into v_students
 from public.lab_enrollments e join public.lab_profiles p on p.user_id=e.student_id
 left join public.lab_progress w on w.student_id=e.student_id and w.classroom_id=e.classroom_id and w.lab_id='balloon'
 where e.classroom_id=p_classroom;
 return jsonb_build_object('classroom',to_jsonb(v_class),'students',v_students);
end $$;

create or replace function public.lab_add_student(p_classroom uuid,p_email text,p_display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email)); v_uid uuid; v_existing lab_private.invites%rowtype;
begin
 perform lab_private.require_teacher(p_classroom);
 if v_email is null or v_email!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(v_email)>254
 or p_display_name is null or length(trim(p_display_name)) not between 1 and 80
 then raise exception 'Provide an email and display code' using errcode='22023'; end if;
 -- Serialize changes to this invite without exposing email addresses to other users.
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 select * into v_existing from lab_private.invites where email=v_email;
 if found and (v_existing.role<>'student' or v_existing.classroom_id<>p_classroom) then
  raise exception 'Account already assigned' using errcode='42501';
 end if;
 select id into v_uid from auth.users where lower(email)=v_email and email_confirmed_at is not null limit 1;
 if v_uid is not null and exists(select 1 from public.lab_profiles where user_id=v_uid and role<>'student') then
  raise exception 'Account already assigned' using errcode='42501';
 end if;
 if v_uid is not null and exists(select 1 from public.lab_enrollments where student_id=v_uid and classroom_id<>p_classroom) then
  raise exception 'Account already assigned' using errcode='42501';
 end if;
 insert into lab_private.invites(email,role,display_name,classroom_id) values(v_email,'student',trim(p_display_name),p_classroom)
 on conflict(email) do update set display_name=excluded.display_name;
 if v_uid is not null then
  insert into public.lab_profiles(user_id,role,display_name) values(v_uid,'student',trim(p_display_name))
  on conflict(user_id) do update set display_name=excluded.display_name;
  insert into public.lab_enrollments(classroom_id,student_id) values(p_classroom,v_uid) on conflict(student_id) do nothing;
 end if;
 return jsonb_build_object('registered',true,'ready',v_uid is not null);
end $$;

revoke all on function lab_private.require_teacher(uuid),lab_private.require_student(uuid),lab_private.ensure_profile() from public,anon,authenticated;
revoke all on function public.lab_context(),public.lab_load(uuid),public.lab_save(uuid,jsonb,bigint),public.lab_set_step(uuid,integer,bigint),public.lab_dashboard(uuid),public.lab_add_student(uuid,text,text) from public,anon,authenticated;
grant execute on function public.lab_context(),public.lab_load(uuid),public.lab_save(uuid,jsonb,bigint),public.lab_set_step(uuid,integer,bigint),public.lab_dashboard(uuid),public.lab_add_student(uuid,text,text) to authenticated;
commit;
