-- ---------------------------------------------------------------------
-- Favourites — the products a customer wants to find again.
--
-- Run this once in the Supabase SQL editor. Safe to run twice.
--
-- One row per customer per product. The product is referenced rather
-- than copied, so a price change or a new photograph reaches the
-- customer's list without anything having to update it; and when the
-- owner deletes a product, the cascade takes the favourite with it
-- rather than leaving a row pointing at nothing.
-- ---------------------------------------------------------------------

create table if not exists favourites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id)   on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);

-- The only question ever asked of this table is "what has this customer
-- saved", newest first.
create index if not exists favourites_user_idx
  on favourites(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row-level security.
--
-- A customer's list is their own business. These policies are what stop
-- one signed-in customer reading, adding to, or deleting from another's
-- — the anon key in the browser can do nothing here except on behalf of
-- whoever is signed in.
-- ---------------------------------------------------------------------

alter table favourites enable row level security;

drop policy if exists "read own favourites"   on favourites;
drop policy if exists "add own favourites"    on favourites;
drop policy if exists "remove own favourites" on favourites;

create policy "read own favourites" on favourites
  for select using (auth.uid() = user_id);

create policy "add own favourites" on favourites
  for insert with check (auth.uid() = user_id);

create policy "remove own favourites" on favourites
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select tablename, policyname from pg_policies
--   where tablename = 'favourites';
--
-- Expect three rows: read, add and remove.
-- ---------------------------------------------------------------------
