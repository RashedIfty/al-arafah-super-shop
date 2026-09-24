/**
 * Shop owner panel.
 *
 * Written for someone who is not technical: plain language, one obvious
 * action per screen, confirmation before anything destructive.
 */
import { $, $$, esc, on, IMG_FALLBACK } from "../shared/lib/dom.js";
import { icon } from "../shared/ui/icons.js";
import { yen } from "../shared/lib/format.js";
import { shrinkImage, fileSize } from "../shared/lib/image.js";
import { isLoggedIn, login, logout, usingSupabase } from "./auth.js";
import * as store from "./local-store.js";
import { DEFAULT_ANNOUNCEMENTS } from "../features/deals/deals.js";
import { COUNTRIES } from "../features/catalog/countries.js";
import { flag } from "../features/catalog/flags.js";
import { autoTranslate } from "./translate.js";
import * as api from "../backend/client.js";
import {
  setOrders, setArchivedOrders, setPhotos, setCustomerPhotos,
  renderOrders, initOrders, watchOrders,
} from "./orders.js";
import { setRestock, renderRestock, initRestock } from "./restock.js";
import { initFaces } from "./photos.js";
import { setFindCatalog, setFindRepaint, initFind, initDealFind } from "./find.js";
import { setCustomers, setCustomerOrders, setCustomerAsks, renderCustomers, initCustomers }
  from "./customers.js";

let catalog = [];
let editing = null;            // {catId, index} when editing, null when adding
let confirmAction = null;      // callback for the confirm dialog
let deals = [];                // Today's Deal & New Arrival strip
let editingDeal = null;        // index when editing, null when adding
let archive = { products: [], categories: [], deals: [] };
let notice = null;      // the single announcement row

/* ------------------------------- helpers ------------------------------ */

function toast(msg, bad = false){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("bad", bad);
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3000);
}

/**
 * Ask before doing something that cannot simply be taken back.
 *
 * opts.yes     — the confirm button's words (default "Yes, delete")
 * opts.reasons — ask why, inside this dialog: a list of common reasons
 *                shown as buttons that fill the box, and the box itself
 *                for anything else. The reason typed is handed to onYes.
 *                It used to come from the browser's own prompt(), a bare
 *                grey box outside the shop's look.
 */
function ask(title, text, onYes, opts = {}){
  $("#confTitle").textContent = title;
  $("#confText").textContent  = text;
  $("#confYes").textContent   = opts.yes || "Yes, delete";

  const why = $("#confWhy"), box = $("#confReason");
  why.hidden = !opts.reasons;
  box.value = "";
  $("#confChips").innerHTML = (opts.reasons || []).map(r =>
    `<button type="button" class="conf-chip" data-reason="${esc(r)}">${esc(r)}</button>`).join("");

  confirmAction = () => onYes(box.value.trim());
  $("#confirm").hidden = false;
  if (opts.reasons) setTimeout(() => box.focus(), 50);
}

/* A common reason, one tap: into the box, where it can still be edited. */
document.addEventListener("click", e => {
  const chip = e.target.closest("[data-reason]");
  if (!chip) return;
  const box = $("#confReason");
  box.value = chip.dataset.reason;
  $$("#confChips .conf-chip").forEach(c => c.classList.toggle("on", c === chip));
  box.focus();
});

