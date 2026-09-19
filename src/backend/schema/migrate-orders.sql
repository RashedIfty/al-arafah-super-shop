-- ---------------------------------------------------------------------
-- Orders — a customer can buy, and the owner is told.
--
-- Run this once in the Supabase SQL editor. Safe to run twice.
--
-- Four things happen here.
--
-- 1. A profile per customer: the name, phone and address a delivery
--    needs. Asked for at checkout rather than at sign-up, so browsing
--    stays open to anyone.
--
-- 2. Orders, and the items inside them. An order copies the customer's
--    details and each product's name and price at the moment it is
--    placed, so changing a price tomorrow does not rewrite yesterday's
--    receipt.
--
-- 3. An owner. Until now the catalogue's write rule was "any signed-in
--    user", which since customer accounts went live has meant any
--    customer could edit the shop's products. This names the owner and
--    locks writing to them.
--
-- 4. Realtime on orders, so the owner's panel hears about one the
--    moment it arrives.
-- ---------------------------------------------------------------------


-- ============================== the owner =============================
-- Who the shop belongs to. One row, id = 1, like the announcement.

create table if not exists settings (
  id         int primary key default 1,
  owner_uid  uuid references auth.users(id),
  updated_at timestamptz default now(),
  constraint settings_single_row check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;

/* Name the owner.
 *
 * Run this once, with the email you sign in to the admin panel with. It
 * is a separate statement because it needs an email only you know, and
 * because getting it wrong locks you out of your own catalogue.
 *
 *   update settings
 *      set owner_uid = (select id from auth.users where email = 'YOU@EXAMPLE.COM'),
 *          updated_at = now()
 *    where id = 1;
 *
 * Check it took:
 *
 *   select u.email from settings s join auth.users u on u.id = s.owner_uid;
 */

/* True when the caller is the shop owner.
 *
 * security definer so it can read settings regardless of who is asking;
 * stable so Postgres may cache it within a statement rather than
 * re-running it per row.
 *
 * Returns false rather than null when no owner is set, so a half-run
 * migration denies writes instead of allowing them.
 */
create or replace function is_owner() returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(auth.uid() = (select owner_uid from settings where id = 1), false);
$$;

alter table settings enable row level security;

drop policy if exists "read settings"  on settings;
drop policy if exists "owner settings" on settings;

-- The owner's uid is not a secret, but nobody needs it either. Only the
-- owner reads or writes this row; is_owner() reaches it regardless,
-- being security definer.
create policy "owner settings" on settings
  for all using (is_owner()) with check (is_owner());


-- ============================== profiles ==============================
-- What a delivery needs. One row per customer.

create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  phone      text not null,
  postal     text not null,
  address    text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  /* A Japanese mobile: 070, 080 or 090 and eight more digits, stored
     without separators. Checked here as well as in the form, because a
     form is only one of the ways a row can arrive. */
  constraint profiles_phone_jp check (phone ~ '^0[789]0[0-9]{8}$'),
  constraint profiles_postal_jp check (postal ~ '^[0-9]{3}-[0-9]{4}$')
);

alter table profiles enable row level security;

drop policy if exists "read own profile"   on profiles;
drop policy if exists "write own profile"  on profiles;
drop policy if exists "update own profile" on profiles;
drop policy if exists "owner reads profiles" on profiles;

create policy "read own profile" on profiles
  for select using (auth.uid() = user_id);

create policy "write own profile" on profiles
  for insert with check (auth.uid() = user_id);

create policy "update own profile" on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No delete policy: a customer removes their profile by closing their
-- account, which cascades from auth.users.


-- =============================== orders ===============================

