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
import { COUNTRIES, realCategories } from "../features/catalog/countries.js";
import * as api from "../backend/client.js";

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

/** Ask before deleting. */
function ask(title, text, onYes){
  $("#confTitle").textContent = title;
  $("#confText").textContent  = text;
  confirmAction = onYes;
  $("#confirm").hidden = false;
}

/* -------------------------------- login ------------------------------- */

async function openPanel(){
  $("#login")?.remove();
  $("#panel").hidden = false;

  if (usingSupabase()){
    const [cat, dl, arc, ann] = await Promise.all([
      api.fetchCatalog(), api.fetchDeals(), api.fetchArchive(), api.fetchAnnouncement()
    ]);
    notice = ann;
    catalog = cat || store.load();
    deals   = dl  || store.loadDeals(DEFAULT_ANNOUNCEMENTS.items);
    archive = arc || archive;
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
}

/** Pull fresh data after a write. */
async function reload(){
  if (!usingSupabase()) return;
  const [cat, dl, arc, ann] = await Promise.all([
    api.fetchCatalog(), api.fetchDeals(), api.fetchArchive(), api.fetchAnnouncement()
  ]);
  if (ann) notice = ann;
  if (cat) catalog = cat;
  if (dl)  deals   = dl;
  if (arc) archive = arc;
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
    err.hidden = false;
    $(".login-card").classList.remove("shake");
    void $(".login-card").offsetWidth;          // restart the animation
    $(".login-card").classList.add("shake");
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

on("#logout", "click", async () => { await logout(); location.href = "index.html"; });

/* Show / hide the password. */
on("#peek", "click", () => {
  const f = $("#pass");
  f.type = f.type === "password" ? "text" : "password";
});

/* ------------------------------ rendering ----------------------------- */

function renderAll(){
  // Countrywise is a way of browsing rather than a category: it is not
  // counted, and it is never offered as a place to put a product.
  const real = realCategories(catalog);

  const products = real.reduce((s, c) => s + c.items.length, 0);
  $("#countLine").textContent =
    `${products} products in ${real.length} categories`;

  $("#fCat").innerHTML = real
    .map(c => `<option value="${esc(c.id)}">${esc(c.en)}</option>`)
    .join("");

  // Optional, so "Not set" comes first and is the default.
  $("#fCountry").innerHTML =
    `<option value="">— Not set —</option>` +
    COUNTRIES.map(c => `<option value="${esc(c.id)}">${esc(c.en)}</option>`).join("");

  renderList();
  renderDeals();
  renderDealPicker();
  renderArchive();
  renderNotice();
}

function renderList(){
  const q = $("#filter").value.trim().toLowerCase();

  // Countrywise is not a category: it holds nothing, so a block for
  // managing its products would be meaningless. It gets its own strip
  // below, where its name and picture stay editable.
  const html = realCategories(catalog).map(cat => {
    const rows = cat.items.map((p, i) => {
      if (q && ![p.en, p.bn, p.ja].join(" ").toLowerCase().includes(q)) return "";

      return `
        <div class="prod">
          <img class="prod-img" src="${esc(p.img || "/images/placeholder.svg")}"
               alt="" loading="lazy" ${IMG_FALLBACK}>
          <div class="prod-tx">
            <b>${esc(p.en)}</b>
            <small>${esc(p.bn)}</small>
            <span class="prod-w">${esc(p.w)}</span>
          </div>
          <div class="prod-price">
            <b>${yen(p.p)}</b>
            ${p.was ? `<s>${yen(p.was)}</s>` : ""}
            ${p.tag ? `<span class="tag ${esc(p.tag)}">${p.tag === "new" ? "NEW" : "SOLD OUT"}</span>` : ""}
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

    const body = rows || `
      <div class="cat-empty">
        <span>No products in this category yet.</span>
        <button class="act edit" data-addto="${esc(cat.id)}">${icon("plus",{size:14})} Add a product here</button>
      </div>`;

    return `
      <section class="cat-block">
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

  $("#list").innerHTML = html || `
    <div class="none">
      <b>Nothing found</b>
      <span>${q ? "Try a different word." : "Add your first product above."}</span>
    </div>`;
}

on("#filter", "input", renderList);

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
  $("#fTag").value = p?.tag || "";
  $("#fCountry").value = p?.country || "";
  $("#fFile").value = "";
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

async function handleImage(file, apply){
  if (!file || !file.type.startsWith("image/")) return;

  const run = ++photoRun;
  const stale = () => run !== photoRun;

  // A phone photo is several megabytes and far larger than the shop ever
  // displays. Shrink it here so the upload is quick and the storage lasts.
  const before = file.size;
  toast("Preparing photo…");

  let small;
  try {
    small = await shrinkImage(file);
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

on("#form", "submit", async e => {
  e.preventDefault();

  const now = +$("#fP").value;
  const was = +$("#fWas").value || 0;

  if (was && was <= now){
    toast("The old price must be higher than the price now.", true);
    return;
  }

  const product = {
    en: $("#fEn").value.trim(),
    bn: $("#fBn").value.trim(),
    ja: $("#fJa").value.trim(),
    w:  $("#fW").value.trim(),
    p:  now,
    was,
    img: $("#fImg").value.trim()
  };
  const tag = $("#fTag").value;
  if (tag) product.tag = tag;

  // Always send it, even empty: clearing a country has to reach the row.
  product.country = $("#fCountry").value || null;

  const catId = $("#fCat").value;

  if (usingSupabase()){
    try {
      if (editing){
        const existing = catalog.find(c => c.id === editing.catId).items[editing.index];
        const { error } = await api.updateProduct(existing._id, catId, product);
        if (error) throw error;
      } else {
        const sort = catalog.find(c => c.id === catId)?.items.length ?? 0;
        const { error } = await api.insertProduct(catId, product, sort);
        if (error) throw error;
      }
      toast(editing ? "Saved — live for everyone." : "Added — live for everyone.");
      closeForm();
      await reload();
    } catch (err){
      toast(err.message || "Could not save. Please try again.", true);
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
  $("#cEn").value = c?.en || "";
  $("#cBn").value = c?.bn || "";
  $("#cJa").value = c?.ja || "";
  setCatPhoto(c?.img || "");

  $("#catModal").hidden = false;
  $("#cEn").focus();
}

on("#addCatBtn", "click", () => openCatForm());

on("#catForm", "submit", async e => {
  e.preventDefault();

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

function renderDealPicker(){
  $("#dPick").innerHTML =
    `<option value="">— Choose a product —</option>` +
    catalog.map(c => `
      <optgroup label="${esc(c.en)}">
        ${c.items.map((p, i) =>
          `<option value="${esc(c.id)}:${i}">${esc(p.en)} · ${esc(p.w)} · ${yen(p.p)}</option>`
        ).join("")}
      </optgroup>`).join("");
}

function renderDeals(){
  if (!deals.length){
    $("#dealList").innerHTML = `
      <div class="none">
        <b>No deals yet</b>
        <span>Click “Add to Deals” to feature a product on your homepage.</span>
      </div>`;
    return;
  }

  $("#dealList").innerHTML = deals.map((d, i) => {
    const off = d.was && d.was > d.p ? Math.round((d.was - d.p) / d.was * 100) : 0;
    const isDeal = d.type === "deal";

    return `
      <div class="deal-row ${isDeal ? "is-deal" : "is-new"}" draggable="true" data-i="${i}">
        <span class="drag" title="Hold and drag to reorder" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
        </span>
        <img class="prod-img" src="${esc(d.img || "/images/placeholder.svg")}" alt="" loading="lazy" ${IMG_FALLBACK}>
        <div class="prod-tx">
          <span class="dtype ${isDeal ? "deal" : "new"}">
            ${isDeal ? icon("fire",{size:12}) + " TODAY'S DEAL"
                      : icon("star",{size:12}) + " NEW ARRIVAL"}
          </span>
          <b>${esc(d.en)}</b>
          <small>${esc(d.bn)}</small>
          <span class="prod-w">${esc(d.w)}</span>
        </div>
        <div class="prod-price">
          <b>${yen(d.p)}</b>
          ${d.was ? `<s>${yen(d.was)}</s>` : ""}
          ${off ? `<span class="tag off">-${off}%</span>` : ""}
        </div>
        <div class="prod-act">
          <button class="act edit" data-dedit="${i}">${icon("edit",{size:14})} Edit</button>
          <button class="act del"  data-ddel="${i}">${icon("archive",{size:14})} Remove</button>
        </div>
      </div>`;
  }).join("");
}

/* --------------------------- deal form ------------------------------- */

function openDealForm(index){
  editingDeal = index ?? null;
  const d = (index !== undefined && index !== null) ? deals[index] : null;

  $("#dealTitle").textContent = d ? "Edit This Deal" : "Add to Today's Deals";
  $("#dealSave").textContent  = d ? "Save Changes"   : "Add to Deals";

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

on("#dealForm", "submit", async e => {
  e.preventDefault();

  const now  = +$("#dP").value;
  const was  = +$("#dWas").value || 0;
  const type = $$("input[name=dtype]").find(r => r.checked)?.value || "new";

  if (was && was <= now){
    toast("The normal price must be higher than the special price.", true);
    return;
  }

  if (usingSupabase()){
    try {
      if (editingDeal !== null){
        const d = deals[editingDeal];
        const { error } = await api.updateDeal(d._id, { ...d, p: now, was, type });
        if (error) throw error;
      } else {
        const v = $("#dPick").value;
        if (!v) return toast("Please choose a product first.", true);
        const [catId, i] = v.split(":");
        const prod = catalog.find(c => c.id === catId)?.items[+i];
        if (!prod) return;
        if (deals.some(d => d.en === prod.en && d.w === prod.w))
          return toast("That product is already in your deals.", true);

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
    }
    return;
  }

  if (editingDeal !== null){
    deals[editingDeal] = { ...deals[editingDeal], p: now, was, type };
  } else {
    const v = $("#dPick").value;
    if (!v){ toast("Please choose a product first.", true); return; }

    const [catId, i] = v.split(":");
    const p = catalog.find(c => c.id === catId)?.items[+i];
    if (!p) return;

    if (deals.some(d => d.en === p.en && d.w === p.w)){
      toast("That product is already in your deals.", true);
      return;
    }

    deals.unshift({ type, en:p.en, bn:p.bn, ja:p.ja, w:p.w, p:now, was, img:p.img || "" });
  }

  store.saveDeals(deals);
  toast(editingDeal !== null ? "Deal updated." : "Added to your homepage deals.");
  closeDealForm();
  renderAll();
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
let dragFrom = null;

/** Move a deal from one place to another and save the new order. */
function moveDeal(from, to){
  if (from === to || from == null || to == null) return;
  if (from < 0 || to < 0 || from >= deals.length || to >= deals.length) return;

  const [row] = deals.splice(from, 1);
  deals.splice(to, 0, row);

  if (usingSupabase()) api.reorderDeals(deals).then(reload);
  else { store.saveDeals(deals); renderAll(); }
}

/** The row under a point on the screen, and its index. */
function rowAt(x, y){
  const el = document.elementFromPoint(x, y)?.closest(".deal-row");
  return el ? { el, i: +el.dataset.i } : null;
}

/* ---- mouse and trackpad ---- */

on("#dealList", "dragstart", e => {
  const row = e.target.closest(".deal-row");
  if (!row) return;
  dragFrom = +row.dataset.i;
  row.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  // Firefox will not start a drag without something on the transfer.
  e.dataTransfer.setData("text/plain", String(dragFrom));
});

on("#dealList", "dragover", e => {
  e.preventDefault();                      // without this, no drop lands
  const over = e.target.closest(".deal-row");
  $$(".deal-row").forEach(r => r.classList.toggle("over", r === over));
});

on("#dealList", "drop", e => {
  e.preventDefault();
  const over = e.target.closest(".deal-row");
  $$(".deal-row").forEach(r => r.classList.remove("over", "dragging"));
  if (over) moveDeal(dragFrom, +over.dataset.i);
  dragFrom = null;
});

on("#dealList", "dragend", () => {
  $$(".deal-row").forEach(r => r.classList.remove("over", "dragging"));
  dragFrom = null;
});

/* ---- touch ---- */

let touchRow = null;

on("#dealList", "touchstart", e => {
  const handle = e.target.closest(".drag");
  if (!handle) return;                     // only the handle starts a drag,
  const row = handle.closest(".deal-row"); // so the list still scrolls
  if (!row) return;
  touchRow = row;
  dragFrom = +row.dataset.i;
  row.classList.add("dragging");
}, { passive: true });

on("#dealList", "touchmove", e => {
  if (!touchRow) return;
  e.preventDefault();                      // hold the page still while dragging
  const t = e.touches[0];
  const over = rowAt(t.clientX, t.clientY);
  $$(".deal-row").forEach(r => r.classList.toggle("over", r === over?.el && r !== touchRow));
}, { passive: false });

on("#dealList", "touchend", e => {
  if (!touchRow) return;
  const t = e.changedTouches[0];
  const over = rowAt(t.clientX, t.clientY);
  $$(".deal-row").forEach(r => r.classList.remove("over", "dragging"));
  if (over && over.el !== touchRow) moveDeal(dragFrom, over.i);
  touchRow = null;
  dragFrom = null;
});
