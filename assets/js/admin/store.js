/**
 * Catalogue storage — the seam between the UI and wherever data lives.
 *
 * Right now everything is kept in localStorage, seeded from catalog.js on
 * first run. To move to a real backend, reimplement these functions to call
 * your API; nothing else in the admin panel needs to change.
 */
import { CATALOG } from "../data/catalog.js";

const KEY = "aa-catalog";

/** Deep clone without structuredClone, which older Safari lacks. */
const clone = v => JSON.parse(JSON.stringify(v));

/** Read the working catalogue (localStorage, or the bundled data). */
export function load(){
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupt or unavailable — fall through to defaults */ }
  return clone(CATALOG);
}

/** Persist the whole catalogue. */
export function save(catalog){
  try {
    localStorage.setItem(KEY, JSON.stringify(catalog));
    return true;
  } catch (e) {
    // Most likely the 5MB quota, hit by base64 images.
    console.error("save failed:", e);
    return false;
  }
}

/** Throw away local edits and go back to the shipped catalog.js. */
export function reset(){
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return clone(CATALOG);
}

/** True when local edits exist. */
export function isDirty(){
  try { return localStorage.getItem(KEY) !== null; }
  catch { return false; }
}

/* ------------------------------ products ------------------------------ */

export function addProduct(catalog, categoryId, product){
  const cat = catalog.find(c => c.id === categoryId);
  if (!cat) return catalog;
  cat.items.push(product);
  return catalog;
}

export function updateProduct(catalog, categoryId, index, product){
  const cat = catalog.find(c => c.id === categoryId);
  if (cat?.items[index]) cat.items[index] = product;
  return catalog;
}

export function deleteProduct(catalog, categoryId, index){
  const cat = catalog.find(c => c.id === categoryId);
  if (cat) cat.items.splice(index, 1);
  return catalog;
}

/* ----------------------------- categories ----------------------------- */

export function addCategory(catalog, category){
  catalog.push({ ...category, items: [] });
  return catalog;
}

export function deleteCategory(catalog, categoryId){
  const i = catalog.findIndex(c => c.id === categoryId);
  if (i > -1) catalog.splice(i, 1);
  return catalog;
}

/* ------------------------------- export ------------------------------- */

/**
 * Rebuild catalog.js source from the working catalogue, so edits can be
 * committed to the repo and become the real defaults.
 */
export function toSource(catalog){
  const s = v => JSON.stringify(v);

  const item = p => {
    const parts = [
      `en:${s(p.en)}`, `bn:${s(p.bn)}`, `ja:${s(p.ja)}`,
      `w:${s(p.w)}`, `p:${p.p}`, `was:${p.was || 0}`, `img:${s(p.img || "")}`
    ];
    if (p.tag) parts.push(`tag:${s(p.tag)}`);
    return `      { ${parts.join(", ")} }`;
  };

  const cat = c =>
    `  { id:${s(c.id)}, icon:${s(c.icon)}, img:${s(c.img)},\n` +
    `    en:${s(c.en)}, bn:${s(c.bn)}, ja:${s(c.ja)},\n` +
    `    items:[\n${c.items.map(item).join(",\n")}\n    ]}`;

  return `/* Product catalogue — see docs at bottom of file */\n` +
         `export const CATALOG = [\n${catalog.map(cat).join(",\n\n")}\n];\n`;
}

/** Trigger a download of the regenerated catalog.js. */
export function downloadSource(catalog){
  const blob = new Blob([toSource(catalog)], { type: "text/javascript" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = "catalog.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =============================== DEALS ================================
   The "Today's Deal & New Arrival" strip on the homepage.
   Same pattern as the catalogue: localStorage, seeded from the data file.
   ====================================================================== */

const DEAL_KEY = "aa-deals";

export function loadDeals(defaults){
  try {
    const raw = localStorage.getItem(DEAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* fall through */ }
  return clone(defaults);
}

export function saveDeals(items){
  try {
    localStorage.setItem(DEAL_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error("saveDeals failed:", e);
    return false;
  }
}

export function resetDeals(defaults){
  try { localStorage.removeItem(DEAL_KEY); } catch { /* ignore */ }
  return clone(defaults);
}

export const dealsDirty = () => {
  try { return localStorage.getItem(DEAL_KEY) !== null; }
  catch { return false; }
};
