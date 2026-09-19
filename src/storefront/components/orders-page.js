/**
 * The customer's own orders, newest first, grouped by the day they were
 * placed.
 *
 * Row-level security confines the list to whoever is signed in, so there
 * is no filtering to do here — the database simply does not return
 * anybody else's.
 */
import { esc } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { jstDate, jstDay } from "../../shared/lib/format.js";
import { icon } from "../../shared/ui/icons.js";
import { isSignedIn } from "../../features/account/account.js";
import { myOrders, ordersLoaded } from "../../features/orders/orders.js";
import { orderCardHTML } from "./checkout.js";

export function ordersPageHTML(){
  const T = t();

  if (!isSignedIn())
    return empty(icon("lock", { size: 28 }), T.acct_signin, T.ord_why,
      `<a class="btn btn-red" href="signin.html?from=orders.html">${esc(T.acct_signin)}</a>`);

  const list = myOrders();

  /* Nothing yet is not the same as nothing ever: until the first fetch
     has come back, saying "no orders" would be a guess. */
  if (!list.length && !ordersLoaded())
    return `<p class="ord-loading">${esc(T.acct_working)}</p>`;

  if (!list.length)
    return empty(icon("cart", { size: 28 }), T.ord_none, T.ord_none_s,
      `<a class="btn btn-red" href="products.html">${esc(T.nav_products)}</a>`);

  const lang = document.documentElement.lang || "en";

  // Grouped by day, in the order the list already arrived (newest first).
  const days = [];
  for (const o of list){
    const key = jstDay(o.placed_at);
    let g = days.find(d => d.key === key);
    if (!g) days.push(g = { key, orders: [] });
    g.orders.push(o);
  }

  return `
    <div class="ord-page">
      ${days.map(d => `
        <h2 class="ord-day">${esc(jstDate(d.orders[0].placed_at, false))}</h2>
        ${d.orders.map(o => orderCardHTML(o, T, lang, true)).join("")}
      `).join("")}
    </div>`;
}

const empty = (ic, title, line, action) => `
  <div class="cart-empty">
    <span class="cart-empty-ic">${ic}</span>
    <b>${esc(title)}</b>
    <p>${esc(line)}</p>
    ${action}
  </div>`;
