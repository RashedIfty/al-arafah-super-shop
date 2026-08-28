/**
 * Countries a product can come from.
 *
 * Kept as a fixed list rather than free text: a typo would otherwise
 * split one country into two, and the owner would end up with both
 * "Bangladesh" and "Bangaldesh" sitting in the shop.
 *
 * The order is roughly what this shop stocks most of. Adding a country
 * is a one-line change here — nothing else needs touching.
 */
export const COUNTRIES = [
  { id: "bd", en: "Bangladesh",  bn: "বাংলাদেশ",    ja: "バングラデシュ" },
  { id: "in", en: "India",       bn: "ভারত",        ja: "インド" },
  { id: "pk", en: "Pakistan",    bn: "পাকিস্তান",    ja: "パキスタン" },
  { id: "jp", en: "Japan",       bn: "জাপান",       ja: "日本" },
  { id: "id", en: "Indonesia",   bn: "ইন্দোনেশিয়া",  ja: "インドネシア" },
  { id: "th", en: "Thailand",    bn: "থাইল্যান্ড",    ja: "タイ" },
  { id: "tr", en: "Turkey",      bn: "তুরস্ক",       ja: "トルコ" },
  { id: "my", en: "Malaysia",    bn: "মালয়েশিয়া",   ja: "マレーシア" },
  { id: "np", en: "Nepal",       bn: "নেপাল",       ja: "ネパール" },
  { id: "lk", en: "Sri Lanka",   bn: "শ্রীলঙ্কা",     ja: "スリランカ" },
  { id: "cn", en: "China",       bn: "চীন",         ja: "中国" },
  { id: "kr", en: "Korea",       bn: "কোরিয়া",      ja: "韓国" },
  { id: "vn", en: "Vietnam",     bn: "ভিয়েতনাম",    ja: "ベトナム" },
  { id: "ph", en: "Philippines", bn: "ফিলিপাইন",    ja: "フィリピン" },
  { id: "mm", en: "Myanmar",     bn: "মিয়ানমার",    ja: "ミャンマー" },
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
