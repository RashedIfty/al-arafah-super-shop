/**
 * Product card + category section markup.
 */
import { esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { t, getLang, LANGS, itemCount } from "../../features/i18n/lang.js";
import { yen, discount } from "../../shared/lib/format.js";
import { SHOP } from "../../shared/shop.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { isSaved } from "../../features/favourites/favourites.js";

/**
 * Categories a customer can actually walk into, each keeping the position
 * it holds in CATALOG.
 *
 * The index matters: the lightbox finds a product as CATALOG[c].items[p],
 * so a card must carry where its category really sits, not where it sits
 * once the empty ones have been dropped.
 */
const stocked = () =>
  CATALOG.map((cat, ci) => ({ cat, ci })).filter(x => x.cat.items.length);

/**
 * One product card.
 * Names in the two inactive languages are shown as a secondary line, so a
 * customer can always recognise the item whichever language they read.
 */
export function cardHTML(product, category, ci = 0, pi = 0){
  const T = t(), lang = getLang();
  const off = discount(product.was, product.p);
  const img = product.img || SHOP.placeholder;

  const badges = off ? `<span class="badge badge-off">-${off}% ${esc(T.off)}</span>` : "";

  /* The heart sits on the photograph, opposite the discount badge. Shown
     to everyone: a customer who is not signed in should be able to see
     what the button does before being asked to sign in for it. */
  const fav = product._id ? `
    <button class="fav${isSaved(product._id) ? " on" : ""}"
            data-fav="${esc(product._id)}"
            aria-pressed="${isSaved(product._id)}"
            aria-label="${esc(T.fav_save)}" title="${esc(T.fav_save)}">
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 21s-7.5-4.7-9.6-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.6 12c-2.1 4.3-9.6 9-9.6 9z"/></svg>
    </button>` : "";

  /* Stock sits on the line with the weight rather than as a corner badge:
     it is a fact about the product, read alongside its size and price,
     not a flash the eye is meant to catch first. Nothing is claimed when
     the owner has not said — an unmarked product is simply unmarked. */
  const stock =
      product.tag === "in"  ? `<span class="card-stock in">${esc(T.in_stock)}</span>`
    : product.tag === "out" ? `<span class="card-stock out">${esc(T.out_stock)}</span>`
    : "";

  const alt = LANGS.filter(l => l !== lang).map(l => product[l]).join(" · ");
  const searchIndex = LANGS.map(l => product[l]).join(" ").toLowerCase();

  return `
  <article class="card${product.tag === "out" ? " out" : ""}"
           data-lb data-lb-c="${ci}" data-lb-p="${pi}"
           data-lb-cat="${esc(category[lang])}"
           tabindex="0" role="button"
           data-search="${esc(searchIndex)}"
           data-price="${product.p}"
           data-sale="${product.was > product.p ? 1 : 0}"
           data-tag="${esc(product.tag ?? "")}"
           data-name="${esc(product[lang].toLowerCase())}"
           data-key="${esc(product.en.toLowerCase())}">
    <div class="card-img">
      ${fav}
      <div class="badges">${badges}</div>
      <img src="${esc(img)}" alt="${esc(product[lang])}"
           loading="lazy" width="600" height="600" ${IMG_FALLBACK}>
    </div>
    <div class="card-b">
      <div class="card-cat">${esc(category[lang])}</div>
      <h3>${esc(product[lang])}</h3>
      <div class="card-jp" title="${esc(alt)}">${esc(alt)}</div>
      <div class="card-meta">
        <span class="card-w">${esc(product.w)}</span>
        ${stock}
      </div>
      <div class="price">
        <span class="now">${yen(product.p)}</span>
        ${product.was ? `<span class="was">${yen(product.was)}</span>` : ""}
      </div>
      <div class="tax">${esc(T.withtax)}</div>
    </div>
  </article>`;
}

/** Numbered category sections — the "step by step" catalogue. */
export function catalogHTML(){
  const T = t(), lang = getLang();

  // Customers only see categories that actually have something in them.
  // `n` numbers the sections on screen; `ci` is the real position in
  // CATALOG, which is what the lightbox looks the product up by.
  return stocked().map(({ cat, ci }, n) => `
    <section class="sec wrap" id="${esc(cat.id)}">
      <div class="sec-head">
        <span class="sec-no">${n + 1}</span>
        <h2>${esc(cat[lang])}</h2>
        <span class="n">${esc(itemCount(cat.items.length))}</span>
      </div>
      <div class="grid">
        ${cat.items.map((p, j) =>
          cardHTML(p, cat, ci, j).replace("<article", `<article data-i="${j}"`)).join("")}
      </div>
    </section>`).join("");
}

/** Category chips / tiles. */
export function chipsHTML(){
  const T = t(), lang = getLang();
  const prefix = document.body.dataset.page === "products" ? "" : "products.html";

  return stocked().map(({ cat }) => `
    <a href="${prefix}#${esc(cat.id)}" class="chip">
      <img src="${esc(cat.img || SHOP.placeholder)}" alt="" loading="lazy"
           width="80" height="80" ${IMG_FALLBACK}>
      <b>${esc(cat[lang])}</b>
      <span>${esc(itemCount(cat.items.length))}</span>
    </a>`).join("");
}
