/* ==========================================================================
   Today's Deal & New Arrival — the strip at the top of the homepage.
   ==========================================================================
   Deals are managed in the owner's panel and live in the database. There
   is nothing to edit here.

   This file used to hold the list itself, from before the shop had a
   database. That list stayed frozen at whatever was on offer the day it
   was written, so long after those deals were removed a returning
   visitor still saw them flash up for an instant before the real ones
   arrived. It is empty now, and deliberately so: an empty strip for the
   half-second before the database answers is honest, where six deals the
   shop stopped selling months ago is not.
   ========================================================================== */

const DEFAULT_ANNOUNCEMENTS = {

  /* Turn the whole top banner on/off */
  ACTIVE: true,

  /* Date shown next to the heading — free text, write it however you like. */
  updated: {
    en: "Updated today",
    bn: "আজ আপডেট করা হয়েছে",
    ja: "本日更新"
  },

  /* No items here on purpose — see the note at the top of the file.
     The strip fills from the database, or from the last reply this
     browser saw. */
  items: []
};

/* The strip paints immediately, then repaints when the database answers.

   Without a cache that first paint uses the list bundled above, which is
   whatever the shop was selling when this file was written — so a
   returning visitor saw deals the owner had removed flash up and vanish.
   The catalogue already solved this the same way; the deals strip was
   left behind.

   Keeping the last real reply means a returning visitor's first paint is
   already right. The bundled list is then only what it claims to be: a
   fallback for a browser that has never reached the database. */
const CACHE_KEY = "aa-deals";

function readCache(){
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return Array.isArray(data) ? data : null;
  } catch { return null; }
}

function writeCache(items){
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)); }
  catch { /* private mode, or over quota — the strip still works */ }
}

/**
 * Deals come from Supabase when configured, otherwise the last reply this
 * browser saw, otherwise the defaults above.
 */
const cached = readCache();

export let ANNOUNCEMENTS = cached
  ? { ...DEFAULT_ANNOUNCEMENTS, items: cached }
  : DEFAULT_ANNOUNCEMENTS;

/**
 * Drop deals whose product is no longer on the shelf.
 *
 * A deal keeps its own copy of the product rather than a reference, so
 * that its offer price is independent of the shelf price. The cost is
 * that a deal can outlive its product. Removing the product now clears
 * its deals, but this guards the ones made before that, and anything
 * changed straight in the database.
 *
 * Deals are matched to products by name and weight, which is what the
 * deal was built from.
 */
function onlyStillSold(items, catalog){
  if (!items?.length || !catalog?.length) return items ?? [];

  const shelf = new Set();
  for (const cat of catalog)
    for (const p of cat.items) shelf.add(`${p.en} ${p.w}`);

  return items.filter(d => shelf.has(`${d.en} ${d.w}`));
}

export async function refreshDeals(){
  try {
    const { fetchDeals, fetchCatalog } = await import("../../backend/client.js");

    // Fetch the shelf alongside the deals rather than reading the shared
    // CATALOG: the two refreshes run in parallel, so that copy may still
    // be the previous one and a just-removed product would slip through.
    const [live, shelf] = await Promise.all([fetchDeals(), fetchCatalog()]);

    if (live){
      const items = shelf ? onlyStillSold(live, shelf) : live;
      ANNOUNCEMENTS = { ...DEFAULT_ANNOUNCEMENTS, items };

      /* Cached even when empty: an owner who has removed every deal must
         get an empty strip next time, not the bundled list back. */
      writeCache(items);
    }
  } catch (e) {
    console.warn("Using bundled deals:", e.message);
  }
  return ANNOUNCEMENTS;
}

export { DEFAULT_ANNOUNCEMENTS };
