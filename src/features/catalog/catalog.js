/* Product catalogue.
 *
 * Products are managed in the owner's panel and live in the database.
 *
 * The categories below are a shape to paint before the database answers,
 * and nothing more. Their products are deliberately empty.
 *
 * This list used to carry every product too, from before the shop had a
 * database. It then stayed frozen while the real shop moved on, so the
 * shelves it described were long gone — and a first-time visitor on a
 * slow connection could be shown a shopful of things the shop no longer
 * sells. An empty category for half a second is honest; a full one that
 * is wrong is not.
 */
const DEFAULT_CATALOG = [
  { id:"cooking", icon:"", img:"/images/categories/cooking.jpg",
    en:"Cooking", bn:"রান্নার সামগ্রী", ja:"調理用品",
    items:[] },

  { id:"meat-fish", icon:"", img:"/images/categories/meat-fish.jpg",
    en:"Meat & Fish", bn:"মাংস ও মাছ", ja:"肉・魚",
    items:[] },

  { id:"masala", icon:"", img:"/images/categories/masala.jpg",
    en:"Masala & Spices", bn:"মসলা", ja:"スパイス",
    items:[] },

  { id:"lentils", icon:"", img:"/images/categories/lentils.jpg",
    en:"Lentils & Beans", bn:"ডাল ও শিম", ja:"豆類",
    items:[] },

  { id:"snacks", icon:"", img:"/images/categories/snacks.jpg",
    en:"Snacks & Sweets", bn:"স্ন্যাকস ও মিষ্টি", ja:"スナック・お菓子",
    items:[] },

  { id:"drinks", icon:"", img:"/images/categories/drinks.jpg",
    en:"Drinks & Beverage", bn:"পানীয়", ja:"飲み物",
    items:[] },

  { id:"veg", icon:"", img:"/images/categories/veg.jpg",
    en:"Fruits & Vegetables", bn:"ফল ও সবজি", ja:"野菜・果物",
    items:[] },

  { id:"nuts", icon:"", img:"/images/categories/nuts.jpg",
    en:"Nuts & Dry Fruits", bn:"বাদাম ও শুকনো ফল", ja:"ナッツ・ドライフルーツ",
    items:[] },

  { id:"beauty", icon:"", img:"/images/categories/beauty.jpg",
    en:"Beauty & Health", bn:"রূপচর্চা ও স্বাস্থ্য", ja:"美容・健康",
    items:[] }
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
