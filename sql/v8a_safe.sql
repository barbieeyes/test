-- 승인 없이 적용 가능한 변경 (지우는 문장 없음)
do $$
declare r record; d text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('seedhands_school_info','seedhands_login2','seedhands_admin_login2') loop
    d := pg_get_functiondef(r.oid);
    if position('where code = upper(btrim(p_code))' in d) > 0 then
      d := replace(d, 'where code = upper(btrim(p_code))', 'where seedhands_norm_code(code) = seedhands_norm_code(p_code)');
      execute d;
    end if;
  end loop;
end $$;

create or replace function seedhands_admin_student_update(p_token text, p_student uuid, p_no text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token); st seedhands_students;
begin
  if s.token is null then return jsonb_build_object('ok',false,'error','session'); end if;
  select * into st from seedhands_students where id = p_student and (s.is_super or school_id = s.school_id);
  if not found then return jsonb_build_object('ok',false,'error','학생을 찾지 못했어요.'); end if;
  if btrim(p_no) !~ '^[0-9]{4,6}$' then return jsonb_build_object('ok',false,'error','학번은 숫자 4~6자리예요.'); end if;
  if length(btrim(p_name)) < 2 then return jsonb_build_object('ok',false,'error','이름을 확인해 주세요.'); end if;
  if exists (select 1 from seedhands_students where school_id = st.school_id and student_no = btrim(p_no) and id <> st.id) then
    return jsonb_build_object('ok',false,'error','같은 학번의 학생이 이미 있어요.'); end if;
  update seedhands_students set student_no = btrim(p_no), name = btrim(p_name) where id = st.id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function seedhands_hq_school_update(p_token text, p_school uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token); v_code text;
begin
  if s.token is null or not coalesce(s.is_super,false) then return jsonb_build_object('ok',false,'error','session'); end if;
  if p_patch ? 'code' then
    v_code := upper(regexp_replace(btrim(p_patch->>'code'), '\s', '', 'g'));
    if length(v_code) < 3 or length(v_code) > 30 then return jsonb_build_object('ok',false,'error','코드는 3~30자로 정해 주세요.'); end if;
    if exists (select 1 from seedhands_schools where seedhands_norm_code(code) = seedhands_norm_code(v_code) and id <> p_school) then
      return jsonb_build_object('ok',false,'error','이미 쓰는 코드예요.'); end if;
  end if;
  update seedhands_schools set
    code = coalesce(v_code, code),
    name = coalesce(nullif(btrim(p_patch->>'name'),''), name),
    region = case when p_patch ? 'region' then nullif(btrim(p_patch->>'region'),'') else region end,
    site_name = case when p_patch ? 'site_name' then nullif(btrim(p_patch->>'site_name'),'') else site_name end,
    site_lat = case when p_patch ? 'site_lat' then nullif(p_patch->>'site_lat','')::double precision else site_lat end,
    site_lng = case when p_patch ? 'site_lng' then nullif(p_patch->>'site_lng','')::double precision else site_lng end,
    contact = case when p_patch ? 'contact' then nullif(btrim(p_patch->>'contact'),'') else contact end,
    inst_name = case when p_patch ? 'inst_name' then nullif(btrim(p_patch->>'inst_name'),'') else inst_name end
  where id = p_school;
  return jsonb_build_object('ok',true,'code',(select code from seedhands_schools where id = p_school));
end $$;

create or replace function seedhands_hq_school_pw(p_token text, p_school uuid, p_pw text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token);
begin
  if s.token is null or not coalesce(s.is_super,false) then return jsonb_build_object('ok',false,'error','session'); end if;
  if length(coalesce(p_pw,'')) < 6 then return jsonb_build_object('ok',false,'error','6자 이상으로 정해 주세요.'); end if;
  update seedhands_schools set admin_hash = crypt(p_pw, gen_salt('bf')), admin_fail = 0, admin_locked_until = null where id = p_school;
  update seedhands_sessions set expires_at = now() where school_id = p_school and is_admin;
  return jsonb_build_object('ok',true);
end $$;

alter table seedhands_schools add column if not exists ai_provider text;
alter table seedhands_schools add column if not exists ai_cipher text;
alter table seedhands_schools add column if not exists ai_hint text;
alter table seedhands_cfg add column if not exists shared_ai boolean not null default true;

create or replace function seedhands_admin_ai_set(p_token text, p_provider text, p_cipher text, p_hint text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token);
begin
  if s.token is null or s.school_id is null then return jsonb_build_object('ok',false,'error','session'); end if;
  if p_provider not in ('shared','google','anthropic','gateway','none') then return jsonb_build_object('ok',false,'error','provider'); end if;
  update seedhands_schools set ai_provider = p_provider,
    ai_cipher = case when p_provider in ('shared','none') then null else coalesce(nullif(p_cipher,''), ai_cipher) end,
    ai_hint = case when p_provider in ('shared','none') then null else coalesce(nullif(p_hint,''), ai_hint) end
  where id = s.school_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function seedhands_admin_ai_get(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token); sc seedhands_schools; c seedhands_cfg;
