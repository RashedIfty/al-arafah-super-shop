/**
 * The customer's sign-in page and favourites page.
 *
 * One form does both signing in and creating an account, because they
 * ask for the same two things and a customer who lands on the wrong one
 * should not have to go looking for the other.
 */
import { $, esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { isSignedIn, savedIds, userName, signIn, signUp }
  from "../../features/account/account.js";
import { cardHTML } from "./product-card.js";

/* ------------------------------- the form ----------------------------- */

/**
 * A page of its own, like the owner's login, rather than a dialog over
 * the shop. Signing in is a thing a customer sets out to do, and a page
 * can be linked to, bookmarked and returned to by the back button.
 */
export function accountFormHTML(){
  const T = t();

  /* Arrived from the link in the confirmation email. Saying so matters:
     the customer clicked something, waited, and landed on a sign-in
     form — without a word they cannot tell whether it worked. */
  const confirmed = new URLSearchParams(location.search).has("confirmed");

  return `
    <div class="acct-page">
      ${confirmed ? `
        <p class="acct-ok">${icon("check", { size: 16 })} ${esc(T.acct_confirmed)}</p>` : ""}
      <form class="acct-box" id="acctForm" novalidate>
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

        <p class="acct-forgot" id="acctForgotWrap">
          <button type="button" id="acctForgot">${esc(T.pw_forgot)}</button>
        </p>
      </form>

      <!-- Asking for the link. Hidden until the customer says they have
           forgotten, because most people have not. -->
      <form class="acct-box" id="pwAskBox" hidden novalidate>
        <h2>${esc(T.pw_ask_title)}</h2>
        <p class="acct-sub">${esc(T.pw_ask_sub)}</p>

        <label><span>${esc(T.acct_email)}</span>
          <input id="pwAskEmail" type="email" autocomplete="email"
                 inputmode="email" required></label>

        <p class="acct-err" id="pwAskErr" hidden></p>
        <p class="acct-ok" id="pwAskOk" hidden></p>

        <button type="submit" class="btn btn-red acct-go" id="pwAskGo">
          ${esc(T.pw_send)}
        </button>

        <p class="acct-swap">
          <button type="button" id="pwAskBack">${esc(T.pw_back)}</button>
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
    </div>
    <p class="fav-out">
      <button type="button" data-signout>${esc(T.acct_signout)}</button>
    </p>`;
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

/* ----------------------------- the controls --------------------------- */

/** Signing in, or creating an account. */
let creating = false;

/**
 * Where to send someone who needs to sign in.
 *
 * Their current page is carried along, so tapping a heart on the
 * products page and signing in puts them back among the products rather
 * than somewhere they did not ask to be.
 */
export function goToSignIn(){
  const back = location.pathname.split("/").pop() || "index.html";
  location.href = `signin.html?from=${encodeURIComponent(back)}`;
}

/** Swap the form between signing in and signing up. */
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
 * Wire the form up. Bound once per render, guarded by a flag on the form
 * itself, since render() replaces it whenever the language changes.
 */
export function initAccount(){
  const form = $("#acctForm");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  $("#acctSwap").addEventListener("click", () => setMode(!creating));

  /* ------------------------ forgotten password ---------------------- */

  /* Its own guard, because it is its own element. render() replaces
     both forms, and this one was being bound again on every repaint
     while the check at the top looked only at the sign-in form — which
     is why one press sent two emails. */
  const askBox = $("#pwAskBox");
  const askFresh = askBox && !askBox.dataset.bound;
  if (askFresh) askBox.dataset.bound = "1";
  const showAsk = on => {
    form.hidden = on;
    askBox.hidden = !on;
    if (on) $("#pwAskEmail").value = $("#acctEmail").value.trim();
  };

  $("#acctForgot")?.addEventListener("click", () => showAsk(true));
  $("#pwAskBack")?.addEventListener("click", () => showAsk(false));

  if (askFresh) askBox.addEventListener("submit", async e => {
    e.preventDefault();

    const T = t();
    const err = $("#pwAskErr"), ok = $("#pwAskOk"), go = $("#pwAskGo");
    const email = $("#pwAskEmail").value.trim();

    if (!email){ $("#pwAskEmail").focus(); return; }

    go.disabled = true;
    const label = go.textContent;
    go.textContent = T.pw_sending;
    err.hidden = true; ok.hidden = true;

    const { requestPasswordReset } = await import("../../features/account/account.js");
    const r = await requestPasswordReset(email);

    go.disabled = false;
    go.textContent = label;

    if (!r.ok){ err.textContent = r.message; err.hidden = false; return; }

    /* The same answer whether or not that address has an account, so the
       form cannot be used to find out who shops here. */
    ok.textContent = T.pw_sent;
    ok.hidden = false;
  });

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

    /* Back where they came from, or the favourites they were heading
       for. A page that simply went blank on success would leave them
       wondering whether it had worked. */
    const from = new URLSearchParams(location.search).get("from");
    location.href = from && /^[\w.-]+\.html$/.test(from) ? from : "favourites.html";
  });
}
