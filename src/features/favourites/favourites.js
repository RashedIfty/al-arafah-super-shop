/**
 * Favourites — the products a customer wants to find again.
 *
 * Kept in one place because three parts of the page need the same
 * answer: the heart on every card, the count in the header, and the
 * favourites page itself. They all read from here and all re-render when
 * it changes, so a heart clicked on a card turns red in the header too.
 *
 * Nothing here works signed out, and that is deliberate rather than a
 * limitation: a list that lives only in one browser is a list the
 * customer loses when they pick up their phone instead.
 */
import { isConfigured } from "../../backend/config.js";

/** Product ids the signed-in customer has saved. */
let saved = new Set();

/** The signed-in customer, or null. */
let user = null;

/** Called whenever either changes, so the page can repaint. */
const listeners = new Set();
export const onFavouritesChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

/* ------------------------------- reading ------------------------------ */

export const currentUser = () => user;
export const isSignedIn = () => Boolean(user);
export const isSaved = id => saved.has(id);
export const savedCount = () => saved.size;
export const savedIds = () => [...saved];

/** The customer's given name, or the part of their email before the @. */
export function userName(){
  if (!user) return "";
  const meta = user.user_metadata || {};
  return (meta.given_name || meta.full_name || meta.name
          || (user.email || "").split("@")[0] || "").trim();
}

/** Their Google profile picture, if they have one. */
export const userPhoto = () => user?.user_metadata?.avatar_url || "";

/* ------------------------------- loading ------------------------------ */

/**
 * Find out who is signed in and what they have saved.
 *
 * Called once on load and again whenever the session changes — which
 * includes coming back from Google, where the page reloads with a token
 * in the address.
 */
export async function refreshFavourites(){
  if (!isConfigured()){ user = null; saved = new Set(); return; }

  try {
    const api = await import("../../backend/client.js");
    user = await api.currentUser();
    saved = user ? new Set(await api.fetchFavourites()) : new Set();
  } catch (e){
    console.warn("favourites:", e.message);
    user = null;
    saved = new Set();
  }
  announce();
}

/* ------------------------------- writing ------------------------------ */

/**
 * Save a product, or take it off the list.
 *
 * The set changes first and the page repaints immediately: a heart that
 * waits for the network before filling in feels broken. If the write
 * fails the change is put back, so the page never shows a favourite that
 * was not actually saved.
 */
export async function toggleFavourite(productId){
  if (!user) return { needsSignIn: true };

  const had = saved.has(productId);
  had ? saved.delete(productId) : saved.add(productId);
  announce();

  try {
    const api = await import("../../backend/client.js");
    const { error } = had
      ? await api.removeFavourite(productId)
      : await api.addFavourite(productId);
    if (error) throw error;
    return { ok: true, saved: !had };
  } catch (e){
    had ? saved.add(productId) : saved.delete(productId);
    announce();
    return { ok: false, message: e.message };
  }
}

/* -------------------------------- session ----------------------------- */

export async function signIn(){
  const api = await import("../../backend/client.js");
  return api.signInWithGoogle();
}

export async function signOut(){
  const api = await import("../../backend/client.js");
  await api.signOut();
  user = null;
  saved = new Set();
  announce();
}
