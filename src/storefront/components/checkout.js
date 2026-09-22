/**
 * Checkout: where the shop finds out where to take the box, and how it
 * is being paid for.
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
 *
 * Three screens. Where it goes; how they will pay; then the paying —
 * a QR code to scan, a bank account to transfer to, or a phone call to
 * make first — and the order is placed only after that. Nothing is
 * written until the last press: the address is saved and the order
 * lands in one go, so stepping back never leaves a half-order behind.
 */
import { $, $$, esc } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { yen, jstDate } from "../../shared/lib/format.js";
import { SHOP } from "../../shared/shop.js";
import { PAY, METHODS, PREPAID, payLabel } from "../../shared/pay.js";
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

/* Which of the three screens is showing, which way of paying was
   picked, and everything the first screen collected. `draft` is taken
   when the customer leaves the address screen and is what the order is
   finally placed with, so going back and forth costs nothing and a
   repaint in between hands nothing back empty. */
let step = "ship";          // "ship" | "method" | "pay"
let method = null;          // one of METHODS
let draft = null;           // { ship, note, label, keep, code }

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

  /* The later screens need what the first one collected. If a repaint
     arrives without it — a language switch on a fresh load — start
     where there is something to start with. */
  if (step !== "ship" && !draft) step = "ship";

  if (step === "method") return methodsHTML(T);
  if (step === "pay")    return payHTML(T);
  return shipHTML(T);
}

/* ------------------------- screen 1: where ---------------------------- */

function shipHTML(T){
  const p = myProfile() || {};
  const addrs = myAddresses();
  const a = chosenAddress();
  const lang = document.documentElement.lang || "en";

  /* Coming back from a later screen, the form shows what was typed, as
     it was typed — not the address book's version, and not the tidied
     digits the order will carry. */
  const d = draft?.typed;
  const v = key => d ? d[key] : (a?.[key] || "");

  return `
    <div class="chk-page">
      ${stepperHTML("ship", T)}
      <form class="chk-box" id="chkForm" novalidate>
        <h2>${esc(T.chk_who)}</h2>

        <label><span>${esc(T.chk_name)}</span>
          <input id="chkName" type="text" autocomplete="name"
                 value="${esc(d?.full_name || p.full_name || "")}" required></label>

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
                 value="${esc(v("phone"))}" required></label>

        <label><span>${esc(T.chk_postal)}</span>
          <input id="chkPostal" type="text" autocomplete="postal-code"
                 inputmode="numeric" placeholder="${esc(T.chk_postal_h)}"
                 value="${esc(v("postal"))}" required></label>

        <label><span>${esc(T.chk_addr)}</span>
          <textarea id="chkAddr" rows="3" autocomplete="street-address"
                    placeholder="${esc(T.chk_addr_h)}"
                    required>${esc(v("address"))}</textarea></label>

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
                   value="${esc(draft?.label || T.prof_label_home)}"></label>
        </div>

        <label><span>${esc(T.chk_note)}</span>
          <textarea id="chkNote" rows="2"
                    placeholder="${esc(T.chk_note_h)}">${esc(draft?.note || "")}</textarea></label>

        <p class="chk-err" id="chkErr" hidden></p>

        ${reviewHTML(T, lang)}

        <button type="submit" class="btn btn-red chk-go" id="chkGo">
          ${esc(T.chk_next)} ${icon("arrow", { size: 16 })}
        </button>
        <p class="chk-tax">${esc(T.tax)}</p>
      </form>
    </div>`;
}

/** What they are about to buy, restated. On every screen: nobody should
    press the last button without the total in front of them. */
function reviewHTML(T, lang){
  return `
    <h2 class="chk-h2">${esc(T.chk_review)}</h2>
    <div class="chk-review">
      ${cartLines().map(l => `
        <div class="chk-line">
          <span>${esc(l.product[lang] || l.product.en)}
            <small>${esc(l.product.w)} × ${l.qty}</small></span>
          <b>${yen(l.lineTotal)}</b>
        </div>`).join("")}
      <div class="chk-line chk-sum">
        <span>${esc(T.cart_total)}</span>
        <b>${yen(cartTotal())}</b>
      </div>
    </div>`;
}

/** Delivery · Payment · Pay, with the current one lit. */
function stepperHTML(at, T){
  const steps = [["ship", T.chk_step_ship], ["method", T.chk_step_method], ["pay", T.chk_step_pay]];
  const i = steps.findIndex(s => s[0] === at);
  return `
    <ol class="chk-steps" aria-label="${esc(T.chk_title)}">
      ${steps.map(([id, label], n) => `
        <li class="${n < i ? "done" : n === i ? "on" : ""}">
          <span>${n < i ? icon("check", { size: 12 }) : n + 1}</span>${esc(label)}
        </li>`).join("")}
    </ol>`;
}

