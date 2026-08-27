/**
 * Shop owner panel.
 *
 * Written for someone who is not technical: plain language, one obvious
 * action per screen, confirmation before anything destructive.
 */
import { $, $$, esc, on } from "../core/dom.js";
import { yen } from "../core/format.js";
import { isLoggedIn, login, logout, usingSupabase } from "./auth.js";
import * as store from "./store.js";
import { DEFAULT_ANNOUNCEMENTS } from "../data/announcements.js";
import * as api from "../data/db.js";

let catalog = [];
let editing = null;            // {catId, index} when editing, null when adding
let confirmAction = null;      // callback for the confirm dialog
let deals = [];                // Today's Deal & New Arrival strip
let editingDeal = null;        // index when editing, null when adding
let archive = { products: [], categories: [], deals: [] };

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
    const [cat, dl, arc] = await Promise.all([
      api.fetchCatalog(), api.fetchDeals(), api.fetchArchive()
    ]);
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
  const [cat, dl, arc] = await Promise.all([
    api.fetchCatalog(), api.fetchDeals(), api.fetchArchive()
  ]);
  if (cat) catalog = cat;
  if (dl)  deals   = dl;
  if (arc) archive = arc;
  renderAll();
}

let signingIn = false;

async function doLogin(e){
  e?.preventDefault();
  if (signingIn) return;                       // ignore double taps

  const email = $("#email")?.value ?? "";
  const pass  = $("#pass")?.value  ?? "";
  const btn   = $(".login-go");
  const err   = $("#loginErr");

  err.hidden = true;

  btn.disabled = true;
  const result = await login(email, pass);
  btn.disabled = false;

  if (!result.ok){
    err.textContent = result.message || "That email or password is not right.";
    err.hidden = false;
    $(".login-card").classList.remove("shake");
    void $(".login-card").offsetWidth;          // restart the animation
    $(".login-card").classList.add("shake");
    return;
  }

  // Matched — show progress, then reveal the panel.
  signingIn = true;
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
on(".login-go", "click", doLogin);

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

  renderList();
  renderDeals();
  renderDealPicker();
  renderArchive();
}

