/**
 * Search vocabulary for a halal grocery in Japan.
 *
 * Customers type in three languages, often romanised, often misspelled,
 * and often describe a dish rather than a product. Each entry maps the
 * words people actually use onto the words that appear in the catalogue.
 */

/** Words that mean the same thing. Order within a group does not matter. */
export const SYNONYMS = [
  // proteins
  ["chicken", "murgi", "murghi", "murgir", "মুরগি", "鶏", "とり", "chiken", "chikon"],
  ["beef", "gorur", "goru", "gorur mangsho", "গরু", "গরুর", "牛", "牛肉", "cow"],
  ["mutton", "khasi", "khashi", "খাসি", "খাসির", "マトン", "goat", "lamb"],
  ["meat", "mangsho", "gosht", "gost", "মাংস", "肉", "niku"],
  ["fish", "mach", "machh", "maach", "মাছ", "魚", "sakana"],
  ["prawn", "shrimp", "chingri", "চিংড়ি", "エビ", "ebi"],
  ["tilapia", "telapia", "তেলাপিয়া"],
  ["rohu", "rui", "রুই"],
  ["katla", "katol", "কাতলা"],
  ["pangas", "পাঙ্গাস"],
  ["liver", "kolija", "কলিজা", "レバー"],
  ["sausage", "সসেজ", "ソーセージ"],

  // staples
  ["rice", "chal", "chaal", "চাল", "米", "kome", "gohan"],
  ["basmati", "বাসমতি", "バスマティ"],
  ["flour", "atta", "ata", "আটা", "小麦粉", "maida", "ময়দা"],
  ["lentil", "dal", "daal", "ডাল", "豆", "pulse", "pulses"],
  ["masoor", "masur", "মসুর", "red lentil"],
  ["chickpea", "chola", "chana", "ছোলা", "ひよこ豆"],
  ["beans", "rajma", "রাজমা", "শিম", "豆"],

  // spice
  ["spice", "masala", "moshla", "মসলা", "スパイス", "spices"],
  ["chilli", "chili", "morich", "মরিচ", "唐辛子", "pepper"],
  ["turmeric", "holud", "হলুদ", "ターメリック"],
  ["cumin", "jeera", "jira", "জিরা", "クミン"],
  ["garam", "গরম"],
  ["biryani", "biriyani", "birani", "বিরিয়ানি", "ビリヤニ"],

  // oil
  ["oil", "tel", "তেল", "油", "abura"],
  ["mustard", "sorisha", "sarisha", "সরিষা", "マスタード"],
  ["ghee", "ঘি", "ギー"],
  ["olive", "オリーブ"],

  // snacks & sweets
  ["snack", "snacks", "নাস্তা", "スナック"],
  ["noodle", "noodles", "নুডলস", "ラーメン", "ramen"],
  ["biscuit", "cookie", "cookies", "বিস্কুট", "クッキー"],
  ["paratha", "porota", "পরোটা", "パラタ"],
  ["samosa", "shingara", "সমুচা", "サモサ"],
  ["chips", "চিপস", "チップス"],
  ["sweet", "misti", "mishti", "মিষ্টি", "甘い", "dessert"],

  // drinks
  ["drink", "juice", "jus", "পানীয়", "জুস", "ジュース", "beverage"],
  ["mango", "aam", "আম", "マンゴー"],
  ["guava", "peyara", "পেয়ারা", "グアバ"],
  ["milk", "dudh", "দুধ", "牛乳", "ミルク"],
  ["tea", "cha", "চা", "お茶", "紅茶"],

  // dry goods
  ["dates", "khejur", "খেজুর", "デーツ"],
  ["nuts", "badam", "বাদাম", "ナッツ"],
  ["almond", "kath badam", "アーモンド"],
  ["cashew", "kaju", "কাজু", "カシューナッツ"],

  // beauty
  ["cream", "ক্রিম", "クリーム"],
  ["shampoo", "শ্যাম্পু", "シャンプー"],
  ["soap", "shaban", "সাবান", "石鹸"],
  ["perfume", "spray", "স্প্রে", "香水"],

  // misc
  ["honey", "modhu", "মধু", "はちみつ"],
  ["pickle", "achar", "আচার", "ピクルス"],
  ["salt", "lobon", "লবণ", "塩"],
  ["sugar", "chini", "চিনি", "砂糖"],
  ["frozen", "ফ্রোজেন", "冷凍"],
  ["fresh", "taja", "তাজা", "新鮮"]
];

/**
 * Dishes and needs mapped to the ingredients that make them.
 * Lets "something for biryani" surface rice, masala and meat.
 */
export const RECIPES = {
  "biryani":   ["basmati", "rice", "masala", "chicken", "mutton", "ghee"],
  "curry":     ["masala", "chicken", "beef", "oil", "turmeric"],
  "iftar":     ["dates", "juice", "chickpea", "samosa"],
  "ramadan":   ["dates", "juice", "rice", "chickpea"],
  "eid":       ["mutton", "beef", "basmati", "sweet", "dates"],
  "breakfast": ["paratha", "flour", "tea", "biscuit", "honey"],
  "bbq":       ["beef", "chicken", "masala", "oil"],
  "grill":     ["beef", "chicken", "masala"],
  "soup":      ["chicken", "noodle", "masala"],
  "baby":      ["milk", "biscuit", "cereal"],
  "cheap":     [],   // handled as a price intent, not an ingredient
  "party":     ["chicken", "rice", "drink", "snack", "sweet"]
};

/** Words that express a price preference rather than a product. */
export const PRICE_WORDS = {
  cheap:      "low",  cheapest: "low",  affordable: "low",
  budget:     "low",  সস্তা:    "low",  安い:        "low",
  expensive:  "high", premium:  "high", best:       "high",
  দামি:       "high", 高級:      "high"
};

/** Words that mean "on sale". */
export const SALE_WORDS = [
  "offer", "offers", "sale", "deal", "deals", "discount", "cheap deal",
  "অফার", "ছাড়", "セール", "割引", "お買い得"
];
