-- ---------------------------------------------------------------------
-- Orders can be paused until a set moment, and resume on their own.
--
-- shop_status holds one row: the moment orders open. Before it, the
-- checkout shows "Orders open on …" instead of the order form, and the
-- database refuses any new order — so a tab left open from earlier, or
-- a hand-made request, cannot slip one in. At the moment itself nothing
-- has to be switched back: both checks compare against the clock.
--
-- First use: closed now, open from 1 November 2026, 00:00 Japan time.
-- To change it later: update shop_status set orders_open_from = '…'.
-- A date in the past (or NULL) means orders are open.
--
-- Safe to run twice. All or nothing.
-- ---------------------------------------------------------------------

begin;

create table if not exists public.shop_status (
  id               int primary key default 1 check (id = 1),
  orders_open_from timestamptz
);
insert into public.shop_status (id, orders_open_from)
values (1, '2026-11-01 00:00:00+09')
on conflict (id) do update set orders_open_from = excluded.orders_open_from;

alter table public.shop_status enable row level security;
drop policy if exists "anyone reads shop status" on public.shop_status;
drop policy if exists "owner writes shop status" on public.shop_status;
create policy "anyone reads shop status" on public.shop_status
  for select to anon, authenticated using (true);
create policy "owner writes shop status" on public.shop_status
  for all to authenticated using (is_owner()) with check (is_owner());
-- The project grants everything to anon by default; reading is all it gets.
revoke insert, update, delete, truncate on public.shop_status from anon;

-- The guard: no new order before the opening moment (the owner excepted).
create or replace function public.orders_not_before_open()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare opens timestamptz;
begin
  select orders_open_from into opens from shop_status where id = 1;
  if opens is not null and now() < opens and not is_owner() then
    raise exception 'Orders open on %. Please order again then.',
      to_char(opens at time zone 'Asia/Tokyo', 'FMDD FMMonth YYYY')
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.orders_not_before_open() from public, anon, authenticated;

drop trigger if exists orders_not_before_open on public.orders;
create trigger orders_not_before_open before insert on public.orders
  for each row execute function orders_not_before_open();

commit;
