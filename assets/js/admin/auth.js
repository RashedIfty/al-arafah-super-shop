/**
 * PROTOTYPE AUTH — NOT SECURE.
 *
 * Credentials live in this file, readable by anyone via View Source.
 * Replace with real server-side auth before this handles anything real.
 *
 * Both fields are currently EMPTY, which means the login form lets anyone
 * straight through. Set them below to switch the check back on.
 */

/* ===== SET YOUR LOGIN HERE (leave empty to skip the check) ===== */
export const ADMIN = {
  email: "12345",
  pass:  "12345"
};
/* =============================================================== */

const KEY = "aa-admin-session";

/** True when no credentials are configured — anyone may enter. */
export const isOpen = () => !ADMIN.email && !ADMIN.pass;

/** True when someone has logged in during this browser session. */
export function isLoggedIn(){
  try { return sessionStorage.getItem(KEY) === "1"; }
  catch { return false; }
}

/** Check credentials and start a session. Returns true on success. */
export function login(email = "", pass = ""){
  const ok = isOpen() || (
    email.trim().toLowerCase() === ADMIN.email.toLowerCase() &&
    pass === ADMIN.pass
  );
  if (ok) {
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
  }
  return ok;
}

/** End the session. */
export function logout(){
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
