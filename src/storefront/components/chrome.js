/**
 * Shared page chrome — topbar, header, nav and footer.
 * Every page mounts the same markup so there is one source of truth.
 */
import { esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t, getLang, setLang, LANGS } from "../../features/i18n/lang.js";
import { isSignedIn, savedCount, userName }
  from "../../features/account/account.js";
import { avatarUrl } from "../../features/profile/profile.js";
import { cartCount } from "../../features/cart/cart.js";
import { UI } from "../../features/i18n/index.js";
import { SHOP } from "../../shared/shop.js";
import { CATALOG } from "../../features/catalog/catalog.js";

/** Which nav item is highlighted — read from <body data-page>. */
const currentPage = () => document.body.dataset.page || "home";

/**
 * The language menu: open it, choose, or dismiss it.
 *
 * Bound on the document once rather than on the header, because
 * render() replaces the header whenever anything changes and a
 * listener on the button itself would go with it.
 */
let langBound = false;

export function initLangMenu(){
  if (langBound) return;
  langBound = true;

  const menu = () => document.getElementById("langMenu");
  const now  = () => document.getElementById("langNow");

  const close = () => {
    const m = menu(); if (m) m.hidden = true;
    now()?.setAttribute("aria-expanded", "false");
  };

  document.addEventListener("click", e => {
    const opt = e.target.closest?.("[data-lang]");
    if (opt){ close(); setLang(opt.dataset.lang); return; }

    if (e.target.closest?.("#langNow")){
      const m = menu(); if (!m) return;
      const open = m.hidden;
      m.hidden = !open;
      now()?.setAttribute("aria-expanded", String(open));
      return;
    }

    if (!e.target.closest?.("[data-lang-wrap]")) close();
  });

  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

/* The flag for each language the shop speaks.
 *
 * Emoji rather than image files: they come with the system, cost
 * nothing to load, and are already drawn correctly on every phone the
 * shop's customers use. Bangla gets Bangladesh's flag, which is who
 * the shop is speaking to, not India's. */
const FLAG = { en: "🇬🇧", ja: "🇯🇵", bn: "🇧🇩" };

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

  /* One flag, and the rest behind it.
   *
   * Three buttons in a row was fine for three languages and would not
   * survive a fourth, and on a phone it ate the width the basket and
   * the account button need. The flag says which language you are in
   * without a word of any of them. */
  const langMenu = LANGS.map(l => `
    <button type="button" class="lang-opt${l === lang ? " on" : ""}"
            data-lang="${l}" lang="${l}" role="menuitemradio"
            aria-checked="${l === lang}">
      <span class="lang-flag">${FLAG[l] || ""}</span>
      <span class="lang-name">${esc(UI[l].lang)}</span>
      ${l === lang ? icon("check", { size: 15, cls: "lang-tick" }) : ""}
    </button>`).join("");

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

      <div class="lang" data-lang-wrap>
        <button type="button" class="lang-now" id="langNow"
                aria-haspopup="true" aria-expanded="false" aria-label="Language">
          <span class="lang-flag">${FLAG[lang] || ""}</span>
          ${icon("down", { size: 13, cls: "lang-caret" })}
        </button>
        <div class="lang-menu" id="langMenu" role="menu" hidden>${langMenu}</div>
      </div>

      <a href="tel:${esc(SHOP.telRaw)}" class="tel">
        <span class="tel-ico">${icon("phone")}</span>
        <span><b>${esc(SHOP.tel)}</b><small>${esc(T.callOrder)}</small></span>
      </a>

      ${cartHTML()}
      ${accountHTML()}

      <!-- The owner's way in, at every width: a lock, and nothing else.
           The words took the room the basket and the account need, and
           they were an invitation to the one person on earth who does
           not need inviting. The title says what it is for anybody who
           hovers or listens. -->
      ${isSignedIn() ? "" : `
        <a href="admin.html" class="hdr-login" title="${esc(T.owner_login)}"
           aria-label="${esc(T.owner_login)}">
          <span>${icon("lock",{size:15})}</span>
        </a>`}
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
      <button class="hdr-acct" data-signin title="${esc(T.customer_login)}">
        <span class="hdr-acct-ic">${icon("user",{size:14})}</span>
        <em>${esc(T.customer_login)}</em>
      </button>`;

  /* Nothing saved, nothing to show. A favourites button with no
     favourites behind it is a link to an empty room. The account itself
     is still reachable from the nav. */
  /* Signed in, the header carries their initial and the way out. The
     favourites count rides along when there is one; the sign-out button
     is there whether or not anything is saved, because being unable to
     leave is worse than a button nobody presses. */
  const n = savedCount();

  /* Their photo when they have put one up, their initial when not. The
     link goes to the account page now; favourites live inside it. */
  const pic = avatarUrl();

  return `
    <a href="account.html" class="hdr-acct is-in" title="${esc(T.prof_nav)}">
      <span class="hdr-acct-ic">${pic
        ? `<img src="${esc(pic)}" alt="" width="26" height="26">`
        : esc((userName()[0] || "?").toUpperCase())}</span>
      <em>${esc(T.prof_nav)}</em>
      ${n ? `<i class="hdr-acct-n">${n}</i>` : ""}
    </a>
    <button type="button" class="hdr-out" data-signout
            title="${esc(T.acct_signout)}">
      ${icon("arrow",{size:15})}
      <em>${esc(T.acct_signout)}</em>
    </button>`;
}

/**
 * The basket, in the header beside the account.
 *
 * Always there, empty or not. It is how a customer gets back to what
 * they were buying, and a shop whose basket appears only once you have
 * used it is a shop you have to learn. The count shows only when there
 * is something to count.
 */
function cartHTML(){
  const T = t();
  const n = cartCount();

  return `
    <a href="cart.html" class="hdr-cart" title="${esc(T.cart_title)}">
      <span class="hdr-cart-ic">${icon("cart",{size:15})}</span>
      <em>${esc(T.cart_nav)}</em>
      ${n ? `<i class="hdr-cart-n">${n}</i>` : ""}
    </a>`;
}

export function navHTML(){
  const T = t(), page = currentPage();

  const items = [
    { href:"index.html",    label:T.nav_home,     page:"home" },
    { href:"products.html", label:T.nav_products, page:"products" },
    { href:"delivery.html", label:T.dlv_nav,      page:"delivery" },
    { href:"about.html",    label:T.nav_about,    page:"about" },
    { href:"contact.html",  label:T.nav_contact,  page:"contact" },
  ];

  /* Only once signed in, and only then because the header button that
     leads here is hidden on a narrow screen — without this a customer on
     a phone would have nothing to tap. The account page holds the
     favourites, so it takes their place rather than joining them: on a
     phone the nav already wraps to two rows, and an eighth link would
     make three. */
  if (isSignedIn()){
    items.push({ href:"account.html", label:T.prof_nav, page:"account" });
    items.push({ href:"orders.html",  label:T.ord_nav,  page:"orders" });
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
        <!-- The four photographs behind the headline on the home page.
             They are Creative Commons, which is free to use but not
             free of obligation: the photographer is named, and so is
             the licence. -->
        <p class="foot-credit">
          ${esc(T.credit_photos)}
          <a href="https://commons.wikimedia.org/wiki/File:A_lunch_platter_of_Bengali_cuisine.jpg"
             target="_blank" rel="noopener">Kingshukdeb6</a>,
          <a href="https://commons.wikimedia.org/wiki/File:Bengali_Platter.jpg"
             target="_blank" rel="noopener">JyotiPN</a>,
          <a href="https://commons.wikimedia.org/wiki/File:Panta_Ilish_-_a_traditional_platter_in_Pohela_Boishakh_2016_(01).jpg"
             target="_blank" rel="noopener">Moheen Reeyad</a>,
          <a href="https://commons.wikimedia.org/wiki/File:Kacchi_Biryani.jpg"
             target="_blank" rel="noopener">ANKAN</a>
          ·
          <a href="https://creativecommons.org/licenses/by-sa/4.0/"
             target="_blank" rel="noopener">CC BY-SA</a>
        </p>
        <a href="admin.html" class="owner-link">${icon("lock",{size:14})} ${esc(T.owner_login)}</a>
      </div>
    </div>`;
}
