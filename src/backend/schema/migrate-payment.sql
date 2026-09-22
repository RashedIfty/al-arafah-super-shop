/*
 * How an order was paid.
 *
 * Until now the site never mentioned money: the customer ordered, the
 * owner rang, and the two of them settled it. The shop now takes PayPay,
 * Merpay / d払い and bank transfer, paid before the order is placed, and
 * the customer tells the site what they sent and the transaction number
 * so the owner can match it against the app. Cash on delivery stays for
 * customers who ring first.
 *
 * Three columns, all written by the customer at the moment of ordering
 * and never by them again: the guard trigger below hands the three back
 * to their old values on any later update that is not the owner's.
 *
 * Safe to run more than once.
 */

-- ============================ the columns =============================

alter table orders
  add column if not exists pay_method text not null default 'cod',
  add column if not exists pay_amount int,
  add column if not exists pay_ref    text;

comment on column orders.pay_method is
  'paypay | merpay | bank | cod. Chosen by the customer at checkout.';
comment on column orders.pay_amount is
  'What the customer says they sent, in yen. Null for cash on delivery.';
comment on column orders.pay_ref is
  'The transaction or transfer number the customer typed, for the owner to match.';

/* Constraints are added under a fresh name only if absent, so a second
   run does not fail on the first run's work. */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_pay_method') then
    alter table orders add constraint orders_pay_method
      check (pay_method in ('paypay','merpay','bank','cod'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_pay_amount_sane') then
    alter table orders add constraint orders_pay_amount_sane
      check (pay_amount is null or pay_amount >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_pay_ref_len') then
    alter table orders add constraint orders_pay_ref_len
      check (pay_ref is null or length(pay_ref) between 1 and 80);
  end if;
end $$;

-- ============================== the guard =============================

/*
 * The customer's one permitted edit is still hiding the order. The
 * function is recreated whole rather than patched, so what it resets is
 * in one place to read; the three payment columns join the list.
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

  -- What they said they paid is said once, when ordering.
  new.pay_method    := old.pay_method;
  new.pay_amount    := old.pay_amount;
  new.pay_ref       := old.pay_ref;

  return new;
end;
$$;

drop trigger if exists orders_customer_guard on orders;
create trigger orders_customer_guard
  before update on orders
  for each row execute function orders_customer_may_only_hide();

/* ---------------------------- verification ---------------------------- */
-- select column_name, data_type, column_default from information_schema.columns
--   where table_name = 'orders' and column_name like 'pay_%';
-- select conname from pg_constraint where conname like 'orders_pay_%';
