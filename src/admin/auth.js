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
      const { currentUser } = await import("../backend/client.js");
      return Boolean(await currentUser());
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
      const { signIn } = await import("../backend/client.js");
      const { data, error } = await signIn(email.trim(), pass);

      if (error) return { ok: false, message: friendly(error.message) };
      return { ok: Boolean(data?.user) };
    } catch (e) {
      return { ok: false, message: "Could not reach the server. Check your connection." };
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
