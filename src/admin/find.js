/**
 * The product search, with the dropdown a shop search ought to have.
 *
 * Type a letter and the matching products fall out underneath, with the
 * part that was typed picked out in bold so the owner can see why each
 * one is there. Arrow keys walk the list, Enter takes the highlighted
 * one, Escape closes.
 *
 * Used twice: above My Products, where picking one goes to it, and in
 * the Add to Deals form, where picking one chooses it.
 */
import { $, $$, esc, IMG_FALLBACK } from "../shared/lib/dom.js";
import { yen } from "../shared/lib/format.js";

const MAX = 8;          // as many as fit without becoming a page of their own

let catalog = [];       // set by main.js on every reload
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

function search(query, keep){
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const out = [];
  catalog.forEach(cat => cat.items.forEach((p, i) => {
    if (keep && !keep(p)) return;
    const names = [p.en, p.bn, p.ja].filter(Boolean);
    if (!names.join(" ").toLowerCase().includes(q)) return;
    out.push({ p, cat, i, sort: rank(names, q) });
  }));

  return out.sort((a, b) => (a.sort - b.sort) || a.p.en.localeCompare(b.p.en));
}

/* ------------------------------ one search ---------------------------- */

/**
 * A search box with its dropdown, wired to what picking a result does.
 *
 * Two of them now: the one above My Products, which goes to the picked
 * product, and the one in the Add to Deals form, which chooses it. They
 * share everything but that, so they look and behave the same.
 *
 *   input, box, clear — the elements
 *   wrap              — what counts as "inside" (a click elsewhere closes)
 *   keep(p)           — optional: leave products out of the results
 *   onPick(hit)       — hit is { p, cat, i }
 *   onClear()         — optional: after the cross empties the box
 */
function makeFind({ input, box, clear, wrap, keep, onPick, onClear }){
  if (!input || !box || input.dataset.findBound) return;
  input.dataset.findBound = "1";

  let hits = [], active = -1, total = 0;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

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
    input.setAttribute("aria-expanded", "true");
  }

  function close(){
    box.hidden = true; box.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    hits = []; active = -1;
  }

  function move(step){
    if (!hits.length) return;
    active = (active + step + hits.length) % hits.length;
    box.querySelectorAll(".sg-row").forEach((el, i) => {
      const on = i === active;
      el.classList.toggle("on", on);
      el.setAttribute("aria-selected", on);
      if (on) el.scrollIntoView({ block: "nearest" });
    });
  }

  function go(n){
    const hit = hits[n];
    if (!hit) return;
    close();
    onPick(hit, input);
    showClear(Boolean(input.value));
  }

  let timer;
  const showClear = on => { if (clear) clear.hidden = !on; };

  const show = v => {
    const q = v.trim();
    showClear(Boolean(v));
    if (!q) return close();
    const found = search(q, keep);
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
        // Never submit the form around it; take the highlighted one, or
        // the only one when there is just one.
        e.preventDefault();
        if (active >= 0) go(active);
        else if (hits.length === 1) go(0);
        break;
      case "Escape":    close(); input.blur(); break;
    }
  });

  input.addEventListener("focus", () => { if (input.value.trim()) show(input.value); });

  /* mousedown, not click: blur would close the box first and the click
     would land on nothing. */
  box.addEventListener("mousedown", e => {
    const row = e.target.closest("[data-n]");
    if (row){ e.preventDefault(); go(+row.dataset.n); }
  });

  clear?.addEventListener("click", () => {
    input.value = "";
    showClear(false);
    close();
    onClear?.();
    input.focus();
  });

  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) close();
  });
}

/* ------------------------ above My Products ---------------------------
   Picking one scrolls to it and outlines it for a moment rather than
   filtering the list down, so everything around it stays on screen. The
   list below goes on filtering as it always did. */

/* How the dropdown asks the list to be redrawn. main.js supplies
   renderList(); importing it here would have the two files import each
   other, which is how the admin panel once stopped loading altogether. */
let repaint = null;
export const setFindRepaint = fn => { repaint = fn; };

export function initFind(){
  const input = $("#filter");
  makeFind({
    input, box: $("#adFindBox"), clear: $("#adFindClear"),
    wrap: input?.closest(".ad-find") || document.body,
    onClear: () => repaint?.(),
    onPick: hit => {
      /* The list is filtered as the owner types, so the row may not be
         drawn yet — the box is cleared and the list repainted first,
         and only then is the row looked for. */
      const key = `${hit.cat.id}:${hit.i}`;
      input.value = "";
      repaint?.();
      requestAnimationFrame(() => {
        const row = document.querySelector(`[data-row="${CSS.escape(key)}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("found");
        setTimeout(() => row.classList.remove("found"), 2400);
      });
    },
  });
}

/* --------------------- choosing a deal's product ----------------------
   The same search in the Add to Deals form. Picking one chooses it (the
   hidden picker carries the choice to the rest of the form) and leaves
   its name in the box. A sold-out product is shown, marked Stock out,
   but picking it is refused with a reason: a deal for it would be taken
   straight off again (migrate-soldout.sql), and the owner asked to be
   told rather than find it missing. */
export function initDealFind(choose, refuse){
  const input = $("#dFind");
  makeFind({
    input, box: $("#dFindBox"), clear: $("#dFindClear"),
    wrap: input?.closest(".ad-find") || document.body,
    onPick: hit => {
      input.value = `${hit.p.en}${hit.p.w ? ` (${hit.p.w})` : ""}`;
      if (hit.p.tag === "out"){ choose(""); refuse(hit.p); return; }
      choose(`${hit.cat.id}:${hit.i}`);
    },
    onClear: () => choose(""),
  });
}
