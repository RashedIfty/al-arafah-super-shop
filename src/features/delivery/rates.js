/**
 * What it costs to send a box, and when it costs nothing.
 *
 * The figures are the shop's standing rate sheet from Sagawa Express
 * (佐川急便 運賃御見積書, quote no. 1771002 0720, Tsukuba branch), for
 * parcels sent from Kanto. The owner confirms these are the rates he
 * works to.
 *
 * They are still shown as a guide rather than a charge: what a box
 * actually costs depends on its size and weight once it is packed, and
 * the shop agrees the figure with the customer on the phone. Nothing on
 * the site charges from this table.
 *
 * Kept as data rather than a picture of the sheet so it can be read on
 * a phone, read aloud by a screen reader, and translated.
 */

/** Free delivery, and the two ways to get it. */
export const FREE = {
  localKm: 10,
  localFrom: 8000,      // ¥8,000 within 10 km of the shop
  nationalFrom: 10000,  // ¥10,000 anywhere in Japan
};

/**
 * Box sizes, by the sum of the three sides in centimetres, with the
 * weight each one may carry. Sagawa charges on whichever is the larger
 * of size and weight.
 */
export const SIZES = [
  { size: 60,  kg: 2  },
  { size: 80,  kg: 5  },
  { size: 100, kg: 10 },
  { size: 140, kg: 20 },
  { size: 160, kg: 30 },
  { size: 170, kg: 50 },
  { size: 180, kg: null },
  { size: 200, kg: null },
  { size: 220, kg: null },
  { size: 240, kg: null },
  { size: 260, kg: null },
];

/**
 * The regions, in the order the quote lists them, with the prefectures
 * each covers. Kanto is where Ibaraki sits, so it is the one most
 * customers will look for.
 */
export const REGIONS = [
  { id: "kanto",     en: "Kanto",           ja: "関東",   bn: "কান্তো",
    pref: { en: "Tokyo, Kanagawa, Saitama, Chiba, Ibaraki, Tochigi, Gunma, Yamanashi",
            ja: "東京都・神奈川県・埼玉県・千葉県・茨城県・栃木県・群馬県・山梨県",
            bn: "টোকিও, কানাগাওয়া, সাইতামা, চিবা, ইবারাকি, তোচিগি, গুনমা, ইয়ামানাশি" } },

  { id: "shinetsu",  en: "Shinetsu",        ja: "信越",   bn: "শিনেৎসু",
    pref: { en: "Niigata, Nagano", ja: "新潟県・長野県", bn: "নিইগাতা, নাগানো" } },

  { id: "tokai",     en: "Tokai",           ja: "東海",   bn: "তোকাই",
    pref: { en: "Aichi, Shizuoka, Gifu, Mie", ja: "愛知県・静岡県・岐阜県・三重県",
            bn: "আইচি, শিজুওকা, গিফু, মিয়ে" } },

  { id: "hokuriku",  en: "Hokuriku",        ja: "北陸",   bn: "হোকুরিকু",
    pref: { en: "Ishikawa, Fukui, Toyama", ja: "石川県・福井県・富山県",
            bn: "ইশিকাওয়া, ফুকুই, তোয়ামা" } },

  { id: "kansai",    en: "Kansai",          ja: "関西",   bn: "কানসাই",
    pref: { en: "Osaka, Hyogo, Kyoto, Nara, Wakayama, Shiga",
            ja: "大阪府・兵庫県・京都府・奈良県・和歌山県・滋賀県",
            bn: "ওসাকা, হিয়োগো, কিয়োতো, নারা, ওয়াকায়ামা, শিগা" } },

  { id: "chugoku",   en: "Chugoku",         ja: "中国",   bn: "চুগোকু",
    pref: { en: "Hiroshima, Okayama, Shimane, Yamaguchi, Tottori",
            ja: "広島県・岡山県・島根県・山口県・鳥取県",
            bn: "হিরোশিমা, ওকায়ামা, শিমানে, ইয়ামাগুচি, তোত্তোরি" } },

  { id: "shikoku",   en: "Shikoku",         ja: "四国",   bn: "শিকোকু",
    pref: { en: "Kagawa, Ehime, Kochi, Tokushima", ja: "香川県・愛媛県・高知県・徳島県",
            bn: "কাগাওয়া, এহিমে, কোচি, তোকুশিমা" } },

  { id: "minamitohoku", en: "South Tohoku", ja: "南東北", bn: "দক্ষিণ তোহোকু",
    pref: { en: "Miyagi, Fukushima, Yamagata", ja: "宮城県・福島県・山形県",
            bn: "মিয়াগি, ফুকুশিমা, ইয়ামাগাতা" } },

  { id: "kitatohoku",   en: "North Tohoku", ja: "北東北", bn: "উত্তর তোহোকু",
    pref: { en: "Iwate, Akita, Aomori", ja: "岩手県・秋田県・青森県",
            bn: "ইওয়াতে, আকিতা, আওমোরি" } },

  { id: "kitakyushu",   en: "North Kyushu", ja: "北九州", bn: "উত্তর কিউশু",
    pref: { en: "Fukuoka, Saga, Oita, Nagasaki", ja: "福岡県・佐賀県・大分県・長崎県",
            bn: "ফুকুওকা, সাগা, ওইতা, নাগাসাকি" } },

  { id: "minamikyushu", en: "South Kyushu", ja: "南九州", bn: "দক্ষিণ কিউশু",
    pref: { en: "Kagoshima, Kumamoto, Miyazaki", ja: "鹿児島県・熊本県・宮崎県",
            bn: "কাগোশিমা, কুমামোতো, মিয়াজাকি" } },

  { id: "hokkaido",     en: "Hokkaido",     ja: "北海道", bn: "হোক্কাইদো",
    pref: { en: "Sapporo, Donan, Dohoku, Dotoh", ja: "札幌・道南・道北・道東",
            bn: "সাপ্পোরো, দোনান, দোহোকু, দোতো" } },
];

