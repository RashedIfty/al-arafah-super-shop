/**
 * Product search.
 *
 * Built for how customers actually type: three languages, romanised
 * spellings, typos, and descriptions of a dish rather than a product
 * name. Results are scored and ranked, not just filtered.
 */
import { SYNONYMS, RECIPES, PRICE_WORDS, SALE_WORDS } from "./synonyms.js";

/* ------------------------- vocabulary lookup -------------------------- */

/** word -> every word in its synonym group */
const EXPAND = new Map();
for (const group of SYNONYMS){
  for (const word of group){
    const key = word.toLowerCase();
    EXPAND.set(key, new Set([...(EXPAND.get(key) ?? []), ...group.map(w => w.toLowerCase())]));
  }
}

/* ------------------------------ helpers ------------------------------- */

/**
 * Lowercase and drop punctuation.
 *
 * Accent stripping is applied ONLY to Latin text: NFKD decomposition
 * would tear Bangla and Japanese apart (মাছ becomes "ম ছ", matching
 * almost anything), so those scripts are left intact.
 */
const LATIN_ONLY = /^[\u0000-\u024F\s]*$/;

const normalise = s => {
  let out = String(s ?? "").toLowerCase();

  if (LATIN_ONLY.test(out))
    out = out.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  return out
    // Keep combining marks (\p{M}): Bangla vowel signs and the hasant are
    // marks, not letters, and stripping them shatters every word.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const tokenise = s => normalise(s).split(" ").filter(Boolean);

/**
 * Damerau-Levenshtein distance, capped for speed.
 * Catches "chiken" -> "chicken" and transpositions like "recie" -> "rice".
 */
function editDistance(a, b, max = 2){
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev2 = [], prev = [], cur = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++){
    cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++){
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);

      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1);

      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;      // no point continuing
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

/**
 * How close two words are, 0 to 1.
 *
 * Short queries must be precise. A 2-3 character Bangla or Japanese word
 * carries as much meaning as a whole English word, so a loose substring
 * match on those turns "চাল" (rice) into a hit on unrelated products.
 */
function wordScore(query, target){
  if (target === query) return 1;

  const short = query.length <= 3;

  if (target.startsWith(query)) return short ? 0.95 : 0.9;

  // Substring hits mid-word are only trustworthy for longer queries.
  if (!short && target.includes(query)) return 0.75;

  // Fuzzy matching needs enough characters for a typo to be plausible,
  // and only makes sense for alphabetic scripts.
  if (query.length >= 4){
    const allowed = query.length >= 7 ? 2 : 1;
    const d = editDistance(query, target, allowed);
    if (d <= allowed) return 0.7 - d * 0.15;
  }
  return 0;
}

/** Every form of a query word: itself plus its synonyms. */
function expand(word){
  const out = new Set([word]);
  for (const syn of EXPAND.get(word) ?? []) out.add(syn);
  return out;
}

/* ------------------------------ intents ------------------------------- */

/**
 * Pull non-product meaning out of the query: price preference, "on sale",
 * and any dish whose ingredients we know.
 */
function readIntent(words){
  const intent = { price: null, sale: false, recipe: [] };
  const rest = [];

  for (const w of words){
    if (PRICE_WORDS[w]){ intent.price = PRICE_WORDS[w]; continue; }
    if (SALE_WORDS.includes(w)){ intent.sale = true; continue; }

    if (RECIPES[w]){
      intent.recipe.push(...RECIPES[w]);
      // A word can be both a dish and a product term - "biryani" names a
      // dish AND appears in "Shan Biryani Masala". Consuming it entirely
      // left nothing to match, so every product scored equally.
      rest.push(w);
      continue;
    }

    rest.push(w);
  }
  return { intent, words: rest };
}

/* ------------------------------ scoring ------------------------------- */

/**
 * Score one product against the query.
 * Fields are weighted: a hit in the name matters more than in the category.
 */
function scoreProduct(product, queryWords, intent, lang){
  const fields = [
    { text: product.en, weight: 1.0 },
    { text: product.bn, weight: 1.0 },
    { text: product.ja, weight: 1.0 },
    { text: product._cat ?? "", weight: 0.45 },
    { text: product.w ?? "", weight: 0.3 }
  ];

  // Pre-tokenise once per product.
  const tokens = fields.map(f => ({ words: tokenise(f.text), weight: f.weight }));

  let score = 0;
  let matchedAll = true;

  for (const qw of queryWords){
    const forms = expand(qw);
    let best = 0;

    for (const { words, weight } of tokens){
      for (const tw of words){
        for (const form of forms){
          const s = wordScore(form, tw) * weight;
          if (s > best) best = s;
        }
      }
    }

    if (best === 0) matchedAll = false;
    score += best;
  }

  // Every word matching beats a partial match on more words.
  if (matchedAll && queryWords.length) score *= 1.6;

  // A dish name implies ingredients, but only a strong match on the
  // product NAME counts. Matching loosely, or against the category,
  // gave every product a score and returned the whole catalogue.
  let recipeHit = 0;
  for (const ing of intent.recipe){
    for (const { words, weight } of tokens){
      if (weight < 1) continue;              // names only, not category
      for (const tw of words){
        if (wordScore(ing, tw) >= 0.9){ recipeHit += 0.9; break; }
      }
    }
  }
  score += recipeHit;

  if (score === 0) return 0;

  // Nudges rather than filters, so intent shapes the order.
  if (intent.sale && product.was > product.p) score += 1.2;
  if (intent.price === "low")  score += 0.6 / (1 + product.p / 500);
  if (intent.price === "high") score += Math.min(product.p / 3000, 0.8);
  /* What just arrived is now a shelf rather than a label, so newness is
     read from the flag; `tag` carries stock, and something the shop
     cannot sell today belongs further down the list. */
  if (product.isNew)          score += 0.15;
  if (product.tag === "out")  score -= 0.5;

  return score;
}

/* ------------------------------- search ------------------------------- */

/**
 * Rank products for `query`.
 * Returns [{ product, score }], best first. Empty query returns [].
 */
export function search(query, products, lang = "en"){
  const raw = tokenise(query);
  if (!raw.length) return [];

  const { intent, words } = readIntent(raw);

  // A query of pure intent ("offers", "cheap") still needs to return
  // something, so fall back to every product and let the nudges rank.
  const queryWords = words.length ? words : [];

  const results = [];
  for (const p of products){
    let score = queryWords.length
      ? scoreProduct(p, queryWords, intent, lang)
      : 0;

    // Intent-only query: seed a base score so nudges can order them.
    if (!queryWords.length && (intent.sale || intent.price || intent.recipe.length)){
      score = 1;
      if (intent.sale && !(p.was > p.p)) score = 0;      // "offers" means on sale
      if (score) score += scoreProduct(p, [], intent, lang);
    }

    if (score > 0) results.push({ product: p, score });
  }

  results.sort((a, b) => b.score - a.score || a.product.p - b.product.p);
  return results;
}

/** Did the query look like a typo of something we know? */
export function suggest(query, products){
  const words = tokenise(query);
  if (words.length !== 1) return null;

  const q = words[0];
  if (q.length < 4) return null;

  let best = null, bestScore = 0;
  const seen = new Set();

  for (const p of products){
    for (const text of [p.en, p.bn, p.ja]){
      for (const tw of tokenise(text)){
        if (seen.has(tw)) continue;
        seen.add(tw);
        const s = wordScore(q, tw);
        if (s > bestScore && s < 1){ bestScore = s; best = tw; }
      }
    }
  }
  return bestScore >= 0.55 ? best : null;
}