begin
  if s.token is null or s.school_id is null then return jsonb_build_object('ok',false,'error','session'); end if;
  select * into sc from seedhands_schools where id = s.school_id; select * into c from seedhands_cfg where id = 1;
  return jsonb_build_object('ok',true,'provider',coalesce(sc.ai_provider,'shared'),'hint',sc.ai_hint,'shared_allowed',c.shared_ai,
    'used_today',(select count(*) from seedhands_ai_reviews where school_id = sc.id and created_at > now() - interval '1 day'),
    'used_total',(select count(*) from seedhands_ai_reviews where school_id = sc.id));
end $$;

create or replace function seedhands_hq_shared_ai(p_token text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token);
begin
  if s.token is null or not coalesce(s.is_super,false) then return jsonb_build_object('ok',false,'error','session'); end if;
  if p_on is not null then update seedhands_cfg set shared_ai = p_on where id = 1; end if;
  return jsonb_build_object('ok',true,'shared_ai',(select shared_ai from seedhands_cfg where id = 1));
end $$;

create or replace function seedhands_ai_quota(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := seedhands_session_student(p_token); a seedhands_sessions; scid uuid; sc seedhands_schools; c seedhands_cfg; n_st int := 0; n_sc int;
begin
  if sid is not null then select school_id into scid from seedhands_students where id = sid;
  else a := seedhands_admin_sess(p_token); scid := a.school_id; end if;
  if scid is null then return jsonb_build_object('ok',false,'error','session'); end if;
  select * into sc from seedhands_schools where id = scid; select * into c from seedhands_cfg where id = 1;
  if sid is not null then select count(*) into n_st from seedhands_ai_reviews where student_id = sid and created_at > now() - interval '1 day'; end if;
  select count(*) into n_sc from seedhands_ai_reviews where school_id = scid and created_at > now() - interval '1 day';
  if n_st >= 30 then return jsonb_build_object('ok',false,'error','오늘은 AI 검토를 많이 받았어요. 내일 다시 해 주세요.'); end if;
  if n_sc >= 600 then return jsonb_build_object('ok',false,'error','오늘 우리 학교 AI 검토 횟수를 다 썼어요. 선생님께 말씀해 주세요.'); end if;
  if coalesce(sc.ai_provider,'shared') = 'none' then return jsonb_build_object('ok',false,'error','우리 학교는 AI 검토 없이 선생님이 확인해요.','off',true); end if;
  if coalesce(sc.ai_provider,'shared') = 'shared' then
    if not c.shared_ai then return jsonb_build_object('ok',false,'error','AI 연결이 아직 안 됐어요. 선생님 확인으로 넘어가요.','off',true); end if;
    return jsonb_build_object('ok',true,'provider','shared');
  end if;
  return jsonb_build_object('ok',true,'provider',sc.ai_provider,'cipher',sc.ai_cipher);
end $$;

-- 시드핸즈 도감 (공개: 식물별 집계, 개인정보 없음)
create or replace function seedhands_public_book(p_year int, p_deposited boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'items', coalesce(jsonb_agg(x order by (x->>'seeds')::bigint desc), '[]'::jsonb)) from (
    select jsonb_build_object(
      'plant', (array_agg(a.data->>'plant' order by a.created_at desc))[1],
      'sci', max(a.data->>'sci'), 'family', max(a.data->>'family'),
      'recs', count(*),
      'seeds', coalesce(sum(nullif(regexp_replace(coalesce(a.data->>'seedCount',''), '[^0-9]', '', 'g'), '')::bigint), 0),
      'dep', count(*) filter (where a.status = 'deposited'),
      'schools', count(distinct a.school_id),
      'regions', coalesce(jsonb_agg(distinct left(sc.region, 2)) filter (where sc.region is not null), '[]'::jsonb),
      'months', coalesce(jsonb_agg(distinct substr(a.data->>'date', 6, 2)::int) filter (where a.data->>'date' ~ '^[0-9]{4}-[0-9]{2}'), '[]'::jsonb),
      'photo_id', (array_agg(a.id order by a.created_at desc) filter (where a.photo_plant is not null))[1]) x
    from seedhands_accessions a left join seedhands_schools sc on sc.id = a.school_id
    where a.status <> 'rejected' and coalesce(a.data->>'plant','') <> ''
      and (p_year is null or left(coalesce(a.data->>'date', a.created_at::text), 4) = p_year::text)
      and (not coalesce(p_deposited,false) or a.status = 'deposited')
    group by coalesce(nullif(a.data->>'sci',''), a.data->>'plant')
  ) t;
$$;
create or replace function seedhands_public_book_photo(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'photo', (select photo_plant from seedhands_accessions where id = p_id and status <> 'rejected'));
$$;

revoke all on function seedhands_admin_student_update(text,uuid,text,text), seedhands_hq_school_update(text,uuid,jsonb), seedhands_hq_school_pw(text,uuid,text),
  seedhands_admin_ai_set(text,text,text,text), seedhands_admin_ai_get(text), seedhands_hq_shared_ai(text,boolean), seedhands_public_book(int,boolean), seedhands_public_book_photo(uuid) from public;
grant execute on function seedhands_admin_student_update(text,uuid,text,text), seedhands_hq_school_update(text,uuid,jsonb), seedhands_hq_school_pw(text,uuid,text),
  seedhands_admin_ai_set(text,text,text,text), seedhands_admin_ai_get(text), seedhands_hq_shared_ai(text,boolean), seedhands_public_book(int,boolean), seedhands_public_book_photo(uuid) to anon, authenticated;
revoke all on function seedhands_make_code(text,text), seedhands_find_school(text) from public, anon, authenticated;
