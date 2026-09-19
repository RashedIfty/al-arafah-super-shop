/**
 * The owner's side of an order.
 *
 * One list, newest first, and four buttons that move an order along its
 * one permitted path: pending → confirmed → dispatched → delivered, with
 * reject and cancel as the ways out. Which buttons appear is decided by
 * the status, so the owner is never offered a step that cannot be taken.
 *
 * The sequence is enforced again in the database (client.js:setOrderStatus
 * matches on the status it expects), so a stale page cannot dispatch
 * something that was never confirmed. The gating here is courtesy; the
 * gating there is the rule.
 *
 * Rendering follows the archive tab: a .cat-block per day, .arc-row per
 * order, .act buttons. Nothing new to learn for someone who already uses
 * the panel.
 */
import { $, $$, esc } from "../shared/lib/dom.js";
import { icon } from "../shared/ui/icons.js";
import { yen, jstDate, jstDay } from "../shared/lib/format.js";
import * as api from "../backend/client.js";

/* ------------------------------- state -------------------------------- */

let orders = [];
let busy = new Set();        // ids mid-write, so a double-click cannot fire twice
let unseen = 0;              // orders that arrived while the tab was not open

export const setOrders = rows => { orders = rows || []; };
export const allOrders = () => orders;

/* ------------------------------ the chime ----------------------------- */

/**
 * A short two-note tone, built in the browser rather than shipped as a
 * file — it is a few lines of maths against forty kilobytes of audio,
 * and it cannot 404.
 *
 * Browsers refuse to make noise before the person has interacted with
 * the page, so the context is created on the owner's first click and
 * kept. Until then the banner still appears; only the sound waits.
 */
let audio = null;

export function unlockAudio(){
  if (audio) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try { audio = new Ctx(); } catch { /* no audio on this device */ }
}

/**
 * One chime across every open tab.
 *
 * The owner may well have the panel open on the counter and on his
 * phone. A timestamp in localStorage claims the sound for two seconds;
 * whichever tab writes first plays it, and the others stay quiet.
 * localStorage is shared between tabs — sessionStorage is per-tab by
 * design and would let all three ring.
 */
function claimSound(){
  const KEY = "aa-order-chime";
  const now = Date.now();
  try {
    const last = +(localStorage.getItem(KEY) || 0);
    if (now - last < 2000) return false;
    localStorage.setItem(KEY, String(now));
    return true;
  } catch { return true; }   // private mode: better twice than never
}

export function chime(){
  if (!audio || audio.state === "closed") return;
  if (!claimSound()) return;

  // Resumes a context the browser suspended while the tab was hidden.
  if (audio.state === "suspended") audio.resume().catch(() => {});

  const t0 = audio.currentTime;
  for (const [i, hz] of [880, 1320].entries()){
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;

    const at = t0 + i * 0.16;
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);

    osc.connect(amp).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.36);
  }
}

/* ------------------------------ the badge ----------------------------- */

const ordersTabOpen = () => !$("#tab-orders")?.hidden;

export function markSeen(){
  unseen = 0;
  paintBadge();
}

function paintBadge(){
  const badge = $("#ordCount");
  if (badge) badge.textContent = unseen ? unseen : "";

  // The tab title too, for a panel sitting behind other windows.
  const base = "My Shop — Al-Arafah Super Shop";
  document.title = unseen ? `(${unseen}) ${base}` : base;
}

/* ------------------------------ one order ----------------------------- */

/** What may be done next, and what each button is called. */
const ACTIONS = {
  pending: [
    ["confirmed", "Confirm", "edit", "check"],
    ["rejected",  "Reject",  "del",  "close"],
  ],
  confirmed: [
    ["dispatched", "Dispatch",  "edit", "send"],
    ["cancelled",  "Cancel",    "del",  "close"],
  ],
  dispatched: [
    ["delivered", "Mark as Delivered", "edit", "check"],
  ],
};

