/**
 * Shared page chrome — topbar, header, nav and footer.
 * Every page mounts the same markup so there is one source of truth.
 */
import { esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t, getLang, LANGS } from "../../features/i18n/lang.js";
import { isSignedIn, savedCount, userName }
  from "../../features/account/account.js";
import { cartCount } from "../../features/cart/cart.js";
import { UI } from "../../features/i18n/index.js";
import { SHOP } from "../../shared/shop.js";
import { CATALOG } from "../../features/catalog/catalog.js";

/** Which nav item is highlighted — read from <body data-page>. */
const currentPage = () => document.body.dataset.page || "home";

export function topbarHTML(){
  const T = t();
  return `
    <div class="wrap topbar-in">
      <span>${icon("pin",{size:14})} ${esc(SHOP.city[getLang()])} · <b>${esc(SHOP.tel)}</b></span>
      <div class="topbar-links">
        <!-- Delivery belongs on every page, not only the homepage: a
             customer deep in the catalogue is exactly who needs to know. -->
        <a class="topbar-dlv" href="index.html#delivery">
          ${icon("box",{size:14})} ${esc(T.tb_dlv)}
        </a>
        <span>${icon("clock",{size:14})} ${esc(T.daily)} ${esc(SHOP.hours)}</span>
      </div>
    </div>`;
}

export function headerHTML(){
  const T = t(), lang = getLang();

  const langBtns = LANGS.map(l =>
    `<button class="lang-b${l === lang ? " on" : ""}" data-lang="${l}"
             lang="${l}">${esc(UI[l].lang)}</button>`).join("");

  return `
    <div class="wrap header-in">
      <a href="index.html" class="brand">
        <img src="/images/logo.jpeg" alt="${esc(SHOP.name)} ${esc(SHOP.name2)}"
             class="brand-logo" width="56" height="56">
        <span class="brand-tx">
          <b>${esc(SHOP.name)}</b>
          <span>${esc(SHOP.name2)}</span>
          <i>${esc(T.shop)}</i>
        </span>
      </a>

      ${currentPage() === "products" ? `
      <form class="search" onsubmit="return false;" role="search">
        <input type="search" id="search" placeholder="${esc(T.search)}"
               aria-label="${esc(T.search)}" autocomplete="off">
        <button type="submit" aria-label="${esc(T.search)}">${icon("search")}</button>
        <div class="sg-box" id="sgBox" hidden></div>
      </form>` : ""}

      <div class="lang" role="group" aria-label="Language">${langBtns}</div>

      <a href="tel:${esc(SHOP.telRaw)}" class="tel">
        <span class="tel-ico">${icon("phone")}</span>
        <span><b>${esc(SHOP.tel)}</b><small>${esc(T.callOrder)}</small></span>
      </a>

      ${cartHTML()}
      ${accountHTML()}

      <a href="admin.html" class="hdr-login" title="${esc(T.owner_login)}">
        <span>${icon("lock",{size:15})}</span>
        <em>${esc(T.owner_login)}</em>
      </a>
    </div>`;
}

/**
 * The customer's own corner of the header.
 *
 * Signed out it opens the sign-in dialog. Signed in it links to their
 * favourites and carries the count — the only visible sign that anything
 * was kept.
 */
function accountHTML(){
  const T = t();

  if (!isSignedIn())
    return `
      <button class="hdr-acct" data-signin title="${esc(T.acct_signin)}">
        <span class="hdr-acct-ic">${icon("lock",{size:13})}</span>
        <em>${esc(T.acct_signin)}</em>
      </button>`;

  const n = savedCount();
  return `
    <a href="favourites.html" class="hdr-acct is-in" title="${esc(T.fav_title)}">
      <span class="hdr-acct-ic">${esc((userName()[0] || "?").toUpperCase())}</span>
      <em>${esc(T.fav_nav)}</em>
      ${n ? `<i class="hdr-acct-n">${n}</i>` : ""}
    </a>`;
}

/**
 * The basket, in the header beside the account.
 *
 * Hidden while empty. A basket icon showing nothing is a permanent
 * reminder of a thing the customer has not done; once there is something
 * in it, the count is worth carrying on every page.
 */
function cartHTML(){
  const T = t();
  const n = cartCount();
  if (!n) return "";

  return `
    <a href="cart.html" class="hdr-cart" title="${esc(T.cart_title)}">
      <span class="hdr-cart-ic">${icon("cart",{size:15})}</span>
      <em>${esc(T.cart_nav)}</em>
      <i class="hdr-cart-n">${n}</i>
    </a>`;
}

