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
      /* The address first, before the password is even tried. A
         customer at the wrong door should be told it is the wrong door,
         whatever they typed underneath — and the shop's password is
         never put to the test by somebody who could not have it. */
      const { isOwnerEmail, signIn } = await import("../backend/client.js");
      if (!(await isOwnerEmail(email))){
        return {
          ok: false,
          notOwner: true,
          message: "This is not the owner's account. Sign in with the owner email.",
        };
      }

      const { data, error } = await signIn(email.trim(), pass);

      if (error) return { ok: false, message: friendly(error.message) };
      if (!data?.user) return { ok: false, message: "That email or password is not right." };

      /* Belt and braces. The address was checked above, but the panel
         should never open on anything but the owner's session — and this
         is the check the database itself uses. */
      const { amOwner, signOut } = await import("../backend/client.js");
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
  return msg || "Could not sign in.";
}
