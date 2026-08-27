-- =====================================================================
--  AL-ARAFAH SUPER SHOP — database schema
--  Run this once in Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ------------------------- categories -------------------------------
create table if not exists categories (
  id        text primary key,          -- "rice", "meat", …
  icon      text not null default '🛒',
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
  sort        int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz default now()
);

create index if not exists products_category_idx on products(category_id);

-- The common query is "everything not archived".
create index if not exists products_live_idx   on products(category_id) where archived_at is null;
create index if not exists categories_live_idx on categories(sort)      where archived_at is null;
create index if not exists deals_live_idx      on deals(sort)           where archived_at is null;

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

-- =====================================================================
--  SECURITY
--  Anyone may READ (customers browsing the shop).
--  Only a signed-in user may WRITE (the owner in the admin panel).
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
