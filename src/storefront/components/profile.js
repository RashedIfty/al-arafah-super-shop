/**
 * The customer's account page: their photo, their name, their address
 * book, and the products they have kept.
 *
 * Everything on it is optional. A customer who never opens this page
 * orders exactly as before; one who fills it in finds the checkout
 * already knows where to go.
 *
 * Shaped like components/checkout.js: HTML from module state, handlers
 * bound once and guarded, and a repaint function supplied by main.js.
 */
import { $, esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t } from "../../features/i18n/lang.js";
import { isSignedIn, accountKnown, userName, userEmail }
  from "../../features/account/account.js";
import {
  myProfile, myAddresses, profileLoaded,
  saveMyProfile, saveAddress, deleteAddress, setDefaultAddress,
  changeAvatar, removeAvatar,
} from "../../features/profile/profile.js";
import { isJpMobile, isJpPostal } from "../../shared/lib/jp.js";
import { favouritesGridHTML, emptyCardHTML } from "./account.js";

/* Which address form is open: null, "new", or an address id. */
let editing = null;

/* A one-line "Saved." that has to outlive the repaint saving sets off,
   which is why it is state rather than a textContent on a node that is
   about to be replaced. */
let flash = "";

/* How the page asks to be repainted. main.js supplies render(); the
   module cannot import it without the two importing each other. */
let render = null;
export const setProfileRepaint = fn => { render = fn; };

/* ------------------------------- the page ----------------------------- */

export function profileHTML(){
  const T = t();

  /* Reading the session takes a moment. Showing the sign-in card before
     the answer arrives tells a signed-in customer they are signed out. */
  if (!accountKnown())
    return `<p class="ord-loading">${esc(T.acct_working)}</p>`;

  if (!isSignedIn())
    return emptyCardHTML(T.acct_signin, T.prof_why,
      `<button class="btn btn-red" data-signin>${esc(T.acct_signin)}</button>`);

  if (!profileLoaded())
    return `<p class="ord-loading">${esc(T.acct_working)}</p>`;

  const p = myProfile() || {};
  const addrs = myAddresses();
  const initial = ((p.full_name || userName() || "?").trim()[0] || "?").toUpperCase();

  return `
    <div class="prof-page">

      <section class="prof-sec prof-top">
        <div class="prof-avatar" id="profAvatar">
          ${p.avatar_url
            ? `<img src="${esc(p.avatar_url)}" alt="">`
            : `<span>${esc(initial)}</span>`}
        </div>
        <div class="prof-top-tx">
          <b>${esc(p.full_name || userName())}</b>
          <span>${esc(userEmail())}</span>
          <div class="prof-photo-acts">
            <input type="file" id="profFile" accept="image/jpeg,image/png,image/webp" hidden>
            <button type="button" class="btn btn-out btn-sm" data-avatar-pick>
              ${icon("camera", { size: 14 })} ${esc(T.prof_photo_change)}
            </button>
            ${p.avatar_url ? `
              <button type="button" class="prof-link" data-avatar-remove>
                ${esc(T.prof_photo_remove)}</button>` : ""}
          </div>
          <p class="acct-err" id="profPhotoErr" hidden></p>
        </div>
      </section>

      <form class="prof-sec" id="profForm" novalidate>
        <h2>${esc(T.prof_me)}</h2>

        <label><span>${esc(T.prof_name)}</span>
          <input id="profName" type="text" autocomplete="name"
                 value="${esc(p.full_name || "")}"></label>

        <label><span>${esc(T.prof_email)}</span>
          <input id="profEmail" type="email" value="${esc(userEmail())}" readonly>
          <small class="prof-note">${esc(T.prof_email_note)}</small></label>

        <label><span>${esc(T.prof_phone)} <em>${esc(T.prof_optional)}</em></span>
          <input id="profPhone" type="tel" inputmode="tel" autocomplete="tel"
                 placeholder="${esc(T.chk_phone_h)}"
                 value="${esc(p.phone || "")}"></label>

        <p class="acct-err" id="profErr" hidden></p>
        ${flash ? `<p class="acct-err ok">${esc(flash)}</p>` : ""}

        <button type="submit" class="btn btn-red" id="profGo">${esc(T.prof_save)}</button>
      </form>

      <section class="prof-sec">
        <div class="prof-sec-head">
          <h2>${esc(T.prof_addrs)}</h2>
          ${editing === "new" ? "" : `
            <button type="button" class="btn btn-out btn-sm" data-addr-add>
              ${icon("plus", { size: 14 })} ${esc(T.prof_addr_add)}
            </button>`}
        </div>

        ${editing === "new" ? addrFormHTML(null, T) : ""}

        ${addrs.length
          ? addrs.map(a => editing === a.id ? addrFormHTML(a, T) : addrCardHTML(a, T)).join("")
          : editing === "new" ? "" : `<p class="prof-none">${esc(T.prof_addrs_none)}</p>`}
      </section>

      <p class="prof-links">
        <a class="btn btn-out" href="orders.html">${icon("box", { size: 15 })} ${esc(T.ord_nav)}</a>
        <button type="button" class="prof-link" data-signout>${esc(T.acct_signout)}</button>
      </p>
    </div>`;
}

