/**
 * Countries a product can come from — every sovereign state, with its
 * flag.
 *
 * A fixed list rather than free text: a typo would otherwise split one
 * country into two, and the owner would end up with both "Bangladesh"
 * and "Bangaldesh" sitting in the shop.
 *
 * Alphabetical by English name. The list used to hold only the fifteen
 * this shop stocks most of, ordered by how much of each it sells, which
 * meant anything else simply could not be recorded. Every country is here
 * now and the order is the one you can search by eye.
 *
 * The ids are ISO two-letter codes, which is what the flag files are
 * named after — so adding a country never means finding a picture for it.
 */
export const COUNTRIES = [
  { id: "af", en: "Afghanistan", bn: "আফগানিস্তান", ja: "アフガニスタン" },
  { id: "al", en: "Albania", bn: "আলবেনিয়া", ja: "アルバニア" },
  { id: "dz", en: "Algeria", bn: "আলজেরিয়া", ja: "アルジェリア" },
  { id: "ad", en: "Andorra", bn: "অ্যান্ডোরা", ja: "アンドラ" },
  { id: "ao", en: "Angola", bn: "অ্যাঙ্গোলা", ja: "アンゴラ" },
  { id: "ag", en: "Antigua and Barbuda", bn: "অ্যান্টিগুয়া ও বারবুডা", ja: "アンティグア・バーブーダ" },
  { id: "ar", en: "Argentina", bn: "আর্জেন্টিনা", ja: "アルゼンチン" },
  { id: "am", en: "Armenia", bn: "আর্মেনিয়া", ja: "アルメニア" },
  { id: "au", en: "Australia", bn: "অস্ট্রেলিয়া", ja: "オーストラリア" },
  { id: "at", en: "Austria", bn: "অস্ট্রিয়া", ja: "オーストリア" },
  { id: "az", en: "Azerbaijan", bn: "আজারবাইজান", ja: "アゼルバイジャン" },
  { id: "bs", en: "Bahamas", bn: "বাহামা", ja: "バハマ" },
  { id: "bh", en: "Bahrain", bn: "বাহরাইন", ja: "バーレーン" },
  { id: "bd", en: "Bangladesh", bn: "বাংলাদেশ", ja: "バングラデシュ" },
  { id: "bb", en: "Barbados", bn: "বার্বাডোস", ja: "バルバドス" },
  { id: "by", en: "Belarus", bn: "বেলারুশ", ja: "ベラルーシ" },
  { id: "be", en: "Belgium", bn: "বেলজিয়াম", ja: "ベルギー" },
  { id: "bz", en: "Belize", bn: "বেলিজ", ja: "ベリーズ" },
  { id: "bj", en: "Benin", bn: "বেনিন", ja: "ベナン" },
  { id: "bt", en: "Bhutan", bn: "ভুটান", ja: "ブータン" },
  { id: "bo", en: "Bolivia", bn: "বলিভিয়া", ja: "ボリビア" },
  { id: "ba", en: "Bosnia and Herzegovina", bn: "বসনিয়া ও হার্জেগোভিনা", ja: "ボスニア・ヘルツェゴビナ" },
  { id: "bw", en: "Botswana", bn: "বতসোয়ানা", ja: "ボツワナ" },
  { id: "br", en: "Brazil", bn: "ব্রাজিল", ja: "ブラジル" },
  { id: "bn", en: "Brunei", bn: "ব্রুনাই", ja: "ブルネイ" },
  { id: "bg", en: "Bulgaria", bn: "বুলগেরিয়া", ja: "ブルガリア" },
  { id: "bf", en: "Burkina Faso", bn: "বুরকিনা ফাসো", ja: "ブルキナファソ" },
  { id: "bi", en: "Burundi", bn: "বুরুন্ডি", ja: "ブルンジ" },
  { id: "kh", en: "Cambodia", bn: "কম্বোডিয়া", ja: "カンボジア" },
  { id: "cm", en: "Cameroon", bn: "ক্যামেরুন", ja: "カメルーン" },
  { id: "ca", en: "Canada", bn: "কানাডা", ja: "カナダ" },
  { id: "cv", en: "Cape Verde", bn: "কেপ ভার্দে", ja: "カーボベルデ" },
  { id: "cf", en: "Central African Republic", bn: "মধ্য আফ্রিকান প্রজাতন্ত্র", ja: "中央アフリカ共和国" },
  { id: "td", en: "Chad", bn: "চাদ", ja: "チャド" },
  { id: "cl", en: "Chile", bn: "চিলি", ja: "チリ" },
  { id: "cn", en: "China", bn: "চীন", ja: "中華人民共和国" },
  { id: "co", en: "Colombia", bn: "কলম্বিয়া", ja: "コロンビア" },
  { id: "km", en: "Comoros", bn: "কোমোরোস", ja: "コモロ" },
  { id: "cg", en: "Congo", bn: "কঙ্গো প্রজাতন্ত্র", ja: "コンゴ共和国" },
  { id: "cr", en: "Costa Rica", bn: "কোস্টারিকা", ja: "コスタリカ" },
  { id: "hr", en: "Croatia", bn: "ক্রোয়েশিয়া", ja: "クロアチア" },
  { id: "cu", en: "Cuba", bn: "কিউবা", ja: "キューバ" },
  { id: "cy", en: "Cyprus", bn: "সাইপ্রাস", ja: "キプロス" },
  { id: "cz", en: "Czechia", bn: "চেকিয়া", ja: "チェコ" },
  { id: "cd", en: "DR Congo", bn: "গণপ্রজাতন্ত্রী কঙ্গো", ja: "コンゴ民主共和国" },
  { id: "dk", en: "Denmark", bn: "ডেনমার্ক", ja: "デンマーク" },
  { id: "dj", en: "Djibouti", bn: "জিবুতি", ja: "ジブチ" },
  { id: "dm", en: "Dominica", bn: "ডোমিনিকা", ja: "ドミニカ国" },
  { id: "do", en: "Dominican Republic", bn: "ডোমিনিকান প্রজাতন্ত্র", ja: "ドミニカ共和国" },
  { id: "ec", en: "Ecuador", bn: "ইকুয়েডর", ja: "エクアドル" },
  { id: "eg", en: "Egypt", bn: "মিশর", ja: "エジプト" },
  { id: "sv", en: "El Salvador", bn: "এল সালভাদর", ja: "エルサルバドル" },
  { id: "gq", en: "Equatorial Guinea", bn: "নিরক্ষীয় গিনি", ja: "赤道ギニア" },
  { id: "er", en: "Eritrea", bn: "ইরিত্রিয়া", ja: "エリトリア" },
  { id: "ee", en: "Estonia", bn: "এস্তোনিয়া", ja: "エストニア" },
  { id: "sz", en: "Eswatini", bn: "এসোয়াতিনি", ja: "エスワティニ" },
  { id: "et", en: "Ethiopia", bn: "ইথিওপিয়া", ja: "エチオピア" },
  { id: "fj", en: "Fiji", bn: "ফিজি", ja: "フィジー" },
  { id: "fi", en: "Finland", bn: "ফিনল্যান্ড", ja: "フィンランド" },
  { id: "fr", en: "France", bn: "ফ্রান্স", ja: "フランス" },
  { id: "ga", en: "Gabon", bn: "গ্যাবন", ja: "ガボン" },
  { id: "gm", en: "Gambia", bn: "গাম্বিয়া", ja: "ガンビア" },
  { id: "ge", en: "Georgia", bn: "জর্জিয়া", ja: "ジョージア" },
  { id: "de", en: "Germany", bn: "জার্মানি", ja: "ドイツ" },
  { id: "gh", en: "Ghana", bn: "ঘানা", ja: "ガーナ" },
  { id: "gr", en: "Greece", bn: "গ্রিস", ja: "ギリシャ" },
  { id: "gd", en: "Grenada", bn: "গ্রেনাডা", ja: "グレナダ" },
  { id: "gt", en: "Guatemala", bn: "গুয়াতেমালা", ja: "グアテマラ" },
  { id: "gn", en: "Guinea", bn: "গিনি", ja: "ギニア" },
  { id: "gw", en: "Guinea-Bissau", bn: "গিনি-বিসাউ", ja: "ギニアビサウ" },
  { id: "gy", en: "Guyana", bn: "গায়ানা", ja: "ガイアナ" },
  { id: "ht", en: "Haiti", bn: "হাইতি", ja: "ハイチ" },
  { id: "hn", en: "Honduras", bn: "হন্ডুরাস", ja: "ホンジュラス" },
  { id: "hu", en: "Hungary", bn: "হাঙ্গেরি", ja: "ハンガリー" },
  { id: "is", en: "Iceland", bn: "আইসল্যান্ড", ja: "アイスランド" },
  { id: "in", en: "India", bn: "ভারত", ja: "インド" },
  { id: "id", en: "Indonesia", bn: "ইন্দোনেশিয়া", ja: "インドネシア" },
  { id: "ir", en: "Iran", bn: "ইরান", ja: "イラン" },
  { id: "iq", en: "Iraq", bn: "ইরাক", ja: "イラク" },
  { id: "ie", en: "Ireland", bn: "আয়ারল্যান্ড", ja: "アイルランド" },
  { id: "il", en: "Israel", bn: "ইসরায়েল", ja: "イスラエル" },
  { id: "it", en: "Italy", bn: "ইতালি", ja: "イタリア" },
  { id: "ci", en: "Ivory Coast", bn: "আইভরি কোস্ট", ja: "コートジボワール" },
  { id: "jm", en: "Jamaica", bn: "জ্যামাইকা", ja: "ジャマイカ" },
  { id: "jp", en: "Japan", bn: "জাপান", ja: "日本" },
  { id: "jo", en: "Jordan", bn: "জর্ডান", ja: "ヨルダン" },
  { id: "kz", en: "Kazakhstan", bn: "কাজাখস্তান", ja: "カザフスタン" },
  { id: "ke", en: "Kenya", bn: "কেনিয়া", ja: "ケニア" },
  { id: "ki", en: "Kiribati", bn: "কিরিবাতি", ja: "キリバス" },
  { id: "kw", en: "Kuwait", bn: "কুয়েত", ja: "クウェート" },
  { id: "kg", en: "Kyrgyzstan", bn: "কিরগিজস্তান", ja: "キルギス" },
  { id: "la", en: "Laos", bn: "লাওস", ja: "ラオス" },
  { id: "lv", en: "Latvia", bn: "লাটভিয়া", ja: "ラトビア" },
  { id: "lb", en: "Lebanon", bn: "লেবানন", ja: "レバノン" },
  { id: "ls", en: "Lesotho", bn: "লেসোথো", ja: "レソト" },
  { id: "lr", en: "Liberia", bn: "লাইবেরিয়া", ja: "リベリア" },
  { id: "ly", en: "Libya", bn: "লিবিয়া", ja: "リビア" },
  { id: "li", en: "Liechtenstein", bn: "লিশটেনস্টাইন", ja: "リヒテンシュタイン" },
  { id: "lt", en: "Lithuania", bn: "লিথুয়ানিয়া", ja: "リトアニア" },
  { id: "lu", en: "Luxembourg", bn: "লুক্সেমবার্গ", ja: "ルクセンブルク" },
  { id: "mg", en: "Madagascar", bn: "মাদাগাস্কার", ja: "マダガスカル" },
  { id: "mw", en: "Malawi", bn: "মালাউই", ja: "マラウイ" },
  { id: "my", en: "Malaysia", bn: "মালয়েশিয়া", ja: "マレーシア" },
  { id: "mv", en: "Maldives", bn: "মালদ্বীপ", ja: "モルディブ" },
  { id: "ml", en: "Mali", bn: "মালি", ja: "マリ共和国" },
  { id: "mt", en: "Malta", bn: "মাল্টা", ja: "マルタ" },
  { id: "mh", en: "Marshall Islands", bn: "মার্শাল দ্বীপপুঞ্জ", ja: "マーシャル諸島" },
  { id: "mr", en: "Mauritania", bn: "মৌরিতানিয়া", ja: "モーリタニア" },
  { id: "mu", en: "Mauritius", bn: "মরিশাস", ja: "モーリシャス" },
  { id: "mx", en: "Mexico", bn: "মেক্সিকো", ja: "メキシコ" },
  { id: "fm", en: "Micronesia", bn: "মাইক্রোনেশিয়া", ja: "ミクロネシア連邦" },
  { id: "md", en: "Moldova", bn: "মলদোভা", ja: "モルドバ" },
  { id: "mc", en: "Monaco", bn: "মোনাকো", ja: "モナコ" },
  { id: "mn", en: "Mongolia", bn: "মঙ্গোলিয়া", ja: "モンゴル国" },
  { id: "me", en: "Montenegro", bn: "মন্টিনিগ্রো", ja: "モンテネグロ" },
  { id: "ma", en: "Morocco", bn: "মরক্কো", ja: "モロッコ" },
  { id: "mz", en: "Mozambique", bn: "মোজাম্বিক", ja: "モザンビーク" },
  { id: "mm", en: "Myanmar", bn: "মিয়ানমার", ja: "ミャンマー" },
  { id: "na", en: "Namibia", bn: "নামিবিয়া", ja: "ナミビア" },
  { id: "nr", en: "Nauru", bn: "নাউরু", ja: "ナウル" },
  { id: "np", en: "Nepal", bn: "নেপাল", ja: "ネパール" },
  { id: "nl", en: "Netherlands", bn: "নেদারল্যান্ডস", ja: "オランダ王国" },
  { id: "nz", en: "New Zealand", bn: "নিউজিল্যান্ড", ja: "ニュージーランド" },
  { id: "ni", en: "Nicaragua", bn: "নিকারাগুয়া", ja: "ニカラグア" },
  { id: "ne", en: "Niger", bn: "নাইজার", ja: "ニジェール" },
  { id: "ng", en: "Nigeria", bn: "নাইজেরিয়া", ja: "ナイジェリア" },
  { id: "kp", en: "North Korea", bn: "উত্তর কোরিয়া", ja: "朝鮮民主主義人民共和国" },
  { id: "mk", en: "North Macedonia", bn: "উত্তর মেসিডোনিয়া", ja: "北マケドニア" },
  { id: "no", en: "Norway", bn: "নরওয়ে", ja: "ノルウェー" },
  { id: "om", en: "Oman", bn: "ওমান", ja: "オマーン" },
  { id: "pk", en: "Pakistan", bn: "পাকিস্তান", ja: "パキスタン" },
  { id: "pw", en: "Palau", bn: "পালাউ", ja: "パラオ" },
  { id: "ps", en: "Palestine", bn: "ফিলিস্তিন", ja: "パレスチナ国" },
  { id: "pa", en: "Panama", bn: "পানামা", ja: "パナマ" },
  { id: "pg", en: "Papua New Guinea", bn: "পাপুয়া নিউ গিনি", ja: "パプアニューギニア" },
  { id: "py", en: "Paraguay", bn: "প্যারাগুয়ে", ja: "パラグアイ" },
  { id: "pe", en: "Peru", bn: "পেরু", ja: "ペルー" },
  { id: "ph", en: "Philippines", bn: "ফিলিপাইন", ja: "フィリピン" },
  { id: "pl", en: "Poland", bn: "পোল্যান্ড", ja: "ポーランド" },
  { id: "pt", en: "Portugal", bn: "পর্তুগাল", ja: "ポルトガル" },
  { id: "qa", en: "Qatar", bn: "কাতার", ja: "カタール" },
  { id: "ro", en: "Romania", bn: "রোমানিয়া", ja: "ルーマニア" },
  { id: "ru", en: "Russia", bn: "রাশিয়া", ja: "ロシア" },
  { id: "rw", en: "Rwanda", bn: "রুয়ান্ডা", ja: "ルワンダ" },
  { id: "kn", en: "Saint Kitts and Nevis", bn: "সেন্ট কিটস ও নেভিস", ja: "セントクリストファー・ネイビス" },
  { id: "lc", en: "Saint Lucia", bn: "সেন্ট লুসিয়া", ja: "セントルシア" },
  { id: "vc", en: "Saint Vincent and the Grenadines", bn: "সেন্ট ভিনসেন্ট ও গ্রেনাডাইনস", ja: "セントビンセント・グレナディーン" },
  { id: "ws", en: "Samoa", bn: "সামোয়া", ja: "サモア" },
  { id: "sm", en: "San Marino", bn: "সান মারিনো", ja: "サンマリノ" },
  { id: "sa", en: "Saudi Arabia", bn: "সৌদি আরব", ja: "サウジアラビア" },
  { id: "sn", en: "Senegal", bn: "সেনেগাল", ja: "セネガル" },
  { id: "rs", en: "Serbia", bn: "সার্বিয়া", ja: "セルビア" },
  { id: "sc", en: "Seychelles", bn: "সেশেলস", ja: "セーシェル" },
  { id: "sl", en: "Sierra Leone", bn: "সিয়েরা লিওন", ja: "シエラレオネ" },
  { id: "sg", en: "Singapore", bn: "সিঙ্গাপুর", ja: "シンガポール" },
  { id: "sk", en: "Slovakia", bn: "স্লোভাকিয়া", ja: "スロバキア" },
  { id: "si", en: "Slovenia", bn: "স্লোভেনিয়া", ja: "スロベニア" },
  { id: "sb", en: "Solomon Islands", bn: "সলোমন দ্বীপপুঞ্জ", ja: "ソロモン諸島" },
  { id: "so", en: "Somalia", bn: "সোমালিয়া", ja: "ソマリア" },
  { id: "za", en: "South Africa", bn: "দক্ষিণ আফ্রিকা", ja: "南アフリカ共和国" },
  { id: "kr", en: "South Korea", bn: "দক্ষিণ কোরিয়া", ja: "大韓民国" },
  { id: "ss", en: "South Sudan", bn: "দক্ষিণ সুদান", ja: "南スーダン" },
  { id: "es", en: "Spain", bn: "স্পেন", ja: "スペイン" },
  { id: "lk", en: "Sri Lanka", bn: "শ্রীলঙ্কা", ja: "スリランカ" },
  { id: "sd", en: "Sudan", bn: "সুদান", ja: "スーダン" },
  { id: "sr", en: "Suriname", bn: "সুরিনাম", ja: "スリナム" },
  { id: "se", en: "Sweden", bn: "সুইডেন", ja: "スウェーデン" },
  { id: "ch", en: "Switzerland", bn: "সুইজারল্যান্ড", ja: "スイス" },
  { id: "sy", en: "Syria", bn: "সিরিয়া", ja: "シリア" },
  { id: "st", en: "São Tomé and Príncipe", bn: "সাও তোমে ও প্রিন্সিপে", ja: "サントメ・プリンシペ" },
  { id: "tj", en: "Tajikistan", bn: "তাজিকিস্তান", ja: "タジキスタン" },
  { id: "tz", en: "Tanzania", bn: "তানজানিয়া", ja: "タンザニア" },
  { id: "th", en: "Thailand", bn: "থাইল্যান্ড", ja: "タイ王国" },
  { id: "tl", en: "Timor-Leste", bn: "পূর্ব তিমুর", ja: "東ティモール" },
  { id: "tg", en: "Togo", bn: "টোগো", ja: "トーゴ" },
  { id: "to", en: "Tonga", bn: "টোঙ্গা", ja: "トンガ" },
  { id: "tt", en: "Trinidad and Tobago", bn: "ত্রিনিদাদ ও টোবাগো", ja: "トリニダード・トバゴ" },
  { id: "tn", en: "Tunisia", bn: "তিউনিসিয়া", ja: "チュニジア" },
  { id: "tr", en: "Turkey", bn: "তুরস্ক", ja: "トルコ" },
  { id: "tm", en: "Turkmenistan", bn: "তুর্কমেনিস্তান", ja: "トルクメニスタン" },
  { id: "tv", en: "Tuvalu", bn: "টুভালু", ja: "ツバル" },
  { id: "ug", en: "Uganda", bn: "উগান্ডা", ja: "ウガンダ" },
  { id: "ua", en: "Ukraine", bn: "ইউক্রেন", ja: "ウクライナ" },
  { id: "ae", en: "United Arab Emirates", bn: "সংযুক্ত আরব আমিরাত", ja: "アラブ首長国連邦" },
  { id: "gb", en: "United Kingdom", bn: "যুক্তরাজ্য", ja: "イギリス" },
  { id: "us", en: "United States", bn: "যুক্তরাষ্ট্র", ja: "アメリカ合衆国" },
  { id: "uy", en: "Uruguay", bn: "উরুগুয়ে", ja: "ウルグアイ" },
  { id: "uz", en: "Uzbekistan", bn: "উজবেকিস্তান", ja: "ウズベキスタン" },
  { id: "vu", en: "Vanuatu", bn: "ভানুয়াতু", ja: "バヌアツ" },
  { id: "va", en: "Vatican City", bn: "ভ্যাটিকান সিটি", ja: "バチカン" },
  { id: "ve", en: "Venezuela", bn: "ভেনেজুয়েলা", ja: "ベネズエラ" },
  { id: "vn", en: "Vietnam", bn: "ভিয়েতনাম", ja: "ベトナム" },
  { id: "ye", en: "Yemen", bn: "ইয়েমেন", ja: "イエメン" },
  { id: "zm", en: "Zambia", bn: "জাম্বিয়া", ja: "ザンビア" },
  { id: "zw", en: "Zimbabwe", bn: "জিম্বাবুয়ে", ja: "ジンバブエ" },
];