/* -------------------------- screen 2: how ----------------------------- */

/**
 * The mark on each button.
 *
 * The two app payments show "QR", because scanning a code is the thing
 * the customer is about to do and it is the same act in both. The
 * shop's PayPay logo file is the 証券 lockup, which belongs to a
 * different product and would be wrong on a payment button.
 */
function methodMark(id){
  if (id === "paypay" || id === "merpay") return `<b class="chk-mqr">QR</b>`;
  if (id === "bank") return icon("cash", { size: 22 });
  return icon("box", { size: 22 });
}

function methodsHTML(T){
  return `
    <div class="chk-page">
      ${stepperHTML("method", T)}
      <div class="chk-box">
        <h2>${esc(T.chk_pay_h)}</h2>

        <div class="chk-methods">
          ${METHODS.map(id => `
            <button type="button" class="chk-method ${esc(id)}" data-method="${esc(id)}">
              <span class="chk-mbadge">${methodMark(id)}</span>
              <span class="chk-mtx">
                <b>${esc(payLabel(id, T))}</b>
                <small>${esc(T[`pay_${id}_s`])}</small>
              </span>
              ${icon("arrow", { size: 16, cls: "chk-marrow" })}
            </button>`).join("")}
        </div>

        <div class="chk-line chk-sum chk-sum-alone">
          <span>${esc(T.cart_total)}</span><b>${yen(cartTotal())}</b>
        </div>

        <button type="button" class="chk-back" data-chk-back="ship">
          ${icon("arrow", { size: 14 })} ${esc(T.chk_back)}
        </button>
      </div>
    </div>`;
}

/* -------------------------- screen 3: paying -------------------------- */

/** A row of the bank table, with the figure copyable in one tap. */
const bankRow = (label, value) => `
  <div class="chk-bank-row">
    <span>${esc(label)}</span>
    <b>${esc(value)}</b>
    <button type="button" class="chk-copy" data-copy="${esc(value)}">${esc(t().chk_copy)}</button>
  </div>`;

/** The order, as a WhatsApp message: what, how much, where, and how paid. */
function waText(T, lang, extra = []){
  const lines = cartLines();
  return encodeURIComponent(
    [`${T.ord_id} ${draft?.code || ""}`,
     ...lines.map(l => `• ${l.product[lang] || l.product.en} ${l.product.w} × ${l.qty} — ${yen(l.lineTotal)}`),
     `${T.ord_total}: ${yen(cartTotal())}`,
     ...extra,
     draft ? `${draft.ship.full_name} · ${draft.ship.phone}` : "",
     draft ? `〒${draft.ship.postal} ${draft.ship.address}` : "",
     draft?.note ? `— ${draft.note}` : "",
    ].filter(Boolean).join("\n"));
}

