-- ---------------------------------------------------------------------
-- The homepage strip comes from the Today's Deals tab alone.
--
-- Until now the strip also took every product ticked "Special Offer",
-- ahead of the tab's own deals, so the owner saw four cards in the tab
-- and twenty on the homepage. The strip now shows only the tab. So that
-- the homepage looks the same the moment this runs, each Special Offer
-- product becomes a deal of type 'offer' at the front of the tab, in
-- the order the strip showed them (category order, then product order),
-- with the existing deals after them in their own order.
--
-- A deal keeps its own copy of name, photo and price, like every deal.
-- The Special Offer tick itself is left alone: it still gives the
-- product its OFFER badge and its place on the Special Offers page.
--
-- Safe to run twice: a product already in the tab (same name and
-- weight, ignoring case and spacing) is not added again.
-- ---------------------------------------------------------------------

begin;

with norm as (
  select lower(regexp_replace(trim(en), '\s+', ' ', 'g')) || '|' ||
         lower(regexp_replace(trim(w), '\s+', '', 'g')) as k
    from deals where archived_at is null
), offers as (
  select p.en, p.bn, p.ja, p.w, p.p, p.was, p.img,
         row_number() over (order by c.sort, p.sort, p.created_at) - 1 as rn
    from products p join categories c on c.id = p.category_id
   where p.is_offer and p.archived_at is null
     and lower(regexp_replace(trim(p.en), '\s+', ' ', 'g')) || '|' ||
         lower(regexp_replace(trim(p.w), '\s+', '', 'g')) not in (select k from norm)
), shifted as (
  update deals set sort = sort + (select count(*) from offers)
   where archived_at is null
  returning 1
)
insert into deals (type, en, bn, ja, w, p, was, img, sort)
select 'offer', en, coalesce(bn, ''), coalesce(ja, ''), coalesce(w, ''), p, coalesce(was, 0), coalesce(img, ''), rn
  from offers
 where (select count(*) from shifted) >= 0;

commit;
