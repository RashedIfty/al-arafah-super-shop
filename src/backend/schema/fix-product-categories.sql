-- ---------------------------------------------------------------------
-- Products that were put in the wrong category.
--
-- Run once in the Supabase SQL editor. Safe to run twice.
--
-- All 202 products were read and checked; these are the ones that did
-- not belong where they were. Each goes to the end of its new category
-- (drag it in the panel to place it elsewhere). Names, prices, photos
-- and stock are not touched.
-- ---------------------------------------------------------------------

begin;

-- Mustard seeds are a spice, not a lentil.
update products   -- Mustard Seed (Yellow) (100g)
   set category_id = 'masala',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'masala')
 where id = 'a27522be-9540-4fbd-813d-76064f066298' and category_id <> 'masala';

update products   -- Mustard Seed (Black) (100g)
   set category_id = 'masala',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'masala')
 where id = 'c1fb6f39-8d94-4c63-bcac-eca8c20433d4' and category_id <> 'masala';

-- Coconut sugar is for cooking, not a snack.
update products   -- Coconut Sugar (300g)
   set category_id = 'cooking',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'cooking')
 where id = '15cade44-7f56-4e36-815f-afd4dbbe863a' and category_id <> 'cooking';

-- Chia seeds sit with the nuts and dry fruits.
update products   -- Chia Seed India Gate (300 g)
   set category_id = 'nuts',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'nuts')
 where id = '82e73e52-6a49-4e3e-aa9b-29f2d9568106' and category_id <> 'nuts';

commit;
