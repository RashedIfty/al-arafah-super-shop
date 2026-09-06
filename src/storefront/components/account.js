/**
 * The customer's sign-in dialog and favourites page.
 *
 * One dialog does both signing in and creating an account, because they
 * ask for the same two things and a customer who lands on the wrong one
 * should not have to go looking for the other.
 */
import { $, esc } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { isSignedIn, savedIds, userName, signIn, signUp }
  from "../../features/account/account.js";
import { cardHTML } from "./product-card.js";

/* ------------------------------ the dialog ---------------------------- */

/** Rendered once and left in the page; opening it only unhides it. */
export function accountDialogHTML(){
  const T = t();

  return `
    <div class="acct-modal" id="acctModal" hidden>
      <div class="acct-bg" data-acct-close></div>
      <form class="acct-box" id="acctForm" novalidate>
        <button type="button" class="acct-x" data-acct-close aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>

        <h2 id="acctTitle">${esc(T.acct_signin)}</h2>
        <p class="acct-sub" id="acctSub">${esc(T.acct_why)}</p>

        <label><span>${esc(T.acct_email)}</span>
          <input id="acctEmail" type="email" autocomplete="email"
                 inputmode="email" required></label>

        <label><span>${esc(T.acct_pass)}</span>
          <input id="acctPass" type="password" autocomplete="current-password"
                 minlength="6" required></label>

        <p class="acct-err" id="acctErr" hidden></p>

        <button type="submit" class="btn btn-red acct-go" id="acctGo">
          ${esc(T.acct_signin)}
        </button>

        <p class="acct-swap">
          <span id="acctSwapTx">${esc(T.acct_no_account)}</span>
          <button type="button" id="acctSwap">${esc(T.acct_create)}</button>
        </p>
      </form>
    </div>`;
}

/* --------------------------- the saved page --------------------------- */

/**
 * Find each saved product in the catalogue.
 *
 * The list holds ids, so a price change or a new photograph reaches this
 * page for free, and a product the owner removes simply stops appearing.
 * Carries the category and both indices, because the lightbox looks a
 * product up as CATALOG[c].items[p].
 */
function savedProducts(){
  const wanted = savedIds();
  if (!wanted.length) return [];

  const byId = new Map();
  CATALOG.forEach((cat, ci) => cat.items.forEach((p, pi) => {
    if (p._id) byId.set(p._id, { p, cat, ci, pi });
  }));

  // The customer's own order — newest saved first — not the shop's.
  return wanted.map(id => byId.get(id)).filter(Boolean);
}

export function favouritesHTML(){
  const T = t();

  if (!isSignedIn())
    return empty(T.acct_signin, T.acct_why,
      `<button class="btn btn-red" data-signin>${esc(T.acct_signin)}</button>`);

  const items = savedProducts();

  if (!items.length)
    return empty(T.fav_none, T.fav_none_s,
      `<a class="btn btn-red" href="products.html">${esc(T.nav_products)}</a>`);

  return `
    <p class="fav-hi">${esc((T.fav_hi || "").replace("{n}", userName()))}</p>
    <div class="grid">
      ${items.map(x => cardHTML(x.p, x.cat, x.ci, x.pi)).join("")}
    </div>`;
}

/** Signed out, or signed in with nothing saved: both say what to do next. */
const empty = (title, line, action) => `
  <div class="fav-empty">
    <span class="fav-empty-ic">${heart()}</span>
    <b>${esc(title)}</b>
    <p>${esc(line)}</p>
    ${action}
  </div>`;

const heart = () =>
  `<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M12 21s-7.5-4.7-9.6-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.6 12c-2.1 4.3-9.6 9-9.6 9z"/></svg>`;

/* ---------------------------- dialog control -------------------------- */

/** Signing in, or creating an account. */
let creating = false;

export function openAccount(){
  const box = $("#acctModal");
  if (!box) return;
  box.hidden = false;
  $("#acctErr").hidden = true;
  $("#acctEmail")?.focus();
}

export const closeAccount = () => { const b = $("#acctModal"); if (b) b.hidden = true; };

/** Swap the dialog between signing in and signing up. */
function setMode(create){
  creating = create;
  const T = t();
  $("#acctTitle").textContent  = create ? T.acct_create   : T.acct_signin;
  $("#acctSub").textContent    = create ? T.acct_why_new  : T.acct_why;
  $("#acctGo").textContent     = create ? T.acct_create   : T.acct_signin;
  $("#acctSwapTx").textContent = create ? T.acct_have     : T.acct_no_account;
  $("#acctSwap").textContent   = create ? T.acct_signin   : T.acct_create;
  $("#acctPass").autocomplete  = create ? "new-password"  : "current-password";
  $("#acctErr").hidden = true;
}

/**
 * Wire the dialog up. Bound once — the dialog is static markup, unlike
 * the cards, so it survives a re-render.
 */
export function initAccount(){
  const form = $("#acctForm");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  $("#acctSwap").addEventListener("click", () => setMode(!creating));

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const T = t();
    const email = $("#acctEmail").value.trim();
    const pass  = $("#acctPass").value;
    const err   = $("#acctErr");
    const go    = $("#acctGo");

    if (!email || pass.length < 6){
      err.textContent = T.acct_bad;
      err.hidden = false;
      return;
    }

    /* Held until the answer lands. Sign-in is rate-limited by address, so
       a double-click would spend two of the customer's own attempts. */
    go.disabled = true;
    const label = go.textContent;
    go.textContent = T.acct_working;
    err.hidden = true;

    const r = creating ? await signUp(email, pass) : await signIn(email, pass);

    go.disabled = false;
    go.textContent = label;

    if (!r.ok){
      err.textContent = r.message;
      err.hidden = false;
      return;
    }

    // Signing up may need the email confirming first.
    if (creating && r.signedIn === false){
      err.textContent = T.acct_check_email;
      err.className = "acct-err ok";
      err.hidden = false;
      return;
    }

    closeAccount();
  });
}
