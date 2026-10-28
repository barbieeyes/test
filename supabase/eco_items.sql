-- 에코쌤즈 팀 공용 저장소 (Supabase SQL Editor에서 한 번 실행)
create table if not exists public.eco_items (
  id text primary key, kind text not null default 'plant', author text, ts bigint,
  data jsonb not null, deleted boolean not null default false, updated_at timestamptz not null default now()
);
create index if not exists eco_items_updated_idx on public.eco_items (updated_at);
create or replace function public.eco_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists eco_items_touch on public.eco_items;
create trigger eco_items_touch before insert or update on public.eco_items for each row execute function public.eco_touch();
create or replace function public.eco_pin_ok() returns boolean language sql stable set search_path = '' as $$
  select coalesce((current_setting('request.headers', true))::json->>'x-team-pin', '') = '2144' $$;
alter table public.eco_items enable row level security;
create policy eco_items_read on public.eco_items for select to anon, authenticated using (public.eco_pin_ok());
create policy eco_items_insert on public.eco_items for insert to anon, authenticated with check (public.eco_pin_ok());
create policy eco_items_update on public.eco_items for update to anon, authenticated using (public.eco_pin_ok()) with check (public.eco_pin_ok());
grant select, insert, update on public.eco_items to anon, authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eco-photos', 'eco-photos', true, 8388608, array['image/jpeg','image/png']) on conflict (id) do nothing;
create policy eco_photos_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'eco-photos' and public.eco_pin_ok());
create policy eco_photos_update on storage.objects for update to anon, authenticated using (bucket_id = 'eco-photos' and public.eco_pin_ok()) with check (bucket_id = 'eco-photos' and public.eco_pin_ok());
