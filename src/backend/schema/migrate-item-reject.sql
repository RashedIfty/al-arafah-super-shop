/*
 * "We have the rice but not the fish."
 *
 * Until now an order was all or nothing: the owner confirmed it or he
 * rejected it. But a shop runs out of one thing, not of everything, and
 * rejecting a whole order because one line is short means the customer
 * loses the four items that were on the shelf.
 *
 * A line can now be refused on its own. The order goes ahead with what
 * is left, and the total follows.
 *
 * Safe to run more than once.
 */

-- ========================== the rejected flag =========================

alter table order_items
  add column if not exists rejected     boolean not null default false,
  add column if not exists reject_note  text,
  add column if not exists rejected_at  timestamptz;

comment on column order_items.rejected is
  'The shop could not supply this line. It stays on the order, struck through.';

/* The line is kept rather than deleted, so the customer can see what was
   dropped and why. An invoice that quietly lists four items when five
   were ordered is how a shop loses an argument it should have won. */

-- ============================ the new total ===========================

/*
 * The order total is the sum of the lines still standing.
 *
 * Computed here rather than in the browser. The customer's page, the
 * owner's panel and the printed invoice all ask three different
 * questions about the same order, and three separate sums is three
 * chances to disagree about what is owed. The database settles it.
 */
create or replace function orders_retotal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid := coalesce(new.order_id, old.order_id);
begin
  update orders
     set total = coalesce((
           select sum(line_total)
             from order_items
            where order_id = oid
              and not rejected
         ), 0)
   where id = oid;

  return null;                 -- after trigger: the return is ignored
end;
$$;

drop trigger if exists order_items_retotal on order_items;
create trigger order_items_retotal
  after insert or update or delete on order_items
  for each row execute function orders_retotal();

/* ---------------------------------------------------------------------
 * Only the owner may refuse a line.
 *
 * order_items had no update policy at all — nobody could change a line
 * once placed, which was right when a line was immutable. Now the owner
 * needs exactly one power over it, and the customer still needs none:
 * a customer who could set `rejected` could delete items from their own
 * bill after the shop had packed them.
 * ------------------------------------------------------------------- */

drop policy if exists "owner rejects items" on order_items;
create policy "owner rejects items" on order_items
  for update to authenticated
  using (is_owner()) with check (is_owner());

/*
 * A customer may not touch these columns even if a policy is loosened
 * later by mistake. The trigger sees the row before and after, which a
 * policy cannot, and it holds against the database password too —
 * is_owner() is false on a direct psql connection.
 */
create or replace function order_items_owner_only_rejects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_owner() or auth.role() = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;

  new.rejected    := old.rejected;
  new.reject_note := old.reject_note;
  new.rejected_at := old.rejected_at;
  return new;
end;
$$;

drop trigger if exists order_items_reject_guard on order_items;
create trigger order_items_reject_guard
  before update on order_items
  for each row execute function order_items_owner_only_rejects();

/* ---------------------------- verification ---------------------------
 * -- an order with one line refused
 * select o.code, o.total,
 *        count(*) filter (where not i.rejected) as kept,
 *        count(*) filter (where i.rejected)     as refused
 *   from orders o join order_items i on i.order_id = o.id
 *  group by o.code, o.total
 *  order by o.code;
 * ------------------------------------------------------------------- */
