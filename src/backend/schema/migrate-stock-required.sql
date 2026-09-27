-- ---------------------------------------------------------------------
-- Every product is in stock or out of stock. Nothing in between.
--
-- The panel used to offer a third choice, "Don't say", and picked it by
-- default, so products added in a hurry went up with no stock status at
-- all. That choice is gone from the panel (a new product starts In
-- stock), and this makes the database agree:
--
--   1. products with no status are marked in stock;
--   2. a new row is in stock unless it says otherwise;
--   3. the column can only ever hold 'in' or 'out'.
--
-- Safe to run twice. All or nothing.
-- ---------------------------------------------------------------------

begin;

update products set tag = 'in'
 where tag is null or tag not in ('in', 'out');

alter table products alter column tag set default 'in';
alter table products alter column tag set not null;

alter table products drop constraint if exists products_tag_in_or_out;
alter table products add constraint products_tag_in_or_out
  check (tag in ('in', 'out'));

commit;
