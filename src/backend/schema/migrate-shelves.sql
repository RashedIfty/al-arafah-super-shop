-- ---------------------------------------------------------------------
-- Shelves, and three new categories.
--
-- Run this once in the Supabase SQL editor before deploying the branch.
-- It is safe to run twice: every statement checks first.
--
-- Two things happen here.
--
-- 1. Products gain two flags, is_new and is_popular. These are shelves —
--    extra places a product appears — not categories. A product keeps
--    the one category it lives in and can sit on both shelves, or
--    neither.
--
-- 2. The row with id 'others' stops being Countrywise. Countrywise was
--    only ever a row so the owner could give it a name and a picture,
--    and being a row is what kept letting it turn up as somewhere a
--    product could be filed. It is now defined in the code
--    (src/features/catalog/shelves.js) with no row at all, which frees
--    'others' to become the real Others category the shop wanted.
-- ---------------------------------------------------------------------

-- 1. the two shelf flags -------------------------------------------------
alter table products add column if not exists is_new     boolean not null default false;
alter table products add column if not exists is_popular boolean not null default false;

create index if not exists products_new_idx
  on products(sort) where is_new and archived_at is null;
create index if not exists products_popular_idx
  on products(sort) where is_popular and archived_at is null;

-- 2. 'others' becomes a real category ------------------------------------
-- Its old picture was the Countrywise tile, which now ships with the
-- code, so the row takes the Others logo instead.
update categories
   set en  = 'Others',
       bn  = 'অন্যান্য',
       ja  = 'その他',
       img = '/images/categories/others-cat.jpg'
 where id = 'others';

-- 3. the two brand-new categories ----------------------------------------
insert into categories (id, icon, img, en, bn, ja, sort)
values
  ('oil', '', '/images/categories/oil.jpg',
   'Oil', 'তেল', '油', 10),
  ('turkish-kabab', '', '/images/categories/turkish-kabab.jpg',
   'Turkish Kabab', 'তুর্কি কাবাব', 'トルコケバブ', 11)
on conflict (id) do nothing;

-- 4. put them in a sensible order ----------------------------------------
-- Others belongs at the end: it is where anything that fits nowhere else
-- goes, so it should not sit between two real categories.
update categories set sort = 9  where id = 'oil';
update categories set sort = 10 where id = 'turkish-kabab';
update categories set sort = 11 where id = 'others';

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select id, en, sort from categories where archived_at is null
--   order by sort;
--
-- Expect twelve rows ending in oil, turkish-kabab, others — and no row
-- called Countrywise.
-- ---------------------------------------------------------------------
