/**
 * Owner authentication.
 *
 * Uses Supabase Auth when configured — passwords are hashed on their
 * servers and never appear in this code. Falls back to the local
 * prototype login only when Supabase details are missing.
 */
import { isConfigured } from "../backend/config.js";

/* Fallback only — used when Supabase is not configured. */
const LOCAL = { email: "12345", pass: "12345" };
const KEY = "aa-admin-session";

/** True when we are running against a real backend. */
export const usingSupabase = () => isConfigured();

/** Is someone signed in? */
export async function isLoggedIn(){
  if (usingSupabase()){
    try {
      /* Signed in is not the same as being the owner. Every customer
         account can sign in — the panel belongs to one of them, and
         which one is a row in the database, not a name in this file. */
      const { amOwner } = await import("../backend/client.js");
      return await amOwner();
    } catch { return false; }
  }
  try { return sessionStorage.getItem(KEY) === "1"; }
  catch { return false; }
}

/**
 * Attempt sign-in.
 * Returns { ok: true } or { ok: false, message: "…" }.
 */
export async function login(email = "", pass = ""){
  if (usingSupabase()){
    try {
      /* Password first, through the same rate-limited door the shop's
         customers use, and only then the question of whose account it
         is. Asking "is this the owner's address?" before signing in
         told anybody who typed an address whether they had found the
         owner's — the one account worth guessing a password for. */
      const { signIn, amOwner, signOut } = await import("../backend/client.js");
      const { data, error } = await signIn(email.trim(), pass);

      if (error) return { ok: false, message: friendly(error.message) };
      if (!data?.user) return { ok: false, message: "That email or password is not right." };

      /* Signed in is not the same as being the owner: every customer
         account can get this far. The database decides, with the same
         check every write policy uses, and anyone else is signed
         straight back out. */
      if (!(await amOwner())){
        await signOut();
        return {
          ok: false,
          notOwner: true,
          message: "This is not the owner's account. Sign in with the owner email.",
        };
      }

      return { ok: true };
    } catch (e) {
      // Surface the real cause; a generic message here hid a module-load
      // failure for far too long.
      console.error("[auth] sign-in failed:", e);
      return {
        ok: false,
        message: "Could not sign in: " + (e?.message || "unknown error")
      };
    }
  }

  // Local fallback
  const ok = email.trim().toLowerCase() === LOCAL.email.toLowerCase()
          && pass === LOCAL.pass;
  if (ok) { try { sessionStorage.setItem(KEY, "1"); } catch {} }
  return { ok, message: ok ? "" : "That email or password is not right." };
}

/** Sign out of whichever backend is in use. */
export async function logout(){
  if (usingSupabase()){
    try {
      const { signOut } = await import("../backend/client.js");
      await signOut();
    } catch { /* ignore */ }
  }
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Turn Supabase error text into something the owner can act on. */
function friendly(msg = ""){
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "That email or password is not right.";
  if (m.includes("email not confirmed")) return "Please confirm your email address first.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment.";
  if (m.includes("too many attempts")) return msg;   // the login function's own words, with the wait
  return msg || "Could not sign in.";
}
