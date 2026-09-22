/*
 * A customer becomes a person.
 *
 * Until now the shop knew four things about a customer — name, phone,
 * postcode, address — and learned them only at the checkout. One
 * address, no photo, nothing to look at between orders.
 *
 * Two changes. profiles becomes optional and grows a photo: a customer
 * may put up a picture and a name before they have ever ordered, so the
 * columns the checkout used to demand may now be empty. And addresses
 * move to a table of their own, several per customer, each with a label
 * and its own phone, one of them the default the checkout fills in.
 *
 * Safe to run more than once.
 */

-- ============================== profiles ==============================
-- Optional now, and carries the photo. The old address columns are
-- retired rather than dropped: nothing writes them once the new code is
-- live, and a column that can still be read is a column that can be
-- checked against the backfill below. A later migration drops them.

alter table profiles add column if not exists avatar_url text;

alter table profiles alter column full_name drop not null;
alter table profiles alter column phone     drop not null;
alter table profiles alter column postal    drop not null;
alter table profiles alter column address   drop not null;

comment on column profiles.phone   is 'The account''s main mobile. Each address carries its own as well.';
comment on column profiles.postal  is 'Retired: addresses live in the addresses table. Kept until that has proven itself.';
comment on column profiles.address is 'Retired: see addresses.';

/* The check constraints on phone and postal pass a NULL, as SQL checks
   do, so they stay exactly as they are. */

-- ============================= addresses ==============================
-- Where the box goes. Several per customer, one of them the default.

create table if not exists addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,

  /* "Home", "Work", "My parents' place" — whatever they call it. Free
     text rather than a fixed list, because the fixed list is always
     one entry short. */
  label      text not null default 'Home',

  /* Its own phone: the driver rings the number for the place they are
     going, not the one on the account. */
  phone      text not null,
  postal     text not null,
  address    text not null,

  is_default boolean not null default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint addresses_phone_jp  check (phone  ~ '^0[789]0[0-9]{8}$'),
  constraint addresses_postal_jp check (postal ~ '^[0-9]{3}-[0-9]{4}$'),
  constraint addresses_label_len check (length(label) between 1 and 40)
);

comment on table addresses is
  'A customer''s delivery addresses. One is the default the checkout fills in.';

create index if not exists addresses_user_idx on addresses(user_id, created_at);

/* At most one default per customer, enforced by the table. The trigger
   below keeps this from ever being hit in normal use; the index is what
   makes it impossible rather than merely unlikely. */
create unique index if not exists addresses_one_default_idx
  on addresses(user_id) where is_default;

/*
 * One default, kept by the table itself.
 *
 * Done here rather than in the browser because the browser has no
 * transaction: "clear the old default, then set the new one" is two
 * requests, and a dropped connection between them leaves a customer
 * with none. Here it is one row change and the rest follows.
 *
 * Security definer so the sibling update is not itself subject to the
 * caller's row policy. It only ever touches rows with new.user_id, so
 * nothing is reachable that the caller could not reach anyway.
 */
create or replace function addresses_keep_one_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* The first address a customer has is their default whether they
     ticked the box or not — a checkout with one address to choose from
     should not have to ask which. */
  if tg_op = 'INSERT' and not exists
       (select 1 from addresses where user_id = new.user_id) then
    new.is_default := true;
  end if;

  if new.is_default then
    update addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists addresses_one_default on addresses;
create trigger addresses_one_default
  before insert or update on addresses
  for each row execute function addresses_keep_one_default();

/* Deleting the default hands it to the oldest address left, so a
   customer who removes one is never left with several and no default. */
create or replace function addresses_promote_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update addresses
       set is_default = true
     where id = (select id from addresses
                  where user_id = old.user_id
                  order by created_at
                  limit 1);
  end if;
  return old;
end;
$$;

drop trigger if exists addresses_promote on addresses;
create trigger addresses_promote
  after delete on addresses
  for each row execute function addresses_promote_after_delete();

-- ------------------------------- rules --------------------------------

alter table addresses enable row level security;

drop policy if exists "read own addresses"   on addresses;
drop policy if exists "add own addresses"    on addresses;
drop policy if exists "update own addresses" on addresses;
drop policy if exists "remove own addresses" on addresses;

create policy "read own addresses" on addresses
  for select to authenticated using (auth.uid() = user_id);

create policy "add own addresses" on addresses
  for insert to authenticated with check (auth.uid() = user_id);

create policy "update own addresses" on addresses
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "remove own addresses" on addresses
  for delete to authenticated using (auth.uid() = user_id);

/* No owner policy, on purpose. An order copies the address at the moment
   it is placed, so the owner reads it from the order and never needs the
   live one — and a customer's address book is theirs. */

-- ------------------------------ backfill ------------------------------
-- Every customer who already gave an address at the checkout gets it
-- back as their one address, labelled Home and made the default.
-- Guarded, so running this file again adds nothing.

insert into addresses (user_id, label, phone, postal, address, is_default)
select p.user_id, 'Home', p.phone, p.postal, p.address, true
  from profiles p
 where p.phone   is not null
   and p.postal  is not null
   and p.address is not null
   and not exists (select 1 from addresses a where a.user_id = p.user_id);

-- ---------------------------- the owner's board -----------------------
-- Unchanged but for one detail: a name may now be missing, and an empty
-- string is as missing as a null. Otherwise as in migrate-restock.sql.

create or replace view restock_board
with (security_invoker = false) as
  select r.user_id,
         r.product_id,
         r.created_at,
         r.done_at,
         coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)) as customer,
         p.phone,
         u.email,
         pr.en, pr.bn, pr.ja, pr.w, pr.img, pr.tag
    from restock_requests r
    join auth.users u   on u.id = r.user_id
    left join profiles p on p.user_id = r.user_id
    join products pr    on pr.id = r.product_id
   where is_owner();

revoke all on restock_board from public, anon;
grant select on restock_board to authenticated;

/* ---------------------------- verification ---------------------------
 * -- every complete profile became an address, and none became two
 * select (select count(*) from profiles
 *          where phone is not null and postal is not null and address is not null)
 *          as complete_profiles,
 *        (select count(*) from addresses) as addresses;
 *
 * -- nobody has other than exactly one default
 * select user_id, count(*) filter (where is_default) as defaults
 *   from addresses group by user_id
 * having count(*) filter (where is_default) <> 1;
 * ------------------------------------------------------------------- */
