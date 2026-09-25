-- ---------------------------------------------------------------------
-- Categories, names and weights, tidied in one go.
--
-- Run once in the Supabase SQL editor. Safe to run twice. All or
-- nothing: if any line fails, nothing changes.
--
-- 1. Six products moved to the category they belong in. Each goes to
--    the end of it; drag it in the panel to place it elsewhere.
-- 2. Three names corrected, in English, Bangla and Japanese.
-- 3. Weights written one way throughout: 500g, 1 kg, 350 ml, 1L, 4 pcs.
-- 4. The Dal Paratha deal takes its product's new weight, so the two
--    still match.
--
-- Prices, photos, stock and order are not touched.
-- ---------------------------------------------------------------------

begin;

-- 1. Categories ---------------------------------------------------------

-- Mustard seeds are a spice, not a lentil.
update products   -- Mustard Seed (Yellow) (100g): lentils -> masala
   set category_id = 'masala',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'masala')
 where id = 'a27522be-9540-4fbd-813d-76064f066298' and category_id <> 'masala';

update products   -- Mustard Seed (Black) (100g): lentils -> masala
   set category_id = 'masala',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'masala')
 where id = 'c1fb6f39-8d94-4c63-bcac-eca8c20433d4' and category_id <> 'masala';

-- Coconut sugar is for cooking, not a snack.
update products   -- Coconut Sugar (300g): snacks -> cooking
   set category_id = 'cooking',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'cooking')
 where id = '15cade44-7f56-4e36-815f-afd4dbbe863a' and category_id <> 'cooking';

-- Chia seeds sit with the nuts and dry fruits.
update products   -- Chia Seed India Gate (300 g): cooking -> nuts
   set category_id = 'nuts',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'nuts')
 where id = '82e73e52-6a49-4e3e-aa9b-29f2d9568106' and category_id <> 'nuts';

-- Khichuri mix is rice and lentils: cooking.
update products   -- Radhuni Khichuri Mix (500g): masala -> cooking
   set category_id = 'cooking',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'cooking')
 where id = '5dda8dcc-f20f-49ba-aa38-b066109a5960' and category_id <> 'cooking';

-- Firni is a dessert.
update products   -- Radhuni Firni Mix (150g): masala -> snacks
   set category_id = 'snacks',
       sort = (select coalesce(max(sort), 0) + 1 from products where category_id = 'snacks')
 where id = 'dbb49c69-4a33-40e2-9ac6-ad1aa0a33fef' and category_id <> 'snacks';

-- 2. Names --------------------------------------------------------------

update products   -- was: Indain Gate Basmati Rice Premium Indiagate
   set en = 'India Gate Basmati Rice Premium', bn = 'ইন্ডিয়া গেট বাসমতি চাল প্রিমিয়াম', ja = 'インディアゲート バスマティライス プレミアム'
 where id = 'e4ac68f8-6e61-447e-b917-20c485e3a7af';

update products   -- was: Basmati Rice India Gate Daily Premium
   set en = 'India Gate Basmati Rice Daily Premium', bn = 'ইন্ডিয়া গেট বাসমতি চাল ডেইলি প্রিমিয়াম', ja = 'インディアゲート バスマティライス デイリープレミアム'
 where id = '4a4b4ea2-1275-4445-b657-02f631b9e686';

update products   -- was: Sadia Whole Chicken (1200g)
   set en = 'Sadia Whole Chicken', bn = 'সাদিয়া আস্ত মুরগি', ja = 'サディア 丸鶏'
 where id = 'df122f91-4146-46e4-8969-006991f6e6b4';

-- 3. Weights ------------------------------------------------------------