function renderList(){
  const q = $("#filter").value.trim().toLowerCase();

  const html = catalog.map(cat => {
    const rows = cat.items.map((p, i) => {
      if (q && ![p.en, p.bn, p.ja].join(" ").toLowerCase().includes(q)) return "";

      return `
        <div class="prod">
          <img class="prod-img" src="${esc(p.img || "assets/img/placeholder.svg")}"
               alt="" loading="lazy">
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
            <button class="act edit" data-edit="${esc(cat.id)}:${i}">✏️ Edit</button>
            <button class="act del"  data-del="${esc(cat.id)}:${i}">🗄 Remove</button>
          </div>
        </div>`;
    }).join("");

    // While searching, hide categories with no match. Otherwise always show
    // the category — an empty one still needs to be editable and fillable.
    if (q && !rows) return "";

    const body = rows || `
      <div class="cat-empty">
        <span>No products in this category yet.</span>
        <button class="act edit" data-addto="${esc(cat.id)}">+ Add a product here</button>
      </div>`;

    return `
      <section class="cat-block">
        <div class="cat-head">
          <img src="${esc(cat.img)}" alt="" class="cat-thumb">
          <b>${esc(cat.en)}</b>
          <em>${cat.items.length}</em>
          <button class="act edit cat-edit" data-editcat="${esc(cat.id)}">✏️ Edit</button>
          <button class="act del" data-delcat="${esc(cat.id)}">🗄 Remove</button>
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

on("#fFile", "change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Show it straight away while the upload runs.
  const reader = new FileReader();
  reader.onload = () => setPhoto(reader.result);
  reader.readAsDataURL(file);

  if (usingSupabase()){
    toast("Uploading photo…");
    try {
      const url = await api.uploadPhoto(file);
      setPhoto(url);                       // store the hosted URL, not base64
      toast("Photo uploaded.");
    } catch (err){
      toast("Photo upload failed: " + (err.message || "try again"), true);
    }
  } else if (file.size > 500 * 1024){
    toast("That photo is quite large. A smaller one will load faster.", true);
  }
});

/* Live feedback on the sale price. */
function updateSaleHint(){
  const now = +$("#fP").value, was = +$("#fWas").value;
  const hint = $("#saleHint");

  if (!was){ hint.hidden = true; return; }

  if (was <= now){
    hint.textContent = "⚠️ The old price should be higher than the price now.";
    hint.className = "hint bad";
  } else {
    const off = Math.round((was - now) / was * 100);
    hint.textContent = `✅ Customers will see “${off}% OFF” on this product.`;
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

on("#cFile", "change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => setCatPhoto(reader.result);
  reader.readAsDataURL(file);

  if (usingSupabase()){
    toast("Uploading photo…");
    try {
      const url = await api.uploadPhoto(file);
      setCatPhoto(url);
      toast("Photo uploaded.");
    } catch (err){
      toast("Photo upload failed: " + (err.message || "try again"), true);
    }
  }
});

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
      img: $("#cImg").value.trim() || "assets/img/placeholder.svg"
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
    img:  $("#cImg").value.trim() || "assets/img/placeholder.svg",
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
      <div class="deal-row ${isDeal ? "is-deal" : "is-new"}">
        <img class="prod-img" src="${esc(d.img || "assets/img/placeholder.svg")}" alt="" loading="lazy">
        <div class="prod-tx">
          <span class="dtype ${isDeal ? "deal" : "new"}">
            ${isDeal ? "🔥 TODAY'S DEAL" : "⭐ NEW ARRIVAL"}
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
          <button class="act" data-dup="${i}" title="Move up">↑</button>
          <button class="act" data-ddown="${i}" title="Move down">↓</button>
          <button class="act edit" data-dedit="${i}">✏️ Edit</button>
          <button class="act del"  data-ddel="${i}">🗄 Remove</button>
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
  $("#dPicked").textContent = `✅ ${p.en} — normally ${yen(p.p)}`;
  $("#dPicked").hidden = false;
  updateDealHint();
});

function updateDealHint(){
  const now = +$("#dP").value, was = +$("#dWas").value;
  const h = $("#dHint");

  if (!was){ h.hidden = true; return; }
  if (was <= now){
    h.textContent = "⚠️ The normal price should be higher than the special price.";
    h.className = "hint bad";
  } else {
    h.textContent = `✅ Customers will see “${Math.round((was - now) / was * 100)}% OFF”.`;
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

        const { error } = await api.insertDeal(
          { type, en:prod.en, bn:prod.bn, ja:prod.ja, w:prod.w,
            p:now, was, img:prod.img || "" }, deals.length);
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

    deals.push({ type, en:p.en, bn:p.bn, ja:p.ja, w:p.w, p:now, was, img:p.img || "" });
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

  const up = e.target.closest("[data-dup]");
  if (up){
    const i = +up.dataset.dup;
    if (i > 0){
      [deals[i - 1], deals[i]] = [deals[i], deals[i - 1]];
      if (usingSupabase()) api.reorderDeals(deals).then(reload);
      else { store.saveDeals(deals); renderAll(); }
    }
    return;
  }

  const dn = e.target.closest("[data-ddown]");
  if (dn){
    const i = +dn.dataset.ddown;
    if (i < deals.length - 1){
      [deals[i + 1], deals[i]] = [deals[i], deals[i + 1]];
      if (usingSupabase()) api.reorderDeals(deals).then(reload);
      else { store.saveDeals(deals); renderAll(); }
    }
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
      <img class="prod-img" src="${esc(item.img || "assets/img/placeholder.svg")}"
           alt="" loading="lazy">
      <div class="prod-tx">
        <span class="arc-kind">${esc(label)}</span>
        <b>${esc(name)}</b>
        <small>${esc(item.bn || "")}</small>
        ${when ? `<span class="arc-when">Removed ${esc(when)}</span>` : ""}
      </div>
      <div class="prod-act">
        <button class="act edit" data-restore="${esc(kind)}:${esc(item.id)}">↩ Restore</button>
        <button class="act del"  data-destroy="${esc(kind)}:${esc(item.id)}">🗑 Delete forever</button>
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