/**
 * The table itself, in yen, keyed by region then by size.
 *
 * Read straight off the quote. Kanto first because that is where the
 * shop is and where most orders go.
 */
export const RATES = {
  // 関東 — where the shop is, so the one most orders use.
  kanto:        { 60:670,  80:890,  100:1110, 140:1590, 160:1780, 170:3054, 180:3327, 200:4072, 220:4763, 240:6209, 260:7654 },
  shinetsu:     { 60:670,  80:890,  100:1110, 140:1590, 160:1780, 170:3054, 180:3327, 200:4072, 220:4763, 240:6209, 260:7654 },
  tokai:        { 60:670,  80:890,  100:1110, 140:1590, 160:1780, 170:3054, 180:3327, 200:4072, 220:4763, 240:6209, 260:7654 },
  hokuriku:     { 60:670,  80:890,  100:1110, 140:1590, 160:1780, 170:3054, 180:3327, 200:4072, 220:4763, 240:6209, 260:7654 },
  kansai:       { 60:760,  80:980,  100:1190, 140:1680, 160:1870, 170:3054, 180:3327, 200:4072, 220:4763, 240:6209, 260:7654 },
  chugoku:      { 60:860,  80:1070, 100:1270, 140:1780, 160:1970, 170:3327, 180:3645, 200:4445, 220:5300, 240:6909, 260:8563 },
  shikoku:      { 60:950,  80:1160, 100:1370, 140:1870, 160:2060, 170:3536, 180:3909, 200:4872, 220:5781, 240:7600, 260:9418 },
  minamitohoku: { 60:670,  80:890,  100:1110, 140:1590, 160:1780, 170:2363, 180:3109, 200:3427, 220:3700, 240:4763, 260:5836 },
  kitatohoku:   { 60:760,  80:980,  100:1190, 140:1680, 160:1870, 170:3327, 180:3645, 200:4445, 220:4927, 240:6427, 260:7918 },
  kitakyushu:   { 60:1050, 80:1260, 100:1460, 140:1980, 160:2150, 170:3536, 180:3909, 200:4872, 220:5781, 240:7600, 260:9418 },
  minamikyushu: { 60:1050, 80:1260, 100:1460, 140:1980, 160:2150, 170:3854, 180:4300, 200:5354, 220:6372, 240:8454, 260:10545 },
  hokkaido:     { 60:1050, 80:1260, 100:1460, 140:1980, 160:2150, 170:3854, 180:3854, 200:4345, 220:5354, 240:6800, 260:10654 },
};

/** The quote these came from, so the page can say where and when. */
export const QUOTE = {
  carrier: "Sagawa Express",
  carrierJa: "佐川急便株式会社",
  branch: "Tsukuba",
  branchJa: "つくば営業所",
  tel: "0570-01-0293",
  dated: "2020-02-12",
  no: "1771002 0720",
};

/**
 * Limits the quote sets out, worth repeating because they decide
 * whether a heavy order can be sent at all.
 */
export const LIMITS = {
  maxKg: 50,
  maxSize: 260,
  codOver: 300000,   // over ¥300,000 the carrier requires insurance
};
