/**
 * The ticker — the strip of moving text across the very top of the page.
 *
 * A line about the shop, scrolling past. Not the owner's announcement,
 * which sits lower down and says one specific thing on a given day; these
 * are the standing claims — halal, fresh, three languages, delivery — the
 * ones true every day and worth a customer knowing in their first second.
 *
 * The order is shuffled on every visit, so someone coming back sees a
 * different line first rather than the same one wearing out. Which is why
 * the lines have to be interchangeable: any of them can lead.
 *
 * Written in all three languages, like everything else a customer reads.
 */

/**
 * The lines.
 *
 * Kept short: this is read sideways at walking speed, not studied. Each
 * carries an icon name from shared/ui/icons.js, or "" for none.
 */
export const LINES = [
  { icon: "check",
    en: "100% Halal — certified suppliers, every single item",
    bn: "১০০% হালাল — প্রতিটি পণ্য সার্টিফাইড সরবরাহকারীর কাছ থেকে",
    ja: "100% ハラール — 認証済みの仕入先から、すべての商品" },

  { icon: "box",
    en: "Free delivery on orders over ¥8,000",
    bn: "৮,০০০ ইয়েনের বেশি অর্ডারে ফ্রি ডেলিভারি",
    ja: "8,000円以上のご注文で送料無料" },

  { icon: "star",
    en: "Fresh meat, fish and vegetables — in daily",
    bn: "তাজা মাংস, মাছ ও সবজি — প্রতিদিন আসে",
    ja: "新鮮な肉・魚・野菜 — 毎日入荷" },

  { icon: "phone",
    en: "We speak Bangla, English and 日本語",
    bn: "আমরা বাংলা, ইংরেজি ও জাপানি ভাষায় কথা বলি",
    ja: "ベンガル語・英語・日本語で対応します" },

  { icon: "pin",
    en: "Your neighbourhood halal shop in Tsukuba",
    bn: "সুকুবায় আপনার পাড়ার হালাল দোকান",
    ja: "つくばの、ご近所のハラールショップ" },

  { icon: "fire",
    en: "Rice, spices and lentils straight from home",
    bn: "চাল, মসলা আর ডাল — একদম দেশের মতো",
    ja: "米・スパイス・豆類を本場の味そのままに" },

  { icon: "clock",
    en: "Open every day, holidays included",
    bn: "ছুটির দিনসহ প্রতিদিন খোলা",
    ja: "祝日も含めて年中無休" },

  { icon: "bulb",
    en: "A family-run shop — we know our customers by name",
    bn: "পারিবারিকভাবে চালানো দোকান — ক্রেতাদের আমরা নাম ধরে চিনি",
    ja: "家族経営のお店 — お客様をお名前で覚えています" },
];

/**
 * The lines in a fresh order.
 *
 * Fisher-Yates on a copy: the exported list keeps its written order, so
 * nothing downstream depends on where a line happens to have landed.
 *
 * A different first line on each visit is the point of the shuffle. There
 * is no seed and no memory of last time — a returning customer should not
 * be able to predict the strip, and neither should they have to.
 */
export function shuffled(){
  const out = LINES.slice();
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
