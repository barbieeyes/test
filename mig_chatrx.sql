create table if not exists public.gg_chat_rx(
  chat_id bigint not null references public.gg_chat(id) on delete cascade,
  who text not null,
  kind text not null check (kind in ('heart','thumb','lol','wow')),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(chat_id,who,kind));
alter table public.gg_chat_rx enable row level security;
revoke all on public.gg_chat_rx from anon, authenticated;
grant select (chat_id,kind,active,who) on public.gg_chat_rx to anon, authenticated;
create policy gg_read on public.gg_chat_rx for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.gg_chat_rx;
create or replace function public.gg_chat_react(p_sid uuid,p_key text,p_code text,p_tname text,p_chat bigint,p_kind text) returns boolean language plpgsql security definer set search_path='' as $$
declare s public.gg_students; w text; v boolean; ch public.gg_chat; begin
  if p_kind not in ('heart','thumb','lol','wow') then raise exception 'bad_kind'; end if;
  select * into ch from public.gg_chat where id=p_chat; if ch.id is null or ch.deleted then raise exception 'no_msg'; end if;
  if p_sid is null then if not public.gg_ok_teacher(p_code) then return null; end if; w:='tea:'||left(coalesce(p_tname,'선생님'),20);
  else s:=public.gg_student(p_sid,p_key);
    if ch.channel<>'all' and ch.channel<>('t'||s.team) then raise exception 'not_your_channel'; end if;
    w:='stu:'||s.id; end if;
  insert into public.gg_chat_rx(chat_id,who,kind,active) values(p_chat,w,p_kind,true)
  on conflict(chat_id,who,kind) do update set active=not public.gg_chat_rx.active, updated_at=now()
  returning active into v; return v; end $$;
