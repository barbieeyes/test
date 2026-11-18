alter table seedhands_cfg add column if not exists server_hash text;
update seedhands_cfg set server_hash = '2f4f308c2255840a65294636d365105a011899a1858b65c7eb9e3cc1ef03cc27' where id = 1;

create or replace function seedhands_srv_ok(p_secret text) returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce(length(p_secret) >= 32 and encode(digest(p_secret, 'sha256'), 'hex') = (select server_hash from seedhands_cfg where id = 1), false);
$$;
revoke all on function seedhands_srv_ok(text) from public, anon, authenticated;

-- 학생에게 열린 quota는 암호문을 돌려주지 않아요
create or replace function seedhands_ai_quota(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb := seedhands_ai_quota2(null, p_token);
begin return r - 'cipher'; end $$;

create or replace function seedhands_ai_quota2(p_secret text, p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
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
    return jsonb_build_object('ok',true,'provider','shared','admin',sid is null);
  end if;
  return jsonb_build_object('ok',true,'provider',sc.ai_provider,'admin',sid is null) ||
    case when seedhands_srv_ok(p_secret) then jsonb_build_object('cipher',sc.ai_cipher) else '{}'::jsonb end;
end $$;

-- AI 결과 기록은 서버(비밀값)만 할 수 있어요
create or replace function seedhands_ai_log2(p_secret text, p_token text, p_plant text, p_sci text, p_model text, p_result jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := seedhands_session_student(p_token); sc uuid; v uuid;
begin
  if not seedhands_srv_ok(p_secret) then return jsonb_build_object('ok',false,'error','forbidden'); end if;
  if sid is null then return jsonb_build_object('ok',false,'error','session'); end if;
  if length(coalesce(p_result::text,'')) > 20000 then return jsonb_build_object('ok',false,'error','too long'); end if;
  select school_id into sc from seedhands_students where id = sid;
  insert into seedhands_ai_reviews(student_id, school_id, plant, sci, model, result)
  values (sid, sc, left(p_plant,120), left(p_sci,160), left(p_model,80), coalesce(p_result,'{}'::jsonb)) returning id into v;
  return jsonb_build_object('ok',true,'id',v);
end $$;
revoke execute on function seedhands_ai_log(text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function seedhands_ai_quota2(text,text), seedhands_ai_log2(text,text,text,text,text,jsonb), seedhands_ai_quota(text) to anon, authenticated;

-- 저장할 때 AI 결과는 서버 기록에서만 가져와요 (학생이 꾸밀 수 없어요)
create or replace function seedhands_ai_clean(p_data jsonb, p_sid uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d jsonb := coalesce(p_data,'{}'::jsonb) - 'ai_level' - 'ai_summary' - 'ai_at'; rv seedhands_ai_reviews; rid uuid;
begin
  begin rid := nullif(p_data->>'ai_id','')::uuid; exception when others then rid := null; end;
  if rid is not null then select * into rv from seedhands_ai_reviews where id = rid and student_id = p_sid; end if;
  if rv.id is null then return d - 'ai_id' - 'ai_sig'; end if;
  return d || jsonb_build_object('ai_level', rv.result->>'level', 'ai_summary', left(coalesce(rv.result->>'summary',''), 400), 'ai_at', rv.created_at);
end $$;
revoke all on function seedhands_ai_clean(jsonb,uuid) from public, anon, authenticated;

create or replace function seedhands_acc_save(p_token text, p_id uuid, p_data jsonb, p_plant text, p_fruit text, p_seed text, p_sketch text) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := seedhands_session_student(p_token); st seedhands_students; sc seedhands_schools; a seedhands_accessions; v_no text; d jsonb;
begin
  if sid is null then return jsonb_build_object('ok',false,'error','session'); end if;
  if length(coalesce(p_data::text,'')) > 30000 then return jsonb_build_object('ok',false,'error','기록 내용이 너무 길어요.'); end if;
  if not (seedhands_img_ok(p_plant, 900000) and seedhands_img_ok(p_fruit, 900000) and seedhands_img_ok(p_seed, 900000) and seedhands_img_ok(p_sketch, 700000)) then
    return jsonb_build_object('ok',false,'error','사진이나 그림 용량이 너무 크거나 형식이 맞지 않아요.'); end if;
  d := seedhands_ai_clean(p_data, sid);
  select * into st from seedhands_students where id = sid;
  if p_id is null then
    if coalesce(p_plant,'') = '' or coalesce(p_seed,'') = '' then return jsonb_build_object('ok',false,'error','식물 전체 사진과 씨앗 사진을 꼭 넣어 주세요.'); end if;
    update seedhands_schools set acc_seq = acc_seq + 1 where id = st.school_id returning * into sc;
    v_no := sc.code || '-' || to_char(now() at time zone 'Asia/Seoul', 'YYYY') || '-' || lpad(sc.acc_seq::text, 3, '0');
    insert into seedhands_accessions(school_id, student_id, acc_no, data, photo_plant, photo_fruit, photo_seed, sketch)
    values (st.school_id, sid, v_no, d, nullif(p_plant,''), nullif(p_fruit,''), nullif(p_seed,''), nullif(p_sketch,''))
    returning * into a;
  else
    select * into a from seedhands_accessions where id = p_id and student_id = sid;
    if not found then return jsonb_build_object('ok',false,'error','기록을 찾지 못했어요.'); end if;
    if a.status not in ('collected','rejected') then
      return jsonb_build_object('ok',false,'error','선생님이 이미 처리 중인 씨앗이라 고칠 수 없어요. 선생님께 말씀해 주세요.'); end if;
    if p_plant = '' or p_seed = '' then return jsonb_build_object('ok',false,'error','식물 전체 사진과 씨앗 사진은 지울 수 없어요.'); end if;
    update seedhands_accessions set data = case when p_data is null then data else d end,
      photo_plant = case when p_plant is null then photo_plant else nullif(p_plant,'') end,
      photo_fruit = case when p_fruit is null then photo_fruit else nullif(p_fruit,'') end,
      photo_seed = case when p_seed is null then photo_seed else nullif(p_seed,'') end,
      sketch = case when p_sketch is null then sketch else nullif(p_sketch,'') end,
      status = 'collected', updated_at = now()
    where id = a.id returning * into a;
  end if;
  return jsonb_build_object('ok',true,'id',a.id,'acc_no',a.acc_no,'status',a.status,'updated_at',a.updated_at);
end $$;

-- 제공자를 바꾸면서 새 키가 없으면 옛 키는 버려요
create or replace function seedhands_admin_ai_set(p_token text, p_provider text, p_cipher text, p_hint text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s seedhands_sessions := seedhands_admin_sess(p_token);
begin
  if s.token is null or s.school_id is null then return jsonb_build_object('ok',false,'error','session'); end if;
  if p_provider not in ('shared','google','anthropic','gateway','none') then return jsonb_build_object('ok',false,'error','provider'); end if;
  update seedhands_schools set
    ai_cipher = case when p_provider in ('shared','none') then null when nullif(p_cipher,'') is not null then p_cipher when coalesce(ai_provider,'') = p_provider then ai_cipher else null end,
    ai_hint = case when p_provider in ('shared','none') then null when nullif(p_hint,'') is not null then p_hint when coalesce(ai_provider,'') = p_provider then ai_hint else null end,
    ai_provider = p_provider
  where id = s.school_id;
  return jsonb_build_object('ok',true);
end $$;

-- 도감: 씨앗 수 넘침, 충북/충남 구분, 빈 날짜
create or replace function seedhands_region2(r text) returns text language sql immutable as $$
  select case when r like '충청북%' then '충북' when r like '충청남%' then '충남' when r like '경상북%' then '경북' when r like '경상남%' then '경남'
    when r like '전라북%' or r like '전북%' then '전북' when r like '전라남%' then '전남' else left(r, 2) end;
$$;
create or replace function seedhands_public_book(p_year integer, p_deposited boolean) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'items', coalesce(jsonb_agg(x order by (x->>'seeds')::bigint desc), '[]'::jsonb)) from (
    select jsonb_build_object(
      'plant', (array_agg(a.data->>'plant' order by a.created_at desc))[1],
      'sci', max(a.data->>'sci'), 'family', max(a.data->>'family'),
      'recs', count(*),
      'seeds', coalesce(sum(substring(replace(coalesce(a.data->>'seedCount',''), ',', '') from '\d{1,9}')::bigint), 0),
      'dep', count(*) filter (where a.status = 'deposited'),
      'schools', count(distinct a.school_id),
      'regions', coalesce(jsonb_agg(distinct seedhands_region2(sc.region)) filter (where sc.region is not null), '[]'::jsonb),
      'months', coalesce(jsonb_agg(distinct substr(a.data->>'date', 6, 2)::int) filter (where a.data->>'date' ~ '^[0-9]{4}-[0-9]{2}'), '[]'::jsonb),
      'photo_id', (array_agg(a.id order by a.created_at desc) filter (where a.photo_plant is not null))[1]) x
    from seedhands_accessions a left join seedhands_schools sc on sc.id = a.school_id
    where a.status <> 'rejected' and coalesce(a.data->>'plant','') <> ''
      and (p_year is null or left(coalesce(nullif(a.data->>'date',''), a.created_at::text), 4) = p_year::text)
      and (not coalesce(p_deposited,false) or a.status = 'deposited')
    group by coalesce(nullif(a.data->>'sci',''), a.data->>'plant')
  ) t;
$$;
