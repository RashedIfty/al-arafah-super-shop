/* Product catalogue — see docs at bottom of file */
const DEFAULT_CATALOG = [
  { id:"rice", icon:"🍚", img:"assets/img/categories/rice.jpg",
    en:"Rice & Flour", bn:"চাল ও আটা", ja:"米・粉類",
    items:[
      { en:"Premium Basmati Rice", bn:"প্রিমিয়াম বাসমতি চাল", ja:"高級バスマティ米", w:"5 kg", p:3890, was:4280, img:"assets/img/products/basmati-premium.jpg" },
      { en:"Thai Rice",            bn:"থাই চাল",              ja:"タイ米",           w:"5 kg", p:2990, was:3600, img:"assets/img/products/thai-rice.jpg" },
      { en:"Atta Whole Wheat Flour",  bn:"আটা",               ja:"全粒粉（アタ）",   w:"5 kg", p:1490, was:0,    img:"assets/img/products/atta-flour.jpg" },
      { en:"Gram Flour (Besan)",   bn:"বেসন",                 ja:"ベサン粉",         w:"1 kg", p:520,  was:0,    img:"assets/img/products/gram-flour.jpg" },
      { en:"Rice Flour",           bn:"চালের গুঁড়া",         ja:"米粉",             w:"1 kg", p:420,  was:0,    img:"assets/img/products/rice-flour.jpg" }
    ]},

  { id:"meat", icon:"🥩", img:"assets/img/categories/meat.jpg",
    en:"Meat", bn:"মাংস", ja:"肉類",
    items:[
      { en:"Chicken Whole Halal",   bn:"আস্ত মুরগি",        ja:"丸鶏（ハラール）",   w:"1 kg", p:498,  was:580,  img:"assets/img/products/chicken-whole.jpg" },
      { en:"Chicken Boneless Leg",  bn:"হাড় ছাড়া মুরগির রান", ja:"骨なし鶏もも肉",  w:"2 kg", p:1180, was:1450, img:"assets/img/products/chicken-boneless-leg.jpg" },
      { en:"Chicken Breast Boneless", bn:"মুরগির বুকের মাংস", ja:"鶏むね肉",         w:"2 kg", p:1850, was:0,    img:"assets/img/products/chicken-breast.jpg" },
      { en:"Chicken Leg with Bone", bn:"হাড়সহ মুরগির রান",  ja:"骨付き鶏もも肉",     w:"2 kg", p:1690, was:1735, img:"assets/img/products/chicken-leg-bone.jpg" },
      { en:"Beef with Bone",        bn:"হাড়সহ গরুর মাংস",   ja:"骨付き牛肉",         w:"1 kg", p:1920, was:0,    img:"assets/img/products/beef-bone.jpg" },
      { en:"Beef Boneless",         bn:"হাড় ছাড়া গরুর মাংস", ja:"牛肉（骨なし）",   w:"1 kg", p:2380, was:0,    img:"assets/img/products/beef-boneless.jpg" },
      { en:"Beef Mince (Keema)",    bn:"গরুর কিমা",          ja:"牛ひき肉",           w:"1 kg", p:2180, was:0,    img:"assets/img/products/beef-mince.jpg" },
      { en:"Mutton Curry Cut",      bn:"খাসির মাংস",         ja:"マトン（カレー用）", w:"1 kg", p:3480, was:0,    img:"assets/img/products/mutton.jpg" },
      { en:"Chicken Liver",         bn:"মুরগির কলিজা",       ja:"鶏レバー",           w:"500 g",p:580,  was:0,    img:"assets/img/products/chicken-liver.jpg" },
      { en:"Chicken Sausage",       bn:"চিকেন সসেজ",         ja:"チキンソーセージ",   w:"375 g",p:350,  was:395,  img:"assets/img/products/chicken-sausage.jpg" }
    ]},

  { id:"fish", icon:"🐟", img:"assets/img/categories/fish.jpg",
    en:"Fish", bn:"মাছ", ja:"魚類",
    items:[
      { en:"Rohu Fish Whole",      bn:"রুই মাছ",        ja:"ロフ魚",              w:"1 kg",  p:1290, was:0,    img:"assets/img/products/rohu-fish.jpg" },
      { en:"Katla Fish Cut",       bn:"কাতলা মাছ",      ja:"カトラ魚",            w:"1 kg",  p:1390, was:0,    img:"assets/img/products/katla-fish.jpg" },
      { en:"Tilapia Whole Frozen", bn:"তেলাপিয়া মাছ",  ja:"ティラピア（冷凍）",  w:"800 g", p:398,  was:440,  img:"assets/img/products/tilapia.jpg" },
      { en:"Pangas Fish Fillet",   bn:"পাঙ্গাস ফিলে",   ja:"パンガス フィレ",     w:"1 kg",  p:980,  was:0,    img:"assets/img/products/pangas.jpg" },
      { en:"Prawn / Shrimp Medium",bn:"চিংড়ি (মাঝারি)", ja:"エビ（中）",         w:"500 g", p:1480, was:0,    img:"assets/img/products/prawn.jpg" }
    ]},

  { id:"lentils", icon:"🫘", img:"assets/img/categories/lentils.jpg",
    en:"Lentils & Beans", bn:"ডাল ও শিম", ja:"豆類",
    items:[
      { en:"Masoor Dal (Red Lentil)", bn:"মসুর ডাল",   ja:"レンズ豆（マスール）", w:"1 kg", p:261, was:394, img:"assets/img/products/masoor-dal.jpg" },
      { en:"Red Kidney Beans", bn:"রাজমা",             ja:"赤インゲン豆",         w:"1 kg", p:720, was:0,   img:"assets/img/products/kidney-beans.jpg" }
    ]},

  { id:"masala", icon:"🌶️", img:"assets/img/categories/masala.jpg",
    en:"Masala & Spices", bn:"মসলা", ja:"スパイス",
    items:[
      { en:"Shan Biryani Masala", bn:"শান বিরিয়ানি মসলা", ja:"ビリヤニマサラ",   w:"60 g", p:230, was:0, img:"assets/img/products/biryani-masala.jpg" },
      { en:"Shan Chicken Masala", bn:"শান চিকেন মসলা",    ja:"チキンマサラ",     w:"50 g", p:210, was:0, img:"assets/img/products/shan-masala.jpg" },
      { en:"MDH Garam Masala",    bn:"গরম মসলা",          ja:"ガラムマサラ",     w:"100 g",p:390, was:0, img:"assets/img/products/garam-masala.jpg" }
    ]},

  { id:"oil", icon:"🫒", img:"assets/img/categories/oil.jpg",
    en:"Oil & Ghee", bn:"তেল ও ঘি", ja:"油・ギー",
    items:[
      { en:"Sunflower Oil",    bn:"সূর্যমুখী তেল",    ja:"ひまわり油",         w:"1 L",  p:590,  was:0,    img:"assets/img/products/sunflower-oil.jpg" },
      { en:"Olive Pomace Oil", bn:"অলিভ অয়েল",       ja:"オリーブオイル",     w:"1 L",  p:890,  was:0,    img:"assets/img/products/olive-oil.jpg" }
    ]},

  { id:"snacks", icon:"🍪", img:"assets/img/categories/snacks.jpg",
    en:"Snacks & Sweets", bn:"স্ন্যাকস ও মিষ্টি", ja:"スナック・お菓子",
    items:[
      { en:"Plain Paratha (5 pcs)", bn:"পরোটা (৫ পিস)",  ja:"パラタ（5枚）",     w:"400 g",p:190, was:290, img:"assets/img/products/paratha.jpg" },
      { en:"Samosa Frozen (10 pcs)",bn:"সমুচা (১০ পিস)", ja:"サモサ（冷凍10個）",w:"500 g",p:680, was:0,   img:"assets/img/products/samosa.jpg" },
      { en:"Wai Wai Noodles",       bn:"ওয়াই ওয়াই নুডলস",ja:"ワイワイヌードル",  w:"60 g", p:59,  was:101, img:"assets/img/products/waiwai-noodles.jpg" },
      { en:"Indomie Instant Noodles",bn:"ইন্দোমি নুডলস", ja:"インドミー",        w:"67 g", p:120, was:140, img:"assets/img/products/indomie.jpg" },
      { en:"Haldiram Namkeen Mix",  bn:"হালদিরাম নমকিন", ja:"ナムキン ミックス",  w:"200 g",p:390, was:0,   img:"assets/img/products/haldiram-namkeen.jpg" },
      { en:"Milk Cookies",          bn:"মিল্ক কুকিজ",    ja:"ミルククッキー",     w:"900 g",p:670, was:0,   img:"assets/img/products/milk-cookies.jpg" },
      { en:"Butter Cookies",        bn:"বাটার কুকিজ",    ja:"バタークッキー",     w:"900 g",p:670, was:0,   img:"assets/img/products/butter-cookies.jpg" },
      { en:"Jackfruit Chips",       bn:"কাঁঠাল চিপস",    ja:"ジャックフルーツチップス",w:"100 g",p:398,was:0,img:"assets/img/products/jackfruit-chips.jpg" }
    ]},

  { id:"dates", icon:"🌴", img:"assets/img/categories/dates.jpg",
    en:"Dates & Dry Fruits", bn:"খেজুর ও বাদাম", ja:"デーツ・ナッツ",
    items:[
      { en:"Regular Dates",      bn:"সাধারণ খেজুর", ja:"デーツ",           w:"500 g",p:680,  was:0, img:"assets/img/products/dates-regular.jpg" }
    ]},

  { id:"drinks", icon:"🧃", img:"assets/img/categories/drinks.jpg",
    en:"Drinks & Beverage", bn:"পানীয়", ja:"飲み物",
    items:[
      { en:"Mango Fruit Drink",   bn:"ম্যাঙ্গো জুস",   ja:"マンゴージュース", w:"1 L",   p:280,  was:0, img:"assets/img/products/mango-drink-1l.jpg" },
      { en:"Mango Fruit Drink",   bn:"ম্যাঙ্গো জুস",   ja:"マンゴージュース", w:"2 L",   p:550,  was:0, img:"assets/img/products/mango-drink-2l.jpg" },
      { en:"Guava Fruit Drink",   bn:"পেয়ারা জুস",     ja:"グアバジュース",   w:"1 L",   p:280,  was:0, img:"assets/img/products/guava-drink-1l.jpg" },
      { en:"Pomegranate Drink",   bn:"ডালিম জুস",      ja:"ザクロジュース",   w:"1 L",   p:280,  was:0, img:"assets/img/products/pomegranate-1l.jpg" },
      { en:"Powder Milk",         bn:"গুঁড়া দুধ",     ja:"粉ミルク",         w:"1 kg",  p:1980, was:0, img:"assets/img/products/powder-milk.jpg" }
    ]},

  { id:"cosmetics", icon:"💄", img:"assets/img/categories/cosmetics.jpg",
    en:"Cosmetics & Beauty", bn:"কসমেটিকস ও রূপচর্চা", ja:"化粧品・美容",
    items:[
      { en:"Himalaya Day Cream",      bn:"হিমালয়া ডে ক্রিম",       ja:"ヒマラヤ デイクリーム",    w:"50 ml", p:1290, was:0,   img:"assets/img/products/cream-himalaya.jpg" },
      { en:"Halal Body Shampoo",      bn:"হালাল বডি শ্যাম্পু",      ja:"ハラール ボディシャンプー", w:"400 ml",p:980,  was:0,   img:"assets/img/products/shampoo.jpg" },
      { en:"Deodorant Roll-On",       bn:"ডিওডোরেন্ট",             ja:"デオドラント",             w:"50 ml", p:590,  was:0,   img:"assets/img/products/deodorant.jpg" },
      { en:"Body Spray",              bn:"বডি স্প্রে",             ja:"ボディスプレー",           w:"59 g",  p:780,  was:0,   img:"assets/img/products/body-spray.jpg" }
    ]},

  { id:"others", icon:"🧂", img:"assets/img/categories/others.jpg",
    en:"Others", bn:"অন্যান্য", ja:"その他",
    items:[
      { en:"Mixed Pickle",       bn:"মিক্সড আচার",   ja:"ミックスピクルス",   w:"400 g",p:590,  was:0, img:"assets/img/products/pickle.jpg" },
      { en:"Honey Pure",         bn:"খাঁটি মধু",     ja:"純粋はちみつ",       w:"500 g",p:1480, was:0, img:"assets/img/products/honey.jpg" }
    ]}
];

/**
 * Local edits made in admin.html override the defaults above.
 * Export from the admin panel and replace this file to make them permanent.
 */
function withLocalEdits(){
  try {
    const raw = localStorage.getItem("aa-catalog");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* unavailable or corrupt — use the defaults */ }
  return DEFAULT_CATALOG;
}

export const CATALOG = withLocalEdits();
