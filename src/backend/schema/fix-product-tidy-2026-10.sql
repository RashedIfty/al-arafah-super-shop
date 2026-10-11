begin;
create temp table fx(id uuid, en text, w text, ja text, cat text, old_en text, old_w text) on commit drop;
insert into fx values ('3675036b-e7cd-49aa-9fff-b26e40024bd1', 'Katla Fish Cleaned', NULL, NULL, NULL, 'Katla Fish cleaned', '1 kg');
insert into fx values ('9e4d0191-cafc-4cca-ad93-726885571c46', NULL, '900g (6 pcs)', NULL, NULL, 'Quail Bird', '900g (6picese)');
insert into fx values ('4d06fd14-11a7-47e2-bf83-4ddbe5dcc6e2', NULL, NULL, NULL, 'snacks', 'Radhuni Kheer Mix', '150g');
insert into fx values ('60b9836b-da87-4b46-9109-12dbe5e98b96', NULL, NULL, NULL, 'snacks', 'Radhuni Falooda Mix', '250g');
insert into fx values ('af6e1ea9-451f-4fad-ad2c-9aacf64380d1', 'Basmati Sella Rice (Kaalar)', NULL, NULL, NULL, 'Basmati Sella Rice (Kaalar )', '5 kg');
insert into fx values ('3e694c06-dfd9-4532-a59d-ee30741e19e8', NULL, '5L', NULL, 'oil', 'Zade Sunflower oil', '5 Litter');
insert into fx values ('10fb9a99-6770-4182-a58c-8c903e57553b', NULL, '3L', NULL, NULL, 'Abya Sunflower oil', '3 Ltr');
insert into fx values ('5d655604-f197-4990-b59e-f8ef7eb60e84', NULL, NULL, NULL, 'cooking', 'Condensed Milk', '400g');
insert into fx values ('7258d9be-cea1-4e0c-b5d5-f0979fb8cd6a', NULL, '1L', NULL, NULL, 'Mango Juice', '1000ml');
insert into fx values ('6004fd58-d9f0-447c-b78f-db2f4947e90c', NULL, '1 pc', NULL, NULL, 'Ligion Gold Mehedi', '1 Pcs');
insert into fx values ('bbc148e9-751b-4360-b46e-c3f0e50a6a37', 'Enchanteur Deluxe Soap', NULL, NULL, NULL, 'Delux Enchanter soap', '0');
insert into fx values ('34e1f1e5-871c-4cd0-a380-1c8fa41182b9', 'Vatika Shampoo – Nourish & Protect', NULL, NULL, NULL, 'Vatika Shampoo- Nourish & Protect - 200ml', '200 ml');
insert into fx values ('a1c920a9-db89-4132-8ff1-cfe35fe6807c', 'White Vinegar', NULL, NULL, NULL, 'White Vinegar 白酢', '340 ml');
insert into fx values ('3e71463d-9237-4b7e-aa81-28c687e8b952', 'Hokkaido Milk Powder', '225g', NULL, 'cooking', 'Hokkaido milk powder', '225 gm');
insert into fx values ('65a5a593-65a8-469e-9125-3b8a36ffd3f0', 'G-Food Tokmadana (Basil Seed)', NULL, NULL, NULL, 'Tokmadana || Basil Seed 100gm (G-Food)', '100g');
insert into fx values ('d7545e7c-23da-4fe8-8a1a-5a961bf0f1cf', NULL, '350 ml', NULL, NULL, 'Tamarind Juice', '350ml');
insert into fx values ('749ca5c3-eb89-40b2-a4d8-39ebb7e53d77', NULL, NULL, NULL, 'cooking', 'Anchor Milk (Powder)', '400g');
insert into fx values ('c1b0ccc7-d8c1-4d65-9bbb-2e89d097228a', 'Calin Soap', NULL, NULL, NULL, 'calin soap', '0');
insert into fx values ('ec0acd0a-8828-4eef-b126-c8e519cac56c', 'Hilsha Fish Whole', '1 kg', NULL, NULL, 'Hilash Fish Whole', '1000g');
insert into fx values ('83ac2099-481f-45eb-b4ac-b2a33c81b087', 'Vishal Kalijeera Rice', NULL, NULL, NULL, 'Vishal kalijeera rice', '1 kg');
insert into fx values ('79b77eaa-61f8-4c96-b733-629b180710e7', NULL, NULL, NULL, 'cooking', 'Condensed Milk', '400g');
insert into fx values ('5a693106-f475-4155-9b4e-1377c7721e6a', 'Amul Ghee', '1L', NULL, NULL, 'Amul Gee', '1000 Ml');
insert into fx values ('e6c0d04c-e4d0-49b6-8b62-2596c585bff7', 'Hokkaido Masala Tea', NULL, NULL, 'drinks', 'Hokkaido Masala tea', '250g');
insert into fx values ('d31ac380-9cb4-4416-8c5a-6571b04e223d', 'Rani Sandalwood Soap', NULL, NULL, NULL, 'Rani Sendalwood Soap', '0');
insert into fx values ('52b7b9e0-2f10-43e4-8dba-34e6bfdb38ee', 'Ossum Fragrance Body Spray – Fantasy', NULL, NULL, NULL, 'Ossum Fragrance Body Spray - Fantasy -120ml', '120 ml');
insert into fx values ('58bb0f03-ef30-4705-8fd8-7216eb052659', 'Thai Rice (Royal Umbrella)', NULL, NULL, NULL, 'Thai rice(Royal Umbrella)', '5 kg');
insert into fx values ('f2b5558b-4d06-41e6-97bf-cf73c9212598', NULL, '1 kg', NULL, NULL, 'Tapal Tea', '1000g');
insert into fx values ('4942bd3e-cbb9-4d2f-9da4-4610b5d1eb11', 'Katla Fish Cleaned', NULL, NULL, NULL, 'Katla Fish cleaned', '2 kg');
insert into fx values ('ee5a6af0-4f49-45d3-abd4-1a3f4e556ecc', 'Bombili Karawale / Lotia Shutki', NULL, NULL, NULL, 'Bombili Karawale /Lotia Shutki', '200g');
insert into fx values ('0c055a41-dc09-42fb-9cae-a4aa302fb654', NULL, '1L', NULL, NULL, 'Abya Sunflower oil', '1 Ltr');
insert into fx values ('0b827fd7-680a-4d85-b07d-af6761e4f40e', NULL, '350 ml', NULL, NULL, 'Sugar Cane Juice', '350ml');
insert into fx values ('87dd0f76-ffa5-4f8f-be43-175b876e16aa', 'Isubgul Vushi', NULL, NULL, NULL, 'Isubgul Vushi (70g) イスブグル・ヴシ', '70g');
insert into fx values ('f95b5b78-00f2-4e53-aae8-a19cf99753fd', NULL, '130 ml', NULL, NULL, 'Sesame Oil', '130ml');
insert into fx values ('47ee0d87-571b-48f9-ab0e-ffa98b4a6ea1', 'Kojic Honey Lemon Soap', NULL, NULL, NULL, 'kojic honey Lemon Soap', '0');
insert into fx values ('7a374588-29d3-424a-9d68-80002b6ad476', 'Fogg Fragrance Body Spray – Essence (Women)', NULL, NULL, NULL, 'Fogg Fragrance Body Spray Women - Essence -120ml', '120 ml');
insert into fx values ('7e12da30-8d78-4014-997f-943593c6824e', 'Hajji Baba Atta', '5 kg', NULL, NULL, 'HAJJI BABA ATTA', '5 KG');
insert into fx values ('3713367a-95fe-4e1f-8662-e7f51afe5dfc', NULL, '1L', NULL, NULL, 'Mango Juice', '1000ml');
insert into fx values ('f59e3d4e-449a-433d-9b26-0d7b08214831', 'Keeri Samba Rice', NULL, NULL, NULL, 'kerri Sambal Rice', '5 kg');
insert into fx values ('04d9ac97-5f4c-45b7-a534-2b50ff811ed6', 'Sambal Pecel', NULL, NULL, NULL, 'Sambal Pecel1', '150g');
insert into fx values ('49a6198b-4522-438f-b502-ab74ba6965c4', NULL, '350 ml', NULL, 'drinks', 'Coconut Juice', '350ml');
insert into fx values ('607e95ce-4453-48f6-a7be-8c057bba4ca9', NULL, '250 ml', NULL, NULL, 'Mustard Oil', '250ml');
insert into fx values ('fdde7b67-2ee2-4d2f-b6e1-070ddd031f08', 'Fogg Scent – Midnight Purple (Women)', NULL, NULL, NULL, 'Fogg Scent - Midnight Purple - Women -100ml', '100 ml');
insert into fx values ('c8c2fcda-7982-476f-9133-a2b479617d0b', NULL, '500g', NULL, 'cooking', 'Full Cream Milk Powder (Milk)', '500 gram');
insert into fx values ('2da533ab-91a8-4618-87d8-48819d7d018e', NULL, '400 ml', NULL, 'cooking', 'Coconut Milk (Kara)', '400ml');
insert into fx values ('c315132d-bd69-4cd9-8df8-98141dffa982', NULL, '500g', NULL, NULL, 'Smoked Pangush (Dried)', '500 gram');
insert into fx values ('0422e9a8-f600-41ca-9020-647828f38711', NULL, '500g', NULL, NULL, 'Hilsha Fish Cut', '500 gram');
insert into fx values ('d7d3be20-275d-49d3-b117-58c08a2b3045', 'Hilsha Fish Egg', NULL, NULL, NULL, 'Hilash Fish Egg', '250g');
insert into fx values ('191915a6-6005-4e5f-89c8-8d5ed32629fc', 'Hajji Baba Atta', '10 kg', NULL, NULL, 'HAJJI BABA ATTA', '10 KG');
insert into fx values ('4d058ad5-373b-4de8-8661-b8785f977af8', 'Palm Oil', '1L', NULL, NULL, 'Plam Oil', '1000ml');
insert into fx values ('204a2359-56cb-4fcc-9c81-ffde2fb86aa7', NULL, NULL, NULL, 'cooking', 'Anchor Milk Powder (Milk)', '400g');
insert into fx values ('d321f0ec-2a1c-4534-85b7-661c897d17fa', 'Hokkaido Ghee', '1L', NULL, NULL, 'Hokkido Gee', '1000ml');
insert into fx values ('a3da8bfc-096a-47b1-ae43-2800c27d4673', NULL, NULL, NULL, 'snacks', 'Radhuni Jorda Mix', '400g');
insert into fx values ('7525cc91-5a55-4cdb-a873-64bce4ca0560', 'Mango Pickle in Oil', NULL, NULL, NULL, 'Mango Pickel oil', '1 kg');
insert into fx values ('84da8c4a-c817-438a-89d5-0426c73b116f', 'Amul Ghee', '1L', NULL, NULL, 'Amul Gee', '1000ml');
insert into fx values ('7cfd4682-a14e-4366-a9f4-57e694d9f396', 'Lazzat Mixed Seedless Pickle', '330g', NULL, NULL, 'Lazzat Mixed Seedless Pickel (330g)', '330gm');
insert into fx values ('a4feb43e-06c3-46cc-a7cc-49188c01cf2d', NULL, '30g', NULL, NULL, 'Radhuni Korma Masala', '30 g');
insert into fx values ('97b2fdc2-94b6-470e-b768-3604dd9b6153', 'Thai Rice (Royal Umbrella)', NULL, NULL, NULL, 'Thai rice (Royal Umbrella)', '5 kg');
insert into fx values ('fc1f0c87-442a-40a6-b417-b94c09e65d1d', 'Fogg Body Spray – Bleu Spring', NULL, NULL, NULL, 'Fogg Body Spray - Bleu Spring -120ml', '120 ml');
insert into fx values ('41a6cc3a-7487-4eb1-955f-c617b67c0b07', NULL, NULL, NULL, 'snacks', 'Radhuni Kheer Mix', '150g');
insert into fx values ('f37895ee-88ee-45ad-a944-86dc07dc02c9', NULL, '10 kg', 'コシヒカリ 日本米 G-A', NULL, 'Japanese Rice Koshihikari G-A', '10 KG');
insert into fx values ('e0d99103-03fe-42bb-b246-0dad21973919', 'Basmati Sella Rice (Kaalar)', NULL, NULL, NULL, 'Basmati Sella Rice (Kaalar )', '5 kg');
insert into fx values ('b4cd204f-ca51-40dd-ba18-5a4b074e4a3d', 'King Mango Fruit Juice', NULL, NULL, NULL, 'King Mango Fruit Juce', '2L');
insert into fx values ('302542b1-0925-4d84-8fbd-e6226637e8a0', 'Tamarind Juice', '350 ml', NULL, NULL, 'Tmarind Juice', '350ml');
insert into fx values ('a9db370b-2311-40a1-8e76-c3ce443410f8', 'Vanivel Soap', '90g', NULL, NULL, 'vanivel Soap', '90 g');
insert into fx values ('b61f2d14-958d-4d7a-bf5f-e4cb1d97955c', 'Keeri Samba Rice', NULL, NULL, NULL, 'Keeri samba', '5 kg');
insert into fx values ('477763ac-c6b0-412f-9342-fa347d7aaea5', NULL, NULL, NULL, 'veg', 'Red Chilli Frozen', '200g');
insert into fx values ('29ea407e-2e98-4298-823b-3a53fb11ee34', NULL, '5L', NULL, NULL, 'Sunflower Oil', '5 Litter');
insert into fx values ('6f07724c-b2ae-4d77-9766-dd11f1d1097d', 'Baghabari Ghee', NULL, NULL, NULL, 'Baghabari Gee', '200g');
insert into fx values ('eeb2bcd7-9726-4141-a2ff-762b0940c66b', NULL, '2 pcs', NULL, NULL, 'Shil Pata puta', '2picese');
insert into fx values ('d1df84d1-ef16-4fca-8b7e-0f210fb00157', 'Chinigura Rice (Chashi)', NULL, NULL, NULL, 'Chinigura Rice (Chashi )', '1 kg');
insert into fx values ('78daf97c-26a5-4135-bf1e-7c50378892f6', 'India Gate Basmati Rice', NULL, NULL, NULL, 'India Gate basmati rice', '1 kg');
insert into fx values ('0b4aadbc-9715-4890-9cc5-db9049cfdd02', 'Green Chilli Frozen', NULL, NULL, NULL, 'GREEN CHILLI FROZEN', '200g');
insert into fx values ('b237bd86-69b0-4024-9c74-cc54fa4718d9', NULL, '1 pc', NULL, NULL, 'Coconut (Narkel Kurni)', '1 picese');
insert into fx values ('9da0ac03-6a24-4025-8d7f-bbcce4736369', 'Pat Pat', NULL, NULL, NULL, 'PAT PAT', '500g');
insert into fx values ('08f8d4c0-b658-46d6-b214-59a2c3ceb845', 'Chakki Fresh Atta', '5 kg', NULL, NULL, 'CHAKKI FRESH ATTA', '5 KG');
insert into fx values ('b58db282-99bd-4216-800d-0ce21232577a', 'Mango Pickle', NULL, NULL, NULL, 'Mango Pickel 330g', '330g');
insert into fx values ('026c05e6-0f10-415d-83d6-50a1dd9f1d0e', 'Daliya / Broken Wheat', NULL, NULL, NULL, 'Daliya /Broken Wheat', '500g');
insert into fx values ('7a578870-dd49-4b88-81bb-e573074bab2e', 'Ruchi Mango Pickle', NULL, NULL, NULL, 'Mango pickle Ruchi 400g', '400g');
insert into fx values ('4581fc80-3cb8-4ba0-a9ba-18f9fdd2aa95', 'Chinigura Rice', NULL, NULL, NULL, 'CHINIGURA RICE', '1 kg');
insert into fx values ('00eaa5d4-3ddb-4c11-971b-2decae6ec096', 'IBADAH White Vinegar', NULL, NULL, NULL, 'IBADAH White Vinegar 白酢', '650 ml');
insert into fx values ('cd31e697-6136-44fa-9a4d-354e557126e9', 'Hokkaido Ghee', NULL, NULL, NULL, 'Hokkido Gee', '450');

