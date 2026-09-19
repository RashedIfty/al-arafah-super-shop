/**
 * The basket, on a page of its own.
 *
 * Each line joins live to the catalogue, so a price the owner changed
 * this morning is the price shown here — the freeze happens at checkout,
 * not before.
 */
import { esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { yen } from "../../shared/lib/format.js";
import { SHOP } from "../../shared/shop.js";
import { icon } from "../../shared/ui/icons.js";
import { cartLines, cartTotal, isEmpty } from "../../features/cart/cart.js";

export function cartPageHTML(){
  const T = t();

  if (isEmpty())
    return `
      <div class="cart-empty">
        <span class="cart-empty-ic">${icon("cart", { size: 30 })}</span>
        <b>${esc(T.cart_none)}</b>
        <p>${esc(T.cart_none_s)}</p>
        <a class="btn btn-red" href="products.html">${esc(T.nav_products)}</a>
      </div>`;

  const lines = cartLines();
  const lang = document.documentElement.lang || "en";

  return `
    <div class="cart-page">
      ${lines.map(l => lineHTML(l, lang, T)).join("")}

      <div class="cart-sum">
        <div class="cart-sum-row">
          <span>${esc(T.cart_total)}</span>
          <b>${yen(cartTotal())}</b>
        </div>
        <a class="btn btn-red" href="checkout.html">${esc(T.cart_checkout)}</a>
        <p class="tax">${esc(T.tax)}</p>
      </div>
    </div>`;
}

function lineHTML({ product, qty, lineTotal }, lang, T){
  const img = product.img || SHOP.placeholder;

  return `
    <div class="cart-line">
      <img src="${esc(img)}" alt="" loading="lazy" ${IMG_FALLBACK}>

      <div class="cart-tx">
        <b>${esc(product[lang] || product.en)}</b>
        <small>${esc(product.w)} · ${yen(product.p)}</small>

        <div class="buy-qty">
          <button type="button" class="qty-b" data-qty-down="${esc(product._id)}"
                  aria-label="${esc(T.cart_less)}">&minus;</button>
          <span class="qty-n">${qty}</span>
          <button type="button" class="qty-b" data-qty-up="${esc(product._id)}"
                  aria-label="${esc(T.cart_more)}">+</button>
        </div>
      </div>

      <div class="cart-money">
        <b>${yen(lineTotal)}</b>
        <small>${qty} × ${yen(product.p)}</small>
      </div>

      <button type="button" class="cart-drop" data-remove="${esc(product._id)}"
              aria-label="${esc(T.cart_remove)}" title="${esc(T.cart_remove)}">
        ${icon("trash", { size: 16 })}
      </button>
    </div>`;
}
