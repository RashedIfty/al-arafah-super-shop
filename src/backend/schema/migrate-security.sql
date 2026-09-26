-- ---------------------------------------------------------------------
-- Closing the doors a customer could walk through.
--
-- Run once in the Supabase SQL editor. Safe to run twice.
--
-- Run it BEFORE deploying the code that calls place_order(): the
-- checkout of the new code places orders only through it, and the
-- checkout of the old code stops working the moment this runs (its
-- direct inserts are refused). Deploy straight after.
--
-- What it changes, and why:
--
--   1. Orders are placed by one database function, place_order(). Until
--      now the browser wrote the order and its lines itself, prices
--      included, so anyone who opened the developer tools could buy the
--      whole shop for one yen. The function takes only product ids and
--      quantities and reads every name and price from the products
--      table. It also refuses sold-out and archived products, caps how
--      many orders one account can place in an hour, and mints the
--      order code itself when the one it is given is unusable.
--
--   2. Customers lose their INSERT policies on orders and order_items,
--      so place_order() is the only way in. Reading their own orders and
--      hiding them from their history work exactly as before.
--
--   3. "owner write announcement" said `using (true)`: every signed-in
--      customer could rewrite the banner at the top of the shop. It now
--      asks is_owner(), like every other owner policy.
--
--   4. "owner upload photos" only checked the bucket name, so every
--      signed-in customer could upload, replace or delete product
--      photos. It now asks is_owner() as well.
--
--   5. The three owner views run with their owner's rights (that is how
--      they reach auth.users), so the grants on them matter. They had
--      ALL, and customer_photos is simple enough to be updatable: a
--      customer could insert a profile row through it for any account
--      that did not have one. Now they are select-only, for signed-in
--      users, and the is_owner() inside each still decides what comes
--      back.
--
--   6. Trigger and housekeeping functions were callable over the API by
--      anyone. None of them should be called directly; triggers do not
--      need the grant to fire.
--
--   7. is_owner_email() is dropped. It answered "is this the owner's
--      address?" to anybody who asked, anonymous or not, which let a
--      stranger confirm the owner's login email before trying passwords
--      against it. The panel now signs in first and asks is_owner()
--      afterwards.
-- ---------------------------------------------------------------------

begin;

/* ------------------------------------------------------------------ 1 */