function payHTML(T){
  const lang = document.documentElement.lang || "en";
  const total = cartTotal();
  const m = method;
  const prepaid = PREPAID.includes(m);

  let how = "";

  if (m === "paypay" || m === "merpay"){
    how = `
      <div class="chk-qr">
        <img src="${esc(PAY[m].qr)}" alt="${esc(payLabel(m, T))} QR" width="220" height="220">
        ${m === "paypay" ? `
          <small class="chk-qr-id">${esc(T.chk_qr_id)} <b>${esc(PAY.paypay.id)}</b></small>` : ""}
        <div class="chk-due"><span>${esc(T.chk_amt_due)}</span><b>${yen(total)}</b></div>
        <div class="chk-refline"><span>${esc(T.chk_ref)}</span><b>${esc(draft.code)}</b></div>
        <p>${esc(T.chk_qr_how)}</p>
      </div>`;
  }

  if (m === "bank"){
    const B = PAY.bank;
    how = `
      <div class="chk-bank">
        <h3>${esc(T.chk_bank_h)}</h3>
        ${bankRow(T.chk_bank_bank,   lang === "ja" ? B.bank : `${B.bank} (${B.bankEn})`)}
        ${bankRow(T.chk_bank_code,   B.code)}
        ${bankRow(T.chk_bank_branch, `${B.branch} (${B.branchCode})`)}
        ${bankRow(T.chk_bank_type,   lang === "ja" ? B.type : `${B.type} (${B.typeEn})`)}
        ${bankRow(T.chk_bank_number, B.number)}
        ${bankRow(T.chk_bank_holder, B.holder)}
        <div class="chk-due"><span>${esc(T.chk_amt_due)}</span><b>${yen(total)}</b></div>
        <div class="chk-refline"><span>${esc(T.chk_ref)}</span><b>${esc(draft.code)}</b></div>
        <p>${esc(T.chk_bank_note)}</p>
      </div>`;
  }

  if (m === "cod"){
    const extra = [`${T.ord_pay}: ${payLabel("cod", T)}`];
    how = `
      <div class="chk-cod">
        <h3>${icon("phone", { size: 18 })} ${esc(T.chk_cod_h)}</h3>
        <p>${esc(T.chk_cod_1)}</p>
        <div class="ord-acts">
          <a class="btn btn-red" href="tel:${esc(SHOP.telRaw)}">
            ${icon("phone", { size: 16 })} ${esc(SHOP.tel)}
          </a>
          <a class="btn btn-out" target="_blank" rel="noopener"
             href="https://wa.me/81${esc(SHOP.telRaw.slice(1))}?text=${waText(T, lang, extra)}">
            ${esc(T.ord_wa)}
          </a>
        </div>
        <label class="chk-check chk-cod-ok">
          <input type="checkbox" id="payCod">
          <span>${esc(T.chk_cod_ok)}</span>
        </label>
      </div>`;
  }

  const after = prepaid ? `
    <h2 class="chk-h2">${esc(T.chk_paid_h)}</h2>
    <label><span>${esc(T.chk_paid_amt)}</span>
      <input id="payAmt" type="number" inputmode="numeric" min="1" step="1"
             value="${total}" required></label>
    <label><span>${esc(m === "bank" ? T.chk_bank_ref : T.chk_paid_ref)}</span>
      <input id="payRef" type="text" maxlength="80" autocomplete="off"
             placeholder="${esc(m === "bank" ? T.chk_bank_ref_h : T.chk_paid_ref_h)}" required></label>` : "";

  return `
    <div class="chk-page">
      ${stepperHTML("pay", T)}
      <form class="chk-box chk-pay ${esc(m)}" id="payForm" novalidate>
        <h2>${esc(payLabel(m, T))}</h2>

        ${how}
        ${after}

        <p class="chk-err" id="payErr" hidden></p>

        ${reviewHTML(T, lang)}

        <button type="submit" class="btn btn-red chk-go" id="payGo"
                ${busy ? "disabled" : ""}>
          ${esc(busy ? T.chk_placing : T.chk_place)}
        </button>
        <p class="chk-tax">${esc(T.tax)}</p>

        <button type="button" class="chk-back" data-chk-back="method">
          ${icon("arrow", { size: 14 })} ${esc(T.chk_back)}
        </button>
      </form>
    </div>`;
}

/* --------------------------- the confirmation ------------------------- */

