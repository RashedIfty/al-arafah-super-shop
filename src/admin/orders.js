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
import { openInvoice, PAY_METHODS } from "./invoice.js";
export { setPhotos, setCustomerPhotos } from "./photos.js";
import { faceHTML, customerPhotoOf } from "./photos.js";

/* ------------------------------- state -------------------------------- */

let orders = [];
let archived = [];           // the owner's archive, shown under the live list
let busy = new Set();        // ids mid-write, so a double-click cannot fire twice
let unseen = 0;              // orders that arrived while the tab was not open

export const setOrders = rows => { orders = rows || []; };

export const setArchivedOrders = rows => { archived = rows || []; };
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

/**
 * Whether the owner wants to hear it at all.
 *
 * On unless he has said otherwise, because a shop that misses an order
 * is worse off than one that hears a chime it did not need. The choice
 * is remembered per browser, so turning it off at the counter does not
 * silence his phone.
 */
const WANT_KEY = "aa-order-sound";

let wanted = (() => {
  try { return localStorage.getItem(WANT_KEY) !== "off"; }
  catch { return true; }          // private mode: default to hearing it
})();

export const soundWanted = () => wanted;

function setWanted(on){
  wanted = on;
  try { localStorage.setItem(WANT_KEY, on ? "on" : "off"); } catch { /* not fatal */ }
  paintSound();
}

