/**
 * Checkout: where the shop finds out where to take the box.
 *
 * Registration stays email and password. The name, mobile and address a
 * delivery actually needs are asked for here, the first time somebody
 * orders, and the order is refused without them. A five-field form in
 * front of a visitor who only wants to look at the rice would cost more
 * customers than it keeps.
 *
 * A customer with an address book sees it: the default address filled
 * in, the others a pick away, and a blank form behind "a new address".
 * Whatever they choose stays editable, and an address typed here can be
 * kept — a ticked box, which they untick for the one-off delivery to a
 * friend's place that should not clutter their account.
 */
import { $, $$, esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { yen, jstDate } from "../../shared/lib/format.js";
import { SHOP } from "../../shared/shop.js";
import { icon } from "../../shared/ui/icons.js";
import { isSignedIn, accountKnown } from "../../features/account/account.js";
import { cartLines, cartTotal, isEmpty } from "../../features/cart/cart.js";
import { placeMyOrder } from "../../features/orders/orders.js";
import { myProfile, myAddresses, defaultAddress, saveAddress, saveMyProfile }
  from "../../features/profile/profile.js";
import { isJpMobile, isJpPostal, normalisePhone, normalisePostal }
  from "../../shared/lib/jp.js";

/* The order just placed, held so the confirmation survives the repaints
   that clearing the basket sets off. */
let placed = null;

/* Which saved address the form is showing: an id, "new", or null for
   "whichever is the default". Kept here so a repaint mid-way — the
   basket changing, the language switching — puts the same one back. */
let pick = null;

/* True from the first press until the answer lands. Held in state
   rather than only on the button, because saving the address repaints
   the form and a fresh button would come back enabled. */
let busy = false;

/** The address the form should show, or null for a blank one. */
function chosenAddress(){
  if (pick === "new") return null;
  return myAddresses().find(a => a.id === pick) ?? defaultAddress();
}

/** One line for the picker: "Home · 〒305-0005 · Tsukuba, Amakubo 3-4…" */
function addrLine(a){
  const short = a.address.length > 28 ? a.address.slice(0, 28) + "…" : a.address;
  return `${a.label} · 〒${a.postal} · ${short}`;
}

export function checkoutHTML(){
  const T = t();

  if (placed) return confirmationHTML(placed, T);

  // Same reason as the orders page: do not claim they are signed out
  // before anyone has looked.
  if (!accountKnown())
    return `<p class="ord-loading">${esc(T.acct_working)}</p>`;

  if (!isSignedIn())
    return card(icon("lock", { size: 28 }), T.acct_signin, T.chk_signin,
      `<a class="btn btn-red" href="signin.html?from=checkout.html">${esc(T.acct_signin)}</a>`);

  if (isEmpty())
    return card(icon("cart", { size: 28 }), T.cart_none, T.cart_none_s,
      `<a class="btn btn-red" href="products.html">${esc(T.nav_products)}</a>`);

  const p = myProfile() || {};
  const addrs = myAddresses();
  const a = chosenAddress();
  const lines = cartLines();
  const lang = document.documentElement.lang || "en";

  return `
    <div class="chk-page">
      <form class="chk-box" id="chkForm" novalidate>
        <h2>${esc(T.chk_who)}</h2>

        <label><span>${esc(T.chk_name)}</span>
          <input id="chkName" type="text" autocomplete="name"
                 value="${esc(p.full_name || "")}" required></label>

        ${addrs.length ? `
          <label><span>${esc(T.chk_addr_pick)}</span>
            <select id="chkPick">
              ${addrs.map(x => `
                <option value="${esc(x.id)}"${a?.id === x.id ? " selected" : ""}>
                  ${esc(addrLine(x))}</option>`).join("")}
              <option value="new"${a ? "" : " selected"}>${esc(T.chk_addr_new)}</option>
            </select></label>` : ""}

        <label><span>${esc(T.chk_phone)}</span>
          <input id="chkPhone" type="tel" autocomplete="tel" inputmode="tel"
                 placeholder="${esc(T.chk_phone_h)}"
                 value="${esc(a?.phone || "")}" required></label>

        <label><span>${esc(T.chk_postal)}</span>
          <input id="chkPostal" type="text" autocomplete="postal-code"
                 inputmode="numeric" placeholder="${esc(T.chk_postal_h)}"
                 value="${esc(a?.postal || "")}" required></label>

        <label><span>${esc(T.chk_addr)}</span>
          <textarea id="chkAddr" rows="3" autocomplete="street-address"
                    placeholder="${esc(T.chk_addr_h)}"
                    required>${esc(a?.address || "")}</textarea></label>

        <!-- Keep it? Shown for a new address, and again when a picked
             one has been edited. Ticked, because most people want the
             address they just typed to be there next time. -->
        <div class="chk-save" id="chkSaveWrap"${a ? " hidden" : ""}>
          <label class="chk-check">
            <input type="checkbox" id="chkSave" checked>
            <span id="chkSaveTx">${esc(T.chk_save_addr)}</span>
          </label>
          <label id="chkLabelWrap"><span>${esc(T.prof_label)}</span>
            <input id="chkLabel" type="text" maxlength="40"
                   placeholder="${esc(T.prof_label_h)}"
                   value="${esc(T.prof_label_home)}"></label>
        </div>

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

        <button type="submit" class="btn btn-red chk-go" id="chkGo"
                ${busy ? "disabled" : ""}>
          ${esc(busy ? T.chk_placing : T.chk_place)}
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

/**
 * One order, in full. Shared with the orders page.
 *
 * `canRemove` is off on the confirmation screen: offering to delete an
 * order in the same breath as confirming it invites a misplaced tap.
 */
export function orderCardHTML(o, T, lang, canRemove = false, n = 0){
  const nameOf = i => i[`name_${lang}`] || i.name_en;

  return `
    <div class="ord-card">
      <div class="ord-head">
        ${n ? `<span class="ord-no">${n}</span>` : ""}
        <b>${esc(o.code)}</b>
        <span class="ord-pill ${esc(o.status)}">${esc(statusLabel(o.status, T))}</span>
      </div>

      <p class="ord-when">${esc(T.ord_placed)}: ${esc(jstDate(o.placed_at))}</p>

      ${o.cancel_reason ? `
        <p class="ord-reason"><b>${esc(T.st_why)}:</b> ${esc(o.cancel_reason)}</p>` : ""}

      <div class="ord-items">
        ${(o.order_items || o.items || []).map(i => `
          <div class="ord-item${i.rejected ? " refused" : ""}">
            <span>
              ${esc(nameOf(i))} <small>${esc(i.w)} × ${i.qty}</small>
              ${i.rejected ? `
                <em class="ord-item-why">${esc(
                  i.reject_note || T.ord_unavailable)}</em>` : ""}
            </span>
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

      ${canRemove ? `
        <button type="button" class="ord-drop" data-drop-order="${esc(o.id)}">
          ${icon("trash", { size: 14 })} ${esc(T.ord_remove)}
        </button>` : ""}
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

  /* ------------------------ the address picker ---------------------- */

  const phone = $("#chkPhone"), postal = $("#chkPostal"), addr = $("#chkAddr");
  const wrap = $("#chkSaveWrap"), tx = $("#chkSaveTx");
  const labelWrap = $("#chkLabelWrap"), box = $("#chkSave");

  /* Show the "keep this?" row, or hide it. A new address asks for a
     label as well; an edit to one they already have keeps its label. */
  const showSave = mode => {
    if (!wrap) return;
    wrap.hidden = !mode;
    if (!mode) return;
    const T = t();
    tx.textContent = mode === "new" ? T.chk_save_addr : T.chk_update_addr;
    labelWrap.hidden = mode !== "new";
    box.checked = true;
  };

  /* Has the customer typed something other than the address they picked? */
  const edited = a => a && (
       normalisePhone(phone.value)   !== a.phone
    || normalisePostal(postal.value) !== a.postal
    || addr.value.trim()             !== a.address);

  $("#chkPick")?.addEventListener("change", e => {
    pick = e.target.value;
    const a = chosenAddress();
    phone.value  = a?.phone   || "";
    postal.value = a?.postal  || "";
    addr.value   = a?.address || "";
    showSave(a ? null : "new");
  });

  /* Editing a picked address offers to keep the edit. Typing into a
     blank form changes nothing: that row is already showing. */
  for (const el of [phone, postal, addr])
    el.addEventListener("input", () => {
      const a = chosenAddress();
      if (a) showSave(edited(a) ? "update" : null);
    });

  /* ----------------------------- placing ---------------------------- */

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (busy) return;

    const T = t();
    const err = $("#chkErr");
    const go = $("#chkGo");

    const p = {
      full_name: $("#chkName").value,
      phone:     phone.value,
      postal:    postal.value,
      address:   addr.value,
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

    /* Everything typed, taken now. Keeping the address repaints the
       form, and a repaint would hand back an empty note. */
    const note  = $("#chkNote")?.value || "";
    const label = $("#chkLabel")?.value || "";
    const keep  = Boolean(wrap && !wrap.hidden && box.checked);
    const ship  = {
      full_name: p.full_name.trim(),
      phone:     normalisePhone(p.phone),
      postal:    normalisePostal(p.postal),
      address:   p.address.trim(),
    };

    /* Held from the first press until the answer lands. Without it a
       double-click places the order twice, and the customer gets two
       boxes of rice. In module state as well as on the button: saving
       the address repaints the form, and a fresh button would otherwise
       come back enabled while the order was still in flight. */
    busy = true;
    go.disabled = true;
    go.textContent = T.chk_placing;
    err.hidden = true;

    /* The form may have been repainted by the time this is needed, so
       the elements are looked up again rather than reused. */
    const stop = message => {
      busy = false;
      const g = $("#chkGo"), e2 = $("#chkErr");
      if (g){ g.disabled = false; g.textContent = T.chk_place; }
      if (e2){ e2.textContent = message; e2.hidden = false; }
    };

    /* Their address book, if they asked. A new address is added; an
       edited one is updated in place and keeps its label. */
    if (keep){
      const a = chosenAddress();
      const r = await saveAddress(a
        ? { id: a.id, label: a.label, ...ship }
        : { label, ...ship });
      if (!r.ok) return stop(r.message);
      if (r.address) pick = r.address.id;
    }

    /* The name on the account, and a main phone if there is none yet.
       Never blocks the order: the order carries its own copy of both. */
    const prof = myProfile() || {};
    if (ship.full_name !== (prof.full_name || "") || !prof.phone){
      const r = await saveMyProfile({
        full_name: ship.full_name,
        ...(prof.phone ? {} : { phone: ship.phone }),
      });
      if (!r.ok) console.warn("profile:", r.message);
    }

    const r = await placeMyOrder({ lines, note, ship });
    if (!r.ok) return stop(r.message);

    /* Held here rather than in a query string: the confirmation carries
       the whole order, and a page reload should not be able to conjure
       one that was never placed.

       Set before repainting, not after. Emptying the basket already
       told every listener to re-render, and that repaint happened while
       this was still null — the customer watched their order turn into
       "your basket is empty". The order is in the database either way;
       what was lost was any sign of it. */
    busy = false;
    pick = null;
    placed = r.order;
    onPlaced?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}
