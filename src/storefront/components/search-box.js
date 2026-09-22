/**
 * Live search dropdown.
 *
 * Suggestions appear as the customer types, each with a thumbnail, name
 * and price. Arrow keys move through them, Enter opens the highlighted
 * one, Escape closes. Ranking comes from features/search/engine.js.
 *
 * There can be more than one search box on a page — the header's and
 * the filter panel's — so everything that belongs to one box lives in
 * its own `ctx`. What is typed in one is mirrored into the others, so
 * they never disagree about what the cards below are filtered to.
 */
import { $, $$, esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { yen, discount } from "../../shared/lib/format.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { search, suggest } from "../../features/search/engine.js";
import { rerank, worthAsking } from "../../features/search/smart.js";
import { filter } from "./search.js";

const MAX = 8;              // product suggestions shown at once
const MAX_CATS = 3;         // category suggestions shown at once

/** Every box on the page: [input, box] pairs. */
const PAIRS = [["#search", "#sgBox"], ["#search2", "#sgBox2"]];
const boxes = new Set();    // live ctx objects

/** Flatten the catalogue once per keystroke, carrying the category name. */
const allProducts = () =>
  CATALOG.flatMap(c => c.items.map(p => ({ ...p, _cat: c[getLang()] || c.en, _catId: c.id })));

/**
 * Categories whose name contains the typed text, in any of the three
 * languages. A name that starts with it comes first. Only shelves with
 * something on them — an empty section is nowhere to send anyone.
 */
function matchCats(q){
  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  const hits = [];
  for (const c of CATALOG){
    if (!c.items.length) continue;
    const names = [c.en, c.bn, c.ja].filter(Boolean).map(s => s.toLowerCase());
    const at = Math.min(...names.map(n => { const i = n.indexOf(needle); return i < 0 ? 99 : i; }));
    if (at < 99) hits.push({ cat: c, at });
  }
  hits.sort((a, b) => a.at - b.at);
  return hits.slice(0, MAX_CATS).map(h => h.cat);
}

/* ------------------------------ markup -------------------------------- */

/**
 * The typed part, in bold, wherever it appears in the name — so the
 * customer sees why each row is there. Escaped first, and the query
 * escaped the same way before it is looked for, so the two agree.
 */
function mark(name, q){
  const safe = esc(name);
  const needle = esc(q.trim());
  const at = needle ? safe.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (at === -1) return safe;
  return safe.slice(0, at) +
         `<b>${safe.slice(at, at + needle.length)}</b>` +
         safe.slice(at + needle.length);
}

function catHTML(cat, q){
  const lang = getLang();
  return `
    <li class="sg-row sg-cat" role="option" aria-selected="false" data-cat="${esc(cat.id)}">
      <img class="sg-img" src="${esc(cat.img || "/images/placeholder.svg")}"
           alt="" loading="lazy" width="44" height="44" ${IMG_FALLBACK}>
      <span class="sg-tx">
        <span class="sg-name">${mark(cat[lang] || cat.en, q)}</span>
        <small>${esc(itemCount(cat.items.length))}</small>
      </span>
    </li>`;
}

function rowHTML(product, i, q = ""){
  const lang = getLang();
  const T = t();
  const off = discount(product.was, product.p);

  return `
    <li class="sg-row" role="option" aria-selected="false" data-i="${i}">
      <img class="sg-img" src="${esc(product.img || "/images/placeholder.svg")}"
           alt="" loading="lazy" width="44" height="44" ${IMG_FALLBACK}>
      <span class="sg-tx">
        <span class="sg-name">${mark(product[lang] || product.en, q)}${
          product.w ? ` <span class="sg-w">(${esc(product.w)})</span>` : ""}</span>
        <small>in ${esc(product._cat)}</small>
      </span>
      <span class="sg-price">
        ${product.was > product.p ? `<s>${yen(product.was)}</s>` : ""}
        <b>${yen(product.p)}</b>
        <small class="sg-tax">${esc(T.withtax)}</small>
        ${product.tag === "out" ? `<em class="sg-out">${esc(T.out_stock)}</em>` : ""}
      </span>
      ${off ? `<span class="sg-off">-${off}%</span>` : ""}
    </li>`;
}

/* ------------------------------ one box ------------------------------- */

function render(ctx, query){
  if (!query.trim()){ close(ctx); return; }

  const products = allProducts();
  const local = search(query, products, getLang());

  ctx.results = local;
  ctx.cats = matchCats(query);
  ctx.active = -1;
  paint(ctx, query);

  // Local results are already on screen; the model only reorders them.
  if (worthAsking(query)){
    const mine = ++ctx.seq;                  // a slow reply cannot overwrite a newer search
    ctx.box.classList.add("thinking");

    rerank(query, local).then(better => {
      if (mine !== ctx.seq) return;          // a newer query has started
      ctx.box.classList.remove("thinking");
      if (better === local) return;          // nothing changed
      ctx.results = better;
      paint(ctx, query);
    });
  }
}

function paint(ctx, query){
  const { box, results, cats } = ctx;
  const products = allProducts();
  const T = t();

  if (!results.length && !cats.length){
    const alt = suggest(query, products);
    box.innerHTML = `
      <div class="sg-none">
        <b>${esc(T.noresult)}</b>
        ${alt ? `<span>${esc(T.sg_didyoumean)} <button class="sg-alt" data-alt="${esc(alt)}">${esc(alt)}</button>?</span>`
              : `<span>${esc(T.noresult_s)}</span>`}
      </div>`;
  } else {
    const shown = results.slice(0, MAX);
    box.innerHTML = `
      ${cats.length ? `
      <div class="sg-head">${esc(T.st_categories)}</div>
      <ul class="sg-list sg-cats" role="listbox">
        ${cats.map(c => catHTML(c, query)).join("")}
      </ul>` : ""}
      ${shown.length ? `
      <div class="sg-head">${esc(T.st_products)}</div>
      <ul class="sg-list" role="listbox">
        ${shown.map((r, i) => rowHTML(r.product, i, query)).join("")}
      </ul>
      <button type="button" class="sg-foot" data-all>
        ${esc(T.sg_see_all)} (${results.length})
      </button>` : ""}`;
  }

  box.hidden = false;
  ctx.input.setAttribute("aria-expanded", "true");
}

function close(ctx){
  ctx.box.hidden = true;
  ctx.box.innerHTML = "";
  ctx.input.setAttribute("aria-expanded", "false");
  ctx.active = -1;
  ctx.results = [];
  ctx.cats = [];
}

const closeAll = () => boxes.forEach(close);

/** The same words in every box, so none of them lies about the cards. */
function setAll(value){
  boxes.forEach(c => { if (c.input.value !== value) c.input.value = value; });
}

/** Move the highlight down the rows, categories first, and keep it in view. */
function move(ctx, step){
  const rows = $$(".sg-row", ctx.box);
  if (!rows.length) return;
  ctx.active = (ctx.active + step + rows.length) % rows.length;

  rows.forEach((el, i) => {
    const on = i === ctx.active;
    el.classList.toggle("on", on);
    el.setAttribute("aria-selected", on);
    if (on) el.scrollIntoView({ block: "nearest" });
  });
}

const onProductsPage = () => document.body.dataset.page === "products";

/** Open a category: scroll to its shelf here, or go to it on the products page. */
function goCat(id){
  closeAll();
  setAll("");

  if (onProductsPage()){
    filter("");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    location.href = `products.html#${id}`;
  }
}

/** Jump to a product on the products page and flash it. */
function go(ctx, i){
  const hit = ctx.results[i];
  if (!hit) return;

  const id = hit.product._catId;
  const onProducts = onProductsPage();
  const url = `${onProducts ? "" : "products.html"}#${id}`;

  closeAll();
  setAll("");

  if (onProducts){
    filter("");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    highlight(hit.product);
  } else {
    sessionStorage.setItem("aa-find", hit.product.en);
    location.href = url;
  }
}

/**
 * "See all": the whole list, not the first eight. On the products page
 * the cards under the dropdown are already filtered to the query, so
 * this only closes the dropdown and scrolls to the first of them. From
 * any other page it carries the words over to the products page.
 */
function goAll(query){
  closeAll();
  if (onProductsPage()){
    filter(query);
    $(".sec:not([hidden])")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    sessionStorage.setItem("aa-q", query);
    location.href = "products.html";
  }
}

/** Enter or a click on any row. */
function pick(ctx, el){
  if (el.dataset.cat) goCat(el.dataset.cat);
  else if (el.dataset.i != null) go(ctx, +el.dataset.i);
}

/** Briefly outline the card the customer picked. */
function highlight(product){
  setTimeout(() => {
    const card = $$(".card").find(c =>
      c.dataset.search?.includes(product.en.toLowerCase()));
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("found");
    setTimeout(() => card.classList.remove("found"), 2400);
  }, 400);
}

/* ------------------------------- wiring ------------------------------- */

function attach(input, box){
  const ctx = { input, box, active: -1, results: [], cats: [], seq: 0 };
  boxes.add(ctx);

  // A box that was just re-rendered starts with the words the others hold.
  if (!input.value){
    const other = [...boxes].find(c => c !== ctx && c.input.value);
    if (other) input.value = other.input.value;
  }

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  let timer;
  input.addEventListener("input", e => {
    clearTimeout(timer);
    const v = e.target.value;
    setAll(v);
    timer = setTimeout(() => render(ctx, v), 90);   // settle between keystrokes
  });

  input.addEventListener("keydown", e => {
    switch (e.key){
      case "ArrowDown": e.preventDefault(); move(ctx, 1);  break;
      case "ArrowUp":   e.preventDefault(); move(ctx, -1); break;
      case "Enter": {
        e.preventDefault();
        const row = ctx.active >= 0 ? $$(".sg-row", box)[ctx.active] : null;
        if (row) pick(ctx, row);
        else if (input.value.trim() && ctx.results.length) goAll(input.value);
        break;
      }
      case "Escape":    close(ctx); input.blur();          break;
    }
  });

  input.addEventListener("focus", () => {
    if (input.value.trim()) render(ctx, input.value);
  });

  // Click a suggestion, the foot, or the "did you mean" button.
  box.addEventListener("mousedown", e => {
    const alt = e.target.closest("[data-alt]");
    if (alt){
      e.preventDefault();
      input.value = alt.dataset.alt;
      setAll(input.value);
      render(ctx, input.value);
      return;
    }
    if (e.target.closest("[data-all]")){ e.preventDefault(); goAll(input.value); return; }
    const row = e.target.closest(".sg-row");
    if (row){ e.preventDefault(); pick(ctx, row); }
  });
}

let pageBound = false;

export function initSearchBox(){
  // render() runs on every change of state and keeps markup that has not
  // changed, so this is called many times for one input. Bound twice, an
  // arrow key moved two rows and a click picked twice.
  for (const [inSel, boxSel] of PAIRS){
    const input = $(inSel), box = $(boxSel);
    if (!input || !box || input.dataset.sgBound) continue;
    input.dataset.sgBound = "1";
    attach(input, box);
  }
  // Boxes whose markup was replaced are gone; forget them.
  boxes.forEach(c => { if (!c.input.isConnected) boxes.delete(c); });

  if (pageBound || !boxes.size) return;
  pageBound = true;

  document.addEventListener("click", e => {
    if (!e.target.closest(".search")) closeAll();
  });

  // Arriving from another page with a product in mind.
  const wanted = sessionStorage.getItem("aa-find");
  if (wanted){
    sessionStorage.removeItem("aa-find");
    highlight({ en: wanted });
  }

  // Arriving from another page with words in mind: the cards filter
  // to them, with no dropdown over the top.
  const words = sessionStorage.getItem("aa-q");
  if (words && onProductsPage()){
    sessionStorage.removeItem("aa-q");
    setAll(words);
    setTimeout(() => {
      filter(words);
      $(".sec:not([hidden])")?.scrollIntoView({ block: "start" });
    }, 0);
  }
}
