/**
 * Setting a new password, after following the link in the email.
 *
 * The link carries a one-time session in the URL fragment, which the
 * Supabase client picks up on load. Having it is the proof: only
 * somebody who can read that inbox could have got here. So the page asks
 * for nothing but the new password.
 *
 * Both sides use this one page — a customer sent here from the shop's
 * sign-in form, and the owner sent here from the panel. What differs is
 * only where they are sent afterwards.
 */
import { $, esc } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { icon } from "../../shared/ui/icons.js";

/* Set once the password is saved, so the confirmation survives the
   repaint that signing in sets off. */
let done = false;

export function resetHTML(){
  const T = t();

  if (done)
    return `
      <div class="acct-page">
        <div class="acct-box acct-centre">
          <span class="pw-done-ic">${icon("check", { size: 30 })}</span>
          <h2>${esc(T.pw_done)}</h2>
          <a class="btn btn-red acct-go" href="index.html">${esc(T.pw_shop)}</a>
        </div>
      </div>`;

  return `
    <div class="acct-page">
      <form class="acct-box" id="pwForm" novalidate>
        <h2>${esc(T.pw_title)}</h2>

        <label><span>${esc(T.pw_new)}</span>
          <input id="pwNew" type="password" autocomplete="new-password"
                 minlength="8" required></label>

        <label><span>${esc(T.pw_again)}</span>
          <input id="pwAgain" type="password" autocomplete="new-password"
                 minlength="8" required></label>

        <p class="acct-err" id="pwErr" hidden></p>

        <button type="submit" class="btn btn-red acct-go" id="pwGo">
          ${esc(T.pw_save)}
        </button>

        <p class="acct-swap">
          <a href="signin.html">${esc(T.pw_back)}</a>
        </p>
      </form>
    </div>`;
}

/**
 * Bound once per render, guarded on the form — render() replaces it
 * whenever the language changes.
 */
export function initReset(){
  const form = $("#pwForm");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const T = t();
    const err = $("#pwErr"), go = $("#pwGo");
    const a = $("#pwNew").value, b = $("#pwAgain").value;

    const fail = a.length < 8      ? [T.pw_short,   "#pwNew"]
               : a !== b           ? [T.pw_nomatch, "#pwAgain"]
               : null;

    if (fail){
      err.textContent = fail[0];
      err.hidden = false;
      $(fail[1])?.focus();
      return;
    }

    go.disabled = true;
    const label = go.textContent;
    go.textContent = T.pw_saving;
    err.hidden = true;

    const { savePassword } = await import("../../features/account/account.js");
    const r = await savePassword(a);

    if (!r.ok){
      go.disabled = false;
      go.textContent = label;

      /* Arriving without a session means the link was old or already
         used — which is a different problem from a bad password, and
         needs different words. */
      err.textContent = /session|jwt|token|auth/i.test(r.message || "")
        ? T.pw_expired : r.message;
      err.hidden = false;
      return;
    }

    done = true;
    render?.();
  });
}

/* How the page asks to be repainted. main.js supplies render(); the
   module cannot import it without the two importing each other. */
let render = null;
export const setResetRepaint = fn => { render = fn; };