create or replace function public.place_order(
  ship  jsonb,
  items jsonb,
  note  text,
  code  text,
  pay   jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  alphabet   constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code_shape constant text := '^AA-[0-9]{6}-[A-Z2-9]{4}$';

  s_name     text;
  s_phone    text;
  s_postal   text;
  s_address  text;
  s_note     text;

  p_method   text;
  p_amount   integer;
  p_ref      text;

  entry      jsonb;
  pid_text   text;
  pid        uuid;
  q          jsonb;
  wanted     jsonb := '{}'::jsonb;   -- product id -> merged quantity
  prod       products%rowtype;
  lines      jsonb := '[]'::jsonb;
  line_sum   integer := 0;

  use_code   text;
  bytes      bytea;
  tries      integer := 0;
  ord        orders%rowtype;
  result     jsonb;
begin
  if uid is null then
    raise exception 'Please sign in to place an order.';
  end if;

  /* One order at a time per customer. Two taps on the button arrive as
     two requests at once; without this both would pass the rate limit
     and the code check below before either had written anything. */
  perform pg_advisory_xact_lock(hashtextextended('place_order:' || uid::text, 0));

  /* A retry of an order that already went through. The checkout minted
     the code before sending, so a customer whose connection dropped
     after the order was saved sends the same code again. They get the
     order they already placed back, not a second box of rice. */
  code := upper(trim(coalesce(code, '')));
  if code ~ code_shape then
    select * into ord
      from orders o
     where o.code = place_order.code
       and o.user_id = uid
       and o.placed_at > now() - interval '1 hour';

    if found then
      select to_jsonb(ord) || jsonb_build_object('items', coalesce(
               (select jsonb_agg(to_jsonb(i) order by i.id)
                  from order_items i where i.order_id = ord.id),
               '[]'::jsonb))
        into result;
      return result;
    end if;
  end if;

  /* More orders in an hour than any household places. Enough to stop a
     script filling the owner's list with rubbish; not enough to get in
     the way of somebody who forgot the milk. */
  if (select count(*) from orders o
       where o.user_id = uid
         and o.placed_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have placed several orders in the last hour. Please wait a little before placing another, or contact the shop.';
  end if;

  /* ---- where it goes ---- */
  s_name    := trim(coalesce(ship ->> 'full_name', ''));
  s_phone   := trim(coalesce(ship ->> 'phone', ''));
  s_postal  := trim(coalesce(ship ->> 'postal', ''));
  s_address := trim(coalesce(ship ->> 'address', ''));

  if s_name = '' or s_phone = '' or s_postal = '' or s_address = '' then
    raise exception 'Please fill in your name, phone, postal code and address.';
  end if;
  if length(s_name)    > 80  then raise exception 'The name is too long (80 characters at most).'; end if;
  if length(s_phone)   > 20  then raise exception 'The phone number is too long.'; end if;
  if length(s_postal)  > 10  then raise exception 'The postal code is too long.'; end if;
  if length(s_address) > 300 then raise exception 'The address is too long (300 characters at most).'; end if;

  s_note := nullif(trim(coalesce(note, '')), '');
  if length(s_note) > 500 then
    raise exception 'The note is too long (500 characters at most).';
  end if;

  /* ---- how it is paid ---- */
  p_method := pay ->> 'method';
  if p_method is null or p_method not in ('paypay', 'merpay', 'bank', 'cod') then
    raise exception 'Please choose how you will pay.';
  end if;

  if p_method = 'cod' then
    p_amount := null;
    p_ref    := null;
  else
    begin
      p_amount := round((pay ->> 'amount')::numeric);
    exception when others then
      p_amount := null;
    end;
    if p_amount is null or p_amount <= 0 then
      raise exception 'Please enter the amount you sent.';
    end if;

    p_ref := trim(coalesce(pay ->> 'ref', ''));
    if p_ref = '' then
      raise exception 'Please enter the transaction or transfer number.';
    end if;
    if length(p_ref) > 80 then
      raise exception 'The transaction number is too long (80 characters at most).';
    end if;
  end if;

  /* ---- what is in the basket ----
     Only ids and quantities are read from what the browser sent. Any
     name or price that came with them is ignored. */
  if items is null or jsonb_typeof(items) <> 'array' then
    raise exception 'The basket is empty.';
  end if;
  if jsonb_array_length(items) = 0 then
    raise exception 'The basket is empty.';
  end if;
  if jsonb_array_length(items) > 50 then
    raise exception 'Too many different items for one order (50 at most).';
  end if;

  for entry in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(entry) is distinct from 'object' then
      raise exception 'The basket could not be read. Please refresh the page and try again.';
    end if;
    pid_text := entry ->> 'product_id';
    if pid_text is null
       or pid_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'One of the items in the basket is no longer in the shop. Please remove it and try again.';
    end if;

    q := entry -> 'qty';
    if q is null or jsonb_typeof(q) is distinct from 'number' then
      raise exception 'Each item''s quantity must be a whole number from 1 to 99.';
    end if;
    if (q::text)::numeric <> trunc((q::text)::numeric)
       or (q::text)::numeric < 1 or (q::text)::numeric > 99 then
      raise exception 'Each item''s quantity must be a whole number from 1 to 99.';
    end if;

    /* The same product twice becomes one line. */
    pid_text := lower(pid_text);
    wanted := wanted || jsonb_build_object(pid_text,
      least(99, coalesce((wanted ->> pid_text)::integer, 0) + (q::text)::integer));
  end loop;

  for pid_text in select key from jsonb_each(wanted) loop
    pid := pid_text::uuid;
    select * into prod from products where id = pid;

    if not found then
      raise exception 'One of the items in the basket is no longer in the shop. Please remove it and try again.';
    end if;
    if prod.archived_at is not null then
      raise exception '"%" is no longer sold. Please remove it from your basket.', prod.en;
    end if;
    if prod.tag is not distinct from 'out' then
      raise exception '"%" has just sold out. Please remove it from your basket.', prod.en;
    end if;

    lines := lines || jsonb_build_object(
      'product_id', prod.id,
      'name_en',    prod.en,
      'name_bn',    prod.bn,
      'name_ja',    prod.ja,
      'w',          coalesce(prod.w, ''),
      'unit_price', prod.p,
      'qty',        (wanted ->> pid_text)::integer,
      'line_total', prod.p * (wanted ->> pid_text)::integer);
    line_sum := line_sum + prod.p * (wanted ->> pid_text)::integer;
  end loop;

  /* ---- the code ----
     The one the checkout showed the customer, if it is well formed and
     nobody has it; otherwise a fresh one. A code another account already
     used is never reused: it is the reference on somebody else's bank
     transfer. */
  if code ~ code_shape and not exists (select 1 from orders o where o.code = place_order.code) then
    use_code := code;
  end if;

  /* ---- the order ----
     Written with its total already in place. The line inserts below
     fire orders_retotal, whose update the customer guard then hands
     back to the old total (this function runs as the customer as far as
     is_owner() can tell), so the figure written here is the one that
     stays. It is the same sum orders_retotal would arrive at. */
  loop
    if use_code is null then
      bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      use_code := 'AA-' || to_char(now() at time zone 'Asia/Tokyo', 'YYMMDD') || '-'
        || substr(alphabet, get_byte(bytes, 0) % 32 + 1, 1)
        || substr(alphabet, get_byte(bytes, 1) % 32 + 1, 1)
        || substr(alphabet, get_byte(bytes, 2) % 32 + 1, 1)
        || substr(alphabet, get_byte(bytes, 3) % 32 + 1, 1);
    end if;

    begin
      insert into orders (code, user_id, name, phone, postal, address, total, note,
                          status, cancel_reason, placed_at,
                          confirmed_at, dispatched_at, delivered_at, cancelled_at,
                          hidden_at, archived_at,
                          pay_method, pay_amount, pay_ref)
      values (use_code, uid, s_name, s_phone, s_postal, s_address, line_sum, s_note,
              'pending', null, now(),
              null, null, null, null,
              null, null,
              p_method, p_amount, p_ref)
      returning * into ord;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 10 then
        raise exception 'Could not give the order a number. Please try again.';
      end if;
      use_code := null;
    end;
  end loop;

  insert into order_items (order_id, product_id, name_en, name_bn, name_ja, w,
                           unit_price, qty, line_total)
  select ord.id, (l ->> 'product_id')::uuid, l ->> 'name_en', l ->> 'name_bn', l ->> 'name_ja',
         l ->> 'w', (l ->> 'unit_price')::integer, (l ->> 'qty')::integer,
         (l ->> 'line_total')::integer
    from jsonb_array_elements(lines) as l;

  select * into ord from orders where id = ord.id;

  select to_jsonb(ord) || jsonb_build_object('items', coalesce(
           (select jsonb_agg(to_jsonb(i) order by i.id)
              from order_items i where i.order_id = ord.id),
           '[]'::jsonb))
    into result;
  return result;
end;
$$;

/* Signed-in customers only. The default privileges on this project hand
   every new function to anon as well, so it is taken back explicitly. */
revoke all on function public.place_order(jsonb, jsonb, text, text, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, text, text, jsonb) to authenticated;

/* ------------------------------------------------------------------ 2 */

drop policy if exists "place own orders"      on public.orders;
drop policy if exists "place own order items" on public.order_items;

/* ------------------------------------------------------------------ 3 */

drop policy if exists "owner write announcement" on public.announcement;
create policy "owner write announcement" on public.announcement
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

/* ------------------------------------------------------------------ 4 */

/* Skipped where there is no storage schema, which is only ever a test
   database; every Supabase project has one. */
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'drop policy if exists "owner upload photos" on storage.objects';
    execute $p$
      create policy "owner upload photos" on storage.objects
        for all to authenticated
        using (bucket_id = 'product-photos' and public.is_owner())
        with check (bucket_id = 'product-photos' and public.is_owner())
    $p$;
  end if;
end $$;

/* ------------------------------------------------------------------ 5 */

revoke all on public.customer_directory from anon, authenticated;
revoke all on public.restock_board      from anon, authenticated;
revoke all on public.customer_photos    from anon, authenticated;

grant select on public.customer_directory to authenticated;
grant select on public.restock_board      to authenticated;
grant select on public.customer_photos    to authenticated;

/* A barrier keeps the planner from running a caller's own conditions
   before the view's is_owner() test, where a cleverly written one could
   learn about rows it was never going to be shown. */
alter view public.customer_photos set (security_barrier = true);

/* ------------------------------------------------------------------ 6 */

/* Any signature, and only those that exist: a function that was never
   created on this project is simply passed over. is_owner() and
   reorder_products() are left alone — policies, views and the panel
   call them. */
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('prune_login_attempts', 'orders_retotal',
                         'orders_customer_may_only_hide', 'order_items_owner_only_rejects',
                         'restock_customer_may_only_reask', 'restock_follow_stock',
                         'restock_only_when_out', 'addresses_keep_one_default',
                         'addresses_promote_after_delete', 'bump_shop_version',
                         'soldout_leaves_offers')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

/* ------------------------------------------------------------------ 7 */

do $$
begin
  if to_regprocedure('public.is_owner_email(text)') is not null then
    revoke all on function public.is_owner_email(text) from public, anon, authenticated;
  end if;
end $$;
drop function if exists public.is_owner_email(text);

commit;

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select proname, proacl from pg_proc
--    where proname in ('place_order', 'is_owner_email', 'orders_retotal');
--     → place_order granted to authenticated (and postgres, service_role)
--       but not anon; orders_retotal with no anon or authenticated;
--       no is_owner_email row at all.
--
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('orders', 'order_items')
--    order by 1, 2;
--     → no "place own orders" and no "place own order items".
--
--   select policyname, qual, with_check from pg_policies
--    where policyname in ('owner write announcement', 'owner upload photos');
--     → both mention is_owner().
--
--   select table_name, grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_name in ('customer_directory', 'restock_board', 'customer_photos')
--      and grantee in ('anon', 'authenticated');
--     → three rows, all authenticated | SELECT.
--
-- Then place a test order in the shop, and check the owner's panel shows
-- it with the right prices and total.
-- ---------------------------------------------------------------------
