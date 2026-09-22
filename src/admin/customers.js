/**
 * The customer book: every registered account, on a card.
 *
 * Who they are, how to reach them, where the box goes, everything they
 * have ordered and everything they have asked the shop to get back in.
 * Sorted by first name, because that is how the owner knows them, and
 * searched by anything on the card — a name half-remembered, the tail
 * of a phone number, a street.
 *
 * Shaped like admin/restock.js: plain setters, a render function that
 * main.js calls, and the two lists the cards are assembled from handed
 * in rather than fetched here. A new registration appears on the next
 * reload without anybody doing anything; the list is the accounts.
 */
import { $, esc } from "../shared/lib/dom.js";
import { icon } from "../shared/ui/icons.js";
import { jstDate } from "../shared/lib/format.js";
import { yen } from "../shared/lib/format.js";
import { faceHTML } from "./photos.js";

let people = [];        // customer_directory rows
let orders = [];        // every order, live and archived
let asks = [];          // every restock request, open and done
let query = "";
let open = new Set();   // cards whose history is unfolded

export const setCustomers = rows => { people = rows || []; };
export const setCustomerOrders = rows => { orders = rows || []; };
export const setCustomerAsks = rows => { asks = rows || []; };
export const customerCount = () => people.length;

/* ------------------------------- shaping ------------------------------ */

/** The name to sort and search by: what they set, else their email. */
const nameOf = p => (p.full_name || p.email.split("@")[0] || "").trim();

/** First name first, then the rest, case and accents ignored. */
const byFirstName = (a, b) =>
  nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" });

/** One line of everything searchable, lower-cased once. */
function haystack(p){
  return [p.full_name, p.email, p.phone, p.addr_phone, p.addr_label,
          p.postal, p.address].filter(Boolean).join(" ").toLowerCase();
}

/** The customers matching the search, in order. */
function shown(){
  const q = query.trim().toLowerCase();
  const list = q ? people.filter(p => haystack(p).includes(q)) : people;
  return [...list].sort(byFirstName);
}

/* ------------------------------ rendering ----------------------------- */

export function renderCustomers(){
  const list = $("#cuList");
  const line = $("#cuLine");
  const badge = $("#cuCount");

  if (badge) badge.textContent = people.length || "";
  if (!list) return;

  const rows = shown();

  if (line){
    line.textContent = !people.length
      ? "Nobody has registered yet."
      : query.trim()
        ? `${rows.length} of ${people.length} customer${people.length === 1 ? "" : "s"}`
        : `${people.length} registered customer${people.length === 1 ? "" : "s"}`;
  }

  if (!people.length){
    list.innerHTML = `
      <div class="none">
        <b>No customers yet</b>
        <span>Everyone who creates an account on the website will appear here.</span>
      </div>`;
    return;
  }

  if (!rows.length){
    list.innerHTML = `
      <div class="none">
        <b>Nobody matches</b>
        <span>Try a name, a phone number or a street.</span>
      </div>`;
    return;
  }

  /* Orders and requests per customer, counted once rather than per card. */
  const ordersBy = new Map();
  for (const o of orders)
    (ordersBy.get(o.user_id) ?? ordersBy.set(o.user_id, []).get(o.user_id)).push(o);
  const asksBy = new Map();
  for (const a of asks)
    (asksBy.get(a.user_id) ?? asksBy.set(a.user_id, []).get(a.user_id)).push(a);

  list.innerHTML = `<div class="cu-grid">${
    rows.map(p => cardHTML(p, ordersBy.get(p.user_id) ?? [], asksBy.get(p.user_id) ?? [])).join("")
  }</div>`;
}

/** The initial, when there is no photo: the one letter they go by. */
function blankFace(p){
  const ch = (nameOf(p)[0] || "?").toUpperCase();
  return `<span class="cu-face cu-face-blank" aria-hidden="true">${esc(ch)}</span>`;
}

