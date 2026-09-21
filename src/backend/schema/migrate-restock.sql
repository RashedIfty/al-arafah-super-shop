/*
 * "Tell me when it is back."
 *
 * A customer who finds something sold out has nowhere to put that wish,
 * and the owner has no idea which of his empty shelves people are
 * actually asking after. One row records both.
 *
 * Only for products already on the shelf and marked out of stock — this
 * is not a suggestion box for things the shop has never carried.
 *
 * Safe to run more than once.
 */

create table if not exists restock_requests (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id)   on delete cascade,
  created_at timestamptz not null default now(),

  /* Set when the owner has the thing back in and has told everybody.
     Kept rather than deleted: how long people waited is worth knowing,
     and it is what stops the same customer being emailed twice. */
  done_at    timestamptz,

  /* One ask per person per product. Pressing the button again is not an
     error and not a second request — it simply does nothing, so the
     count means how many people want this rather than how many times
     one impatient person pressed. */
  primary key (user_id, product_id)
);

/* The owner's list is always "what is still outstanding". */
create index if not exists restock_open_idx
  on restock_requests(created_at desc) where done_at is null;

comment on table restock_requests is
  'Customers waiting for a sold-out product to come back.';

/* ------------------------------- rules -------------------------------- */

alter table restock_requests enable row level security;

drop policy if exists "read own restock"     on restock_requests;
drop policy if exists "add own restock"      on restock_requests;
drop policy if exists "withdraw own restock" on restock_requests;
drop policy if exists "owner reads restock"  on restock_requests;
drop policy if exists "owner clears restock" on restock_requests;

create policy "read own restock" on restock_requests
  for select to authenticated using (auth.uid() = user_id);

create policy "add own restock" on restock_requests
  for insert to authenticated with check (auth.uid() = user_id);

create policy "withdraw own restock" on restock_requests
  for delete to authenticated using (auth.uid() = user_id);

create policy "owner reads restock" on restock_requests
  for select to authenticated using (is_owner());

create policy "owner clears restock" on restock_requests
  for update to authenticated using (is_owner()) with check (is_owner());

/*
 * An upsert is an insert that may become an update, and Postgres asks
 * for both permissions before it will try. Without this a second press
 * of the button is refused outright — which is the one thing it must
 * never be, since the customer has done nothing wrong by pressing it
 * again. They may only touch their own row, and the only column they
 * could change is one they already set.
 */
drop policy if exists "reask own restock" on restock_requests;
create policy "reask own restock" on restock_requests
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

/*
 * A policy cannot say "only this column", so the rule that a customer
 * may re-ask but not decide their own request has been dealt with lives
 * in a trigger, which can see the row before and after.
 *
 * It holds against the superuser too — is_owner() is false for a direct
 * psql connection — so clearing done_at by hand means disabling this
 * first. That is the correct trade: the guard is not bypassable by
 * whoever happens to have the database password.
 */
create or replace function restock_customer_may_only_reask()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_owner() then
    return new;
  end if;
  new.done_at    := old.done_at;      -- only the owner clears a request
  new.created_at := old.created_at;   -- and the clock is not theirs to set
  return new;
end;
$$;

drop trigger if exists restock_customer_guard on restock_requests;
create trigger restock_customer_guard
  before update on restock_requests
  for each row execute function restock_customer_may_only_reask();

/* ------------------------- the owner's board -------------------------- */

/*
 * Everything the owner needs on one row: who asked, how to reach them,
 * and what for.
 *
 * The name and phone are in profiles and the email is in auth.users,
 * which no customer may read. A security definer view reaches across
 * both and then answers only the owner — so the join happens in one
 * place rather than being assembled in the browser from tables the
 * browser cannot see.
 */
create or replace view restock_board
with (security_invoker = false) as
  select r.user_id,
         r.product_id,
         r.created_at,
         r.done_at,
         coalesce(p.full_name, split_part(u.email, '@', 1)) as customer,
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

/* ---------------------------- verification ---------------------------- */
-- select count(*) as open_requests from restock_requests where done_at is null;
-- select * from restock_board order by created_at desc;