update products set w = '190g' where id = '4c05a585-00ff-49b8-9533-08a5520380cc';   -- Soan Papdi (Mithai): 190 g
update products set w = '90g' where id = 'c15cbb97-7ebf-4907-bfe1-9d1b67b57764';   -- Enchanteur Deluxe Perfumed Soap (Romantic): 90 g
update products set w = '400g' where id = 'f7117890-9584-4af1-a15b-d7016cd45a27';   -- Pond's Dreamflower Talcum Powder: 400 g
update products set w = '330 ml' where id = 'de3ffdac-70cc-4de0-918c-9ceca7573f34';   -- Yooh Power Energy Drink: 330ml
update products set w = '1 pc' where id = '325a1310-8d34-4960-9ab4-1fd4669f9b1b';   -- Fresh Apple: 1pc
update products set w = '5L' where id = '2d44fa18-8002-4077-9bd9-04ddde35c6c4';   -- Sunflower Oil: 5 Litter
update products set w = '250g' where id = '08ef4ee4-f421-48ba-9554-1fb35c4dacf8';   -- Soan Papdi (United King): 250 g
update products set w = '90g' where id = '0ec4ce88-de95-4a25-8c0f-27033b24368b';   -- Enchanteur Deluxe Perfumed Soap (Charming): 90 g
update products set w = '90g' where id = '8129f3dd-b2cf-4ff8-985a-781d348a190b';   -- Enchanteur Deluxe Perfumed Soap (Magic): 90 g
update products set w = '1200g' where id = '8f31dcd0-9c67-4751-bbf4-94486ac3141b';   -- Watermelon: 1200G
update products set w = '90g' where id = 'd8e90bdc-f53f-4b4d-857d-0a399706ce5a';   -- Swadeshi Rani Sandalwood Herbal Care Bar: 90 g
update products set w = '500g' where id = 'e0712514-581d-40c2-ac12-bb85f4a048d8';   -- Coconut Oil (Organic): 500 gram
update products set w = '4 pcs' where id = '803c6d05-cab0-4483-951c-2e3347d72089';   -- Dal Paratha: 4pc
update products set w = '300g' where id = '82e73e52-6a49-4e3e-aa9b-29f2d9568106';   -- Chia Seed India Gate: 300 g
update products set w = '5 pcs' where id = '7665281b-f552-4bf0-8720-32e74a8bc5a3';   -- Plain Paratha: 5 Pieces
update products set w = '150g' where id = '56eeb90c-fee0-4723-9edf-d0c167cf5c10';   -- Dettol Original: 150 g
update products set w = '510g' where id = '3907768d-5613-4ebc-82eb-c5da3f532109';   -- Kao White Soap, Regular Size, 6-Pack: 510 g
update products set w = '1 lb' where id = 'fdab6f51-ba38-4b4d-964f-0350d2c0b0d9';   -- Chocolate Cake: 1 POUND
update products set w = '510g' where id = '29e7dbbe-1914-4711-ae4a-e344f6beb6f6';   -- Kao White Soap, 6-Pack, Aromatic Rose Scent: 510 g
update products set w = '780g' where id = '392b3a73-b3c4-4e03-99ad-4d2e56635468';   -- Palm Soup Base: 780gm
update products set w = '1 pack' where id = '4ac06cf8-684e-45e9-9859-61493e2a3be2';   -- Bogurar Doi: 1 P
update products set w = '130g' where id = 'ad4dbdce-9305-4a23-bc03-813e60eb2345';   -- Kao White Soap: 130 g
update products set w = '1 kg' where id = 'cd467294-dd4f-4256-a6e6-43660bf3977f';   -- Masoor Dal with Skin: 1 Kg
update products set w = '250 ml' where id = 'd79c91e7-144b-4c7f-9cdf-04bca7352afd';   -- Dettol Liquid: 250 Gram
update products set w = '1L' where id = 'ed20ca73-79d1-4a9f-a517-d3475310df4d';   -- Hajji Baba Pomegranate Juice: 1 L
update products set w = '1 pc' where id = 'a91a622b-dbf6-49f0-93f8-59dbbd72dc66';   -- Fogg Body Spray: 1 p
update products set w = '175 ml' where id = '1f1bd13a-b0a6-4ad9-988f-0c0ed3f46609';   -- Parachute Coconut Hair Oil: 175 ML
update products set w = '400g' where id = 'fe5d8440-07bd-4020-8c7a-9b2625e3d910';   -- Dal Paratha: 400 g
update products set w = '12 pcs' where id = '8435712c-b7a6-4217-9b88-9351bad708a1';   -- Punjabi Samosa: 12 pc
update products set w = '1800g' where id = '093bdd45-df56-4ca6-8791-e04f67c48a45';   -- Whole Duck: 1800
update products set w = '1 kg' where id = 'c58ef615-506a-4c0c-8498-5154a655c592';   -- Padma Split Masoor Dal: 1kg
update products set w = '50g' where id = 'e4a9492f-b3c7-4a89-b1f5-1c77c58e6cf4';   -- Ahmed Seekh Kabab BBQ: 50G
update products set w = '350 ml' where id = 'b69f0f28-ec7f-4510-acac-90ac439243e7';   -- Foco Coconut Juice: 350ml
update products set w = '100g' where id = '9ec0eb0e-3285-4abe-ae4d-45ded1d74cf4';   -- Shan Black Pepper Powder: 100

-- 4. The deal that copies Dal Paratha (4pc) -----------------------------
update deals set w = '4 pcs' where id = 'bd8ac5fd-ccb1-4b50-ba9d-63d26863c22e';

commit;