/** One saved address, with the things that can be done to it. */
function addrCardHTML(a, T){
  return `
    <div class="addr-card${a.is_default ? " is-default" : ""}">
      <div class="addr-head">
        <b>${esc(a.label)}</b>
        ${a.is_default ? `<span class="ord-pill confirmed">${esc(T.prof_addr_default)}</span>` : ""}
      </div>
      <p class="addr-body">${esc(a.phone)}<br>〒${esc(a.postal)} ${esc(a.address)}</p>
      <div class="addr-acts">
        <button type="button" class="btn btn-out btn-sm" data-addr-edit="${esc(a.id)}">
          ${esc(T.prof_addr_edit)}</button>
        ${a.is_default ? "" : `
          <button type="button" class="btn btn-out btn-sm" data-addr-default="${esc(a.id)}">
            ${esc(T.prof_addr_make_default)}</button>`}
        <button type="button" class="prof-link danger" data-addr-del="${esc(a.id)}">
          ${esc(T.prof_addr_del)}</button>
      </div>
    </div>`;
}

/**
 * The form, for a new address or an edit. The three chips are only the
 * common names; the box takes whatever they like to call the place.
 */
function addrFormHTML(a, T){
  const chips = [T.prof_label_home, T.prof_label_work, T.prof_label_other];

  return `
    <form class="addr-form" id="addrForm" novalidate data-id="${esc(a?.id || "")}">
      <label><span>${esc(T.prof_label)}</span>
        <input id="addrLabel" type="text" maxlength="40"
               placeholder="${esc(T.prof_label_h)}"
               value="${esc(a?.label || T.prof_label_home)}">
        <span class="addr-chips">
          ${chips.map(c => `<button type="button" data-label-chip="${esc(c)}">${esc(c)}</button>`).join("")}
        </span></label>

      <label><span>${esc(T.chk_phone)}</span>
        <input id="addrPhone" type="tel" inputmode="tel" autocomplete="tel"
               placeholder="${esc(T.chk_phone_h)}" value="${esc(a?.phone || "")}" required></label>

      <label><span>${esc(T.chk_postal)}</span>
        <input id="addrPostal" type="text" inputmode="numeric" autocomplete="postal-code"
               placeholder="${esc(T.chk_postal_h)}" value="${esc(a?.postal || "")}" required></label>

      <label><span>${esc(T.chk_addr)}</span>
        <textarea id="addrAddr" rows="3" autocomplete="street-address"
                  placeholder="${esc(T.chk_addr_h)}" required>${esc(a?.address || "")}</textarea></label>

      ${a?.is_default ? "" : `
        <label class="chk-check">
          <input type="checkbox" id="addrDefault">
          <span>${esc(T.prof_addr_make_default)}</span>
        </label>`}

      <p class="acct-err" id="addrErr" hidden></p>

      <div class="addr-acts">
        <button type="submit" class="btn btn-red btn-sm" id="addrGo">${esc(T.prof_addr_save)}</button>
        <button type="button" class="btn btn-out btn-sm" data-addr-cancel>${esc(T.prof_cancel)}</button>
      </div>
    </form>`;
}

/** The kept products, under the rest. Its own mount; see account.html. */
export function profFavHTML(){
  const T = t();
  if (!accountKnown() || !isSignedIn()) return "";

  return `
    <div class="prof-page">
      <section class="prof-sec prof-favs">
        <div class="prof-sec-head">
          <h2>${esc(T.prof_favs)}</h2>
          <a href="favourites.html">${esc(T.prof_favs_all)}</a>
        </div>
        ${favouritesGridHTML()}
      </section>
    </div>`;
}

/* ------------------------------ the controls -------------------------- */

/* The module's short codes, in the customer's language. Anything else
   is the server's own words and is shown as they came. */
const words = (r, T) => ({
  "bad-phone":   T.chk_bad_phone,
  "bad-postal":  T.chk_bad_postal,
  "bad-address": T.chk_bad_addr,
  "bad-photo":   T.prof_photo_bad,
  "upload-failed": T.prof_photo_fail,
}[r.message] || r.message || T.prof_photo_fail);

/** Show, then clear after a moment — with a repaint each way. */
function say(message){
  flash = message;
  render?.();
  setTimeout(() => { flash = ""; render?.(); }, 2500);
}

