/**
 * Checkout: where the shop finds out where to take the box.
 *
 * Registration stays email and password. The name, mobile and address a
 * delivery actually needs are asked for here, the first time somebody
 * orders, and the order is refused without them. A five-field form in
 * front of a visitor who only wants to look at the rice would cost more
 * customers than it keeps.
 *
 * Details already given are filled in and left editable, so a returning
 * customer checks rather than retypes.
 */
import { $, $$, esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { yen, jstDate } from "../../shared/lib/format.js";
import { SHOP } from "../../shared/shop.js";
import { icon } from "../../shared/ui/icons.js";
import { isSignedIn } from "../../features/account/account.js";
import { cartLines, cartTotal, isEmpty } from "../../features/cart/cart.js";
import {
  myProfile, saveMyProfile, placeMyOrder,
  isJpMobile, isJpPostal, digitsOnly,
} from "../../features/orders/orders.js";

/* The order just placed, held so the confirmation survives the repaints
   that clearing the basket sets off. */
let placed = null;

export function checkoutHTML(){
  const T = t();

  if (placed) return confirmationHTML(placed, T);

  if (!isSignedIn())
    return card(icon("lock", { size: 28 }), T.acct_signin, T.chk_signin,
      `<a class="btn btn-red" href="signin.html?from=checkout.html">${esc(T.acct_signin)}</a>`);

  if (isEmpty())
    return card(icon("cart", { size: 28 }), T.cart_none, T.cart_none_s,
      `<a class="btn btn-red" href="products.html">${esc(T.nav_products)}</a>`);

  const p = myProfile() || {};
  const lines = cartLines();
  const lang = document.documentElement.lang || "en";

  return `
    <div class="chk-page">
      <form class="chk-box" id="chkForm" novalidate>
        <h2>${esc(T.chk_who)}</h2>

        <label><span>${esc(T.chk_name)}</span>
          <input id="chkName" type="text" autocomplete="name"
                 value="${esc(p.full_name || "")}" required></label>

        <label><span>${esc(T.chk_phone)}</span>
          <input id="chkPhone" type="tel" autocomplete="tel" inputmode="tel"
                 placeholder="${esc(T.chk_phone_h)}"
                 value="${esc(p.phone || "")}" required></label>

        <label><span>${esc(T.chk_postal)}</span>
          <input id="chkPostal" type="text" autocomplete="postal-code"
                 inputmode="numeric" placeholder="${esc(T.chk_postal_h)}"
                 value="${esc(p.postal || "")}" required></label>

        <label><span>${esc(T.chk_addr)}</span>
          <textarea id="chkAddr" rows="3" autocomplete="street-address"
                    placeholder="${esc(T.chk_addr_h)}"
                    required>${esc(p.address || "")}</textarea></label>

        <label><span>${esc(T.chk_note)}</span>
          <textarea id="chkNote" rows="2"
                    placeholder="${esc(T.chk_note_h)}"></textarea></label>

        <p class="chk-err" id="chkErr" hidden></p>

        <h2 class="chk-h2">${esc(T.chk_review)}</h2>
        <div class="chk-review">
          ${lines.map(l => `
            <div class="chk-line">
              <span>${esc(l.product[lang] || l.product.en)}
                <small>${esc(l.product.w)} × ${l.qty}</small></span>
              <b>${yen(l.lineTotal)}</b>
            </div>`).join("")}
          <div class="chk-line chk-sum">
            <span>${esc(T.cart_total)}</span>
            <b>${yen(cartTotal())}</b>
          </div>
        </div>

        <button type="submit" class="btn btn-red chk-go" id="chkGo">
          ${esc(T.chk_place)}
        </button>
        <p class="chk-tax">${esc(T.tax)}</p>
      </form>
    </div>`;
}

/* --------------------------- the confirmation ------------------------- */

/**
 * What the customer sees the moment the order lands.
 *
 * The two buttons are the point of the screen. The shop confirms by
 * phone, so the call has to be one tap away; and WhatsApp carries the
 * order to the owner's phone for the times his panel is not open.
 */
function confirmationHTML(o, T){
  const lang = document.documentElement.lang || "en";
  const nameOf = i => i[`name_${lang}`] || i.name_en;

  const text = encodeURIComponent(
    [`${T.ord_id} ${o.code}`,
     ...o.items.map(i => `• ${nameOf(i)} ${i.w} × ${i.qty} — ${yen(i.line_total)}`),
     `${T.ord_total}: ${yen(o.total)}`,
     `${o.name} · ${o.phone}`,
     `〒${o.postal} ${o.address}`,
     o.note ? `— ${o.note}` : "",
    ].filter(Boolean).join("\n"));

  return `
    <div class="chk-page">
      <div class="ord-done">
        <span class="ord-done-ic">${icon("check", { size: 30 })}</span>
        <b>${esc(T.ord_done)}</b>
        <p>${esc(T.ord_done_s)}</p>

        <div class="ord-code">${esc(o.code)}</div>

        <div class="ord-acts">
          <a class="btn btn-red" href="tel:${esc(SHOP.telRaw)}">
            ${icon("phone", { size: 16 })} ${esc(T.ord_call)}
          </a>
          <a class="btn btn-out" target="_blank" rel="noopener"
             href="https://wa.me/81${esc(SHOP.telRaw.slice(1))}?text=${text}">
            ${esc(T.ord_wa)}
          </a>
        </div>
      </div>

      ${orderCardHTML(o, T, lang)}

      <p class="ord-after">
        <a href="orders.html">${esc(T.ord_nav)}</a> ·
        <a href="products.html">${esc(T.ord_keep)}</a>
      </p>
    </div>`;
}

/** One order, in full. Shared with the orders page. */
export function orderCardHTML(o, T, lang){
  const nameOf = i => i[`name_${lang}`] || i.name_en;

  return `
    <div class="ord-card">
      <div class="ord-head">
        <b>${esc(o.code)}</b>
        <span class="ord-pill ${esc(o.status)}">${esc(statusLabel(o.status, T))}</span>
      </div>

      <p class="ord-when">${esc(T.ord_placed)}: ${esc(jstDate(o.placed_at))}</p>

      ${o.cancel_reason ? `
        <p class="ord-reason"><b>${esc(T.st_why)}:</b> ${esc(o.cancel_reason)}</p>` : ""}

      <div class="ord-items">
        ${(o.order_items || o.items || []).map(i => `
          <div class="ord-item">
            <span>${esc(nameOf(i))} <small>${esc(i.w)} × ${i.qty}</small></span>
            <b>${yen(i.line_total)}</b>
          </div>`).join("")}
        <div class="ord-item ord-tot">
          <span>${esc(T.ord_total)}</span><b>${yen(o.total)}</b>
        </div>
      </div>

      <p class="ord-to">
        <b>${esc(T.ord_to)}</b><br>
        ${esc(o.name)} · ${esc(o.phone)}<br>
        〒${esc(o.postal)} ${esc(o.address)}
      </p>
      ${o.note ? `<p class="ord-note">${esc(o.note)}</p>` : ""}
    </div>`;
}

export const statusLabel = (s, T) => ({
  pending: T.st_pending, confirmed: T.st_confirmed,
  dispatched: T.st_dispatched, delivered: T.st_delivered,
  rejected: T.st_rejected, cancelled: T.st_cancelled,
}[s] || s);

const card = (ic, title, line, action) => `
  <div class="cart-empty">
    <span class="cart-empty-ic">${ic}</span>
    <b>${esc(title)}</b>
    <p>${esc(line)}</p>
    ${action}
  </div>`;

/* ------------------------------ the form ------------------------------ */

/**
 * Bound once per render, guarded on the form itself — render() replaces
 * it whenever the language changes or the basket moves.
 */
/* How checkout asks the page to repaint. main.js supplies render(); the
   module cannot import it without the two files importing each other. */
let onPlaced = null;
export const setCheckoutRepaint = fn => { onPlaced = fn; };

export function initCheckout(){
  const form = $("#chkForm");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const T = t();
    const err = $("#chkErr");
    const go = $("#chkGo");

    const p = {
      full_name: $("#chkName").value,
      phone:     $("#chkPhone").value,
      postal:    $("#chkPostal").value,
      address:   $("#chkAddr").value,
    };

    /* Checked one at a time so the customer is told which field is
       wrong, rather than being refused as a whole. */
    const fail =
        !p.full_name.trim()   ? [T.chk_bad_name,   "#chkName"]
      : !isJpMobile(p.phone)  ? [T.chk_bad_phone,  "#chkPhone"]
      : !isJpPostal(p.postal) ? [T.chk_bad_postal, "#chkPostal"]
      : !p.address.trim()     ? [T.chk_bad_addr,   "#chkAddr"]
      : null;

    if (fail){
      err.textContent = fail[0];
      err.className = "chk-err";
      err.hidden = false;
      $(fail[1])?.focus();
      return;
    }

    const lines = cartLines();
    if (!lines.length){
      err.textContent = T.chk_empty;
      err.hidden = false;
      return;
    }

    /* Held from the first press until the answer lands. Without it a
       double-click places the order twice, and the customer gets two
       boxes of rice. */
    go.disabled = true;
    const label = go.textContent;
    go.textContent = T.chk_placing;
    err.hidden = true;

    const saved = await saveMyProfile(p);
    if (!saved.ok){
      go.disabled = false; go.textContent = label;
      err.textContent = saved.message;
      err.hidden = false;
      return;
    }

    const r = await placeMyOrder({ lines, note: $("#chkNote").value });

    if (!r.ok){
      go.disabled = false; go.textContent = label;
      err.textContent = r.message;
      err.hidden = false;
      return;
    }

    /* Held here rather than in a query string: the confirmation carries
       the whole order, and a page reload should not be able to conjure
       one that was never placed.

       Set before repainting, not after. Emptying the basket already
       told every listener to re-render, and that repaint happened while
       this was still null — the customer watched their order turn into
       "your basket is empty". The order is in the database either way;
       what was lost was any sign of it. */
    placed = r.order;
    onPlaced?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}
