/*
 * Asking again, after the thing has been and gone.
 *
 * A customer asked for the Biriyani, the shop got it in, everyone was
 * told, and the requests were stamped done. Then it sold out again — and
 * the same customer pressing the button a second time got nowhere. The
 * row already existed, so the upsert merged into it and left done_at
 * holding last week's timestamp. The button reset itself on the next
 * refresh and the owner's board never showed the request.
 *
 * The guard was the cause. It said a customer may never write done_at,
 * which is right for setting it — nobody should be able to mark their
 * own request handled — but wrong for clearing it. Re-opening a closed
 * request is precisely what asking again means.
 *
 * So the rule becomes: a customer may clear done_at, and may not set it.
 *
 * Safe to run more than once.
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

/* The trigger itself is unchanged; replacing the function is enough.
   Recreated anyway so this file stands alone. */
drop trigger if exists restock_customer_guard on restock_requests;
create trigger restock_customer_guard
  before update on restock_requests
  for each row execute function restock_customer_may_only_reask();

/* ---------------------------- verification ---------------------------
 * -- rows that are closed while the product is still sold out: these are
 * -- the ones that were stuck, and there should be none once a customer
 * -- has re-asked.
 * select p.en, r.created_at, r.done_at
 *   from restock_requests r
 *   join products p on p.id = r.product_id
 *  where r.done_at is not null and p.tag = 'out'
 *  order by r.done_at desc;
 * ------------------------------------------------------------------- */
