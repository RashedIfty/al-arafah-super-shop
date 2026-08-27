/**
 * AI re-ranking, layered on top of the local search.
 *
 * Local search always runs first and its results are what the customer
 * sees. For conversational queries the shortlist is sent to an Edge
 * Function, which returns a better order. Anything that goes wrong -
 * rate limit, timeout, outage - leaves the local order untouched, so
 * search never breaks.
 */
import { SUPABASE, isConfigured } from "../../backend/config.js";

const ENDPOINT = () => `${SUPABASE.URL}/functions/v1/smart-search`;

/** Give up rather than make the customer wait. */
const TIMEOUT = 2500;

/** How many local hits to hand the model. */
const SHORTLIST = 15;

/** Repeated queries within a session cost nothing. */
const cache = new Map();
const CACHE_MAX = 50;

/**
 * Is this worth an API call?
 *
 * Single product words are already handled well locally and answering
 * them instantly matters more than a marginally better order. Only
 * phrases that read like a question or a need go to the model.
 */
export function worthAsking(query){
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);

  if (words.length < 2) return false;        // "chicken", "মাছ"
  if (q.length > 120) return false;          // not a real query

  // Phrases that signal intent rather than a product name.
  const CONVERSATIONAL = [
    "for", "something", "what", "which", "need", "want", "good",
    "best", "cheap", "quick", "healthy", "kids", "party", "dinner",
    "lunch", "breakfast", "recipe", "cook", "make", "with",
    "জন্য", "কি", "ভালো", "সস্তা",
    "ため", "おすすめ", "安い", "料理"
  ];

  return words.some(w => CONVERSATIONAL.includes(w));
}

/**
 * Re-rank `results` (from the local engine) for `query`.
 * Returns a new array, or the original if the model was not consulted.
 */
export async function rerank(query, results){
  if (!isConfigured() || !results.length) return results;
  if (!worthAsking(query)) return results;

  const key = query.trim().toLowerCase();
  if (cache.has(key)) return applyOrder(results, cache.get(key));

  const shortlist = results.slice(0, SHORTLIST);

  const candidates = shortlist.map(r => ({
    name: r.product.en,
    cat:  r.product._cat ?? "",
    w:    r.product.w ?? "",
    p:    r.product.p,
    sale: r.product.was > r.product.p
  }));

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT);

  try {
    const res = await fetch(ENDPOINT(), {
      method: "POST",
      signal: abort.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE.KEY}`,
        "apikey": SUPABASE.KEY
      },
      body: JSON.stringify({ query, candidates })
    });

    const data = await res.json();

    // No order means the model declined or failed; keep what we had.
    if (!Array.isArray(data.order) || !data.order.length) return results;

    remember(key, data.order);
    return applyOrder(results, data.order);

  } catch {
    return results;               // timeout, offline, anything
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Put the shortlist in the model's order, then append everything it did
 * not mention. Dropping an item entirely would hide a valid local match.
 */
function applyOrder(results, order){
  const shortlist = results.slice(0, SHORTLIST);
  const rest = results.slice(SHORTLIST);

  const picked = order
    .filter(i => i >= 0 && i < shortlist.length)
    .map(i => shortlist[i]);

  const seen = new Set(picked);
  const unpicked = shortlist.filter(r => !seen.has(r));

  return [...picked, ...unpicked, ...rest];
}

function remember(key, order){
  cache.set(key, order);
  if (cache.size > CACHE_MAX)
    cache.delete(cache.keys().next().value);   // drop the oldest
}
