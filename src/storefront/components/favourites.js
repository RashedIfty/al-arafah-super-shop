/**
 * The customer's favourites page.
 *
 * Three states, and each has to say something useful: signed out, signed
 * in with nothing saved, and signed in with a list. The middle one is
 * the easiest to get wrong — an empty page that just says "empty" tells
 * the customer nothing about how to fill it.
 *
 * Products are looked up in CATALOG by id rather than stored: the list
 * holds ids, so a price change or a new photograph reaches this page for
 * free, and a product the owner has removed simply stops appearing.
 */
import { esc } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { isSignedIn, savedIds, userName } from "../../features/favourites/favourites.js";
import { cardHTML } from "./product-card.js";

/**
 * Find each saved product in the catalogue.
 *
 * Carries the category and both indices, because the lightbox looks a
 * product up as CATALOG[c].items[p] — the same reason the country and
 * shelf pages keep them.
 */
function savedProducts(){
  const wanted = savedIds();
  if (!wanted.length) return [];

  const byId = new Map();
  CATALOG.forEach((cat, ci) => cat.items.forEach((p, pi) => {
    if (p._id) byId.set(p._id, { p, cat, ci, pi });
  }));

  // Kept in the order they were saved, newest first, rather than in
  // catalogue order: this is the customer's list, not the shop's.
  return wanted.map(id => byId.get(id)).filter(Boolean);
}

export function favouritesHTML(){
  const T = t();

  if (!isSignedIn())
    return `
      <div class="fav-empty">
        <span class="fav-empty-ic">${heart()}</span>
        <b>${esc(T.fav_title)}</b>
        <p>${esc(T.fav_why)}</p>
        <button class="btn btn-red" data-signin>${esc(T.fav_signin)}</button>
      </div>`;

  const items = savedProducts();

  if (!items.length)
    return `
      <div class="fav-empty">
        <span class="fav-empty-ic">${heart()}</span>
        <b>${esc(T.fav_none)}</b>
        <p>${esc(T.fav_none_s)}</p>
        <a class="btn btn-red" href="products.html">${esc(T.nav_products)}</a>
      </div>`;

  return `
    <p class="fav-hi">${esc((T.fav_hi || "").replace("{n}", userName()))}</p>
    <div class="grid">
      ${items.map(x => cardHTML(x.p, x.cat, x.ci, x.pi)).join("")}
    </div>`;
}

const heart = () =>
  `<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M12 21s-7.5-4.7-9.6-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.6 12c-2.1 4.3-9.6 9-9.6 9z"/></svg>`;
