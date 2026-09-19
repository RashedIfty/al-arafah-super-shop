/**
 * The customer's side of ordering: their delivery details, and the
 * orders they have placed.
 *
 * Shaped like features/account/account.js and features/cart/cart.js —
 * module state, a listener set, and an announce() that survives one bad
 * listener. The checkout page, the orders page and the header all read
 * from here.
 *
 * Nothing is kept in the browser. A delivery address is the shop's
 * record of where to take the box, not a convenience for this laptop,
 * and an order is a promise between two people. Both live in the
 * database and are read back per session.
 */
import { isConfigured } from "../../backend/config.js";

let profile = null;
let orders = [];
let loaded = false;

const listeners = new Set();
export const onOrdersChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

/* ------------------------------- reading ------------------------------ */

export const myProfile = () => profile;
export const myOrders = () => orders;
export const ordersLoaded = () => loaded;

/**
 * Can this customer place an order?
 *
 * All four fields, and the phone in the shape the database will accept.
 * Checked before the button is offered as well as after it is pressed,
 * so the customer is told what is missing rather than refused.
 */
export const profileComplete = (p = profile) => Boolean(
  p && p.full_name?.trim() && p.address?.trim()
    && isJpMobile(p.phone) && isJpPostal(p.postal)
);

/* ---------------------------- Japanese input -------------------------- */

/**
 * A Japanese mobile: 070, 080 or 090 and eight more digits.
 *
 * Landlines are deliberately not accepted. A delivery needs a number
 * somebody carries, and the owner rings to confirm every order — a
 * house phone nobody is standing next to is worse than no number.
 *
 * Separators are allowed on the way in and stripped on the way out, so
 * a customer may type it however they are used to seeing it written.
 */
export const digitsOnly = s => String(s ?? "").replace(/[^\d]/g, "");

/**
 * The number as the database wants it: eleven digits beginning 0.
 *
 * A customer who has their number saved in international form types
 * +81 90-1234-5678, which is the same phone as 090-1234-5678 with the
 * country code in front of it. Rejecting that would be refusing a
 * correct answer on a technicality, so the +81 is folded back to the
 * leading zero before anything else looks at it.
 */
export const normalisePhone = s => {
  const d = digitsOnly(s);
  return d.startsWith("81") && d.length === 12 ? "0" + d.slice(2) : d;
};

export const isJpMobile = s => /^0[789]0\d{8}$/.test(normalisePhone(s));

/** 305-0005. Stored with the hyphen, which is how Japan writes it. */
export const isJpPostal = s => /^\d{3}-?\d{4}$/.test(String(s ?? "").trim());

export const normalisePostal = s => {
  const d = digitsOnly(s);
  return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : String(s ?? "").trim();
};

/* ------------------------------- loading ------------------------------ */

/** The delivery details and the orders, for whoever is signed in. */
export async function refreshOrders(){
  if (!isConfigured()){ profile = null; orders = []; loaded = true; return; }

  try {
    const api = await import("../../backend/client.js");
    const user = await api.currentUser();

    if (!user){ profile = null; orders = []; loaded = true; announce(); return; }

    [profile, orders] = await Promise.all([api.fetchProfile(), api.fetchMyOrders()]);
  } catch (e){
    console.warn("orders:", e.message);
    profile = null;
    orders = [];
  }
  loaded = true;
  announce();
}

/* ------------------------------- writing ------------------------------ */

/** Save the delivery details. Returns { ok } or { ok:false, message }. */
export async function saveMyProfile(p){
  const clean = {
    full_name: p.full_name.trim(),
    phone: normalisePhone(p.phone),
    postal: normalisePostal(p.postal),
    address: p.address.trim(),
  };

  try {
    const api = await import("../../backend/client.js");
    const { error } = await api.saveProfile(clean);
    if (error) return { ok: false, message: error.message };

    profile = clean;
    announce();
    return { ok: true };
  } catch (e){
    return { ok: false, message: e.message || "Could not save." };
  }
}

/**
 * Place the order.
 *
 * The basket is only emptied once the order is safely in the database —
 * a customer whose network drops mid-request should still have their
 * shopping when they try again.
 */
export async function placeMyOrder({ lines, note = "" }){
  if (!profileComplete()) return { ok: false, message: "incomplete-profile" };
  if (!lines?.length) return { ok: false, message: "empty-cart" };

  try {
    const api = await import("../../backend/client.js");
    const { data, error } = await api.placeOrder({ profile, lines, note });
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
