/**
 * The basket.
 *
 * Three parts of the page need the same answer: the button on every
 * card, the count in the header, and the cart page itself. They all read
 * from here and all repaint when it changes, so adding something from a
 * product card turns the header count over too — the same arrangement
 * favourites uses in features/account/account.js.
 *
 * What is stored is a product id and a quantity, never a copy of the
 * product. The name, price and photograph are looked up in the catalogue
 * each time the cart is drawn, so a price the owner changes this morning
 * is the price a customer sees this afternoon. A product that leaves the
 * shop simply drops out of the basket rather than lingering as a line
 * nobody can sell.
 *
 * It lives in localStorage, not the session: a basket belongs to the
 * browser. Signing out does not empty it, and neither does closing the
 * tab. Prices are only frozen when an order is placed — see placeOrder
 * in backend/client.js.
 */
import { CATALOG } from "../catalog/catalog.js";

const KEY = "aa-cart";

/** Nobody buys ninety-nine of anything by accident; past that it is a slip. */
const MAX_QTY = 99;

/** productId → qty */
let items = read();

const listeners = new Set();
export const onCartChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => {
  write();
  listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });
};

/* ----------------------------- persistence ---------------------------- */

function read(){
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : null;
    if (!obj || typeof obj !== "object") return new Map();

    /* Rebuilt entry by entry rather than trusted wholesale: this string
       has been sitting in a browser we do not control, and a bad
       quantity here would reach an order. */
    const m = new Map();
    for (const [id, qty] of Object.entries(obj)){
      const n = Math.floor(Number(qty));
      if (id && Number.isFinite(n) && n > 0) m.set(id, Math.min(n, MAX_QTY));
    }
    return m;
  } catch { return new Map(); }
}

function write(){
  try {
    if (!items.size) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(items)));
  } catch { /* private mode: the cart lives for this page view only */ }
}

/* ------------------------------- reading ------------------------------ */

/** How many individual items, not how many kinds. */
export const cartCount = () => [...items.values()].reduce((s, n) => s + n, 0);

export const qtyOf = id => items.get(id) || 0;
export const inCart = id => items.has(id);
export const isEmpty = () => items.size === 0;

/**
 * The basket as something drawable: each line joined to the live product.
 *
 * Built the way savedProducts() builds the favourites page — a map of
 * every product in the catalogue, then a lookup per id. A line whose
 * product has gone is dropped here and swept from storage by
 * dropMissing() below.
 *
 * Returns [{ product, cat, ci, pi, qty, lineTotal }], in the order the
 * items were added.
 */
export function cartLines(){
  if (!items.size) return [];

  const byId = new Map();
  CATALOG.forEach((cat, ci) => cat.items.forEach((p, pi) => {
    if (p._id) byId.set(p._id, { product: p, cat, ci, pi });
  }));

  const out = [];
  for (const [id, qty] of items){
    const hit = byId.get(id);
    if (hit) out.push({ ...hit, qty, lineTotal: hit.product.p * qty });
  }
  return out;
}

export const cartTotal = () =>
  cartLines().reduce((s, l) => s + l.lineTotal, 0);

/**
 * Forget lines whose product is no longer in the catalogue.
 *
 * Only worth running once the catalogue has actually loaded — an empty
 * CATALOG would look like every product having vanished and would throw
 * the whole basket away.
 */
export function dropMissing(){
  if (!items.size || !CATALOG.length) return;

  const live = new Set();
  for (const cat of CATALOG)
    for (const p of cat.items) if (p._id) live.add(p._id);

  let changed = false;
  for (const id of [...items.keys()])
    if (!live.has(id)){ items.delete(id); changed = true; }

  if (changed) announce();
}

/* ------------------------------- writing ------------------------------ */

export function addToCart(id, qty = 1){
  if (!id) return;
  setQty(id, (items.get(id) || 0) + qty);
}

export function setQty(id, qty){
  if (!id) return;

  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n) || n <= 0){ removeFromCart(id); return; }

  items.set(id, Math.min(n, MAX_QTY));
  announce();
}

export function removeFromCart(id){
  if (items.delete(id)) announce();
}

export function clearCart(){
  if (!items.size) return;
  items = new Map();
  announce();
}
