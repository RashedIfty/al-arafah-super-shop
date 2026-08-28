/* Product catalogue — see docs at bottom of file */
const DEFAULT_CATALOG = [
  { id:"cooking", icon:"", img:"/images/categories/cooking.jpg",
    en:"Cooking", bn:"রান্নার সামগ্রী", ja:"調理用品",
    items:[
      { en:"Sunflower Oil", bn:"সূর্যমুখী তেল", ja:"ひまわり油", w:"1 L", p:590, was:0, img:"/images/products/sunflower-oil.jpg" },
      { en:"Premium Basmati Rice", bn:"প্রিমিয়াম বাসমতি চাল", ja:"高級バスマティ米", w:"5 kg", p:3890, was:4280, img:"/images/products/basmati-premium.jpg" },
      { en:"Mixed Pickle", bn:"মিক্সড আচার", ja:"ミックスピクルス", w:"400 g", p:590, was:0, img:"/images/products/pickle.jpg" },
      { en:"Honey Pure", bn:"খাঁটি মধু", ja:"純粋はちみつ", w:"500 g", p:1480, was:0, img:"/images/products/honey.jpg" },
      { en:"Thai Rice", bn:"থাই চাল", ja:"タイ米", w:"5 kg", p:2990, was:3600, img:"/images/products/thai-rice.jpg" },
      { en:"Olive Pomace Oil", bn:"অলিভ অয়েল", ja:"オリーブオイル", w:"1 L", p:890, was:0, img:"/images/products/olive-oil.jpg" },
      { en:"Atta Whole Wheat Flour", bn:"আটা", ja:"全粒粉（アタ）", w:"5 kg", p:1490, was:0, img:"/images/products/atta-flour.jpg" },
      { en:"Gram Flour (Besan)", bn:"বেসন", ja:"ベサン粉", w:"1 kg", p:520, was:0, img:"/images/products/gram-flour.jpg" },
      { en:"Rice Flour", bn:"চালের গুঁড়া", ja:"米粉", w:"1 kg", p:420, was:0, img:"/images/products/rice-flour.jpg" }
    ]},

  { id:"meat-fish", icon:"", img:"/images/categories/meat-fish.jpg",
    en:"Meat & Fish", bn:"মাংস ও মাছ", ja:"肉・魚",
    items:[
      { en:"Chicken Whole Halal", bn:"আস্ত মুরগি", ja:"丸鶏（ハラール）", w:"1 kg", p:498, was:580, img:"/images/products/chicken-whole.jpg" },
      { en:"Rohu Fish Whole", bn:"রুই মাছ", ja:"ロフ魚", w:"1 kg", p:1290, was:0, img:"/images/products/rohu-fish.jpg" },
      { en:"Chicken Boneless Leg", bn:"হাড় ছাড়া মুরগির রান", ja:"骨なし鶏もも肉", w:"2 kg", p:1180, was:1450, img:"/images/products/chicken-boneless-leg.jpg" },
      { en:"Katla Fish Cut", bn:"কাতলা মাছ", ja:"カトラ魚", w:"1 kg", p:1390, was:0, img:"/images/products/katla-fish.jpg" },
      { en:"Chicken Breast Boneless", bn:"মুরগির বুকের মাংস", ja:"鶏むね肉", w:"2 kg", p:1850, was:0, img:"/images/products/chicken-breast.jpg" },
      { en:"Tilapia Whole Frozen", bn:"তেলাপিয়া মাছ", ja:"ティラピア（冷凍）", w:"800 g", p:398, was:440, img:"/images/products/tilapia.jpg" },
      { en:"Pangas Fish Fillet", bn:"পাঙ্গাস ফিলে", ja:"パンガス フィレ", w:"1 kg", p:980, was:0, img:"/images/products/pangas.jpg" },
      { en:"Chicken Leg with Bone", bn:"হাড়সহ মুরগির রান", ja:"骨付き鶏もも肉", w:"2 kg", p:1690, was:1735, img:"/images/products/chicken-leg-bone.jpg" },
      { en:"Beef with Bone", bn:"হাড়সহ গরুর মাংস", ja:"骨付き牛肉", w:"1 kg", p:1920, was:0, img:"/images/products/beef-bone.jpg" },
      { en:"Prawn / Shrimp Medium", bn:"চিংড়ি (মাঝারি)", ja:"エビ（中）", w:"500 g", p:1480, was:0, img:"/images/products/prawn.jpg" },
      { en:"Beef Boneless", bn:"হাড় ছাড়া গরুর মাংস", ja:"牛肉（骨なし）", w:"1 kg", p:2380, was:0, img:"/images/products/beef-boneless.jpg" },
      { en:"Beef Mince (Keema)", bn:"গরুর কিমা", ja:"牛ひき肉", w:"1 kg", p:2180, was:0, img:"/images/products/beef-mince.jpg" },
      { en:"Mutton Curry Cut", bn:"খাসির মাংস", ja:"マトン（カレー用）", w:"1 kg", p:3480, was:0, img:"/images/products/mutton.jpg" },
      { en:"Chicken Liver", bn:"মুরগির কলিজা", ja:"鶏レバー", w:"500 g", p:580, was:0, img:"/images/products/chicken-liver.jpg" },
      { en:"Chicken Sausage", bn:"চিকেন সসেজ", ja:"チキンソーセージ", w:"375 g", p:350, was:395, img:"/images/products/chicken-sausage.jpg" }
    ]},

  { id:"masala", icon:"", img:"/images/categories/masala.jpg",
    en:"Masala & Spices", bn:"মসলা", ja:"スパイス",
    items:[
      { en:"Shan Biryani Masala", bn:"শান বিরিয়ানি মসলা", ja:"ビリヤニマサラ", w:"60 g", p:230, was:0, img:"/images/products/biryani-masala.jpg" },
      { en:"Shan Chicken Masala", bn:"শান চিকেন মসলা", ja:"チキンマサラ", w:"50 g", p:210, was:0, img:"/images/products/shan-masala.jpg" },
      { en:"MDH Garam Masala", bn:"গরম মসলা", ja:"ガラムマサラ", w:"100 g", p:390, was:0, img:"/images/products/garam-masala.jpg" }
    ]},

  { id:"lentils", icon:"", img:"/images/categories/lentils.jpg",
    en:"Lentils & Beans", bn:"ডাল ও শিম", ja:"豆類",
    items:[
      { en:"Masoor Dal (Red Lentil)", bn:"মসুর ডাল", ja:"レンズ豆（マスール）", w:"1 kg", p:261, was:394, img:"/images/products/masoor-dal.jpg" },
      { en:"Red Kidney Beans", bn:"রাজমা", ja:"赤インゲン豆", w:"1 kg", p:720, was:0, img:"/images/products/kidney-beans.jpg" }
    ]},

  { id:"snacks", icon:"", img:"/images/categories/snacks.jpg",
    en:"Snacks & Sweets", bn:"স্ন্যাকস ও মিষ্টি", ja:"スナック・お菓子",
    items:[
      { en:"Plain Paratha (5 pcs)", bn:"পরোটা (৫ পিস)", ja:"パラタ（5枚）", w:"400 g", p:190, was:290, img:"/images/products/paratha.jpg" },
      { en:"Samosa Frozen (10 pcs)", bn:"সমুচা (১০ পিস)", ja:"サモサ（冷凍10個）", w:"500 g", p:680, was:0, img:"/images/products/samosa.jpg" },
      { en:"Wai Wai Noodles", bn:"ওয়াই ওয়াই নুডলস", ja:"ワイワイヌードル", w:"60 g", p:59, was:101, img:"/images/products/waiwai-noodles.jpg" },
      { en:"Indomie Instant Noodles", bn:"ইন্দোমি নুডলস", ja:"インドミー", w:"67 g", p:120, was:140, img:"/images/products/indomie.jpg" },
      { en:"Haldiram Namkeen Mix", bn:"হালদিরাম নমকিন", ja:"ナムキン ミックス", w:"200 g", p:390, was:0, img:"/images/products/haldiram-namkeen.jpg" },
      { en:"Milk Cookies", bn:"মিল্ক কুকিজ", ja:"ミルククッキー", w:"900 g", p:670, was:0, img:"/images/products/milk-cookies.jpg" },
      { en:"Butter Cookies", bn:"বাটার কুকিজ", ja:"バタークッキー", w:"900 g", p:670, was:0, img:"/images/products/butter-cookies.jpg" },
      { en:"Jackfruit Chips", bn:"কাঁঠাল চিপস", ja:"ジャックフルーツチップス", w:"100 g", p:398, was:0, img:"/images/products/jackfruit-chips.jpg" }
    ]},

  { id:"drinks", icon:"", img:"/images/categories/drinks.jpg",
    en:"Drinks & Beverage", bn:"পানীয়", ja:"飲み物",
    items:[
      { en:"Mango Fruit Drink", bn:"ম্যাঙ্গো জুস", ja:"マンゴージュース", w:"1 L", p:280, was:0, img:"/images/products/mango-drink-1l.jpg" },
      { en:"Mango Fruit Drink", bn:"ম্যাঙ্গো জুস", ja:"マンゴージュース", w:"2 L", p:550, was:0, img:"/images/products/mango-drink-2l.jpg" },
      { en:"Guava Fruit Drink", bn:"পেয়ারা জুস", ja:"グアバジュース", w:"1 L", p:280, was:0, img:"/images/products/guava-drink-1l.jpg" },
      { en:"Pomegranate Drink", bn:"ডালিম জুস", ja:"ザクロジュース", w:"1 L", p:280, was:0, img:"/images/products/pomegranate-1l.jpg" },
      { en:"Powder Milk", bn:"গুঁড়া দুধ", ja:"粉ミルク", w:"1 kg", p:1980, was:0, img:"/images/products/powder-milk.jpg" }
    ]},

  { id:"veg", icon:"", img:"/images/categories/veg.jpg",
    en:"Fruits & Vegetables", bn:"ফল ও সবজি", ja:"野菜・果物",
    items:[
    ]},

  { id:"nuts", icon:"", img:"/images/categories/nuts.jpg",
    en:"Nuts & Dry Fruits", bn:"বাদাম ও শুকনো ফল", ja:"ナッツ・ドライフルーツ",
    items:[
      { en:"Regular Dates", bn:"সাধারণ খেজুর", ja:"デーツ", w:"500 g", p:680, was:0, img:"/images/products/dates-regular.jpg" }
    ]},

  { id:"beauty", icon:"", img:"/images/categories/beauty.jpg",
    en:"Beauty & Health", bn:"রূপচর্চা ও স্বাস্থ্য", ja:"美容・健康",
    items:[
      { en:"Himalaya Day Cream", bn:"হিমালয়া ডে ক্রিম", ja:"ヒマラヤ デイクリーム", w:"50 ml", p:1290, was:0, img:"/images/products/cream-himalaya.jpg" },
      { en:"Halal Body Shampoo", bn:"হালাল বডি শ্যাম্পু", ja:"ハラール ボディシャンプー", w:"400 ml", p:980, was:0, img:"/images/products/shampoo.jpg" },
      { en:"Deodorant Roll-On", bn:"ডিওডোরেন্ট", ja:"デオドラント", w:"50 ml", p:590, was:0, img:"/images/products/deodorant.jpg" },
      { en:"Body Spray", bn:"বডি স্প্রে", ja:"ボディスプレー", w:"59 g", p:780, was:0, img:"/images/products/body-spray.jpg" }
    ]}
];

/**
 * Products come from Supabase when it is configured; otherwise the
 * bundled defaults above are used so the site still works offline.
 * `refreshCatalog()` is called again whenever the database changes.
 */
/* The shop paints immediately, then repaints when the database answers.
   Without a cache that first paint uses the copy bundled into the code,
   which goes stale the moment the owner adds a category — the customer
   sees the old shop for a moment and then watches it change. Keeping the
   last reply means a returning visitor's first paint is already right. */
const CACHE_KEY = "aa-catalog";

function readCache(){
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return Array.isArray(data) && data.length ? data : null;
  } catch { return null; }
}

function writeCache(data){
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
  catch { /* private mode, or over quota — the shop still works */ }
}

export let CATALOG = readCache() || DEFAULT_CATALOG;

export async function refreshCatalog(){
  try {
    const { fetchCatalog } = await import("../../backend/client.js");
    const live = await fetchCatalog();
    if (live && live.length){
      CATALOG = live;
      writeCache(live);
    }
  } catch (e) {
    console.warn("Using bundled catalogue:", e.message);
  }
  return CATALOG;
}

export { DEFAULT_CATALOG };
