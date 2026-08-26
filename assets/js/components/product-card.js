/**
 * Product card + category section markup.
 */
import { esc } from "../core/dom.js";
import { t, getLang, LANGS } from "../core/lang.js";
import { yen, discount } from "../core/format.js";
import { SHOP } from "../data/shop.js";
import { CATALOG } from "../data/catalog.js";

/**
 * One product card.
 * Names in the two inactive languages are shown as a secondary line, so a
 * customer can always recognise the item whichever language they read.
 */
export function cardHTML(product, category, ci = 0, pi = 0){
  const T = t(), lang = getLang();
  const off = discount(product.was, product.p);
  const img = product.img || SHOP.placeholder;

  const badges = [
    off ? `<span class="badge badge-off">-${off}% ${esc(T.off)}</span>` : "",
    product.tag === "new" ? `<span class="badge badge-new">${esc(T.new)}</span>` : "",
    product.tag === "out" ? `<span class="badge badge-out">${esc(T.out)}</span>` : ""
  ].join("");

  const alt = LANGS.filter(l => l !== lang).map(l => product[l]).join(" · ");
  const searchIndex = LANGS.map(l => product[l]).join(" ").toLowerCase();

  return `
  <article class="card${product.tag === "out" ? " out" : ""}"
           data-lb data-lb-c="${ci}" data-lb-p="${pi}"
           data-lb-cat="${esc(category[lang])}"
           tabindex="0" role="button"
           data-search="${esc(searchIndex)}"
           data-price="${product.p}"
           data-name="${esc(product[lang].toLowerCase())}">
    <div class="card-img">
      <div class="badges">${badges}</div>
      <img src="${esc(img)}" alt="${esc(product[lang])}"
           loading="lazy" width="600" height="600">
    </div>
    <div class="card-b">
      <div class="card-cat">${esc(category[lang])}</div>
      <h3>${esc(product[lang])}</h3>
      <div class="card-jp" title="${esc(alt)}">${esc(alt)}</div>
      <span class="card-w">${esc(product.w)}</span>
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

  return CATALOG.map((cat, i) => `
    <section class="sec wrap" id="${esc(cat.id)}">
      <div class="sec-head">
        <span class="sec-no">${i + 1}</span>
        <h2>${esc(cat[lang])}</h2>
        <span class="n">${cat.items.length} ${esc(T.items)}</span>
      </div>
      <div class="grid">
        ${cat.items.map((p, j) =>
          cardHTML(p, cat, i, j).replace("<article", `<article data-i="${j}"`)).join("")}
      </div>
    </section>`).join("");
}

/** Category chips / tiles. */
export function chipsHTML(){
  const T = t(), lang = getLang();
  const prefix = document.body.dataset.page === "products" ? "" : "products.html";

  return CATALOG.map(cat => `
    <a href="${prefix}#${esc(cat.id)}" class="chip">
      <img src="${esc(cat.img)}" alt="" loading="lazy" width="80" height="80">
      <b>${esc(cat[lang])}</b>
      <span>${cat.items.length} ${esc(T.items)}</span>
    </a>`).join("");
}