/** "PayPay · paid ¥3,200 · ref 1234", or "Cash on delivery · ¥3,200 to pay on delivery". */
export function payLine(o, T){
  if (!o.pay_method) return "";
  const prepaid = PREPAID.includes(o.pay_method);
  return [
    payLabel(o.pay_method, T),
    prepaid ? `${T.ord_paid} ${yen(o.pay_amount || 0)}` : `${yen(o.total)} ${T.ord_due}`,
    o.pay_ref ? `${T.ord_ref} ${o.pay_ref}` : "",
  ].filter(Boolean).join(" · ");
}

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
  const prepaid = PREPAID.includes(o.pay_method);

  const text = encodeURIComponent(
    [`${T.ord_id} ${o.code}`,
     ...o.items.map(i => `• ${nameOf(i)} ${i.w} × ${i.qty} — ${yen(i.line_total)}`),
     `${T.ord_total}: ${yen(o.total)}`,
     o.pay_method ? `${T.ord_pay}: ${payLine(o, T)}` : "",
     `${o.name} · ${o.phone}`,
     `〒${o.postal} ${o.address}`,
     o.note ? `— ${o.note}` : "",
    ].filter(Boolean).join("\n"));

  return `
    <div class="chk-page">
      <div class="ord-done">
        <span class="ord-done-ic">${icon("check", { size: 30 })}</span>
        <b>${esc(T.ord_done)}</b>
        <p>${esc(prepaid ? T.ord_done_paid_s : T.ord_done_s)}</p>

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

      ${o.pay_method ? `
        <p class="ord-pay ${esc(o.pay_method)}">
          <b>${esc(T.ord_pay)}</b><br>${esc(payLine(o, T))}
        </p>` : ""}

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

/* ------------------------------ the wiring ---------------------------- */

/* How checkout asks the page to repaint. main.js supplies render(); the
   module cannot import it without the two files importing each other. */
let repaint = null;
export const setCheckoutRepaint = fn => { repaint = fn; };

/** Change screen and show it from the top. */
function goTo(next){
  step = next;
  repaint?.();
  window.scrollTo({ top: 0, behavior: "instant" });
}

/** Show a message in the current screen's error line, and focus a field. */
function complain(errSel, message, focusSel){
  const err = $(errSel);
  if (err){ err.textContent = message; err.className = "chk-err"; err.hidden = false; }
  if (focusSel) $(focusSel)?.focus();
}

export function initCheckout(){
  bindMount();
  bindShipForm();
}

/**
 * The screens after the first are replaced whole on every repaint, so
 * their clicks and submits are caught on the mount, which stays. Bound
 * once.
 */
function bindMount(){
  const mount = $("#checkoutMount");
  if (!mount || mount.dataset.bound) return;
  mount.dataset.bound = "1";

  mount.addEventListener("click", e => {
    const back = e.target.closest("[data-chk-back]");
    if (back){ goTo(back.dataset.chkBack); return; }

    const pickM = e.target.closest("[data-method]");
    if (pickM && METHODS.includes(pickM.dataset.method)){
      method = pickM.dataset.method;
      goTo("pay");
      return;
    }

    const copy = e.target.closest("[data-copy]");
    if (copy){
      const T = t();
      navigator.clipboard?.writeText(copy.dataset.copy).then(() => {
        copy.textContent = T.chk_copied;
        copy.classList.add("did");
        setTimeout(() => { copy.textContent = T.chk_copy; copy.classList.remove("did"); }, 1600);
      }).catch(() => { /* no clipboard: the figure is on screen to read */ });
    }
  });

  mount.addEventListener("submit", e => {
    if (e.target.id === "payForm"){ e.preventDefault(); placeIt(); }
  });

  /* A complaint answers one press. Once they are typing again it has
     been read, and a red line left under a corrected field looks like
     a second mistake. */
  mount.addEventListener("input", () => {
    for (const sel of ["#chkErr", "#payErr"]){ const e = $(sel); if (e) e.hidden = true; }
  });
}

/**
 * The address screen keeps its own handlers: they hold on to fields, and
 * the form is replaced whenever the language changes or the basket
 * moves. Bound once per form, guarded on the form itself.
 */
function bindShipForm(){
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

  /* Coming back to an edited saved address, the row should be showing. */
  { const a = chosenAddress(); if (a && edited(a)) showSave("update"); }

  /* ------------------------- on to payment -------------------------- */

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (busy) return;

    const T = t();
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

    if (fail){ complain("#chkErr", fail[0], fail[1]); return; }

    if (!cartLines().length){ complain("#chkErr", T.chk_empty); return; }

    /* Everything typed, taken now and carried to the last screen. The
       order's reference is minted here so it can be shown as the thing
       to write on a transfer before the order exists. */
    const { orderCode } = await import("../../backend/client.js");
    draft = {
      ship: {
        full_name: p.full_name.trim(),
        phone:     normalisePhone(p.phone),
        postal:    normalisePostal(p.postal),
        address:   p.address.trim(),
      },
      typed: p,                     // for the form, should they come back
      note:  $("#chkNote")?.value || "",
      label: $("#chkLabel")?.value || "",
      keep:  Boolean(wrap && !wrap.hidden && box.checked),
      code:  draft?.code || orderCode(),
    };

    goTo("method");
  });
}

/* ----------------------------- placing -------------------------------- */

async function placeIt(){
  if (busy || !draft || !method) return;
  const T = t();
  const prepaid = PREPAID.includes(method);

  /* What they say they paid, taken before anything can repaint. */
  const amount = prepaid ? Math.round(Number($("#payAmt")?.value)) : null;
  const ref    = prepaid ? ($("#payRef")?.value || "").trim() : "";

  if (prepaid){
    if (!(amount > 0))  return complain("#payErr", T.chk_bad_amt, "#payAmt");
    if (!ref)           return complain("#payErr", T.chk_bad_ref, "#payRef");
  } else if (!$("#payCod")?.checked){
    return complain("#payErr", T.chk_bad_cod, "#payCod");
  }

  const lines = cartLines();
  if (!lines.length) return complain("#payErr", T.chk_empty);

  const { ship, note, label, keep, code } = draft;
  const pay = { method, amount, ref: ref || null };

  /* Held from the first press until the answer lands. Without it a
     double-click places the order twice, and the customer gets two
     boxes of rice. In module state as well as on the button: saving
     the address repaints the form, and a fresh button would otherwise
     come back enabled while the order was still in flight. */
  busy = true;
  const go = $("#payGo");
  if (go){ go.disabled = true; go.textContent = T.chk_placing; }
  const err0 = $("#payErr"); if (err0) err0.hidden = true;

  /* The form may have been repainted by the time this is needed, so
     the elements are looked up again rather than reused. */
  const stop = message => {
    busy = false;
    const g = $("#payGo");
    if (g){ g.disabled = false; g.textContent = T.chk_place; }
    complain("#payErr", message);
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

  const r = await placeMyOrder({ lines, note, ship, code, pay });
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
  step = "ship"; method = null; draft = null;
  placed = r.order;
  repaint?.();
  window.scrollTo({ top: 0, behavior: "instant" });
}