function cardHTML(p, theirOrders, theirAsks){
  const name = nameOf(p);
  const isOpen = open.has(p.user_id);
  const spent = theirOrders
    .filter(o => !["rejected", "cancelled"].includes(o.status))
    .reduce((s, o) => s + Number(o.total || 0), 0);
  const waiting = theirAsks.filter(a => !a.done_at).length;

  return `
    <article class="cu-card${isOpen ? " is-open" : ""}" data-cu="${esc(p.user_id)}">
      <div class="cu-head">
        ${p.avatar_url
          ? `<span class="cu-face">${faceHTML(p.avatar_url, name)}</span>`
          : blankFace(p)}
        <div class="cu-id">
          <b>${esc(name)}</b>
          <a class="cu-mail" href="mailto:${esc(p.email)}">${esc(p.email)}</a>
          ${p.phone
            ? `<a class="cu-tel" href="tel:${esc(p.phone)}">${icon("phone", { size: 12 })} ${esc(p.phone)}</a>`
            : ""}
        </div>
      </div>

      ${p.address ? `
        <div class="cu-addr">
          <em>${esc(p.addr_label || "Address")}</em>
          <span>〒${esc(p.postal)} ${esc(p.address)}</span>
          ${p.addr_phone && p.addr_phone !== p.phone
            ? `<a href="tel:${esc(p.addr_phone)}">${esc(p.addr_phone)}</a>` : ""}
        </div>` : `
        <div class="cu-addr cu-addr-none">No delivery address yet</div>`}

      <div class="cu-stats">
        <span><b>${theirOrders.length}</b> order${theirOrders.length === 1 ? "" : "s"}</span>
        <span><b>${yen(spent)}</b> spent</span>
        <span><b>${theirAsks.length}</b> request${theirAsks.length === 1 ? "" : "s"}${
          waiting ? ` <i class="cu-wait">${waiting} waiting</i>` : ""}</span>
        <span class="cu-since">Since ${esc(jstDate(p.joined_at, false))}</span>
      </div>

      ${theirOrders.length || theirAsks.length ? `
        <button type="button" class="cu-more" data-cu-toggle="${esc(p.user_id)}">
          ${isOpen ? "Hide history" : "Show history"}
        </button>` : ""}

      ${isOpen ? historyHTML(theirOrders, theirAsks) : ""}
    </article>`;
}

/** Everything they have ordered and asked for, newest first. */
function historyHTML(theirOrders, theirAsks){
  const ord = [...theirOrders].sort((a, b) => (a.placed_at < b.placed_at ? 1 : -1));
  const ask = [...theirAsks].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return `
    <div class="cu-hist">
      ${ord.length ? `
        <h4>Orders</h4>
        ${ord.map(o => `
          <div class="cu-ord">
            <div class="cu-ord-head">
              <b>${esc(o.code)}</b>
              <span class="ord-pill ${esc(o.status)}">${esc(o.status)}</span>
              <span class="cu-ord-when">${esc(jstDate(o.placed_at))}</span>
              <b class="cu-ord-tot">${yen(o.total)}</b>
            </div>
            <div class="cu-ord-items">${
              (o.order_items || []).map(i =>
                `<span${i.rejected ? ' class="refused"' : ""}>${esc(i.name_en)} × ${i.qty}</span>`
              ).join("")
            }</div>
          </div>`).join("")}` : ""}

      ${ask.length ? `
        <h4>Restock requests</h4>
        ${ask.map(a => `
          <div class="cu-ask${a.done_at ? " done" : ""}">
            <span>${esc(a.en)} <small>${esc(a.w || "")}</small></span>
            <span class="cu-ask-when">${a.done_at
              ? `back in ${esc(jstDate(a.done_at, false))}`
              : `asked ${esc(jstDate(a.created_at, false))} · <i>waiting</i>`}</span>
          </div>`).join("")}` : ""}
    </div>`;
}

/* ------------------------------- controls ----------------------------- */

export function initCustomers(){
  $("#cuSearch")?.addEventListener("input", e => {
    query = e.target.value;
    renderCustomers();
  });

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-cu-toggle]");
    if (!t) return;
    const id = t.dataset.cuToggle;
    open.has(id) ? open.delete(id) : open.add(id);
    renderCustomers();
  });
}
