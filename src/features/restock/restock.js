/**
 * "Tell me when it is back."
 *
 * Which sold-out products this customer is waiting for. Shaped like
 * features/account/account.js — module state, a listener Set, an
 * announce() that survives one bad listener, and an optimistic write
 * that rolls back if the network refuses.
 *
 * Nothing is kept in the browser. A request is a message to the shop,
 * not a note to this laptop, and the owner has to be able to read it.
 */
import { isConfigured } from "../../backend/config.js";

let waiting = new Set();     // product ids
let loaded = false;

const listeners = new Set();
export const onRestockChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

/* ------------------------------- reading ------------------------------ */

export const isWaiting = id => waiting.has(id);
export const waitingCount = () => waiting.size;
export const restockLoaded = () => loaded;

/* ------------------------------- loading ------------------------------ */

/** What this customer has already asked for. */
export async function refreshRestock(){
  if (!isConfigured()){ waiting = new Set(); loaded = true; return; }

  try {
    const api = await import("../../backend/client.js");
    const user = await api.currentUser();

    waiting = user ? new Set(await api.fetchMyRestock()) : new Set();
  } catch (e){
    console.warn("restock:", e.message);
    waiting = new Set();
  }
  loaded = true;
  announce();
}

/* ------------------------------- writing ------------------------------ */

/**
 * Ask, or take the ask back.
 *
 * The button changes first and the page repaints immediately: one that
 * waits for the network before acknowledging a press feels broken. If
 * the write fails the change is put back, so the page never claims a
 * request the shop never received.
 *
 * Returns { needsSignIn: true } when nobody is signed in — the caller
 * sends them to the sign-in page, the way the heart already does.
 */
export async function toggleRestock(productId){
  if (!isConfigured()) return { ok: false, message: "Not configured" };

  const had = waiting.has(productId);
  had ? waiting.delete(productId) : waiting.add(productId);
  announce();

  try {
    const api = await import("../../backend/client.js");
    const { error } = had
      ? await api.withdrawRestock(productId)
      : await api.askRestock(productId);

    if (error) throw error;
    return { ok: true, asked: !had };

  } catch (e){
    had ? waiting.add(productId) : waiting.delete(productId);
    announce();

    if (/not signed in/i.test(e.message || "")) return { needsSignIn: true };
    return { ok: false, message: e.message };
  }
}
