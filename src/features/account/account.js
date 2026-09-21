/**
 * Customer accounts — email and password, and the favourites they unlock.
 *
 * Three parts of the page need the same answer: the heart on every card,
 * the count in the header, and the favourites page itself. They all read
 * from here and all repaint when it changes, so a heart clicked on a
 * card turns the header count over too.
 *
 * Signing in goes through an Edge Function rather than straight to
 * Supabase Auth, because that is where the rate limit lives — see
 * src/backend/functions/login. Signing up and signing out are ordinary
 * Supabase calls: neither is worth guessing at.
 */
import { SUPABASE, isConfigured } from "../../backend/config.js";

const LOGIN_URL = () => `${SUPABASE.URL}/functions/v1/login`;

let user = null;
let saved = new Set();

/* Whether we have heard back about the session yet.
 *
 * Reading it takes a moment, and "nobody is signed in" is
 * indistinguishable from "we have not looked" unless this is tracked.
 * Without it the pages that turn on being signed in paint their
 * sign-in card first and correct themselves a moment later, which
 * reads as being thrown out of your own account. */
let known = !isConfigured();   // no backend: there is nothing to wait for

const listeners = new Set();
export const onAccountChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

/* ------------------------------- reading ------------------------------ */

export const isSignedIn = () => Boolean(user);

/** False only until the first look at the session has come back. */
export const accountKnown = () => known;
export const isSaved = id => saved.has(id);
export const savedCount = () => saved.size;
export const savedIds = () => [...saved];

/** What to call them: the part of their email before the @. */
export const userName = () => (user?.email || "").split("@")[0];

/* ------------------------------- loading ------------------------------ */

/** Who is signed in, and what have they saved. */
export async function refreshAccount(){
  if (!isConfigured()){ user = null; saved = new Set(); known = true; return; }

  try {
    const api = await import("../../backend/client.js");
    user = await api.currentUser();
    saved = user ? new Set(await api.fetchFavourites()) : new Set();
  } catch (e){
    console.warn("account:", e.message);
    user = null;
    saved = new Set();
  }
  known = true;
  announce();
}

/* ------------------------------- session ------------------------------ */

/**
 * Sign in.
 *
 * The Edge Function counts the attempt and answers with the session, so
 * the token has to be handed to the SDK afterwards — it is what keeps
 * the customer signed in across pages and what row-level security reads
 * when they save a favourite.
 *
 * Returns { ok } or { ok:false, message }.
 */
export async function signIn(email, password){
  if (!isConfigured()) return { ok: false, message: "Not configured" };

  try {
    const res = await fetch(LOGIN_URL(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE.KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.error || "Could not sign in." };

    const api = await import("../../backend/client.js");
    const c = await api.db();
    const { error } = await c.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    if (error) return { ok: false, message: error.message };

    await refreshAccount();
    return { ok: true };

  } catch (e){
    return { ok: false, message: e.message || "Could not sign in." };
  }
}

/**
 * Create an account.
 *
 * Straight to Supabase Auth: there is nothing here worth guessing at, and
 * Supabase already limits how fast an address may sign up.
 *
 * Whether this signs them in or asks them to confirm their email first
 * depends on the project's setting, so the caller is told which happened.
 */
export async function signUp(email, password){
  if (!isConfigured()) return { ok: false, message: "Not configured" };

  try {
    const api = await import("../../backend/client.js");
    const c = await api.db();
    /* Where the confirmation link comes back to.
     *
     * Without this Supabase uses the Site URL from its dashboard, which
     * is still the default localhost:3000 — so every customer who
     * confirmed their email landed on a page that refused to connect.
     * Sending it explicitly means the link works whatever that setting
     * says, and it works the same from the live site or a local copy
     * because it is read from the address the customer is actually on. */
    const { data, error } = await c.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${location.origin}/signin.html?confirmed=1` },
    });

    if (error) return { ok: false, message: error.message };

    // A session means they are in; none means a confirmation email.
    if (data.session){ await refreshAccount(); return { ok: true, signedIn: true }; }
    return { ok: true, signedIn: false };

  } catch (e){
    return { ok: false, message: e.message || "Could not create the account." };
  }
}

/**
 * Ask for a password-reset email.
 *
 * The answer is the same whether the address has an account or not, so
 * the form cannot be used to discover who shops here.
 */
export async function requestPasswordReset(email){
  if (!isConfigured()) return { ok: false, message: "Not configured" };

  try {
    const api = await import("../../backend/client.js");
    const { error } = await api.sendPasswordReset(
      email, `${location.origin}/reset.html`);

    if (error && !/user not found/i.test(error.message))
      return { ok: false, message: error.message };

    return { ok: true };
  } catch (e){
    return { ok: false, message: e.message || "Could not send the email." };
  }
}

/** Set the new password, using the session the emailed link carries. */
export async function savePassword(password){
  if (!isConfigured()) return { ok: false, message: "Not configured" };

  try {
    const api = await import("../../backend/client.js");
    const { error } = await api.setNewPassword(password);
    if (error) return { ok: false, message: error.message };

    await refreshAccount();
    return { ok: true };
  } catch (e){
    return { ok: false, message: e.message || "Could not save the password." };
  }
}

export async function signOut(){
  const api = await import("../../backend/client.js");
  await api.signOut();
  user = null;
  saved = new Set();
  announce();
}

/* ----------------------------- favourites ----------------------------- */

/**
 * Save a product, or take it off the list.
 *
 * The set changes first and the page repaints immediately: a heart that
 * waits for the network before filling feels broken. If the write fails
 * the change is put back, so the page never shows a favourite that was
 * not actually saved.
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
    return { ok: true };
  } catch (e){
    had ? saved.add(productId) : saved.delete(productId);
    announce();
    return { ok: false, message: e.message };
  }
}