export function unlockAudio(){
  if (audio){
    // A context can be suspended again when the tab sleeps. Waking it
    // on every click keeps it ready for the next order.
    if (audio.state === "suspended") audio.resume().catch(() => {});
    paintSound();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try { audio = new Ctx(); } catch { /* no audio on this device */ }
  paintSound();
}

/** True once the browser will actually let us make a noise. */
export const soundReady = () => Boolean(audio) && audio.state === "running";

/**
 * The button says one of three things, because there are three states
 * and the owner needs to tell them apart.
 *
 * Off is his own choice. Waiting is the browser's: it will not let a
 * page make noise until someone has clicked, so a panel left open all
 * morning is silent through no fault of his. Silence is the one failure
 * he cannot see, and without this he would discover it by missing an
 * order.
 */
function paintSound(){
  const el = $("#ordSound");
  if (!el) return;

  const ready = soundReady();

  el.classList.toggle("off",     !wanted);
  el.classList.toggle("waiting", wanted && !ready);
  el.setAttribute("aria-pressed", wanted ? "true" : "false");

  el.textContent = !wanted ? "🔕 Sound off"
                 : ready   ? "🔔 Sound on"
                           : "🔔 Sound on — click anywhere to arm";
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
  if (!wanted) return;                               // he asked for quiet
  if (!audio || audio.state === "closed") return;
  if (!claimSound()) return;

  /* A suspended context — which is what a background tab gets — resumes
     asynchronously. Scheduling the notes before it wakes puts them in
     the past, and nothing is heard. Wait for the resume, then play. */
  if (audio.state === "suspended"){
    audio.resume().then(play).catch(() => {});
    return;
  }
  play();
}

/**
 * The alert itself: a rising three-note phrase, rung three times over
 * about two and a half seconds.
 *
 * Loud and long on purpose. This has to carry to a shopkeeper who is
 * serving somebody at the counter with the panel open on a tablet
 * across the room, not politely notify a person staring at the screen.
 */
function play(){
  const t0 = audio.currentTime;
  const NOTES = [784, 988, 1319];   // G5, B5, E6 — carries over shop noise
  const GAP = 0.13;                 // between notes
  const RING = 0.62;                // between repeats

  for (let rep = 0; rep < 3; rep++){
    for (const [i, hz] of NOTES.entries()){
      const at = t0 + rep * RING + i * GAP;

      /* Two oscillators an octave apart. A single sine is thin through
         a laptop speaker; the octave gives it a body that cuts through. */
      for (const [mult, level] of [[1, 0.5], [2, 0.22]]){
        const osc = audio.createOscillator();
        const amp = audio.createGain();
        osc.type = mult === 1 ? "triangle" : "sine";
        osc.frequency.value = hz * mult;

        amp.gain.setValueAtTime(0.0001, at);
        amp.gain.exponentialRampToValueAtTime(level, at + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);

        osc.connect(amp).connect(audio.destination);
        osc.start(at);
        osc.stop(at + 0.32);
      }
    }
  }
}

/* ------------------------------ the badge ----------------------------- */

const ordersTabOpen = () => !$("#tab-orders")?.hidden;

export function markSeen(){
  unseen = 0;
  paintBadge();
}

/**
 * The badge counts orders waiting to be dealt with, not orders that
 * happen to be new.
 *
 * It read "new since you last looked" and so went blank the moment the
 * tab was opened — leaving an order still waiting with nothing on the
 * tab to say so. The Archive badge beside it has always meant "this
 * many things are in here", and two badges an inch apart should not
 * mean two different kinds of thing.
 */
function paintBadge(){
  const waiting = orders.filter(o => o.status === "pending").length;

  const badge = $("#ordCount");
  if (badge) badge.textContent = waiting ? waiting : "";

  /* The window title is still about arrivals: it is glanced at from
     another application, where "something has come in" is the useful
     news, and it clears once the tab has been opened. */
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

/**
 * One line of an order, with the button that refuses it.
 *
 * A shop runs out of one thing, not of everything. Refusing a line
 * leaves the rest of the order standing, and the customer keeps the
 * four items that were on the shelf instead of losing all five.
 *
 * The refused line stays, struck through: an order that quietly lists
 * four items when five were asked for is how a shop loses an argument
 * it should have won.
 *
 * Only while there is still something to decide. Once an order is on
 * the van the contents are settled, and a button that rewrites a
 * delivered bill is a mistake waiting to be tapped.
 */
const CAN_REFUSE = ["pending", "confirmed"];

function lineRow(i, o, working){
  const open = CAN_REFUSE.includes(o.status);
  const off  = i.rejected;

  return `
    <div class="ord-line${off ? " refused" : ""}">
      <span>
        ${esc(i.name_en)} <small>${esc(i.w)} × ${i.qty}</small>
        ${off && i.reject_note
          ? `<em class="ord-line-why">${esc(i.reject_note)}</em>` : ""}
      </span>
      <b>${yen(i.line_total)}</b>
      ${open ? `
        <button class="ord-line-x${off ? " on" : ""}"
                data-item="${esc(i.id)}:${off ? "undo" : "no"}"
                title="${off ? "Put this back on the order" : "We cannot supply this"}"
                ${working ? "disabled" : ""}>
          ${icon(off ? "restore" : "close", { size: 13 })}
        </button>` : ""}
    </div>`;
}

/**
 * How the customer said they paid, under the total, so the owner can
 * match it against the app or the bank before confirming. Red when the
 * amount they typed is not the total — short, or over, either wants a
 * look. Orders from before the payment step have no method and show
 * nothing here.
 */
function payRow(o){
  if (!o.pay_method) return "";
  const m = PAY_METHODS.find(x => x.id === o.pay_method);
  const label = m ? m.label : o.pay_method;
  const prepaid = o.pay_method !== "cod";
  const off = prepaid && o.pay_amount != null && Number(o.pay_amount) !== Number(o.total);

  return `
    <div class="ord-line ord-pay${off ? " short" : ""}">
      <span>
        ${icon(prepaid ? "check" : "phone", { size: 12 })}
        ${esc(label)}${o.pay_ref ? ` <small>ref ${esc(o.pay_ref)}</small>` : ""}
      </span>
      <b>${prepaid ? `paid ${yen(o.pay_amount || 0)}` : `${yen(o.total)} on delivery`}</b>
    </div>`;
}

/** What was refused, totalled, so the owner sees what he turned away. */
function refusedSum(items){
  const off = items.filter(i => i.rejected);
  if (!off.length) return "";

  const lost = off.reduce((s, i) => s + Number(i.line_total || 0), 0);
  return `
    <div class="ord-line ord-line-off">
      <span>${off.length} item${off.length === 1 ? "" : "s"} not supplied</span>
      <b>−${yen(lost)}</b>
    </div>`;
}

function orderRow(o, n){
  const items = o.order_items || [];
  const acts = ACTIONS[o.status] || [];
  const working = busy.has(o.id);

  return `
    <div class="arc-row ord-row${working ? " working" : ""}">
      <div class="prod-tx">
        <div class="ord-row-head">
          <span class="ord-no">${n}</span>
          <b>${esc(o.code)}</b>
          <span class="ord-pill ${esc(o.status)}">${esc(LABEL[o.status] || o.status)}</span>
        </div>

        <span class="arc-when">${esc(jstDate(o.placed_at))}</span>

        <div class="ord-who">
          ${faceHTML(customerPhotoOf(o.user_id), o.name)}
          <span class="ord-nm">
            <b>${esc(o.name)}</b>
            <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>
          </span>
          <span class="ord-ad">〒${esc(o.postal)} ${esc(o.address)}</span>
        </div>

        <div class="ord-lines${CAN_REFUSE.includes(o.status) ? " has-x" : ""}">
          ${items.map(i => lineRow(i, o, working)).join("")}
          <div class="ord-line ord-line-sum">
            <span>Total</span><b>${yen(o.total)}</b>
          </div>
          ${refusedSum(items)}
          ${payRow(o)}
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
        ${["confirmed", "dispatched", "delivered"].includes(o.status) ? `
          <button class="act" data-ord-invoice="${esc(o.id)}">
            ${icon("box", { size: 14 })} Invoice
          </button>` : ""}
        <button class="act del" data-ord-archive="${esc(o.id)}" ${working ? "disabled" : ""}>
          ${icon("archive", { size: 14 })} Remove
        </button>
      </div>
    </div>`;
}

/* ------------------------------ filtering ----------------------------- */

/**
 * What the owner is looking at. Filtering happens here rather than in
 * the database: a shop of this size will not have enough orders for a
 * round trip to beat filtering in memory, and the list is already in
 * hand for the realtime updates.
 */
let when = "all";       // all | today | yesterday | 7 | 30 | custom
let what = "all";       // all, or one status
let query = "";
let from = "";          // ISO day, custom range only
let to = "";

/** Today in Tokyo, as a sortable "2026-09-19". */
const todayJst = () => jstDay(new Date().toISOString());

/** N days before today, in Tokyo. */
function daysAgoJst(n){
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return jstDay(d.toISOString());
}

/**
 * The window a chip means, as [firstDay, lastDay] inclusive, or null
 * for no date limit. Compared as plain ISO strings, which sort
 * correctly and sidestep every timezone trap a Date comparison invites.
 */
function windowFor(){
  switch (when){
    case "today":     return [todayJst(), todayJst()];
    case "yesterday": return [daysAgoJst(1), daysAgoJst(1)];
    case "7":         return [daysAgoJst(6), todayJst()];   // today counts as one
    case "30":        return [daysAgoJst(29), todayJst()];
    case "custom":
      if (!from && !to) return null;
      return [from || "0000-00-00", to || "9999-99-99"];
    default: return null;
  }
}

function visibleOrders(){
  const win = windowFor();
  const q = query.trim().toLowerCase();

  return orders.filter(o => {
    if (what !== "all" && o.status !== what) return false;

    if (win){
      const day = jstDay(o.placed_at);
      if (day < win[0] || day > win[1]) return false;
    }

    if (q){
      // Code, name and phone — the three things the owner has to hand
      // when a customer rings.
      const hay = [o.code, o.name, o.phone].join(" ").toLowerCase();
      if (hay.includes(q)) return true;

      /* A number typed the way Japan writes it, 080-3333-4444, must
         find a number stored as digits, and the other way about. Only
         worth trying when the search looks like a phone number at all,
         or "1kg" would start matching order codes. */
      let qDigits = q.replace(/\D/g, "");

      // +81 80-3333-4444 is the same phone as 080-3333-4444 with the
      // country code in front. Fold it back, the way checkout does.
      if (qDigits.startsWith("81") && qDigits.length === 12)
        qDigits = "0" + qDigits.slice(2);

      if (qDigits.length >= 3 && /^[\d\s()+-]+$/.test(q))
        return o.phone.replace(/\D/g, "").includes(qDigits);

      return false;
    }

    return true;
  });
}

/* ------------------------------ the list ------------------------------ */

export function renderOrders(){
  // The badge tracks the data, so it is repainted wherever the data is.
  paintBadge();

  const line = $("#ordLine");
  const list = $("#ordList");
  if (!list) return;

  const shown = visibleOrders();
  const filtered = shown.length !== orders.length;
  const waiting = orders.filter(o => o.status === "pending").length;

  if (line){
    line.textContent = !orders.length
      ? "No orders yet."
      : (filtered
          ? `Showing ${shown.length} of ${orders.length} orders`
          : `${orders.length} order${orders.length === 1 ? "" : "s"}`) +
        (waiting ? ` — ${waiting} waiting for you` : "");
  }

  if (!orders.length){
    list.innerHTML = `
      <div class="none">
        <b>No orders yet</b>
        <span>When a customer places an order it will appear here, and this panel will chime.</span>
      </div>` + archivedHTML();   // removed orders are still reachable
    return;
  }

  /* Nothing matched is a different thing from nothing existing, and
     needs a way back rather than an explanation. */
  if (!shown.length){
    list.innerHTML = `
      <div class="none">
        <b>Nothing matches</b>
        <span>No order fits what you are looking for. Try a wider date range, or clear the search.</span>
        <button class="act edit" id="ordClear" style="margin-top:12px">Show all orders</button>
      </div>` + archivedHTML();
    return;
  }

  /* Grouped by the day it was placed, Tokyo time. The list arrives
     newest first, so the days come out in order without sorting. */
  const days = [];
  for (const o of shown){
    const key = jstDay(o.placed_at);
    let g = days.find(d => d.key === key);
    if (!g) days.push(g = { key, rows: [] });
    g.rows.push(o);
  }

  /* Numbered straight through the list, newest first, so the owner can
     say "the third one down" on the phone and both of them are looking
     at the same order. The count runs across days rather than restarting
     each morning, which would give three orders the number 1. */
  let n = 0;
  const bulk = shown.length > 1 ? `
    <div class="ord-bulk ord-bulk-top">
      <button class="act del" data-ord-archive-all>
        ${icon("archive", { size: 14 })} Remove all ${shown.length} from the list
      </button>
    </div>` : "";

  list.innerHTML = bulk + days.map(d => `
    <section class="cat-block">
      <div class="cat-head">
        <b>${esc(jstDate(d.rows[0].placed_at, false))}</b>
        <em>${d.rows.length}</em>
      </div>
      ${d.rows.map(o => orderRow(o, ++n)).join("")}
    </section>`).join("") + archivedHTML();
}

/**
 * The archive, folded away under the live list.
 *
 * A <details> rather than a tab of its own: it is looked at rarely, and
 * putting it here keeps "removed" and "removed by mistake" in the same
 * place the owner was already standing.
 */
function archivedHTML(){
  if (!archived.length) return "";

  return `
    <details class="ord-archive">
      <summary>Removed orders <em>${archived.length}</em></summary>
      <p class="ord-archive-note">
        These are off your list but not gone. Put one back, or delete it
        for good — deleting cannot be undone.
      </p>

      <div class="ord-bulk">
        <button class="act edit" data-ord-restore-all>
          ${icon("restore", { size: 14 })} Put all back
        </button>
        <button class="act del" data-ord-destroy-all>
          ${icon("trash", { size: 14 })} Delete all forever
        </button>
      </div>
      ${archived.map(o => `
        <div class="arc-row ord-row">
          <div class="prod-tx">
            <div class="ord-row-head">
              <b>${esc(o.code)}</b>
              <span class="ord-pill ${esc(o.status)}">${esc(LABEL[o.status] || o.status)}</span>
            </div>
            <span class="arc-when">
              Placed ${esc(jstDate(o.placed_at))} · removed ${esc(jstDate(o.archived_at))}
            </span>
            <div class="ord-who">
              <span class="ord-nm"><b>${esc(o.name)}</b>
                <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></span>
              <span class="ord-ad">${(o.order_items || []).length} item(s) · ${yen(o.total)}</span>
            </div>
          </div>
          <div class="prod-act">
            <button class="act edit" data-ord-restore="${esc(o.id)}">
              ${icon("restore", { size: 14 })} Put back
            </button>
            <button class="act del" data-ord-destroy="${esc(o.id)}">
              ${icon("trash", { size: 14 })} Delete forever
            </button>
          </div>
        </div>`).join("")}
    </details>`;
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
  paintSound();

  // The button turns it off and on. Unlocking first means that the same
  // click both arms the audio and leaves it on — the browser wants a
  // gesture, and this is one.
  $("#ordSound")?.addEventListener("click", () => {
    unlockAudio();
    setWanted(!wanted);
  });

  // Opening the tab clears the count.
  $$(".tab").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.tab === "orders") markSeen();
  }));

  wireFilters();

  const alert = $("#ordAlert");
  $("#ordAlertX")?.addEventListener("click", () => { alert.hidden = true; });
  $("#ordAlertGo")?.addEventListener("click", () => {
    alert.hidden = true;
    $(`.tab[data-tab="orders"]`)?.click();
    $("#ordList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* Archive, restore and delete-for-good. Archiving is reversible, so it
     asks nothing; deleting from the archive cannot be undone, so it does. */
  document.addEventListener("click", async e => {
    const inv = e.target.closest("[data-ord-invoice]");
    if (inv){
      const o = [...orders, ...archived].find(x => String(x.id) === inv.dataset.ordInvoice);
      if (o) askPayMethod(o);
      return;
    }

    /* Choosing the method, then printing. */
    const pay = e.target.closest("[data-pay-go]");
    if (pay){
      const o = [...orders, ...archived].find(x => String(x.id) === payFor);
      const chosen = $("#payPick")?.value || "cod";
      closePayPick();
      if (o && !openInvoice(o, chosen))
        toast("Your browser blocked the new window. Allow pop-ups for this site.", true);
      return;
    }

    if (e.target.closest("[data-pay-x]")){ closePayPick(); return; }

    const arc = e.target.closest("[data-ord-archive]");
    if (arc){
      const o = orders.find(x => String(x.id) === arc.dataset.ordArchive);
      if (!o) return;
      const { error } = await api.archiveOrder(o.id);
      if (error) return toast(error.message, true);
      toast(`Order ${o.code} moved to the archive.`);
      return refresh();
    }

    const put = e.target.closest("[data-ord-restore]");
    if (put){
      const { error } = await api.restoreOrder(put.dataset.ordRestore);
      if (error) return toast(error.message, true);
      toast("Order put back on your list.");
      return refresh();
    }

    /* The bulk three. Each asks first: they reach every order at once,
       and "all" on a phone behind a counter is an easy mis-tap. */
    if (e.target.closest("[data-ord-archive-all]")){
      const n = visibleOrders().length;
      ask("Remove every order from the list?",
          `All ${n} order${n === 1 ? "" : "s"} will move to Removed orders. ` +
          `Nothing is deleted — you can put them back.`,
          async () => {
            const { data, error } = await api.archiveAllOrders();
            if (error) return toast(error.message, true);
            toast(`${data.length} order${data.length === 1 ? "" : "s"} removed from the list.`);
            refresh();
          });
      return;
    }

    if (e.target.closest("[data-ord-restore-all]")){
      const { data, error } = await api.restoreArchivedOrders();
      if (error) return toast(error.message, true);
      toast(`${data.length} order${data.length === 1 ? "" : "s"} put back.`);
      return refresh();
    }

    if (e.target.closest("[data-ord-destroy-all]")){
      const n = archived.length;
      ask("Delete every removed order forever?",
          `All ${n} order${n === 1 ? "" : "s"} in Removed orders will be gone permanently, ` +
          `with everything in them. This cannot be undone, and it is the ` +
          `shop's own record of those sales.`,
          async () => {
            const { data, error } = await api.destroyArchivedOrders();
            if (error) return toast(error.message, true);
            toast(`${data.length} order${data.length === 1 ? "" : "s"} deleted permanently.`);
            refresh();
          });
      return;
    }

    const gone = e.target.closest("[data-ord-destroy]");
    if (gone){
      const id = gone.dataset.ordDestroy;
      const o = archived.find(x => String(x.id) === id);
      ask("Delete this order forever?",
          `Order ${o?.code ?? ""} and everything in it will be gone permanently. ` +
          `This cannot be undone, and it is the shop's own record of a sale.`,
          async () => {
            const { error } = await api.destroyOrder(id);
            if (error) return toast(error.message, true);
            toast("Order deleted permanently.");
            refresh();
          });
      return;
    }
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

  /* ---------------------- one line at a time ------------------------ */

  /**
   * Refuse a single item, or put it back.
   *
   * Refusing asks why and warns; putting one back does not — restoring
   * a line the shop can supply after all needs no ceremony, and an
   * accidental press is undone by pressing again.
   */
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-item]");
    if (!btn) return;

    const [itemId, what] = btn.dataset.item.split(":");
    const order = orders.find(o =>
      (o.order_items || []).some(i => String(i.id) === itemId));
    if (!order || busy.has(order.id)) return;

    const item = order.order_items.find(i => String(i.id) === itemId);

    if (what === "undo") return runItem(order, item, "", true);

    ask("Cannot supply this item?",
        `${item.name_en} ${item.w} × ${item.qty} — ${yen(item.line_total)}. ` +
        `The rest of order ${order.code} goes ahead and the total drops. ` +
        `Please ring ${order.name} as well.`,
        () => runItem(order, item, promptReason(), false));
  });

  async function runItem(order, item, note, undo){
    busy.add(order.id);
    renderOrders();

    const { data, error } = await api.rejectOrderItem(item.id, note, undo);
    busy.delete(order.id);

    if (error){
      toast(error.message, true);
      await refresh();
      return;
    }

    /* Patch the line and the order's new total in place. The whole list
       is not worth refetching for one line, and the total came back
       from the database rather than being added up again here. */
    const oi = orders.findIndex(o => o.id === order.id);
    if (oi !== -1){
      const items = (orders[oi].order_items || []).map(i =>
        String(i.id) === String(item.id)
          ? { ...i, rejected: !undo,
                    reject_note: undo ? null : (note || null) }
          : i);
      orders[oi] = { ...orders[oi], order_items: items,
                     total: data.total ?? orders[oi].total };
    }

    toast(undo
      ? `${item.name_en} is back on order ${order.code}.`
      : `${item.name_en} refused. Order ${order.code} is now ${yen(data.total ?? 0)}.`);
    renderOrders();
  }

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

/* ------------------------ how did they pay? --------------------------- */

/**
 * Ask before printing.
 *
 * The invoice is the paper the customer keeps, and one that says "cash
 * on delivery" for an order settled by PayPay is simply wrong. The owner
 * knows how it was paid; the software does not, and should not guess.
 *
 * Built and thrown away each time rather than living in admin.html: it
 * belongs to this feature, and the panel's own confirm dialog only
 * answers yes or no.
 */
let payFor = null;

function askPayMethod(o){
  payFor = o.id;
  closePayPick();

  const box = document.createElement("div");
  box.className = "ad-modal pay-modal";
  box.id = "payPickWrap";
  box.innerHTML = `
    <div class="ad-modal-bg" data-pay-x></div>
    <div class="ad-modal-box pay-box">
      <div class="ad-modal-head">
        <h2>How was this paid?</h2>
        <button type="button" class="ad-x" data-pay-x aria-label="Close">
          ${icon("close", { size: 20 })}
        </button>
      </div>

      <div class="pay-body">
        <p class="pay-for">
          Order <b>${esc(o.code)}</b> · ${esc(o.name)} · <b>${yen(o.total)}</b>
        </p>

        <label class="pay-lab" for="payPick">Payment method</label>
        <select id="payPick" class="pay-sel">
          ${PAY_METHODS.map(m =>
            `<option value="${esc(m.id)}"${m.id === (o.pay_method || "cod") ? " selected" : ""}>${esc(m.label)}</option>`).join("")}
        </select>

        <p class="pay-hint">
          This is printed on the invoice the customer keeps, so it should
          say what actually happened.
        </p>
      </div>

      <div class="ad-modal-foot">
        <button type="button" class="btn btn-out" data-pay-x>Cancel</button>
        <button type="button" class="btn btn-red" data-pay-go>
          ${icon("box", { size: 15 })} Open the invoice
        </button>
      </div>
    </div>`;

  document.body.appendChild(box);
  $("#payPick")?.focus();
}

function closePayPick(){
  $("#payPickWrap")?.remove();
}

/* --------------------------- the filter bar --------------------------- */

/**
 * Chips rather than dropdowns. The owner works on a phone behind a
 * counter as often as at a desk, and a row of buttons is one tap where
 * a select is three.
 */
function wireFilters(){
  const search = $("#ordSearch");
  if (search){
    let t;
    search.addEventListener("input", () => {
      // Debounced: rebuilding the whole list on every keystroke makes
      // typing stutter once there are a few hundred orders.
      clearTimeout(t);
      t = setTimeout(() => { query = search.value; renderOrders(); }, 140);
    });
  }

  const pick = (wrap, attr, set) => {
    $(wrap)?.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      $$(`${wrap} .chip`).forEach(c => c.classList.toggle("on", c === chip));
      set(chip.dataset[attr]);
      renderOrders();
    });
  };

  pick("#ordWhen", "when", v => {
    when = v;
    const box = $("#ordDates");
    if (box) box.hidden = v !== "custom";
  });

  pick("#ordWhat", "status", v => { what = v; });

  for (const id of ["#ordFrom", "#ordTo"]){
    $(id)?.addEventListener("change", () => {
      from = $("#ordFrom")?.value || "";
      to   = $("#ordTo")?.value   || "";
      renderOrders();
    });
  }

  // "Show all orders", offered when a filter has hidden everything.
  document.addEventListener("click", e => {
    if (!e.target.closest("#ordClear")) return;
    when = what = "all";
    query = from = to = "";
    if (search) search.value = "";
    if ($("#ordFrom")) $("#ordFrom").value = "";
    if ($("#ordTo")) $("#ordTo").value = "";
    if ($("#ordDates")) $("#ordDates").hidden = true;
    $$("#ordWhen .chip").forEach(c => c.classList.toggle("on", c.dataset.when === "all"));
    $$("#ordWhat .chip").forEach(c => c.classList.toggle("on", c.dataset.status === "all"));
    renderOrders();
  });
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
        const how = PAY_METHODS.find(x => x.id === row.pay_method)?.label;
        $("#ordAlertTitle").textContent = `New order — ${row.code}`;
        $("#ordAlertSub").textContent = `${row.name} · ${yen(row.total)}${how ? ` · ${how}` : ""}`;
        alert.hidden = false;
      }

      if (!ordersTabOpen()){ unseen++; paintBadge(); }

      // The payload has no items, so take the order whole from the server.
      await refresh();
    },

    onChange: async () => { await refresh(); },
  });
}