/**
 * Clicks are delegated from the mount, which render() never replaces,
 * so they are bound exactly once. The forms and the file input are
 * replaced on every repaint and are bound per render, each guarded on
 * the element itself.
 */
export function initProfile(){
  const mount = $("#profileMount");
  if (!mount) return;

  if (!mount.dataset.bound){
    mount.dataset.bound = "1";

    mount.addEventListener("click", async e => {
      const T = t();
      const at = sel => e.target.closest(sel);

      if (at("[data-avatar-pick]")){ $("#profFile")?.click(); return; }

      if (at("[data-avatar-remove]")){
        const r = await removeAvatar();
        if (!r.ok) photoErr(words(r, T));
        return;
      }

      if (at("[data-addr-add]"))    { editing = "new"; render?.(); return; }
      if (at("[data-addr-cancel]")) { editing = null;  render?.(); return; }

      const ed = at("[data-addr-edit]");
      if (ed){ editing = ed.dataset.addrEdit; render?.(); return; }

      const df = at("[data-addr-default]");
      if (df){
        const r = await setDefaultAddress(df.dataset.addrDefault);
        if (!r.ok) alert(words(r, T));
        return;
      }

      const del = at("[data-addr-del]");
      if (del){
        if (!confirm(T.prof_addr_del_ask)) return;
        const r = await deleteAddress(del.dataset.addrDel);
        if (!r.ok) alert(words(r, T));
        return;
      }

      const chip = at("[data-label-chip]");
      if (chip){
        const box = $("#addrLabel");
        if (box){ box.value = chip.dataset.labelChip; box.focus(); }
      }
    });
  }

  /* ------------------------------ photo ----------------------------- */

  const file = $("#profFile");
  if (file && !file.dataset.bound){
    file.dataset.bound = "1";

    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;

      const T = t();
      const av = $("#profAvatar");
      $("#profPhotoErr")?.setAttribute("hidden", "");

      /* The only sign that anything is happening: the picture dims
         until the new one is in place. No word about resizing — they
         chose a photo, they get a photo. */
      av?.classList.add("is-busy");
      const r = await changeAvatar(f);
      av?.classList.remove("is-busy");

      if (!r.ok) photoErr(words(r, T));
      file.value = "";
    });
  }

  /* ------------------------------ name ------------------------------ */

  const form = $("#profForm");
  if (form && !form.dataset.bound){
    form.dataset.bound = "1";

    form.addEventListener("submit", async e => {
      e.preventDefault();

      const T = t();
      const name = $("#profName").value, phone = $("#profPhone").value;
      const err = $("#profErr"), go = $("#profGo");

      const fail = !name.trim()                        ? T.prof_bad_name
                 : phone.trim() && !isJpMobile(phone)  ? T.chk_bad_phone
                 : null;
      if (fail){ err.textContent = fail; err.hidden = false; return; }

      go.disabled = true;
      go.textContent = T.prof_saving;
      err.hidden = true;

      const r = await saveMyProfile({ full_name: name, phone });

      if (!r.ok){
        go.disabled = false;
        go.textContent = T.prof_save;
        err.textContent = words(r, T);
        err.hidden = false;
        return;
      }
      say(T.prof_saved);
    });
  }

  /* ---------------------------- address ----------------------------- */

  const af = $("#addrForm");
  if (af && !af.dataset.bound){
    af.dataset.bound = "1";

    af.addEventListener("submit", async e => {
      e.preventDefault();

      const T = t();
      const a = {
        id:         af.dataset.id || undefined,
        label:      $("#addrLabel").value,
        phone:      $("#addrPhone").value,
        postal:     $("#addrPostal").value,
        address:    $("#addrAddr").value,
        is_default: $("#addrDefault")?.checked || false,
      };
      const err = $("#addrErr"), go = $("#addrGo");

      /* One at a time, so they are told which field is wrong. */
      const fail =
          !a.label.trim()        ? [T.prof_bad_label, "#addrLabel"]
        : !isJpMobile(a.phone)   ? [T.chk_bad_phone,  "#addrPhone"]
        : !isJpPostal(a.postal)  ? [T.chk_bad_postal, "#addrPostal"]
        : !a.address.trim()      ? [T.chk_bad_addr,   "#addrAddr"]
        : null;

      if (fail){
        err.textContent = fail[0];
        err.hidden = false;
        $(fail[1])?.focus();
        return;
      }

      go.disabled = true;
      go.textContent = T.prof_saving;
      err.hidden = true;

      const r = await saveAddress(a);

      if (!r.ok){
        go.disabled = false;
        go.textContent = T.prof_addr_save;
        err.textContent = words(r, T);
        err.hidden = false;
        return;
      }

      editing = null;
      render?.();
    });
  }
}

function photoErr(message){
  const el = $("#profPhotoErr");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}