create function pg_temp.k(n text, w text) returns text language sql immutable as
$$ select lower(regexp_replace(trim(coalesce(n,'')), '\s+', ' ', 'g')) || '|' || lower(regexp_replace(trim(coalesce(w,'')), '\s+', '', 'g')) $$;
do $$
declare n int; d int;
begin
  -- deals first, while the old names are still there to match on
  update deals dl set en = coalesce(fx.en, dl.en), w = coalesce(fx.w, dl.w)
    from fx
   where dl.archived_at is null and (fx.en is not null or fx.w is not null)
     and pg_temp.k(dl.en, dl.w) = pg_temp.k(fx.old_en, fx.old_w);
  get diagnostics d = row_count;

  with mv as (
    select fx.id, fx.cat, row_number() over (partition by fx.cat order by p.sort, p.created_at) rn
      from fx join products p on p.id = fx.id where fx.cat is not null
  ), base as (select category_id, max(sort) b from products group by category_id)
  update products p set category_id = mv.cat, sort = coalesce(base.b, 0) + mv.rn
    from mv left join base on base.category_id = mv.cat where p.id = mv.id;

  update products p set en = coalesce(fx.en, p.en), w = coalesce(fx.w, p.w), ja = coalesce(fx.ja, p.ja)
    from fx where p.id = fx.id and p.archived_at is null
     and p.en = fx.old_en and coalesce(p.w,'') = fx.old_w;
  get diagnostics n = row_count;
  if n <> (select count(*) from fx) then raise exception 'expected % products, got % — nothing changed', (select count(*) from fx), n; end if;
  raise notice 'products fixed: %, deal cards renamed to match: %', n, d;
end $$;
commit;
