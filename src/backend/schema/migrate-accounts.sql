-- ---------------------------------------------------------------------
-- Customer accounts and favourites.
--
-- Run this once in the Supabase SQL editor. Safe to run twice.
--
-- Sign-in is email and password, handled by Supabase Auth — passwords
-- are hashed on their servers and never reach this code or this
-- database. What is here is only what the shop itself needs to know: the
-- products a customer has saved, and a record of failed sign-in attempts
-- so that guessing at passwords can be slowed down.
-- ---------------------------------------------------------------------

-- ------------------------------ favourites ---------------------------
-- One row per customer per product. The product is referenced rather
-- than copied, so a price change reaches the customer's list without
-- anything updating it, and deleting a product takes its favourites with
-- it rather than leaving rows pointing at nothing.

create table if not exists favourites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id)   on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);

create index if not exists favourites_user_idx
  on favourites(user_id, created_at desc);

-- A customer's list is their own business. These policies are what stop
-- one signed-in customer reading or writing another's.
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


-- --------------------------- sign-in attempts ------------------------
-- Every failed sign-in, kept just long enough to count.
--
-- Supabase already rate-limits its own auth endpoints, but that is a
-- blunt per-project limit; this counts by address so one machine
-- hammering the login cannot lock out the shop's real customers, and so
-- a slow guess at one account is noticed.
--
-- Written by the Edge Function using the service key, never by a
-- browser: there is no policy granting anyone else access, which with
-- RLS on means the anon key can neither read these rows nor forge them.

create table if not exists login_attempts (
  id         bigserial primary key,
  ip         text not null,
  email      text,
  at         timestamptz not null default now()
);

create index if not exists login_attempts_ip_idx    on login_attempts(ip, at desc);
create index if not exists login_attempts_email_idx on login_attempts(email, at desc);

alter table login_attempts enable row level security;
-- No policies on purpose. RLS with no policy denies everyone except the
-- service key, which is exactly who should be writing here.

-- Old rows are of no use once the window has passed. Kept for a day so
-- the table can also answer "was this address a nuisance yesterday".
--
-- Kept for hand use — `select prune_login_attempts();` in the SQL editor
-- clears the table out in one go. The routine tidying does NOT go
-- through here: nothing ever called this, the table grew for months, and
-- pg_cron is not enabled on this project, so the login Edge Function now
-- deletes old rows itself as it writes new ones.
create or replace function prune_login_attempts() returns void
language sql security definer as $$
  delete from login_attempts where at < now() - interval '1 day';
$$;

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select tablename, policyname from pg_policies
--   where tablename in ('favourites','login_attempts');
--
-- Expect three rows, all for favourites. login_attempts having none is
-- the point: nobody but the service key may touch it.
-- ---------------------------------------------------------------------
