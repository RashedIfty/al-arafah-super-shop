-- ---------------------------------------------------------------------
-- A stamp that changes whenever the shop does.
--
-- Run this once in the Supabase SQL editor. Safe to run twice. The site
-- works without it (it falls back to re-reading every five minutes);
-- with it, a change the owner makes reaches customers at once.
--
-- One row, one timestamp. Any insert, update or delete on products,
-- categories or deals moves it to now(). A customer's page reads only
-- this stamp — a few hundred bytes — and downloads the catalogue again
-- only when the stamp is newer than the copy it holds. That is what lets
-- a price change show straight away without every visitor holding a
-- live connection to the database, which is what filled its memory.
-- ---------------------------------------------------------------------

create table if not exists shop_version (
  id  int primary key default 1 check (id = 1),
  at  timestamptz not null default now()
);

insert into shop_version (id) values (1) on conflict (id) do nothing;

-- Anyone may read the stamp; nobody may write it but the trigger below.
alter table shop_version enable row level security;

drop policy if exists shop_version_read on shop_version;
create policy shop_version_read on shop_version for select using (true);

grant select on shop_version to anon, authenticated;

-- Once per statement, not per row: marking a whole category sold out is
-- one change, not forty.
create or replace function bump_shop_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update shop_version set at = now() where id = 1;
  return null;
end; $$;

drop trigger if exists products_bump_version   on products;
drop trigger if exists categories_bump_version on categories;
drop trigger if exists deals_bump_version      on deals;

create trigger products_bump_version
  after insert or update or delete on products
  for each statement execute function bump_shop_version();
create trigger categories_bump_version
  after insert or update or delete on categories
  for each statement execute function bump_shop_version();
create trigger deals_bump_version
  after insert or update or delete on deals
  for each statement execute function bump_shop_version();

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select at from shop_version;
--     → one row, a time. Change any product's price in the panel and
--       run it again: the time moves.
-- ---------------------------------------------------------------------