const LABEL = {
  pending: "Waiting for you",
  confirmed: "Confirmed",
  dispatched: "On its way",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function orderRow(o){
  const items = o.order_items || [];
  const acts = ACTIONS[o.status] || [];
  const working = busy.has(o.id);

  return `
    <div class="arc-row ord-row${working ? " working" : ""}">
      <div class="prod-tx">
        <div class="ord-row-head">
          <b>${esc(o.code)}</b>
          <span class="ord-pill ${esc(o.status)}">${esc(LABEL[o.status] || o.status)}</span>
        </div>

        <span class="arc-when">${esc(jstDate(o.placed_at))}</span>

        <div class="ord-who">
          <span class="ord-nm">
            <b>${esc(o.name)}</b>
            <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>
          </span>
          <span class="ord-ad">〒${esc(o.postal)} ${esc(o.address)}</span>
        </div>

        <div class="ord-lines">
          ${items.map(i => `
            <div class="ord-line">
              <span>${esc(i.name_en)} <small>${esc(i.w)} × ${i.qty}</small></span>
              <b>${yen(i.line_total)}</b>
            </div>`).join("")}
          <div class="ord-line ord-line-sum">
            <span>Total</span><b>${yen(o.total)}</b>
          </div>
        </div>

        ${o.note ? `<div class="ord-msg">“${esc(o.note)}”</div>` : ""}
        ${o.cancel_reason
          ? `<div class="ord-msg bad">Reason given: ${esc(o.cancel_reason)}</div>` : ""}
      </div>

      <div class="prod-act">
        <a class="act" href="tel:${esc(o.phone)}">${icon("phone", { size: 14 })} Call Customer</a>
        ${acts.map(([to, label, cls, ic]) => `
          <button class="act ${cls}" data-ord="${esc(o.id)}:${to}" ${working ? "disabled" : ""}>
            ${icon(ic, { size: 14 })} ${esc(label)}
          </button>`).join("")}
      </div>
    </div>`;
}

/* ------------------------------ the list ------------------------------ */

export function renderOrders(){
  const line = $("#ordLine");
  const list = $("#ordList");
  if (!list) return;

  const waiting = orders.filter(o => o.status === "pending").length;
  if (line){
    line.textContent = !orders.length
      ? "No orders yet."
      : `${orders.length} order${orders.length === 1 ? "" : "s"}` +
        (waiting ? ` — ${waiting} waiting for you` : "");
  }

  if (!orders.length){
    list.innerHTML = `
      <div class="none">
        <b>No orders yet</b>
        <span>When a customer places an order it will appear here, and this panel will chime.</span>
      </div>`;
    return;
  }

  /* Grouped by the day it was placed, Tokyo time. The list arrives
     newest first, so the days come out in order without sorting. */
  const days = [];
  for (const o of orders){
    const key = jstDay(o.placed_at);
    let g = days.find(d => d.key === key);
    if (!g) days.push(g = { key, rows: [] });
    g.rows.push(o);
  }

  list.innerHTML = days.map(d => `
    <section class="cat-block">
      <div class="cat-head">
        <b>${esc(jstDate(d.rows[0].placed_at, false))}</b>
        <em>${d.rows.length}</em>
      </div>
      ${d.rows.map(orderRow).join("")}
    </section>`).join("");
}

/* ----------------------------- the actions ---------------------------- */

/**
 * Wire the panel up. `deps` carries the things that live in main.js —
 * its toast, its confirm dialog, and a reload — so this module does not
 * reach back into it.
 */
export function initOrders({ toast, ask, refresh }){
  // Any click in the panel is consent enough for the browser to allow
  // sound. Cheap to call repeatedly; it returns at once once unlocked.
  document.addEventListener("click", unlockAudio, { passive: true });

  // Opening the tab clears the count.
  $$(".tab").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.tab === "orders") markSeen();
  }));

  const alert = $("#ordAlert");
  $("#ordAlertX")?.addEventListener("click", () => { alert.hidden = true; });
  $("#ordAlertGo")?.addEventListener("click", () => {
    alert.hidden = true;
    $(`.tab[data-tab="orders"]`)?.click();
    $("#ordList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-ord]");
    if (!btn) return;

    const [id, to] = btn.dataset.ord.split(":");
    const order = orders.find(o => String(o.id) === id);
    if (!order || busy.has(order.id)) return;

    // Rejecting or cancelling is the one thing here the customer cannot
    // undo, so it asks first — and the reason is shown to them.
    if (to === "rejected" || to === "cancelled"){
      ask(to === "rejected" ? "Reject this order?" : "Cancel this order?",
          `Order ${order.code} for ${order.name}. They will see this on their orders page. ` +
          `Please ring them as well — a message on a screen is not the same as being told.`,
          () => run(order, to, promptReason()));
      return;
    }

    run(order, to, "");
  });

  /**
   * The reason, asked for in the plainest way available. The panel's
   * own dialog takes a yes or no and nothing else, and a customer told
   * only "rejected" with no word about why is being treated poorly.
   */
  const promptReason = () =>
    (window.prompt("Why? The customer will see this.", "") || "").trim();

  async function run(order, to, reason){
    busy.add(order.id);
    renderOrders();

    const { data, error } = await api.setOrderStatus(order.id, to, reason);
    busy.delete(order.id);

    if (error){
      toast(error.message, true);
      // Somebody else moved it, or the page was stale. Get the truth back.
      await refresh();
      return;
    }

    // Keep the items: the update returns the order row without them.
    const i = orders.findIndex(o => o.id === order.id);
    if (i !== -1) orders[i] = { ...orders[i], ...data };

    toast(`Order ${order.code} — ${LABEL[to].toLowerCase()}.`);
    renderOrders();
  }
}

/* ------------------------------ realtime ------------------------------ */

/**
 * Listen for orders arriving and changing.
 *
 * An insert is the one that matters: the chime, the banner and the
 * badge. An update is usually this very panel's own doing, so it
 * refreshes quietly.
 */
export async function watchOrders({ refresh }){
  return api.subscribeOrders({
    onInsert: async row => {
      chime();

      const alert = $("#ordAlert");
      if (alert){
        $("#ordAlertTitle").textContent = `New order — ${row.code}`;
        $("#ordAlertSub").textContent = `${row.name} · ${yen(row.total)}`;
        alert.hidden = false;
      }

      if (!ordersTabOpen()){ unseen++; paintBadge(); }

      // The payload has no items, so take the order whole from the server.
      await refresh();
    },

    onChange: async () => { await refresh(); },
  });
}