create table if not exists orders (
  id         uuid primary key default gen_random_uuid(),

  /* What a customer reads out on the phone. Short enough to say aloud,
     unique so two orders are never confused. */
  code       text unique not null,

  user_id    uuid not null references auth.users(id) on delete cascade,

  /* Copied from the profile when the order is placed, not joined to it.
     A customer who moves house next month must not silently change
     where last month's order was sent. */
  name       text not null,
  phone      text not null,
  postal     text not null,
  address    text not null,

  total      int  not null,
  note       text,

  status     text not null default 'pending',
  cancel_reason text,

  placed_at     timestamptz not null default now(),
  confirmed_at  timestamptz,
  dispatched_at timestamptz,
  delivered_at  timestamptz,
  cancelled_at  timestamptz,

  constraint orders_status check (status in
    ('pending','confirmed','dispatched','delivered','rejected','cancelled')),
  constraint orders_total_sane check (total >= 0)
);

-- The two questions ever asked: "my orders, newest first" and
-- "everything, newest first".
create index if not exists orders_user_idx   on orders(user_id, placed_at desc);
create index if not exists orders_placed_idx on orders(placed_at desc);
create index if not exists orders_status_idx on orders(status, placed_at desc);

alter table orders enable row level security;

drop policy if exists "read own orders"   on orders;
drop policy if exists "place own orders"  on orders;
drop policy if exists "owner reads orders" on orders;
drop policy if exists "owner moves orders" on orders;

create policy "read own orders" on orders
  for select using (auth.uid() = user_id);

create policy "place own orders" on orders
  for insert with check (auth.uid() = user_id);

create policy "owner reads orders" on orders
  for select using (is_owner());

/* Only the owner moves an order along. A customer cannot mark their own
   order delivered, and cannot edit one after placing it. */
create policy "owner moves orders" on orders
  for update using (is_owner()) with check (is_owner());


-- ============================ order items =============================
-- What was bought, as it read at the time.

create table if not exists order_items (
  id         bigserial primary key,
  order_id   uuid not null references orders(id) on delete cascade,

  /* Kept so the owner can find the product again, but set null rather
     than cascaded: deleting a product must not delete the record that
     it was once sold. */
  product_id uuid references products(id) on delete set null,

  name_en    text not null,
  name_bn    text not null,
  name_ja    text not null,
  w          text not null default '',
  unit_price int  not null,
  qty        int  not null,
  line_total int  not null,

  constraint order_items_qty_sane check (qty > 0 and qty <= 99)
);

create index if not exists order_items_order_idx on order_items(order_id);

alter table order_items enable row level security;

drop policy if exists "read own order items"  on order_items;
drop policy if exists "place own order items" on order_items;
drop policy if exists "owner reads order items" on order_items;

/* An item is readable by whoever may read its order. Written as a
   subquery against orders so the rule lives in one place. */
create policy "read own order items" on order_items
  for select using (exists (
    select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

create policy "place own order items" on order_items
  for insert with check (exists (
    select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

create policy "owner reads order items" on order_items
  for select using (is_owner());


-- ====================== lock the catalogue down =======================
/* The rule these replace was:
 *
 *   create policy "owner write ..." on ... for all
 *     to authenticated using (true) with check (true)
 *
 * which means "any signed-in user may write". That was written when the
 * only account was the owner's. Customer sign-up went live since, so
 * until this runs, any customer can edit the shop's products.
 */

do $$
declare t text;
begin
  foreach t in array array['categories','products','deals'] loop
    execute format('drop policy if exists "owner write %1$s" on %1$I', t);
    execute format(
      'create policy "owner write %1$s" on %1$I for all
         using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;


-- ============================== realtime ==============================
-- So the owner's panel hears an order arrive rather than waiting to be
-- refreshed. Wrapped because adding a table twice is an error.

do $$
begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- Check it worked.
--
--   select u.email as owner from settings s join auth.users u on u.id = s.owner_uid;
--     → your admin email. Blank means the update above was not run, and
--       nobody can write the catalogue until it is.
--
--   select tablename, policyname from pg_policies
--    where tablename in ('profiles','orders','order_items','settings')
--    order by tablename, policyname;
--     → profiles 3, orders 4, order_items 3, settings 1.
--
--   select tablename, policyname, qual from pg_policies
--    where policyname like 'owner write%';
--     → three rows, each qual reading is_owner(), not true.
-- ---------------------------------------------------------------------
