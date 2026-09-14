\set ON_ERROR_STOP on
begin;
create function public.ci_assert(ok boolean, message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
insert into auth.users values
('11111111-1111-1111-1111-111111111111','teacher1@example.test',now()),
('22222222-2222-2222-2222-222222222222','teacher2@example.test',now()),
('33333333-3333-3333-3333-333333333333','teacher3@example.test',now()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','student1@example.test',now()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','student2@example.test',now()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3','outsider@example.test',now()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4','unconfirmed@example.test',null);
insert into public.lab_profiles values
('11111111-1111-1111-1111-111111111111','teacher','Teacher 1'),
('22222222-2222-2222-2222-222222222222','teacher','Teacher 2');
insert into public.lab_classrooms(id,teacher_id) values
('cccccccc-cccc-cccc-cccc-ccccccccccc1','11111111-1111-1111-1111-111111111111'),
('cccccccc-cccc-cccc-cccc-ccccccccccc2','22222222-2222-2222-2222-222222222222');
insert into lab_private.invites(email,role,display_name) values('teacher3@example.test','teacher','Teacher 3');

set local role anon;
do $$ begin
 begin perform public.lab_context(); raise exception 'Anon invoked context'; exception when insufficient_privilege then null; end;
 begin perform * from public.lab_progress; raise exception 'Anon read progress'; exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
select public.ci_assert(public.lab_context()->'profile'->>'role'='teacher','Teacher bootstrap uses approved invite');
select public.ci_assert(public.lab_context()->'classroom'->>'teacher_id'='33333333-3333-3333-3333-333333333333','Teacher bootstrap creates own class');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',true);
select public.ci_assert(public.lab_context()->'profile'='null'::jsonb,'Unlisted sign-in has no role');
do $$ begin
 begin perform public.lab_dashboard('cccccccc-cccc-cccc-cccc-ccccccccccc1'); raise exception 'Outsider read dashboard'; exception when insufficient_privilege then null; end;
 begin perform public.lab_add_student('cccccccc-cccc-cccc-cccc-ccccccccccc1','outsider@example.test','Self'); raise exception 'Outsider self-enrolled'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select public.ci_assert(public.lab_context()->'profile'->>'role'='teacher','Teacher role read');
select public.lab_add_student('cccccccc-cccc-cccc-cccc-ccccccccccc1','STUDENT1@example.test','Student 01');
select public.lab_add_student('cccccccc-cccc-cccc-cccc-ccccccccccc1','student2@example.test','Student 02');
select public.lab_add_student('cccccccc-cccc-cccc-cccc-ccccccccccc1','unconfirmed@example.test','Pending');
select public.ci_assert(jsonb_array_length(public.lab_dashboard('cccccccc-cccc-cccc-cccc-ccccccccccc1')->'students')=2,'Verified registered students appear');
select public.ci_assert(public.lab_set_step('cccccccc-cccc-cccc-cccc-ccccccccccc1',2,0)->>'current_phase'='2','Teacher can assign step');
do $$ begin
 begin perform public.lab_set_step('cccccccc-cccc-cccc-cccc-ccccccccccc1',3,0); raise exception 'Stale step revision accepted'; exception when serialization_failure then null; end;
 begin perform public.lab_set_step('cccccccc-cccc-cccc-cccc-ccccccccccc1',5,1); raise exception 'Invalid step accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.lab_dashboard('cccccccc-cccc-cccc-cccc-ccccccccccc2'); raise exception 'Teacher read another class'; exception when insufficient_privilege then null; end;
 begin perform public.lab_add_student('cccccccc-cccc-cccc-cccc-ccccccccccc1','teacher2@example.test','Student'); raise exception 'Teacher role downgraded'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',true);
select public.ci_assert(public.lab_context()->'profile'->>'role'='student','Student role from roster');
select public.ci_assert(public.lab_context()->'classroom'->>'current_phase'='2','Student sees assigned step');
select public.ci_assert(public.lab_load('cccccccc-cccc-cccc-cccc-ccccccccccc1')->>'revision'='0','Fresh notebook starts at revision zero');
select public.ci_assert(public.lab_save('cccccccc-cccc-cccc-cccc-ccccccccccc1','{"version":1,"protocol":"balloon-A-J-20-30-8-v1","measurements":{"20":{"B":3},"30":{}},"math":{},"answers":{}}',0)->>'revision'='1','Student saves own notebook');
select public.ci_assert(public.lab_load('cccccccc-cccc-cccc-cccc-ccccccccccc1')->'state'->'measurements'->'20'->>'B'='3','Student reloads own measurement');
do $$ begin
 begin perform public.lab_save('cccccccc-cccc-cccc-cccc-ccccccccccc1','{"version":1,"protocol":"balloon-A-J-20-30-8-v1","measurements":{},"math":{},"answers":{}}',0); raise exception 'Stale revision accepted'; exception when serialization_failure then null; end;
 begin perform public.lab_save('cccccccc-cccc-cccc-cccc-ccccccccccc1','{"version":99}',1); raise exception 'Invalid work accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.lab_load('cccccccc-cccc-cccc-cccc-ccccccccccc2'); raise exception 'Student read another classroom'; exception when insufficient_privilege then null; end;
 begin perform public.lab_save('cccccccc-cccc-cccc-cccc-ccccccccccc2','{}',0); raise exception 'Student wrote another classroom'; exception when insufficient_privilege then null; end;
 begin perform public.lab_dashboard('cccccccc-cccc-cccc-cccc-ccccccccccc1'); raise exception 'Student read peer dashboard'; exception when insufficient_privilege then null; end;
 begin perform public.lab_set_step('cccccccc-cccc-cccc-cccc-ccccccccccc1',4,1); raise exception 'Student controlled teacher step'; exception when insufficient_privilege then null; end;
 begin perform public.lab_add_student('cccccccc-cccc-cccc-cccc-ccccccccccc1','outsider@example.test','Other'); raise exception 'Student registered another account'; exception when insufficient_privilege then null; end;
 begin update public.lab_profiles set role='teacher' where user_id=auth.uid(); raise exception 'Student promoted own role'; exception when insufficient_privilege then null; end;
 begin perform * from public.lab_progress; raise exception 'Student queried raw progress table'; exception when insufficient_privilege then null; end;
 begin perform * from lab_private.invites; raise exception 'Student queried email roster'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',true);
select public.ci_assert(public.lab_load('cccccccc-cccc-cccc-cccc-ccccccccccc1')->'state'='null'::jsonb,'Second student cannot inherit first student notebook');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',true);
select public.ci_assert(public.lab_context()->'profile'='null'::jsonb,'Unconfirmed email is not assigned a role');

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$ begin
 begin perform public.lab_add_student('cccccccc-cccc-cccc-cccc-ccccccccccc2','student1@example.test','Moved'); raise exception 'Another teacher moved enrollment'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select public.ci_assert(public.lab_dashboard('cccccccc-cccc-cccc-cccc-ccccccccccc1')->'students'->0->'state'->'measurements'->'20'->>'B'='3','Assigned teacher sees student work');
reset role;
select public.ci_assert((select bool_and(relrowsecurity) from pg_class where oid in('public.lab_profiles'::regclass,'public.lab_classrooms'::regclass,'public.lab_enrollments'::regclass,'public.lab_progress'::regclass,'lab_private.invites'::regclass)),'All classroom tables use RLS');
rollback;
\echo Classroom access checks passed.
