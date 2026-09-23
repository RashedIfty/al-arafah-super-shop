-- ---------------------------------------------------------------------
-- Special offers.
--
-- Run this once in the Supabase SQL editor BEFORE deploying the code
-- that uses it: the owner's panel saves this column with every product,
-- and until it exists every product save would fail. Safe to run twice.
--
-- A third shelf flag beside is_new and is_popular. A product with it
-- set shows on the Special Offers page and at the front of the Today's
-- Deal & New Arrival strip on the homepage. Unset, it is an ordinary
-- product again and is gone from both. Nothing is copied anywhere, so
-- there is nothing to clean up: both places read the flag itself.
-- ---------------------------------------------------------------------

alter table products add column if not exists is_offer boolean not null default false;

create index if not exists products_offer_idx
  on products(sort) where is_offer and archived_at is null;

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_name = 'products' and column_name = 'is_offer';
--
-- Expect one row: is_offer | boolean | false
-- ---------------------------------------------------------------------
