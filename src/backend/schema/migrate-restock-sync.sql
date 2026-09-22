/*
 * The waiting list follows the shelf.
 *
 * "Tell me when it's back" is a question about one product's stock, so
 * the answer belongs to that product's stock — not to whichever button
 * the owner happened to press. Until now only the Restock tab's own
 * "Back in stock" button closed the requests. Putting the same product
 * back by editing it in the Products tab set the shelf mark and left
 * every request open, so the owner saw people still waiting for
 * something already on the shelf, and pressing the button then emailed
 * them about news they had had for days.
 *
 * Two halves, both in the database so they hold whichever route is
 * taken — the panel, a later feature, or a hand-written SQL fix:
 *
 *   1. A product going back in stock closes its open requests.
 *   2. A request may not be opened for something already in stock.
 *
 * What is NOT done here: sending the email. That stays with the owner's
 * button, because only a person should decide to write to customers,
 * and the function that sends it needs to know who it reached. Closing
 * quietly is the right outcome for the other routes: the shelf changed,
 * nobody was promised a message, and the list tells the truth again.
 *
 * Safe to run more than once.
 */

-- ====================== 1. the shelf closes the list ==================

/*
 * Only on the edge — 'out' to 'in'. A product saved twice while in
 * stock must not keep stamping rows that are already closed, and an
 * update that does not touch the tag must do nothing at all.
 */
create or replace function restock_follow_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tag is distinct from old.tag and new.tag = 'in' then
    /* Say who is writing.
     *
     * restock_customer_may_only_hide — the guard from migrate-restock-
     * reask.sql — hands done_at back to its old value for anyone who is
     * not the owner or the mailer, which is right for a customer and
     * silently undid this. The shelf is a third legitimate writer, so it
     * announces itself and the guard stands aside. Set LOCAL, so it dies
     * with the transaction and cannot be left on. */
    perform set_config('aa.restock_sync', 'on', true);

    update restock_requests
       set done_at = now()
     where product_id = new.id
       and done_at is null;

    perform set_config('aa.restock_sync', '', true);
  end if;

  return new;
end;
$$;

drop trigger if exists products_restock_sync on products;
create trigger products_restock_sync
  after update of tag on products
  for each row execute function restock_follow_stock();

/*
 * The customer guard learns about the shelf.
 *
 * Recreated whole from migrate-restock-reask.sql with one clause added,
 * so the rule about who may write done_at stays readable in one place.
 */
create or replace function restock_customer_may_only_reask()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* The owner through the browser, or the service role — which is the
     function that sends the emails, and the only thing that knows who
     it actually managed to reach. A customer is neither. */
  if is_owner() or auth.role() = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;

  /* The shelf, closing requests because the product came back. Set only
     inside restock_follow_stock() and only for that one statement. */
  if current_setting('aa.restock_sync', true) = 'on' then
    return new;
  end if;

  /*
   * Clearing it is allowed: that is a customer saying "I want this
   * again", which is the whole point of the button and the only way a
   * product that has already come back once can be asked for a second
   * time.
   *
   * Setting it is not. done_at means the shop has dealt with this, and
   * a customer who could write it could take their own request off the
   * owner's list — or, worse, off it quietly, so nobody ever knew they
   * had asked.
   */
  if new.done_at is not null then
    new.done_at := old.done_at;        -- only the shop marks one handled
  end if;

  new.created_at := old.created_at;    -- and the clock is not theirs to set
  return new;
end;
$$;

drop trigger if exists restock_customer_guard on restock_requests;
create trigger restock_customer_guard
  before update on restock_requests
  for each row execute function restock_customer_may_only_reask();

-- =================== 2. nobody waits for what is here =================

/*
 * The storefront already hides the button on anything in stock, but the
 * request is a row a customer can write, and a stale page or a second
 * tab should not be able to add one for something on the shelf.
 *
 * A customer re-asking for a product that went out again is still
 * allowed: that is an update clearing done_at, and the tag is 'out' by
 * then, so this passes it through.
 */
create or replace function restock_only_when_out()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shelf text;
begin
  /* Closing one is always allowed: that is the shelf trigger above, the
     owner's button, or the email function stamping what it sent. */
  if new.done_at is not null then
    return new;
  end if;

  /* The owner and the service role are not the ones this guards. They
     close requests and fix them up; only a customer opening one has to
     be told the thing is already here. */
  if is_owner()
     or auth.role() = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;

  /* An update that leaves done_at null and was already null is not an
     opening either — it is some other column moving. */
  if tg_op = 'UPDATE' and old.done_at is null then
    return new;
  end if;

  select tag into shelf from products where id = new.product_id;

  if shelf is distinct from 'out' then
    raise exception 'That product is in stock'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists restock_requests_stock_guard on restock_requests;
create trigger restock_requests_stock_guard
  before insert or update on restock_requests
  for each row execute function restock_only_when_out();

-- ===================== 3. put today's list right =====================

/*
 * The rows that are already wrong: open requests for products that are
 * back on the shelf. Nobody is emailed about these — they have been
 * closed by the shelf, which is what should have happened when it
 * changed.
 */
/* Announced as the shelf, for the same reason the trigger does: this
   runs in the owner's SQL-editor session, where is_owner() is false —
   that session is a superuser, not a signed-in owner — and the customer
   guard would otherwise hand every done_at straight back. */
do $$
begin
  perform set_config('aa.restock_sync', 'on', true);

  update restock_requests r
     set done_at = now()
    from products p
   where p.id = r.product_id
     and r.done_at is null
     and p.tag is distinct from 'out';

  perform set_config('aa.restock_sync', '', true);
end $$;

/* ---------------------------- verification ----------------------------
 * -- must be zero: nobody waiting for something that is in stock
 * select count(*) from restock_requests r
 *   join products p on p.id = r.product_id
 *  where r.done_at is null and p.tag is distinct from 'out';
 * ------------------------------------------------------------------- */
