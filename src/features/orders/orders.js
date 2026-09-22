/**
 * The customer's side of ordering: the orders they have placed.
 *
 * Shaped like features/account/account.js and features/cart/cart.js —
 * module state, a listener set, and an announce() that survives one bad
 * listener. The checkout page and the orders page read from here.
 *
 * Where the box goes is not kept here any more. That is the customer's
 * address book, in features/profile/profile.js; the checkout hands this
 * module the one address chosen for this order, and the order keeps its
 * own copy of it from then on — a customer who moves house next month
 * must not silently change where last month's order was sent.
 *
 * Nothing is kept in the browser. An order is a promise between two
 * people; it lives in the database and is read back per session.
 */
import { isConfigured } from "../../backend/config.js";
import { shipComplete } from "../profile/profile.js";
import { METHODS, PREPAID } from "../../shared/pay.js";

let orders = [];
let loaded = false;

const listeners = new Set();
export const onOrdersChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

/* ------------------------------- reading ------------------------------ */

export const myOrders = () => orders;
export const ordersLoaded = () => loaded;

/* ------------------------------- loading ------------------------------ */

/** The orders, for whoever is signed in. */
export async function refreshOrders(){
  if (!isConfigured()){ orders = []; loaded = true; return; }

  try {
    const api = await import("../../backend/client.js");
    const user = await api.currentUser();

    if (!user){ orders = []; loaded = true; announce(); return; }

    orders = await api.fetchMyOrders();
  } catch (e){
    console.warn("orders:", e.message);
    orders = [];
  }
  loaded = true;
  announce();
}

/* ------------------------------- writing ------------------------------ */

/**
 * Place the order.
 *
 * `ship` is where it goes — { full_name, phone, postal, address } — as
 * the checkout form has it at the moment of pressing, whatever the
 * address book says. The basket is only emptied once the order is
 * safely in the database: a customer whose network drops mid-request
 * should still have their shopping when they try again.
 */
export async function placeMyOrder({ lines, note = "", ship, code = "", pay = {} }){
  if (!shipComplete(ship)) return { ok: false, message: "incomplete-profile" };
  if (!lines?.length) return { ok: false, message: "empty-cart" };

  /* `pay` is { method, amount, ref }. A prepaid method must come with
     what was sent and the number to find it by; cash on delivery comes
     with neither. The checkout says these in words before it gets here;
     this is the last line, not the first. */
  if (!METHODS.includes(pay.method)) return { ok: false, message: "no-method" };
  if (PREPAID.includes(pay.method)){
    if (!(Number(pay.amount) > 0))   return { ok: false, message: "no-amount" };
    if (!String(pay.ref || "").trim()) return { ok: false, message: "no-ref" };
  }

  try {
    const api = await import("../../backend/client.js");
    const { data, error } = await api.placeOrder({ ship, lines, note, code, pay });
    if (error) return { ok: false, message: error.message };

    const { clearCart } = await import("../cart/cart.js");
    clearCart();

    orders = [data, ...orders];
    announce();
    return { ok: true, order: data };
  } catch (e){
    return { ok: false, message: e.message || "Could not place the order." };
  }
}

/**
 * Take one order out of the customer's own history.
 *
 * Gone from their side for good — nothing in the site will show it to
 * them again. The shop keeps its copy, because a record of a sale is
 * not the customer's to erase.
 *
 * Removed from the list here before the request finishes, and put back
 * if it fails, so the tap feels immediate on a slow phone.
 */
export async function hideMyOrder(id){
  const before = orders;
  orders = orders.filter(o => o.id !== id);
  announce();

  try {
    const api = await import("../../backend/client.js");
    const { error } = await api.hideMyOrder(id);
    if (error){
      orders = before;
      announce();
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (e){
    orders = before;
    announce();
    return { ok: false, message: e.message || "Could not remove it." };
  }
}

/**
 * Watch for the owner moving an order along, so the customer's page
 * changes under them rather than going stale.
 */
export async function watchMyOrders(){
  if (!isConfigured()) return null;

  try {
    const api = await import("../../backend/client.js");
    return api.subscribeMyOrders(row => {
      const i = orders.findIndex(o => o.id === row.id);
      if (i === -1) return;

      // The payload carries the order but not its items; keep the ones
      // already in hand rather than dropping the lines from the page.
      orders[i] = { ...orders[i], ...row };
      announce();
    });
  } catch { return null; }
}