/* ----------------------------- back to top -----------------------------
   With a thousand products the list runs to many screens. The button
   shows once the page is scrolled past the first one, like the shop's. */
{
  const btn = $("#adTopBtn");
  const paint = () => btn?.classList.toggle("show", scrollY > 600);
  addEventListener("scroll", paint, { passive: true });
  btn?.addEventListener("click", () =>
    scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  paint();
}

/* -------------------------------- login ------------------------------- */

async function openPanel(){
  $("#login")?.remove();
  $("#panel").hidden = false;

  if (usingSupabase()){
    const [cat, dl, arc, ann, ord, ordArc, rs, faces, cus, allAsks] = await Promise.all([
      api.fetchCatalog(), api.fetchDeals(), api.fetchArchive(), api.fetchAnnouncement(),
      api.fetchOrders(), api.fetchArchivedOrders(), api.fetchRestock(),
      api.fetchCustomerPhotos(), api.fetchCustomers(), api.fetchAllRestock(),
    ]);
    notice = ann;
    catalog = cat || store.load();
    deals   = dl  || store.loadDeals(DEFAULT_ANNOUNCEMENTS.items);
    archive = arc || archive;
    setCustomerPhotos(faces);   // before the orders draw, so the faces are there
    setOrders(ord);
    setArchivedOrders(ordArc);
    setRestock(rs);
    setCustomers(cus);
    setCustomerOrders([...(ord || []), ...(ordArc || [])]);
    setCustomerAsks(allAsks);
  } else {
    catalog = store.load();
    deals   = store.loadDeals(DEFAULT_ANNOUNCEMENTS.items);
  }
  const dot = $("#liveDot");
  if (dot){
    const live = usingSupabase();
    dot.classList.toggle("off", !live);
    dot.title = live
      ? "Connected — changes are saved for everyone"
      : "Offline — changes stay on this device";
    dot.lastChild.textContent = live ? "Live" : "Offline";
  }

  renderAll();
  startOrders();
}

/**
 * The orders tab, wired once.
 *
 * openPanel() runs again after a sign-in, and binding the listeners a
 * second time would act on every click twice.
 */
let ordersStarted = false;

function startOrders(){
  if (ordersStarted) return;
  ordersStarted = true;

  initOrders({ toast, ask, refresh: reload });
  initRestock({ toast, ask, refresh: reload });
  initCustomers({ toast });
  if (usingSupabase()) watchOrders({ refresh: reload });
}

/** Pull fresh data after a write. */
async function reload(){
  if (!usingSupabase()) return;
  const [cat, dl, arc, ann, ord, ordArc, rs, faces, cus, allAsks] = await Promise.all([
    api.fetchCatalog(), api.fetchDeals(), api.fetchArchive(), api.fetchAnnouncement(),
    api.fetchOrders(), api.fetchArchivedOrders(), api.fetchRestock(),
    api.fetchCustomerPhotos(), api.fetchCustomers(), api.fetchAllRestock(),
  ]);
  if (ann) notice = ann;
  if (cat) catalog = cat;
  if (dl)  deals   = dl;
  if (arc) archive = arc;
  if (faces) setCustomerPhotos(faces);
  if (cus) setCustomers(cus);
  if (ord || ordArc) setCustomerOrders([...(ord || []), ...(ordArc || [])]);
  if (allAsks) setCustomerAsks(allAsks);
  if (ord) setOrders(ord);
  if (ordArc) setArchivedOrders(ordArc);
  if (rs) setRestock(rs);
  renderAll();
}

let signingIn = false;

async function doLogin(e){
  e?.preventDefault();
  if (signingIn) return;        // login() is async - guard before awaiting
  signingIn = true;

  const email = $("#email")?.value ?? "";
  const pass  = $("#pass")?.value  ?? "";
  const btn   = $(".login-go");
  const err   = $("#loginErr");

  err.hidden = true;

  btn.disabled = true;
  let result;
  try {
    result = await login(email, pass);
  } catch (ex) {
    result = { ok: false, message: "Error: " + (ex?.message || ex) };
  }
  btn.disabled = false;

  if (!result.ok){
    signingIn = false;                          // let them try again
    err.textContent = result.message || "That email or password is not right.";
    /* A customer at the wrong door is not the same as a bad password,
       and should not be shaken at as though they had failed. */
    err.classList.toggle("note", Boolean(result.notOwner));
    err.hidden = false;
    if (!result.notOwner){
      $(".login-card").classList.remove("shake");
      void $(".login-card").offsetWidth;        // restart the animation
      $(".login-card").classList.add("shake");
    }
    return;
  }

  // Matched — show progress, then reveal the panel.
  btn.classList.add("loading");
  btn.innerHTML = `<span class="spin"></span><span>Password matched — signing in…</span>`;

  setTimeout(() => {
    $(".login-card").classList.add("done");
    setTimeout(() => {
      $("#login")?.remove();          // gone for good — no stray background
      openPanel();
      $("#panel").classList.add("fade-in");
      scrollTo(0, 0);
      signingIn = false;
    }, 260);
  }, 700);
}

on("#loginForm", "submit", doLogin);

/* ------------------------ forgotten password -------------------------- */

/**
 * The owner's own reset. Sends him to the same page the customers use —
 * one page that sets a password is enough, and the link carries who it
 * is for.
 */
on("#ownerForgot", "click", async () => {
  const email = $("#email")?.value.trim();
  const err = $("#loginErr");

  if (!email){
    err.textContent = "Type your email above first, then press this.";
    err.hidden = false;
    $("#email")?.focus();
    return;
  }

  err.hidden = true;

  const { sendPasswordReset } = await import("../backend/client.js");
  const { error } = await sendPasswordReset(
    email, `${location.origin}/reset.html`);

  if (error && !/user not found/i.test(error.message)){
    err.textContent = error.message;
    err.hidden = false;
    return;
  }

  toast("Check your email for the link.");
});

on("#logout", "click", async () => { await logout(); location.href = "index.html"; });

/* Show / hide the password. */
on("#peek", "click", () => {
  const f = $("#pass");
  f.type = f.type === "password" ? "text" : "password";
});

/* ------------------------------ rendering ----------------------------- */

function renderAll(){
  const products = catalog.reduce((s, c) => s + c.items.length, 0);
  $("#countLine").textContent =
    `${products} products in ${catalog.length} categories`;

  $("#fCat").innerHTML = catalog
    .map(c => `<option value="${esc(c.id)}">${esc(c.en)}</option>`)
    .join("");

  /* Optional, so "Not set" comes first and is the default.
     Nearly two hundred countries is a long scroll, but a native select
     jumps to whatever the owner types — so "ban" reaches Bangladesh in
     three keystrokes, which no custom list would beat. */
  $("#fCountry").innerHTML =
    `<option value="">— Not set —</option>` +
    COUNTRIES.map(c => `<option value="${esc(c.id)}">${esc(c.en)}</option>`).join("");
  showCountryFlag();

  setPhotos(catalog);        // invoices print the product photographs
  setFindCatalog(catalog);   // and the search dropdown looks through it
  setFindRepaint(renderList);
  initFaces();               // a customer's photo, tapped, shown large
  initFind();                // type a letter, the matches fall out

  renderList();
  renderDeals();
  renderDealPicker();
  renderArchive();
  renderNotice();
  renderOrders();
  renderRestock();
  renderCustomers();
}

function renderList(){
  renderPhotoFix();
  const q = $("#filter").value.trim().toLowerCase();

  const html = catalog.map(cat => {
    const rows = cat.items.map((p, i) => {
      if (q && ![p.en, p.bn, p.ja].join(" ").toLowerCase().includes(q)) return "";

      // Where else this product shows up, so the owner can see at a
      // glance what is on the New and Popular pages without opening each.
      const shelves = [
        p.isOffer   ? `<span class="on-shelf offer">OFFER</span>` : "",
        p.isNew     ? `<span class="on-shelf new">NEW</span>`     : "",
        p.isPopular ? `<span class="on-shelf pop">POPULAR</span>` : ""
      ].join("");

      /* Laid out like the card a customer sees in the shop, so the owner
         is arranging what the shop will look like: photo, category,
         names, size and stock, price. Edit and Remove stand where the
         customer's Add button is. */
      const off = p.was > p.p ? Math.round((1 - p.p / p.was) * 100) : 0;
      return `
        <div class="prod" data-row="${esc(cat.id)}:${i}" data-id="${esc(p._id || "")}">
          <div class="prod-pic">
            <img class="prod-img" src="${esc(p.img || "/images/placeholder.svg")}"
                 alt="" loading="lazy" ${IMG_FALLBACK}>
            ${shelves ? `<span class="shelf-marks">${shelves}</span>` : ""}
          </div>
          <div class="prod-tx">
            <span class="prod-cat">${esc(cat.en)}</span>
            <b>${esc(p.en)}</b>
            <small>${esc([p.bn, p.ja].filter(Boolean).join(" · "))}</small>
            <span class="prod-meta">
              <span class="prod-w">${esc(p.w)}</span>
              ${p.tag === "in"  ? `<span class="tag in">IN STOCK</span>` : ""}
              ${p.tag === "out" ? `<span class="tag out">STOCK OUT</span>` : ""}
              ${off ? `<span class="tag off">-${off}% OFF</span>` : ""}
            </span>
          </div>
          <div class="prod-price">
            <b>${yen(p.p)}</b>
            ${p.was ? `<s>${yen(p.was)}</s>` : ""}
            <small>(With Tax)</small>
          </div>
          <div class="prod-act">
            <button class="act edit" data-edit="${esc(cat.id)}:${i}">${icon("edit",{size:14})} Edit</button>
            <button class="act del"  data-del="${esc(cat.id)}:${i}">${icon("archive",{size:14})} Remove</button>
          </div>
        </div>`;
    }).join("");

    // While searching, hide categories with no match. Otherwise always show
    // the category — an empty one still needs to be editable and fillable.
    if (q && !rows) return "";

    /* Cards side by side rather than one long row each: at a thousand
       products the rows ran to screens and screens of scrolling. */
    const body = rows ? `<div class="prod-grid" data-cat="${esc(cat.id)}">${rows}</div>` : `
      <div class="cat-empty">
        <span>No products in this category yet.</span>
        <button class="act edit" data-addto="${esc(cat.id)}">${icon("plus",{size:14})} Add a product here</button>
      </div>`;

    return `
      <section class="cat-block" id="adcat-${esc(cat.id)}">
        <div class="cat-head">
          <img src="${esc(cat.img || "/images/placeholder.svg")}" alt="" class="cat-thumb" ${IMG_FALLBACK}>
          <b>${esc(cat.en)}</b>
          <em>${cat.items.length}</em>
          <button class="act edit cat-edit" data-editcat="${esc(cat.id)}">${icon("edit",{size:14})} Edit</button>
          <button class="act del" data-delcat="${esc(cat.id)}">${icon("archive",{size:14})} Remove</button>
        </div>
        ${body}
      </section>`;
  }).join("");

  const hint = html && !q ? `
    <p class="drag-hint">${icon("grid", { size: 16 })}
      <span><b>Drag a card</b> to change where it shows in your shop — on a
      phone, press and hold it first. New products go to the front of their
      category, and sold-out ones always sit at the end.</span></p>` : "";

  /* Every category as a button, centred under the search: picture, name
     and how many products, and a press jumps to it. Built from the
     categories themselves, so a new one appears here the moment it is
     added. Always the full counts, whatever is being searched. */
  const jump = catalog.length ? `
    <nav class="cat-jump" aria-label="Go to a category">
      ${catalog.map(c => `
        <button type="button" class="cat-jump-b" data-jump="${esc(c.id)}">
          <img src="${esc(c.img || "/images/placeholder.svg")}" alt="" loading="lazy" ${IMG_FALLBACK}>
          <span>${esc(c.en)}</span>
          <em>${c.items.length}</em>
        </button>`).join("")}
    </nav>` : "";

  $("#list").innerHTML = jump + hint + (html || `
    <div class="none">
      <b>Nothing found</b>
      <span>${q ? "Try a different word." : "Add your first product above."}</span>
    </div>`);

  initProductDrag(Boolean(q));
}

/* ------------------------ reordering the products ----------------------
   Drag a card and drop it where it should go; the shop shows products in
   the same order. SortableJS rather than the hand-rolled drag the deals
   list uses: a grid of hundreds of cards wants the neighbours to slide
   aside as you move, the page to scroll when you reach its edge, and a
   press-and-hold on a phone so that an ordinary swipe still scrolls.
   Not while searching: with only some of a category showing, "before
   this one" would not mean anything. */
const SORTABLE = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/modular/sortable.esm.js";
let Sortable = null;

/* One set of draggable grids per list ("products", "deals"), each torn
   down and rebuilt whenever its list is redrawn. */
const sortables = {};
const dragRuns = {};

async function makeSortable(list, grids, onMove){
  const run = dragRuns[list] = (dragRuns[list] || 0) + 1;
  (sortables[list] || []).forEach(x => x.destroy());
  sortables[list] = [];
  if (!grids.length) return;

  if (!Sortable){
    try { ({ Sortable } = await import(SORTABLE)); }
    catch { return; }                          // the list still works, just not by dragging
  }
  if (run !== dragRuns[list]) return;          // redrawn while it loaded

  sortables[list] = grids.map(grid => Sortable.create(grid, {
    draggable: ".prod",
    filter: ".act",                            // Edit and Remove stay buttons
    preventOnFilter: false,
    animation: 160,
    delay: 220, delayOnTouchOnly: true, touchStartThreshold: 6,
    ghostClass: "drag-ghost", chosenClass: "drag-chosen",
    scroll: true, scrollSensitivity: 90, bubbleScroll: true,
    onEnd: e => {
      if (e.oldIndex !== e.newIndex) onMove(grid, e.oldIndex, e.newIndex);
    },
  }));
}

function initProductDrag(searching){
  makeSortable("products", searching ? [] : $$("#list .prod-grid"), moveProduct);
}

async function moveProduct(grid, from, to){
  const cat = catalog.find(c => c.id === grid.dataset.cat);
  if (!cat) return;

  const [p] = cat.items.splice(from, 1);
  cat.items.splice(to, 0, p);
  /* The shop always puts sold-out products last in a category, whatever
     their place; show that here too rather than an order it will not use. */
  cat.items.sort((a, b) => (a.tag === "out") - (b.tag === "out"));

  if (!usingSupabase()){
    store.save(catalog);
    renderList();
    toast("New order saved.");
    return;
  }

  grid.classList.add("saving");
  const { error } = await api.reorderProducts(cat.items.map(x => x._id).filter(Boolean));
  if (error){
    toast("Could not save the new order (" + (error.message || "try again") + ").", true);
    await reload();
    return;
  }
  renderList();
  toast("New order saved — your shop shows it now.");
}

on("#filter", "input", renderList);

/* A category button: go to that category. While a search is hiding it,
   the search is cleared first so there is something to go to. */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-jump]");
  if (!b) return;
  const go = () => document.getElementById(`adcat-${b.dataset.jump}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (!document.getElementById(`adcat-${b.dataset.jump}`)){
    $("#filter").value = "";
    $("#adFindClear")?.setAttribute("hidden", "");
    renderList();
    requestAnimationFrame(go);
  } else go();
});

/* ---------------------------- product form ---------------------------- */

function setPhoto(src){
  const img = $("#previewImg"), empty = $("#photoEmpty");
  $("#fImg").value = src || "";
  if (src){ img.src = src; img.hidden = false; empty.hidden = true; }
  else    { img.hidden = true;  empty.hidden = false; }
}

function openForm(catId, index){
  editing = (index === undefined) ? null : { catId, index };
  const p = editing ? catalog.find(c => c.id === catId).items[index] : null;

  $("#formTitle").textContent = p ? "Edit Product" : "Add New Product";
  $("#saveBtn").textContent   = p ? "Save Changes"  : "Add Product";

  $("#fCat").value = catId || catalog[0]?.id || "";
  $("#fEn").value  = p?.en || "";
  $("#fBn").value  = p?.bn || "";
  $("#fJa").value  = p?.ja || "";
  $("#fW").value   = p?.w  || "";
  $("#fP").value   = p?.p  ?? "";
  $("#fWas").value = p?.was || "";
  /* Stock is the one thing here with no sensible default: a new product
     is presumably on the shelf, but saying so on the owner's behalf would
     be putting words in their mouth. They pick. */
  const stock = p?.tag === "in" || p?.tag === "out" ? p.tag : "";
  $$("input[name=fStock]").forEach(r => r.checked = r.value === stock);
  $("#fCountry").value = p?.country || "";
  showCountryFlag();
  $("#fOffer").checked   = Boolean(p?.isOffer);
  $("#fNew").checked     = Boolean(p?.isNew);
  $("#fPopular").checked = Boolean(p?.isPopular);
  $("#fFile").value = "";
  // The seal is a choice about one photo, so it never carries over.
  if ($("#fHalal")) $("#fHalal").checked = false;
  chosen = null;
  resetProductTranslation?.();
  setPhoto(p?.img || "");
  updateSaleHint();

  $("#modal").hidden = false;
  $("#fEn").focus();
}

const closeForm = () => { $("#modal").hidden = true; editing = null; };

on("#addBtn", "click", () => openForm());

/* Photo picking — the whole box is the button. */
on("#photoPick", "click", () => $("#fFile").click());

/**
 * Handle a chosen image, wherever it came from: the file picker, a paste,
 * or a drag and drop. `apply` sets the preview for whichever form is open.
 */
/** Read a file as a data URL. */
function dataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("Could not read that file"));
    r.readAsDataURL(file);
  });
}

/**
 * Newest pick wins. Choosing a second photo while the first is still
 * uploading must not let the slower one land afterwards and overwrite it.
 */
let photoRun = 0;

/* The photo the owner last chose, kept so the halal seal can be turned
   on and off without asking for the file again. Cleared with the form. */
let chosen = null;

async function handleImage(file, apply){
  chosen = { file, apply };

  if (!file || !file.type.startsWith("image/")) return;

  const run = ++photoRun;
  const stale = () => run !== photoRun;

  // A phone photo is several megabytes and far larger than the shop ever
  // displays. Shrink it here so the upload is quick and the storage lasts.
  const before = file.size;
  toast("Preparing photo…");

  /* A category picture is a sign above an aisle rather than a photograph
     of stock, so it gets neither the ribbon nor the seal — a dozen tiles
     each carrying the shop's mark is the mark repeated, not branding.
     Which form is open is what decides it. */
  const isCategory = apply === setCatPhoto;

  let small;
  try {
    // The halal seal is a per-photo choice, taken from the form.
    small = await shrinkImage(file, isCategory
      ? { plain: true }
      : { halal: $("#fHalal")?.checked });
  } catch {
    small = file;                          // never block on a shrink failure
  }
  if (stale()) return;

  // Show the shrunken picture straight away. It is what gets uploaded, so
  // the preview matches what the customer will see. Deliberately not the
  // original: reading a 4 MB file is slow and it could land after the
  // upload finished and overwrite the hosted URL with base64.
  try {
    const preview = await dataURL(small);
    if (stale()) return;
    apply(preview);
  } catch { /* preview is optional; the upload still matters */ }

  const note = before > small.size
    ? `${fileSize(before)} to ${fileSize(small.size)}`
    : "";

  if (usingSupabase()){
    /* Wait a moment before sending. Toggling the halal seal redraws the
       photo, and without this pause each flick of the switch would put
       another picture in storage that nothing points at. A newer run
       cancels this one while it waits. */
    await new Promise(r => setTimeout(r, 400));
    if (stale()) return;

    toast("Uploading photo…");
    try {
      const url = await api.uploadPhoto(small);
      if (stale()) return;
      apply(url);                          // store the hosted URL, not base64
      toast(note ? `Photo uploaded — made smaller, ${note}.` : "Photo uploaded.");
    } catch (err){
      if (stale()) return;
      toast("Photo upload failed: " + (err.message || "try again"), true);
    }
  } else if (note){
    // No backend yet: the shrunken picture stays in the page as base64.
    toast(`Photo ready — ${note}.`);
  }
}

/** A photo held as text inside the page rather than as a hosted file. */
const embedded = src => String(src || "").trim().startsWith("data:");

/** The text form of a photo back into a file that can be uploaded. */
const toBlob = async src => (await fetch(src)).blob();

/**
 * Make sure the photo about to be saved is a hosted file, not text.
 *
 * The preview is the whole picture written out as text. Saved in its
 * place — when the upload failed, or Save was pressed before it
 * finished — that text went into the row itself, and every visitor
 * downloaded every such photo on every page: 60 of them made each page
 * view 3 MB and spent the database's monthly allowance in a day. So it
 * is uploaded here, at the last moment, and the save refused only if
 * that fails. Without a database the page is all there is, so nothing
 * to do.
 */
async function hostedPhoto(sel, apply){
  const src = $(sel).value;
  if (!usingSupabase() || !embedded(src)) return true;
  toast("Uploading photo…");
  try {
    apply(await api.uploadPhoto(await toBlob(src)));
    return true;
  } catch (err){
    toast("The photo could not be uploaded (" + (err.message || "try again") +
          "). Choose the photo again, then save.", true);
    return false;
  }
}

/* ---------------- moving photos out of the database ----------------
   Clears up after the problem above: every product and deal whose photo
   was saved as text gets it uploaded and its row pointed at the file.
   Only the photo is written, nothing else about the product. Shown only
   while there is something to move. */
function stuckPhotos(){
  const out = [];
  for (const cat of catalog) for (const p of cat.items)
    if (p._id && embedded(p.img)) out.push({ table: "products", id: p._id, img: p.img, name: p.en });
  for (const d of deals)
    if (d._id && embedded(d.img)) out.push({ table: "deals", id: d._id, img: d.img, name: d.en });
  return out;
}

let movingPhotos = false;

function renderPhotoFix(){
  const box = $("#photoFix");
  if (!box || movingPhotos) return;
  const n = usingSupabase() ? stuckPhotos().length : 0;
  box.innerHTML = n ? `
    <div class="photo-fix">
      <div>
        <b>${n} photo${n === 1 ? " is" : "s are"} saved inside the database</b>
        <span>That makes every page of your shop slow to load and uses up the
          database's monthly allowance. Moving them to photo storage fixes it.
          Nothing else about the products changes.</span>
      </div>
      <button type="button" class="btn-red" id="photoFixGo">Move ${n} photo${n === 1 ? "" : "s"}</button>
    </div>` : "";
}

document.addEventListener("click", async e => {
  if (!e.target.closest("#photoFixGo") || movingPhotos) return;
  const list = stuckPhotos();
  const btn = $("#photoFixGo");
  movingPhotos = true;
  btn.disabled = true;
  let done = 0, failed = [];
  for (const x of list){
    btn.textContent = `Moving ${done + failed.length + 1} of ${list.length}…`;
    try {
      const url = await api.uploadPhoto(await toBlob(x.img));
      const { error } = await api.setPhoto(x.table, x.id, url);
      if (error) throw error;
      done++;
    } catch (err){
      failed.push(x.name);
      console.warn("move photo:", x.name, err);
    }
  }
  movingPhotos = false;
  toast(failed.length
    ? `Moved ${done}. ${failed.length} could not be moved: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}. Press the button again to retry.`
    : `All ${done} photos moved. Your shop pages are now much lighter.`, Boolean(failed.length));
  await reload();
});

/** Which photo box is currently on screen. */
function activePicker(){
  if (!$("#modal").hidden)    return { box: $("#photoPick"),  apply: setPhoto };
  if (!$("#catModal").hidden) return { box: $("#cPhotoPick"), apply: setCatPhoto };
  return null;
}

on("#fFile", "change", e => handleImage(e.target.files?.[0], setPhoto));

/* ---- paste a screenshot or copied image straight in ---- */
document.addEventListener("paste", e => {
  const target = activePicker();
  if (!target) return;                     // no photo form open

  const item = [...(e.clipboardData?.items || [])]
    .find(i => i.type.startsWith("image/"));
  if (!item) return;

  e.preventDefault();
  handleImage(item.getAsFile(), target.apply);
});

/* ---- drag an image file onto the box ---- */
["dragenter", "dragover"].forEach(ev =>
  document.addEventListener(ev, e => {
    const target = activePicker();
    if (!target) return;
    e.preventDefault();
    target.box.classList.add("dropping");
  }));

["dragleave", "drop"].forEach(ev =>
  document.addEventListener(ev, e => {
    const target = activePicker();
    if (!target) return;
    if (ev === "dragleave" && e.relatedTarget) return;
    target.box.classList.remove("dropping");
  }));

document.addEventListener("drop", e => {
  const target = activePicker();
  if (!target) return;
  e.preventDefault();
  handleImage(e.dataTransfer?.files?.[0], target.apply);
});

/**
 * Show the flag of whichever country is chosen.
 *
 * A dropdown can only hold text, so the owner picking from two hundred
 * names has nothing to confirm they got the right one. The flag beside it
 * is that confirmation, and it is the same picture the customer will see.
 */
function showCountryFlag(){
  const box = $("#fFlag");
  if (!box) return;
  box.innerHTML = flag($("#fCountry")?.value, { size: 34 });
}

on("#fCountry", "change", showCountryFlag);

/* Live feedback on the sale price. */
function updateSaleHint(){
  const now = +$("#fP").value, was = +$("#fWas").value;
  const hint = $("#saleHint");

  if (!was){ hint.hidden = true; return; }

  if (was <= now){
    hint.textContent = "The old price should be higher than the price now.";
    hint.className = "hint bad";
  } else {
    const off = Math.round((was - now) / was * 100);
    hint.textContent = `Customers will see “${off}% OFF” on this product.`;
    hint.className = "hint good";
  }
  hint.hidden = false;
}
on("#fP", "input", updateSaleHint);
on("#fWas", "input", updateSaleHint);

/* Same guard as the deals form: saving is asynchronous, so without it a
   double-click adds the product twice. */
let savingProduct = false;

on("#form", "submit", async e => {
  e.preventDefault();
  if (savingProduct) return;

  const now = +$("#fP").value;
  const was = +$("#fWas").value || 0;

  if (was && was <= now){
    toast("The old price must be higher than the price now.", true);
    return;
  }

  savingProduct = true;
  const saveBtn = $("#saveBtn");
  if (saveBtn) saveBtn.disabled = true;
  const releaseProduct = () => {
    savingProduct = false;
    if (saveBtn) saveBtn.disabled = false;
  };

  if (!(await hostedPhoto("#fImg", setPhoto))){ releaseProduct(); return; }

  const product = {
    en: $("#fEn").value.trim(),
    bn: $("#fBn").value.trim(),
    ja: $("#fJa").value.trim(),
    w:  $("#fW").value.trim(),
    p:  now,
    was,
    img: $("#fImg").value.trim()
  };
  /* Always sent, even when empty or false: going back to "Don't say",
     clearing a country or unticking a shelf all have to reach the row,
     not merely be left off the update. */
  product.tag = $$("input[name=fStock]").find(r => r.checked)?.value || null;
  product.country   = $("#fCountry").value || null;
  product.isOffer   = $("#fOffer").checked;
  /* Sold out comes off the offers and the deals (migrate-soldout.sql does
     it in the database whichever way the stock changes); say so here
     rather than let the tick quietly vanish. */
  if (product.tag === "out" && product.isOffer){
    product.isOffer = false;
    toast("Sold-out products can't be a Special Offer, so that tick was cleared. " +
          "Tick it again when it's back in stock.");
  }
  product.isNew     = $("#fNew").checked;
  product.isPopular = $("#fPopular").checked;

  const catId = $("#fCat").value;

  if (usingSupabase()){
    try {
      if (editing){
        const existing = catalog.find(c => c.id === editing.catId).items[editing.index];
        const { error } = await api.updateProduct(existing._id, catId, product);
        if (error) throw error;
      } else {
        const { error } = await api.insertProduct(catId, product);
        if (error) throw error;
      }
      toast(editing ? "Saved — live for everyone." : "Added — live for everyone.");
      closeForm();
      await reload();
    } catch (err){
      toast(err.message || "Could not save. Please try again.", true);
    } finally {
      releaseProduct();
    }
    return;
  }

  // Offline fallback
  if (editing){
    if (editing.catId !== catId){
      store.deleteProduct(catalog, editing.catId, editing.index);
      store.addProduct(catalog, catId, product);
    } else {
      store.updateProduct(catalog, catId, editing.index, product);
    }
  } else {
    store.addProduct(catalog, catId, product);
  }

  if (store.save(catalog)){
    toast(editing ? "Saved on this device." : "Added on this device.");
    closeForm();
    renderAll();
  } else {
    toast("Could not save — please use a smaller photo.", true);
  }
  releaseProduct();
});

/* ---------------------------- category form --------------------------- */

/* ---- category photo ---- */

function setCatPhoto(src){
  const img = $("#cPreviewImg"), empty = $("#cPhotoEmpty");
  $("#cImg").value = src || "";
  if (src){ img.src = src; img.hidden = false; empty.hidden = true; }
  else    { img.hidden = true;  empty.hidden = false; }
}

on("#cPhotoPick", "click", () => $("#cFile").click());

on("#cFile", "change", e => handleImage(e.target.files?.[0], setCatPhoto));

let editingCat = null;      // category id when editing, null when adding

function openCatForm(id){
  editingCat = id ?? null;
  const c = id ? catalog.find(x => x.id === id) : null;

  $("#catTitle").textContent = c ? "Edit Category" : "Add a New Category";
  $("#catSave").textContent  = c ? "Save Changes"  : "Add Category";

  $("#catForm").reset();
  $("#cFile").value = "";
  resetCategoryTranslation?.();
  $("#cEn").value = c?.en || "";
  $("#cBn").value = c?.bn || "";
  $("#cJa").value = c?.ja || "";
  setCatPhoto(c?.img || "");

  $("#catModal").hidden = false;
  $("#cEn").focus();
}

on("#addCatBtn", "click", () => openCatForm());

let savingCat = false;

on("#catForm", "submit", async e => {
  e.preventDefault();
  if (savingCat) return;
  savingCat = true;
  const catBtn = $("#catSave");
  if (catBtn) catBtn.disabled = true;
  const releaseCat = () => {
    savingCat = false;
    if (catBtn) catBtn.disabled = false;
  };

  if (!(await hostedPhoto("#cImg", setCatPhoto))){ releaseCat(); return; }

  try {
    const en = $("#cEn").value.trim();

    /* ---- editing an existing category ---- */
    if (editingCat){
      const patch = {
        en,
        bn:  $("#cBn").value.trim(),
        ja:  $("#cJa").value.trim(),
        img: $("#cImg").value.trim() || "/images/placeholder.svg"
      };

      if (usingSupabase()){
        const { error } = await api.updateCategory(editingCat, patch);
        if (error) return toast(error.message, true);
        $("#catModal").hidden = true;
        setCatPhoto("");
        editingCat = null;
        toast("Category updated — live for everyone.");
        return reload();
      }

      const cat = catalog.find(c => c.id === editingCat);
      if (cat) Object.assign(cat, patch);
      store.save(catalog);
      $("#catModal").hidden = true;
      setCatPhoto("");
      editingCat = null;
      toast("Category updated.");
      renderAll();
      return;
    }

    // Build a safe id from the English name so the owner never sees one.
    let id = en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!id) id = "category";
    let n = 2, base = id;
    while (catalog.some(c => c.id === id)) id = `${base}-${n++}`;

    const cat = {
      id,
      icon: "",
      img:  $("#cImg").value.trim() || "/images/placeholder.svg",
      en,
      bn: $("#cBn").value.trim(),
      ja: $("#cJa").value.trim()
    };

    if (usingSupabase()){
      const { error } = await api.insertCategory(cat, catalog.length);
      if (error) return toast(error.message, true);
      $("#catModal").hidden = true;
      $("#catForm").reset();
      setCatPhoto("");
      toast(`“${en}” added — live for everyone.`);
      return reload();
    }

    store.addCategory(catalog, cat);
    store.save(catalog);
    $("#catModal").hidden = true;
    $("#catForm").reset();
    toast(`“${en}” category added.`);
    renderAll();
  } finally {
    releaseCat();
  }
});

/* ------------------------------- actions ------------------------------ */

document.addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  if (edit){
    const [catId, i] = edit.dataset.edit.split(":");
    openForm(catId, +i);
    return;
  }

  const del = e.target.closest("[data-del]");
  if (del){
    const [catId, i] = del.dataset.del.split(":");
    const p = catalog.find(c => c.id === catId).items[+i];
    ask("Remove this product?",
        `“${p.en}” will be hidden from your website. You can restore it any time from the Archive.`,
        async () => {
          if (usingSupabase()){
            const { error } = await api.archive("products", p._id);
            if (error) return toast(error.message, true);
            toast("Moved to Archive.");
            return reload();
          }
          store.deleteProduct(catalog, catId, +i);
          store.save(catalog);
          toast("Product deleted.");
          renderAll();
        });
    return;
  }

  const addTo = e.target.closest("[data-addto]");
  if (addTo){ openForm(addTo.dataset.addto); return; }

  const editCat = e.target.closest("[data-editcat]");
  if (editCat){ openCatForm(editCat.dataset.editcat); return; }

  const delCat = e.target.closest("[data-delcat]");
  if (delCat){
    const cat = catalog.find(c => c.id === delCat.dataset.delcat);
    ask("Remove this category?",
        `“${cat.en}” will be hidden from your website. Its ${cat.items.length} products stay in the Archive too, and you can restore them later.`,
        async () => {
          if (usingSupabase()){
            const { error } = await api.archive("categories", cat.id);
            if (error) return toast(error.message, true);
            toast("Category moved to Archive.");
            return reload();
          }
          store.deleteCategory(catalog, cat.id);
          store.save(catalog);
          toast("Category deleted.");
          renderAll();
        });
    return;
  }

  if (e.target.closest("[data-x]"))  closeForm();
  if (e.target.closest("[data-cx]")) $("#catModal").hidden = true;
  if (e.target.closest("[data-nx]")){ $("#confirm").hidden = true; confirmAction = null; }
});

on("#confYes", "click", () => {
  confirmAction?.();
  $("#confirm").hidden = true;
  confirmAction = null;
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  closeForm();
  $("#catModal").hidden = true;
  $("#confirm").hidden = true;
});

/* -------------------------------- init -------------------------------- */

(async () => { if (await isLoggedIn()) openPanel(); })();


/* ============================ TODAY'S DEALS =========================== */

/** Every product in the shop, flattened, for the picker. */
const allProducts = () =>
  catalog.flatMap(c => c.items.map(p => ({ ...p, _cat: c.en })));

/**
 * The hidden picker behind the deal form's search. The search (find.js,
 * initDealFind) chooses a product by setting this and firing "change",
 * so the rest of the form reads the choice exactly as it always has.
 */
function renderDealPicker(){
  $("#dPick").innerHTML = `<option value=""></option>` +
    catalog.map(c => c.items.map((p, i) =>
      `<option value="${esc(c.id)}:${i}">${esc(p.en)}</option>`).join("")).join("");
}

initDealFind(v => {
  const pick = $("#dPick");
  pick.value = v;
  pick.dispatchEvent(new Event("change", { bubbles: true }));
}, p => {
  const note = $("#dPicked");
  note.textContent = `${p.en} is sold out, so it can't be added to Today's Deals. ` +
                     `Mark it in stock first, then add it.`;
  note.classList.remove("good");
  note.classList.add("bad");
  note.hidden = false;
  // Nothing is chosen, so no price from an earlier pick may stand.
  $("#dP").value = "";
  $("#dWas").value = "";
  updateDealHint?.();
});

function renderDeals(){
  if (!deals.length){
    $("#dealList").innerHTML = `
      <div class="none">
        <b>No deals yet</b>
        <span>Click “Add to Deals” to feature a product on your homepage.</span>
      </div>`;
    return;
  }

  /* Cards like the ones in the homepage strip, side by side, dragged
     to set the strip's order. Special-offer products are not here: they
     come from the tick on each product and lead the strip on their own. */
  $("#dealList").innerHTML = `
    <p class="drag-hint">${icon("grid", { size: 16 })}
      <span><b>Drag a card</b> to change its place in Today's Deal &amp; New
      Arrival — on a phone, press and hold it first. Products ticked as a
      Special Offer always come first, ahead of these.</span></p>
    <div class="prod-grid deal-grid">${deals.map((d, i) => {
    const off = d.was && d.was > d.p ? Math.round((d.was - d.p) / d.was * 100) : 0;
    const isDeal = d.type === "deal";

    return `
      <div class="prod ${isDeal ? "is-deal" : "is-new"}" data-i="${i}">
        <div class="prod-pic">
          <img class="prod-img" src="${esc(d.img || "/images/placeholder.svg")}" alt="" loading="lazy" ${IMG_FALLBACK}>
          <span class="dtype ${isDeal ? "deal" : "new"}">
            ${isDeal ? icon("fire",{size:11}) + " TODAY'S DEAL"
                      : icon("star",{size:11}) + " NEW ARRIVAL"}
          </span>
          ${off ? `<span class="deal-off">-${off}%</span>` : ""}
        </div>
        <div class="prod-tx">
          <b>${esc(d.en)}</b>
          <small>${esc([d.bn, d.ja].filter(Boolean).join(" · "))}</small>
          <span class="prod-meta"><span class="prod-w">${esc(d.w)}</span></span>
        </div>
        <div class="prod-price">
          <b>${yen(d.p)}</b>
          ${d.was ? `<s>${yen(d.was)}</s>` : ""}
          <small>(With Tax)</small>
        </div>
        <div class="prod-act">
          <button class="act edit" data-dedit="${i}">${icon("edit",{size:14})} Edit</button>
          <button class="act del"  data-ddel="${i}">${icon("archive",{size:14})} Remove</button>
        </div>
      </div>`;
  }).join("")}</div>`;

  makeSortable("deals", $$("#dealList .prod-grid"), (grid, from, to) => moveDeal(from, to));
}

/* --------------------------- deal form ------------------------------- */

function openDealForm(index){
  editingDeal = index ?? null;
  const d = (index !== undefined && index !== null) ? deals[index] : null;

  $("#dealTitle").textContent = d ? "Edit This Deal" : "Add to Today's Deals";
  $("#dealSave").textContent  = d ? "Save Changes"   : "Add to Deals";

  if ($("#dFind")){
    $("#dFind").value = d ? `${d.en}${d.w ? ` (${d.w})` : ""}` : "";
    $("#dFind").disabled = !!d;
    $("#dFindClear").hidden = true;
  }
  renderDealPicker();
  $("#dPick").value = "";
  $("#dPicked").hidden = true;
  $("#dP").value   = d?.p   ?? "";
  $("#dWas").value = d?.was || "";
  $$("input[name=dtype]").forEach(r => r.checked = r.value === (d?.type || "new"));

  // When editing, show which product this is and lock the picker.
  $("#dPick").disabled = !!d;
  if (d){
    $("#dPicked").textContent = `Editing: ${d.en} · ${d.w}`;
    $("#dPicked").hidden = false;
  }

  updateDealHint();
  $("#dealModal").hidden = false;
}

const closeDealForm = () => { $("#dealModal").hidden = true; editingDeal = null; };

on("#addDealBtn", "click", () => openDealForm());

/* Picking a product fills in its price automatically. */
on("#dPick", "change", e => {
  const v = e.target.value;
  if (!v){ $("#dPicked").hidden = true; return; }

  const [catId, i] = v.split(":");
  const p = catalog.find(c => c.id === catId)?.items[+i];
  if (!p) return;

  $("#dP").value   = p.p;
  $("#dWas").value = p.was || "";
  $("#dPicked").classList.replace("bad", "good");
  $("#dPicked").textContent = `${p.en} — normally ${yen(p.p)}`;
  $("#dPicked").hidden = false;
  updateDealHint();
});

function updateDealHint(){
  const now = +$("#dP").value, was = +$("#dWas").value;
  const h = $("#dHint");

  if (!was){ h.hidden = true; return; }
  if (was <= now){
    h.textContent = "The normal price should be higher than the special price.";
    h.className = "hint bad";
  } else {
    h.textContent = `Customers will see “${Math.round((was - now) / was * 100)}% OFF”.`;
    h.className = "hint good";
  }
  h.hidden = false;
}
on("#dP", "input", updateDealHint);
on("#dWas", "input", updateDealHint);

/* One save at a time.
 *
 * Saving is asynchronous and the duplicate check reads `deals`, which is
 * only refreshed once the save has finished. A double-click therefore ran
 * the check twice against the same stale list, both passed, and both
 * inserted — nine clicks put nine copies of one product in the strip.
 * The button is held from the first submit until the reload lands. */
let savingDeal = false;

on("#dealForm", "submit", async e => {
  e.preventDefault();
  if (savingDeal) return;

  const now  = +$("#dP").value;
  const was  = +$("#dWas").value || 0;
  const type = $$("input[name=dtype]").find(r => r.checked)?.value || "new";

  if (was && was <= now){
    toast("The normal price must be higher than the special price.", true);
    return;
  }

  savingDeal = true;
  const dealBtn = $("#dealSave");
  if (dealBtn) dealBtn.disabled = true;
  const releaseDeal = () => {
    savingDeal = false;
    if (dealBtn) dealBtn.disabled = false;
  };

  if (usingSupabase()){
    try {
      if (editingDeal !== null){
        const d = deals[editingDeal];
        const { error } = await api.updateDeal(d._id, { ...d, p: now, was, type });
        if (error) throw error;
      } else {
        const v = $("#dPick").value;
        if (!v){ toast("Please choose a product first.", true); return; }
        const [catId, i] = v.split(":");
        const prod = catalog.find(c => c.id === catId)?.items[+i];
        if (!prod) return;

        /* Asked of the database rather than of the copy in the page: the
           copy is only as fresh as the last reload, and a deal added from
           the owner's phone a moment ago would not be in it. */
        if (await api.dealExists(prod.en, prod.w)){
          toast("That product is already in your deals.", true);
          return;
        }

        // A new offer is the news: it belongs at the front of the strip,
        // not behind everything added before it.
        const { error } = await api.insertDeal(
          { type, en:prod.en, bn:prod.bn, ja:prod.ja, w:prod.w,
            p:now, was, img:prod.img || "" });
        if (error) throw error;
      }
      toast(editingDeal !== null ? "Deal updated — live." : "Added to deals — live.");
      closeDealForm();
      await reload();
    } catch (err){
      toast(err.message || "Could not save the deal.", true);
    } finally {
      releaseDeal();
    }
    return;
  }

  if (editingDeal !== null){
    deals[editingDeal] = { ...deals[editingDeal], p: now, was, type };
  } else {
    const v = $("#dPick").value;
    if (!v){ toast("Please choose a product first.", true); releaseDeal(); return; }

    const [catId, i] = v.split(":");
    const p = catalog.find(c => c.id === catId)?.items[+i];
    if (!p){ releaseDeal(); return; }

    if (deals.some(d => d.en === p.en && d.w === p.w)){
      toast("That product is already in your deals.", true);
      releaseDeal();
      return;
    }

    deals.unshift({ type, en:p.en, bn:p.bn, ja:p.ja, w:p.w, p:now, was, img:p.img || "" });
  }

  store.saveDeals(deals);
  toast(editingDeal !== null ? "Deal updated." : "Added to your homepage deals.");
  closeDealForm();
  renderAll();
  releaseDeal();
});

/* --------------------------- deal actions ---------------------------- */

document.addEventListener("click", e => {
  const ed = e.target.closest("[data-dedit]");
  if (ed){ openDealForm(+ed.dataset.dedit); return; }

  const rm = e.target.closest("[data-ddel]");
  if (rm){
    const d = deals[+rm.dataset.ddel];
    ask("Remove from deals?",
        `“${d.en}” will no longer show in the deals strip. The product stays in your shop.`,
        async () => {
          if (usingSupabase()){
            const { error } = await api.archive("deals", d._id);
            if (error) return toast(error.message, true);
            toast("Removed from deals.");
            return reload();
          }
          deals.splice(+rm.dataset.ddel, 1);
          store.saveDeals(deals);
          toast("Removed from deals.");
          renderAll();
        });
    return;
  }


  if (e.target.closest("[data-dx]")) closeDealForm();
});

/* ------------------------------- tabs -------------------------------- */

$$(".tab").forEach(btn => btn.addEventListener("click", () => {
  $$(".tab").forEach(b => b.classList.toggle("on", b === btn));
  $$(".panel-tab").forEach(sec =>
    sec.hidden = sec.id !== "tab-" + btn.dataset.tab);
}));


/* ============================== ARCHIVE =============================== */

/** One archived row. `kind` is the table name. */
function arcRow(item, kind, label){
  const name = item.en;
  const when = item.archived_at
    ? new Date(item.archived_at).toLocaleDateString()
    : "";

  return `
    <div class="arc-row">
      <img class="prod-img" src="${esc(item.img || "/images/placeholder.svg")}"
           alt="" loading="lazy">
      <div class="prod-tx">
        <span class="arc-kind">${esc(label)}</span>
        <b>${esc(name)}</b>
        <small>${esc(item.bn || "")}</small>
        ${when ? `<span class="arc-when">Removed ${esc(when)}</span>` : ""}
      </div>
      <div class="prod-act">
        <button class="act edit" data-restore="${esc(kind)}:${esc(item.id)}">${icon("restore",{size:14})} Restore</button>
        <button class="act del"  data-destroy="${esc(kind)}:${esc(item.id)}">${icon("trash",{size:14})} Delete forever</button>
      </div>
    </div>`;
}

function renderArchive(){
  const total = archive.products.length + archive.categories.length + archive.deals.length;

  const badge = $("#arcCount");
  if (badge) badge.textContent = total ? total : "";

  const list = $("#arcList");
  if (!list) return;

  if (!total){
    list.innerHTML = `
      <div class="none">
        <b>Archive is empty</b>
        <span>Anything you remove from your shop will appear here.</span>
      </div>`;
    return;
  }

  const block = (rows, kind, label, heading) => rows.length ? `
    <section class="cat-block">
      <div class="cat-head"><b>${esc(heading)}</b><em>${rows.length}</em></div>
      ${rows.map(r => arcRow(r, kind, label)).join("")}
    </section>` : "";

  list.innerHTML =
    block(archive.products,   "products",   "Product",  "Products") +
    block(archive.categories, "categories", "Category", "Categories") +
    block(archive.deals,      "deals",      "Deal",     "Deals");
}

/* --------------------------- archive actions -------------------------- */

document.addEventListener("click", async e => {
  const res = e.target.closest("[data-restore]");
  if (res){
    const [kind, id] = res.dataset.restore.split(/:(.+)/);
    const { error } = await api.restore(kind, id);
    if (error) return toast(error.message, true);
    toast("Restored to your website.");
    return reload();
  }

  const del = e.target.closest("[data-destroy]");
  if (del){
    const [kind, id] = del.dataset.destroy.split(/:(.+)/);
    const item = [...archive.products, ...archive.categories, ...archive.deals]
      .find(x => String(x.id) === id);

    ask("Delete forever?",
        `“${item?.en ?? "This item"}” will be gone permanently. This cannot be undone.`,
        async () => {
          const { error } = await api.destroy(kind, id);
          if (error) return toast(error.message, true);
          toast("Deleted permanently.");
          reload();
        });
  }
});


/* =========================== ANNOUNCEMENT ============================= */

/** Fill the editor from whatever is saved. */
function renderNotice(){
  if (!$("#anEn")) return;

  $("#anEn").value = notice?.en ?? "";
  $("#anBn").value = notice?.bn ?? "";
  $("#anJa").value = notice?.ja ?? "";
  $("#anActive").checked = Boolean(notice?.active);

  $("#anBody")?.classList.toggle("off", !notice?.active);

  // Mark the tab when something is actually showing on the website.
  const live = Boolean(notice?.active && (notice.en || "").trim());
  const dot = $("#anDot");
  if (dot) dot.textContent = live ? "ON" : "";

  previewNotice();
}

/** Show the owner exactly what a customer would see. */
function previewNotice(){
  const text = $("#anEn")?.value.trim();
  const wrap = $("#anPreview");
  const bar  = $("#anPreviewBar");
  if (!wrap || !bar) return;

  const on = $("#anActive")?.checked && text;
  wrap.hidden = !on;
  if (on) bar.textContent = text;
}

["#anEn", "#anBn", "#anJa"].forEach(sel => on(sel, "input", previewNotice));

/**
 * A switch should act, not queue a change. Requiring Save after flicking
 * it meant the owner turned the banner off and it stayed up.
 */
on("#anActive", "change", async e => {
  const active = e.target.checked;
  $("#anBody")?.classList.toggle("off", !active);
  previewNotice();

  if (active && !$("#anEn").value.trim()){
    toast("Write the announcement first, then turn it on.", true);
    e.target.checked = false;
    $("#anBody")?.classList.add("off");
    return;
  }

  if (usingSupabase()){
    const { error } = await api.saveAnnouncement({ active });
    if (error){
      toast(error.message, true);
      e.target.checked = !active;          // put the switch back
      return;
    }
  }

  notice = { ...notice, active };
  toast(active ? "Announcement is now showing." : "Announcement hidden.");
  renderNotice();
});

on("#anSave", "click", async () => {
  const en = $("#anEn").value.trim();
  const active = $("#anActive").checked;

  if (active && !en)
    return toast("Please write the announcement in English at least.", true);

  const patch = {
    active,
    en,
    bn: $("#anBn").value.trim(),
    ja: $("#anJa").value.trim()
  };

  if (usingSupabase()){
    const { error } = await api.saveAnnouncement(patch);
    if (error) return toast(error.message, true);
    notice = { ...notice, ...patch };
    toast(active ? "Announcement is live on your website." : "Announcement saved but hidden.");
    return renderNotice();
  }

  notice = { ...notice, ...patch };
  toast("Announcement saved on this device.");
  renderNotice();
});

on("#anDelete", "click", () => {
  ask("Delete the announcement?",
      "The banner will disappear from your website and the text will be cleared.",
      async () => {
        const blank = { active: false, en: "", bn: "", ja: "" };

        if (usingSupabase()){
          const { error } = await api.saveAnnouncement(blank);
          if (error) return toast(error.message, true);
        }
        notice = { ...notice, ...blank };
        toast("Announcement deleted.");
        renderNotice();
      });
});

/* ------------------------- reordering the deals ------------------------ */

/**
 * Drag a deal to move it.
 *
 * Two arrows meant a dozen clicks to move something from the bottom to
 * the top. Dragging says what it means: pick it up, put it where you
 * want it.
 *
 * Both pointer and touch are handled. A phone has no drag-and-drop of
 * its own, and the owner is as likely to be on one as at a desk.
 */
/** Move a deal from one place to another and save the new order. */
function moveDeal(from, to){
  if (from === to || from == null || to == null) return;
  if (from < 0 || to < 0 || from >= deals.length || to >= deals.length) return;

  const [row] = deals.splice(from, 1);
  deals.splice(to, 0, row);

  if (usingSupabase()) api.reorderDeals(deals).then(reload);
  else { store.saveDeals(deals); renderAll(); }
}

/* The dragging itself is SortableJS, set up in renderDeals() through
   the same makeSortable() the product cards use. */

/* ---------------------------- the halal seal --------------------------- */

/**
 * Redraw the photo when the seal is switched on or off.
 *
 * The seal is drawn into the picture as it is compressed, so changing
 * the choice means compressing again — but from the file already in
 * hand, not by making the owner pick it a second time. They tick, and
 * the preview updates.
 */
on("#fHalal", "change", () => {
  if (!chosen) return;                    // no photo yet: nothing to redraw
  handleImage(chosen.file, chosen.apply);
});

/* --------------------------- filling in the rest ----------------------- */

/**
 * Type the English, get the Bangla and Japanese.
 *
 * Only ever fills a box the owner has left empty, and only after they
 * leave the English field — so it never fights their typing, and never
 * replaces a word they chose themselves. The result stays editable,
 * which matters: brand names and shop words are what a translation gets
 * wrong, and the owner is the one holding the packet.
 */
function sayTranslating(where){
  return state => {
    const el = $(where);
    if (!el) return;
    el.textContent =
      state === "working" ? "Filling in Bangla and Japanese…"
      : state === "done"  ? "Filled in — check them and edit if needed."
      : "Could not fill those in — please type them.";
    el.hidden = false;
    if (state !== "working") setTimeout(() => { el.hidden = true; }, 4000);
  };
}

const resetProductTranslation  = autoTranslate({ en: "fEn",  bn: "fBn",  ja: "fJa",  onState: sayTranslating("#fTrans") });
const resetCategoryTranslation = autoTranslate({ en: "cEn",  bn: "cBn",  ja: "cJa",  onState: sayTranslating("#cTrans") });
autoTranslate({ en: "anEn", bn: "anBn", ja: "anJa", onState: sayTranslating("#anTrans") });
