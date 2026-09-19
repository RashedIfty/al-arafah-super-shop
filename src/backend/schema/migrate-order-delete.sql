/*
 * Removing an order from a list.
 *
 * Two different acts wearing the same word.
 *
 * When the customer removes one, they mean "I do not want to look at
 * this any more". They do not get to delete the shop's record of a
 * sale — somebody could otherwise order, take delivery, and erase the
 * evidence. So their delete hides the order from their own history and
 * leaves the owner's copy untouched. From where they sit it is gone for
 * good: nothing in the site will ever show it to them again.
 *
 * When the owner removes one, it goes to the archive, exactly as a
 * product does. Orders are the shop's books. An order deleted by a
 * misplaced tap on a phone behind a counter has to be recoverable.
 *
 * Neither is a DELETE. Rows stay; two timestamps decide who sees what.
 *
 * Safe to run more than once.
 */

-- The customer's own copy, hidden from them alone.
alter table orders add column if not exists hidden_at timestamptz;

-- The owner's archive, the same idea as products.archived_at.
alter table orders add column if not exists archived_at timestamptz;

comment on column orders.hidden_at is
  'Set when the customer removed this from their own history. The owner still sees it.';
comment on column orders.archived_at is
  'Set when the owner archived it. Recoverable, like an archived product.';

-- The usual reads are "mine, not hidden" and "all, not archived".
create index if not exists orders_mine_live_idx
  on orders(user_id, placed_at desc) where hidden_at is null;

create index if not exists orders_live_idx
  on orders(placed_at desc) where archived_at is null;

/* ------------------------------ policies ------------------------------ */

/*
 * The customer may update their own order, but only to hide it.
 *
 * A policy alone cannot express "only this one column may change" —
 * WITH CHECK sees the finished row, not what it was before. A trigger
 * can see both, so the rule lives there and the policy only decides
 * whose rows are in reach.
 */
drop policy if exists "hide own orders" on orders;
create policy "hide own orders" on orders
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/*
 * Whatever the customer sends, only hidden_at is allowed through.
 *
 * The owner is exempt: is_owner() writes statuses and archived_at all
 * day. For anybody else every other column is reset to what it already
 * was, so an attempt to confirm one's own order, change its total or
 * rewrite the address quietly does nothing rather than erroring — and
 * the one legitimate act, hiding it, still works.
 */
create or replace function orders_customer_may_only_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_owner() then
    return new;
  end if;

  new.status        := old.status;
  new.total         := old.total;
  new.code          := old.code;
  new.user_id       := old.user_id;
  new.name          := old.name;
  new.phone         := old.phone;
  new.postal        := old.postal;
  new.address       := old.address;
  new.note          := old.note;
  new.cancel_reason := old.cancel_reason;
  new.placed_at     := old.placed_at;
  new.confirmed_at  := old.confirmed_at;
  new.dispatched_at := old.dispatched_at;
  new.delivered_at  := old.delivered_at;
  new.cancelled_at  := old.cancelled_at;
  new.archived_at   := old.archived_at;   -- the owner's archive, not theirs

  return new;
end;
$$;

drop trigger if exists orders_customer_guard on orders;
create trigger orders_customer_guard
  before update on orders
  for each row execute function orders_customer_may_only_hide();

/* ---------------------------- verification ---------------------------- */
-- select column_name, data_type from information_schema.columns
--   where table_name = 'orders' and column_name in ('hidden_at','archived_at');
