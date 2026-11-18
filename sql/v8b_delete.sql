-- 지우기 기능 (Supabase가 승인을 물어요)
create or replace function seedhands_record_delete(p_token text, p_mission text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := seedhands_session_student(p_token);
begin
  if sid is null then return jsonb_build_object('ok',false,'error','session'); end if;
  delete from seedhands_records where student_id = sid and mission = p_mission;
  return jsonb_build_object('ok',true);
end $$;

create or replace function seedhands_admin_acc_delete(p_token text, p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token); n int;
begin
  if s.token is null then return jsonb_build_object('ok',false,'error','session'); end if;
  delete from seedhands_accessions where id = any(p_ids) and (s.is_super or school_id = s.school_id);
  get diagnostics n = row_count;
  return jsonb_build_object('ok',true,'deleted',n);
end $$;

create or replace function seedhands_hq_school_delete(p_token text, p_school uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token);
begin
  if s.token is null or not coalesce(s.is_super,false) then return jsonb_build_object('ok',false,'error','session'); end if;
  if (select code from seedhands_schools where id = p_school) = 'SR2026' then return jsonb_build_object('ok',false,'error','기본 학교는 지울 수 없어요.'); end if;
  delete from seedhands_sessions where school_id = p_school or student_id in (select id from seedhands_students where school_id = p_school);
  delete from seedhands_records where student_id in (select id from seedhands_students where school_id = p_school);
  delete from seedhands_accessions where school_id = p_school;
  delete from seedhands_ai_reviews where school_id = p_school;
  delete from seedhands_students where school_id = p_school;
  delete from seedhands_schools where id = p_school;
  return jsonb_build_object('ok',true);
end $$;

revoke all on function seedhands_record_delete(text,text), seedhands_admin_acc_delete(text,uuid[]), seedhands_hq_school_delete(text,uuid) from public;
grant execute on function seedhands_record_delete(text,text), seedhands_admin_acc_delete(text,uuid[]), seedhands_hq_school_delete(text,uuid) to anon, authenticated;