export function navHTML(){
  const T = t(), page = currentPage();

  const items = [
    { href:"index.html",    label:T.nav_home,     page:"home" },
    { href:"products.html", label:T.nav_products, page:"products" },
    { href:"about.html",    label:T.nav_about,    page:"about" },
    { href:"contact.html",  label:T.nav_contact,  page:"contact" },
  ];

  /* Only once signed in, and only then because the header button that
     leads here is hidden on a narrow screen — without this a customer on
     a phone would have nothing to tap. */
  if (isSignedIn()){
    items.push({ href:"favourites.html", label:T.fav_nav, page:"favourites" });
    items.push({ href:"orders.html",     label:T.ord_nav, page:"orders" });
  }

  return `<div class="nav-scroll"><div class="wrap nav-in">${
    items.map(i => `<a href="${i.href}"${
      i.page === page ? ' class="on" aria-current="page"' : ""
    }>${esc(i.label)}</a>`).join("")
  }</div></div>`;
}

export function footerHTML(){
  const T = t(), lang = getLang();

  return `
    <div class="wrap foot-g">
      <div class="foot-col">
        <div class="foot-brand">
          <img src="/images/logo.jpeg" alt="" width="54" height="54">
          <span><b>${esc(SHOP.name)}</b><span>${esc(SHOP.name2)}</span></span>
        </div>
        <p class="tagline">“${esc(T.tagline)}”</p>
        <p>${esc(T.about_p)}</p>
        <div class="socials">
          <a href="#" aria-label="Facebook">f</a>
          <a href="#" aria-label="Instagram">◎</a>
          <a href="https://wa.me/81${esc(SHOP.telRaw).slice(1)}" aria-label="WhatsApp">${icon("phone",{size:16})}</a>
        </div>
      </div>

      <div class="foot-col">
        <h4>${esc(T.foot_contact)}</h4>
        <div class="fc"><i>${icon("pin",{size:16})}</i><span>${esc(SHOP.city[lang])}</span></div>
        <div class="fc"><i>${icon("phone",{size:16})}</i><a href="tel:${esc(SHOP.telRaw)}">${esc(SHOP.tel)}</a></div>
        <div class="fc"><i>${icon("clock",{size:16})}</i><span>${esc(T.daily)} · ${esc(SHOP.hours)}</span></div>
      </div>

      <div class="foot-col">
        <h4>${esc(T.foot_links)}</h4>
        <ul>
          <li><a href="index.html">${esc(T.nav_home)}</a></li>
          <li><a href="products.html">${esc(T.nav_products)}</a></li>
          <li><a href="about.html">${esc(T.nav_about)}</a></li>
          <li><a href="contact.html">${esc(T.nav_contact)}</a></li>
        </ul>
      </div>

      <div class="foot-col">
        <h4>${esc(T.foot_cats)}</h4>
        <ul>${CATALOG.slice(0, 7).map(c =>
          `<li><a href="products.html#${esc(c.id)}">${esc(c[lang])}</a></li>`).join("")}</ul>
      </div>
    </div>

    <div class="pay-strip">
      <div class="wrap pay-in">
        <span class="pay-label">${esc(T.pay_label)}</span>
        <ul class="pay-list">
          <li><img src="/images/payment/paypay.svg" alt="PayPay" loading="lazy"></li>
          <li><img src="/images/payment/visa.svg" alt="Visa" loading="lazy"></li>
          <li><img src="/images/payment/mastercard.svg" alt="Mastercard" loading="lazy"></li>
          <li><img src="/images/payment/amex.svg" alt="American Express" loading="lazy"></li>
          <li><img src="/images/payment/jcb.svg" alt="JCB" loading="lazy"></li>
          <li class="pay-cash">${icon("cash",{size:22})} ${esc(T.pay_cash)}</li>
        </ul>
      </div>
    </div>

    <div class="foot-bot">
      <div class="wrap foot-bot-in">
        <p>© 2026 <b>${esc(SHOP.name)} ${esc(SHOP.name2)}</b> ·
           ${esc(T.rights)} · ${esc(T.tax)}</p>
        <a href="admin.html" class="owner-link">${icon("lock",{size:14})} ${esc(T.owner_login)}</a>
      </div>
    </div>`;
}