/** One country by id, or null. */
export const countryById = id =>
  COUNTRIES.find(c => c.id === id) || null;

/** Its name in the reader's language, falling back to English. */
export const countryName = (id, lang = "en") => {
  const c = countryById(id);
  return c ? (c[lang] || c.en) : "";
};

/**
 * Countries that actually have something to show, in list order.
 *
 * A country with no products must not appear — an empty subcategory is
 * a dead end for the customer.
 */
export function countriesInUse(catalog){
  const counts = new Map();

  for (const cat of catalog){
    for (const p of cat.items){
      if (!p.country) continue;
      counts.set(p.country, (counts.get(p.country) || 0) + 1);
    }
  }

  return COUNTRIES
    .filter(c => counts.has(c.id))
    .map(c => ({ ...c, count: counts.get(c.id) }));
}

/** Every product from one country, across all categories. */
export function productsFrom(catalog, countryId){
  const out = [];
  for (const cat of catalog){
    for (const p of cat.items){
      if (p.country === countryId) out.push({ ...p, catId: cat.id, catEn: cat.en });
    }
  }
  return out;
}

/* --------------------------- browsing by country ------------------------
 *
 * Countrywise is a way of browsing rather than a category, and it is now
 * defined in features/catalog/shelves.js alongside New and Popular — the
 * other two ways of looking at the shop that cut across its categories.
 *
 * It used to be a row in the categories table, which is what kept letting
 * it appear as somewhere a product could be filed. A shelf has no row, so
 * every category the owner sees is a real one and needs no filtering.
 */
