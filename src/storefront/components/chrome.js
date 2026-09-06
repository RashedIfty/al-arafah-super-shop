/**
 * Shared page chrome — topbar, header, nav and footer.
 * Every page mounts the same markup so there is one source of truth.
 */
import { esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t, getLang, LANGS } from "../../features/i18n/lang.js";
import { isSignedIn, savedCount, userName, userPhoto }
  from "../../features/favourites/favourites.js";
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
 * Signed out it is a single button that starts the Google sign-in.
 * Signed in it becomes a link to their favourites, carrying their photo
 * and how many they have saved — the count is the point, since it is the
 * only sign anything was kept.
 */
function accountHTML(){
  const T = t();

  if (!isSignedIn())
    return `
      <button class="hdr-acct" data-signin title="${esc(T.fav_signin)}">
        <span class="hdr-acct-ic">${googleMark()}</span>
        <em>${esc(T.fav_signin)}</em>
      </button>`;

  const n = savedCount();
  const photo = userPhoto();

  return `
    <a href="favourites.html" class="hdr-acct is-in" title="${esc(T.fav_title)}">
      <span class="hdr-acct-ic">${
        photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer">`
              : esc((userName()[0] || "?").toUpperCase())}</span>
      <em>${esc(T.fav_nav)}</em>
      ${n ? `<i class="hdr-acct-n">${n}</i>` : ""}
    </a>`;
}

/** Google's mark, so the button is recognisable at a glance. */
const googleMark = () => `
  <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-4H24v7.3h12.1c-.2 1.9-1.6 4.7-4.5 6.6l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15.2"/>
    <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46"/>
    <path fill="#FBBC05" d="M11.5 28.5A13.5 13.5 0 0 1 10.8 24c0-1.6.3-3.1.7-4.5l-7.1-5.5A22 22 0 0 0 2 24c0 3.5.8 6.9 2.4 10z"/>
    <path fill="#EA4335" d="M24 10.2c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14l7.1 5.5c1.8-5.3 6.7-9.3 12.5-9.3"/>
  </svg>`;

export function navHTML(){
  const T = t(), page = currentPage();

  const items = [
    { href:"index.html",    label:T.nav_home,     page:"home" },
    { href:"products.html", label:T.nav_products, page:"products" },
    { href:"about.html",    label:T.nav_about,    page:"about" },
    { href:"contact.html",  label:T.nav_contact,  page:"contact" },
  ];

  /* Only once they are signed in, and only then because the header
     button that leads here is hidden on a narrow screen — without this a
     customer on a phone would have nothing to tap. */
  if (isSignedIn())
    items.push({ href:"favourites.html", label:T.fav_nav, page:"favourites" });

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
