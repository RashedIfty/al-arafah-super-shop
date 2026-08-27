/**
 * Live search dropdown.
 *
 * Suggestions appear as the customer types, each with a thumbnail, name
 * and price. Arrow keys move through them, Enter opens the highlighted
 * one, Escape closes. Ranking comes from features/search/engine.js.
 */
import { $, $$, esc, on } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { yen, discount } from "../../shared/lib/format.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { search, suggest } from "../../features/search/engine.js";
import { rerank, worthAsking } from "../../features/search/smart.js";

const MAX = 8;              // suggestions shown at once
let active = -1;            // keyboard cursor
let results = [];

/** Flatten the catalogue once per keystroke, carrying the category name. */
const allProducts = () =>
  CATALOG.flatMap(c => c.items.map(p => ({ ...p, _cat: c[getLang()] || c.en, _catId: c.id })));

/* ------------------------------ markup -------------------------------- */

function rowHTML(product, i){
  const T = t(), lang = getLang();
  const off = discount(product.was, product.p);

  return `
    <li class="sg-row${i === active ? " on" : ""}" role="option"
        aria-selected="${i === active}" data-i="${i}">
      <img class="sg-img" src="${esc(product.img || "/images/placeholder.svg")}"
           alt="" loading="lazy" width="44" height="44">
      <span class="sg-tx">
        <b>${esc(product[lang] || product.en)}</b>
        <small>${esc(product._cat)} &middot; ${esc(product.w)}</small>
      </span>
      <span class="sg-price">
        <b>${yen(product.p)}</b>
        ${product.was > product.p ? `<s>${yen(product.was)}</s>` : ""}
      </span>
      ${off ? `<span class="sg-off">-${off}%</span>` : ""}
    </li>`;
}

/** Rising counter so a slow AI reply cannot overwrite a newer search. */
let seq = 0;

function render(query){
  const box = $("#sgBox");
  if (!box) return;

  if (!query.trim()){ close(); return; }

  const products = allProducts();
  const local = search(query, products, getLang());

  results = local.slice(0, MAX);
  active = -1;
  paint(query, box);

  // Local results are already on screen; the model only reorders them.
  if (worthAsking(query)){
    const mine = ++seq;
    box.classList.add("thinking");

    rerank(query, local).then(better => {
      if (mine !== seq) return;              // a newer query has started
      box.classList.remove("thinking");
      if (better === local) return;          // nothing changed
      results = better.slice(0, MAX);
      paint(query, box);
    });
  }
}

function paint(query, box){
  const products = allProducts();
  const T = t();

  if (!results.length){
    const alt = suggest(query, products);
    box.innerHTML = `
      <div class="sg-none">
        <b>${esc(T.noresult)}</b>
        ${alt ? `<span>${esc(T.sg_didyoumean)} <button class="sg-alt" data-alt="${esc(alt)}">${esc(alt)}</button>?</span>`
              : `<span>${esc(T.noresult_s)}</span>`}
      </div>`;
  } else {
    box.innerHTML = `
      <ul class="sg-list" role="listbox">
        ${results.map((r, i) => rowHTML(r.product, i)).join("")}
      </ul>
      <div class="sg-foot">${esc(itemCount(results.length))}</div>`;
  }

  box.hidden = false;
  $("#search")?.setAttribute("aria-expanded", "true");
}

function close(){
  const box = $("#sgBox");
  if (box){ box.hidden = true; box.innerHTML = ""; }
  $("#search")?.setAttribute("aria-expanded", "false");
  active = -1;
  results = [];
}

/** Move the highlight and keep it in view. */
function move(step){
  if (!results.length) return;
  active = (active + step + results.length) % results.length;

  $$(".sg-row").forEach((el, i) => {
    const on = i === active;
    el.classList.toggle("on", on);
    el.setAttribute("aria-selected", on);
    if (on) el.scrollIntoView({ block: "nearest" });
  });
}

/** Jump to a product on the products page and flash it. */
function go(i){
  const hit = results[i];
  if (!hit) return;

  const id = hit.product._catId;
  const onProducts = document.body.dataset.page === "products";
  const url = `${onProducts ? "" : "products.html"}#${id}`;

  close();
  $("#search").value = "";

  if (onProducts){
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    highlight(hit.product);
  } else {
    sessionStorage.setItem("aa-find", hit.product.en);
    location.href = url;
  }
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

export function initSearchBox(){
  const input = $("#search");
  if (!input) return;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  let timer;
  input.addEventListener("input", e => {
    clearTimeout(timer);
    const v = e.target.value;
    timer = setTimeout(() => render(v), 90);   // settle between keystrokes
  });

  input.addEventListener("keydown", e => {
    switch (e.key){
      case "ArrowDown": e.preventDefault(); move(1);  break;
      case "ArrowUp":   e.preventDefault(); move(-1); break;
      case "Enter":
        if (active >= 0){ e.preventDefault(); go(active); }
        break;
      case "Escape":    close(); input.blur();        break;
    }
  });

  input.addEventListener("focus", () => {
    if (input.value.trim()) render(input.value);
  });

  // Click a suggestion, or the "did you mean" button.
  $("#sgBox")?.addEventListener("mousedown", e => {
    const alt = e.target.closest("[data-alt]");
    if (alt){
      e.preventDefault();
      input.value = alt.dataset.alt;
      render(input.value);
      return;
    }
    const row = e.target.closest("[data-i]");
    if (row){ e.preventDefault(); go(+row.dataset.i); }
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search") && !e.target.closest("#sgBox")) close();
  });

  // Arriving from another page with a product in mind.
  const wanted = sessionStorage.getItem("aa-find");
  if (wanted){
    sessionStorage.removeItem("aa-find");
    highlight({ en: wanted });
  }
}
