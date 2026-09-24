-- ---------------------------------------------------------------------
-- Put a category's products in a given order, in one request.
--
-- Run this once in the Supabase SQL editor BEFORE deploying the code
-- that uses it: dragging a product card in the panel calls it. Safe to
-- run twice.
--
-- The panel sends the category's product ids in their new order; each
-- product's sort becomes its place in that list (1, 2, 3 …), which is
-- the order the shop shows them in. One statement rather than one
-- update per product: a category of three hundred would otherwise be
-- three hundred requests for a single drag.
--
-- security invoker: it runs with the caller's own rights, so the
-- existing "owner write" policy on products decides who may reorder.
-- Anyone else's call changes no rows.
-- ---------------------------------------------------------------------

create or replace function reorder_products(ids uuid[]) returns void
language sql security invoker set search_path = public as $$
  update products p
     set sort = o.n
    from unnest(ids) with ordinality as o(id, n)
   where p.id = o.id
     and p.sort is distinct from o.n;
$$;

revoke all on function reorder_products(uuid[]) from public, anon;
grant execute on function reorder_products(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select proname from pg_proc where proname = 'reorder_products';
--     → one row.
-- ---------------------------------------------------------------------
