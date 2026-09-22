/**
 * The product search, with the dropdown a shop search ought to have.
 *
 * Type a letter and the matching products fall out underneath, with the
 * part that was typed picked out in bold so the owner can see why each
 * one is there. Arrow keys walk the list, Enter takes the highlighted
 * one, Escape closes.
 *
 * Picking one scrolls to it and outlines it for a moment rather than
 * filtering the list down, so everything around it stays on screen.
 *
 * The list below goes on filtering as it always did. This is a way to
 * reach one thing quickly, not a replacement for looking.
 */
import { $, $$, esc, IMG_FALLBACK } from "../shared/lib/dom.js";
import { yen } from "../shared/lib/format.js";

const MAX = 8;          // as many as fit without becoming a page of their own

let catalog = [];       // set by main.js on every reload
let hits = [];          // what is showing, at most MAX of them
let active = -1;
let total = 0;        // how many matched, before the list was cut to MAX

export const setFindCatalog = list => { catalog = list || []; };

/* ------------------------------ matching ------------------------------ */

/**
 * The typed part, in bold, wherever it appears in the name. Escaped
 * first — a product called "Salt & Pepper" must not become markup — and
 * the query is escaped too before being looked for in the escaped name,
 * so the two agree about what the text is.
 */
function mark(name, q){
  const safe = esc(name);
  const needle = esc(q);
  const at = safe.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1 || !needle) return safe;

  return safe.slice(0, at) +
         `<b>${safe.slice(at, at + needle.length)}</b>` +
         safe.slice(at + needle.length);
}

/** Names that start with what was typed come before ones that merely contain it. */
const rank = (names, q) =>
  names.some(n => n?.toLowerCase().startsWith(q)) ? 0 : 1;

function search(query){
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const out = [];
  catalog.forEach(cat => cat.items.forEach((p, i) => {
    const names = [p.en, p.bn, p.ja].filter(Boolean);
    if (!names.join(" ").toLowerCase().includes(q)) return;
    out.push({ p, cat, i, sort: rank(names, q) });
  }));

  return out.sort((a, b) => (a.sort - b.sort) || a.p.en.localeCompare(b.p.en));
}

/* ------------------------------ rendering ----------------------------- */

function rowHTML(h, n, q){
  const { p, cat } = h;
  return `
    <li class="sg-row${n === active ? " on" : ""}" role="option"
        aria-selected="${n === active}" data-n="${n}">
      <img class="sg-img" src="${esc(p.img || "/images/placeholder.svg")}"
           alt="" loading="lazy" width="38" height="38" ${IMG_FALLBACK}>
      <span class="sg-tx">
        <b class="sg-name">${mark(p.en, q)}${p.w ? ` <span class="sg-w">(${esc(p.w)})</span>` : ""}</b>
        <small>in ${esc(cat.en)}</small>
      </span>
      <span class="sg-price">
        ${p.was > p.p ? `<s>${yen(p.was)}</s>` : ""}
        <b>${yen(p.p)}</b>
        ${p.tag === "out" ? `<em class="sg-out">Stock out</em>` : ""}
      </span>
    </li>`;
}

function paint(q){
  const box = $("#adFindBox");
  if (!box) return;

  box.innerHTML = hits.length
    ? `<div class="sg-list">
         <div class="sg-head">Products</div>
         <ul role="listbox">${hits.map((h, n) => rowHTML(h, n, q)).join("")}</ul>
       </div>
       <div class="sg-foot">${total} product${total === 1 ? "" : "s"}${
         total > hits.length ? ` &middot; showing the first ${hits.length}` : ""}</div>`
    : `<div class="sg-none">
         <b>Nothing matches &ldquo;${esc(q)}&rdquo;</b>
         <span>Try part of the name, in any language.</span>
       </div>`;

  box.hidden = false;
  $("#filter")?.setAttribute("aria-expanded", "true");
}

function close(){
  const box = $("#adFindBox");
  if (box){ box.hidden = true; box.innerHTML = ""; }
  $("#filter")?.setAttribute("aria-expanded", "false");
  hits = [];
  active = -1;
}

function move(step){
  if (!hits.length) return;
  active = (active + step + hits.length) % hits.length;

  $$("#adFindBox .sg-row").forEach((el, i) => {
    const on = i === active;
    el.classList.toggle("on", on);
    el.setAttribute("aria-selected", on);
    if (on) el.scrollIntoView({ block: "nearest" });
  });
}

/**
 * Go to the one that was picked.
 *
 * The list is filtered as the owner types, so the row may not be drawn
 * yet — the box is cleared and the list repainted first, and only then
 * is the row looked for.
 */
function go(n){
  const hit = hits[n];
  if (!hit) return;

  const key = `${hit.cat.id}:${hit.i}`;
  const input = $("#filter");

  close();
  input.value = "";
  $("#adFindClear")?.setAttribute("hidden", "");
  repaint?.();

  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-row="${CSS.escape(key)}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("found");
    setTimeout(() => row.classList.remove("found"), 2400);
  });
}

/* How the dropdown asks the list to be redrawn. main.js supplies
   renderList(); importing it here would have the two files import each
   other, which is how the admin panel once stopped loading altogether. */
let repaint = null;
export const setFindRepaint = fn => { repaint = fn; };

/* ------------------------------- wiring ------------------------------- */

export function initFind(){
  const input = $("#filter");
  if (!input || input.dataset.findBound) return;
  input.dataset.findBound = "1";

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  let timer;
  const clearBtn = $("#adFindClear");
  const showClear = on => { if (clearBtn) clearBtn.hidden = !on; };

  const show = v => {
    const q = v.trim();
    showClear(Boolean(v));
    if (!q) return close();

    const found = search(q);
    total = found.length;
    hits = found.slice(0, MAX);
    active = -1;
    paint(q);
  };

  input.addEventListener("input", e => {
    clearTimeout(timer);
    const v = e.target.value;
    showClear(Boolean(v));
    timer = setTimeout(() => show(v), 90);    // settle between keystrokes
  });

  input.addEventListener("keydown", e => {
    switch (e.key){
      case "ArrowDown": e.preventDefault(); move(1);  break;
      case "ArrowUp":   e.preventDefault(); move(-1); break;
      case "Enter":
        if (active >= 0){ e.preventDefault(); go(active); }
        break;
      case "Escape":    close(); input.blur(); break;
    }
  });

  input.addEventListener("focus", () => { if (input.value.trim()) show(input.value); });

  /* mousedown, not click: blur would close the box first and the click
     would land on nothing. */
  $("#adFindBox")?.addEventListener("mousedown", e => {
    const row = e.target.closest("[data-n]");
    if (row){ e.preventDefault(); go(+row.dataset.n); }
  });

  /* The cross clears the box and the filtered list with it. */
  $("#adFindClear")?.addEventListener("click", () => {
    input.value = "";
    showClear(false);
    close();
    repaint?.();
    input.focus();
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".ad-find")) close();
  });
}
