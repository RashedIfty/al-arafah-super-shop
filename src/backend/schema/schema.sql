-- =====================================================================
--  AL-ARAFAH SUPER SHOP — database schema
--  Run this once in Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ------------------------- categories -------------------------------
create table if not exists categories (
  id        text primary key,          -- "rice", "meat", …
  icon      text not null default '',
  img       text not null default '',
  en        text not null,
  bn        text not null,
  ja        text not null,
  sort      int  not null default 0,   -- display order
  archived_at timestamptz,             -- set = hidden from the shop
  created_at timestamptz default now()
);

-- -------------------------- products --------------------------------
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  category_id text not null references categories(id) on delete cascade,
  en          text not null,
  bn          text not null,
  ja          text not null,
  w           text not null default '',   -- weight / size
  p           int  not null,              -- price in yen
  was         int  not null default 0,    -- old price, 0 = not on sale
  img         text not null default '',
  tag         text,                       -- 'new' | 'out' | null
  country     text,                       -- 'bd', 'in', … null = not set
  -- The shelves a product sits on, beside the category it lives in.
  -- A product can be on both, or neither, and never leaves its category
  -- to be on one.
  is_new      boolean not null default false,
  is_popular  boolean not null default false,
  sort        int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz default now()
);

-- Existing shops upgrade in place; new ones already have them above.
alter table products add column if not exists country    text;
alter table products add column if not exists is_new     boolean not null default false;
alter table products add column if not exists is_popular boolean not null default false;

create index if not exists products_category_idx on products(category_id);

-- Browsing by country only ever asks for products that have one.
create index if not exists products_country_idx
  on products(country) where country is not null and archived_at is null;

-- Likewise a shelf page only ever asks for what is on it.
create index if not exists products_new_idx
  on products(sort) where is_new and archived_at is null;
create index if not exists products_popular_idx
  on products(sort) where is_popular and archived_at is null;

-- The common query is "everything not archived".
create index if not exists products_live_idx   on products(category_id) where archived_at is null;
create index if not exists categories_live_idx on categories(sort)      where archived_at is null;
-- deals_live_idx lives below, under the deals table: an index cannot be
-- created before the table it indexes, and a clean run of this file
-- from the top used to fail here.

-- --------------------------- deals ----------------------------------
-- "Today's Deal & New Arrival" strip on the homepage.
create table if not exists deals (
  id         uuid primary key default gen_random_uuid(),
  type       text not null default 'new',  -- 'new' | 'deal'
  en         text not null,
  bn         text not null,
  ja         text not null,
  w          text not null default '',
  p          int  not null,
  was        int  not null default 0,
  img        text not null default '',
  sort       int  not null default 0,
  archived_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists deals_live_idx on deals(sort) where archived_at is null;

-- =====================================================================
--  SECURITY
--  Anyone may READ (customers browsing the shop).
--
--  The write rule below says "any signed-in user", which was true when
--  the only account was the owner's. Customer sign-up has since gone
--  live, so migrate-orders.sql replaces it with a rule naming the owner.
--
--  If you re-run this file on a shop that has already had that
--  migration, run migrate-orders.sql again afterwards — otherwise this
--  block hands the catalogue back to every customer.
-- =====================================================================
alter table categories enable row level security;
alter table products   enable row level security;
alter table deals      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','products','deals'] loop
    execute format('drop policy if exists "public read %1$s" on %1$I', t);
    execute format('drop policy if exists "owner write %1$s" on %1$I', t);

    execute format(
      'create policy "public read %1$s" on %1$I for select using (true)', t);

    execute format(
      'create policy "owner write %1$s" on %1$I for all
         to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- =====================================================================
--  PHOTO STORAGE
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read photos"  on storage.objects;
drop policy if exists "owner upload photos" on storage.objects;

create policy "public read photos" on storage.objects
  for select using (bucket_id = 'product-photos');

create policy "owner upload photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-photos')
  with check (bucket_id = 'product-photos');
