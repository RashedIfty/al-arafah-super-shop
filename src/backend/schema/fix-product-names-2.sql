-- ---------------------------------------------------------------------
-- Two names, checked against the product photos.
--
-- Run once in the Supabase SQL editor. Safe to run twice.
--
--   * Shan "Karachi" Masala: the box says Karahi (the dish, cooked in a
--     karahi pan), not Karachi (the city).
--   * Anchor Milk: the box says Full Cream Milk Powder.
--
-- Al-Flah is left alone: that is how the box spells it.
-- No Today's Deal copies either name, so no deal needs changing.
-- ---------------------------------------------------------------------

begin;

update products
   set en = 'Shan Karahi Masala',
       bn = 'শান কড়াই মসলা',
       ja = 'シャン カラヒマサラ'
 where id = '862b762c-b1e1-41e1-a16d-0c192db29aa0';

update products
   set en = 'Anchor Full Cream Milk Powder',
       bn = 'অ্যাঙ্কর ফুল ক্রিম মিল্ক পাউডার',
       ja = 'アンカー 全脂粉乳'
 where id = 'b3a14fd2-9ba9-4dcc-b834-91fcdc602c5d';

commit;
