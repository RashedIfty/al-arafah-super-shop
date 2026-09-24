-- ---------------------------------------------------------------------
-- Sold out means off the deals and off the offers.
--
-- Run this once in the Supabase SQL editor. Safe to run twice.
--
-- The moment a product is marked sold out, however that happens (the
-- edit form, a stock change, anything else):
--
--   * its Special Offer tick is cleared, and
--   * any Today's Deal & New Arrival entry for it is archived — the same
--     as pressing Remove on it, so it goes to the Archive tab and can be
--     restored from there.
--
-- The shop already hid these from customers; the owner asked that they
-- leave the panel's lists as well, to be added again when the stock is.
--
-- A deal keeps its own copy of the product rather than a link to it, so
-- it is matched the way the shop has always matched them: by name and
-- weight, ignoring case and spacing.
-- ---------------------------------------------------------------------

create or replace function soldout_leaves_offers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tag = 'out' then
    new.is_offer := false;

    if tg_op = 'INSERT' or old.tag is distinct from 'out' then
      update deals
         set archived_at = now()
       where archived_at is null
         and lower(regexp_replace(trim(en), '\s+', ' ', 'g'))
           = lower(regexp_replace(trim(new.en), '\s+', ' ', 'g'))
         and lower(regexp_replace(coalesce(w, ''), '\s+', '', 'g'))
           = lower(regexp_replace(coalesce(new.w, ''), '\s+', '', 'g'));
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists products_soldout_leaves_offers on products;
create trigger products_soldout_leaves_offers
  before insert or update of tag, is_offer on products
  for each row execute function soldout_leaves_offers();

-- What is sold out already -------------------------------------------------
update products set is_offer = false where tag = 'out' and is_offer;

update deals d
   set archived_at = now()
  from products p
 where d.archived_at is null
   and p.tag = 'out' and p.archived_at is null
   and lower(regexp_replace(trim(d.en), '\s+', ' ', 'g'))
     = lower(regexp_replace(trim(p.en), '\s+', ' ', 'g'))
   and lower(regexp_replace(coalesce(d.w, ''), '\s+', '', 'g'))
     = lower(regexp_replace(coalesce(p.w, ''), '\s+', '', 'g'));

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select d.en from deals d join products p
--     on lower(trim(d.en)) = lower(trim(p.en))
--    where d.archived_at is null and p.tag = 'out';
--     → no rows.
-- ---------------------------------------------------------------------
