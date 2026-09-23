/**
 * Catalogue search, sorting and scroll-spy.
 * Search matches against all three languages at once.
 */
import { $, $$, on } from "../../shared/lib/dom.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { search as rank } from "../../features/search/engine.js";
import { applyFilters } from "./filters.js";

/**
 * Filter cards; hides a whole section when nothing in it matches.
 *
 * The search only records its verdict on each card. Where the filter
 * panel exists it then makes the one pass that decides what shows, so
 * a price cap or "In stock" is never undone by the next keystroke and
 * the count under the panel is right. Without the panel, the pass is
 * made here.
 */
export function filter(query){
  const q = query.trim();

  // Use the same ranked engine as the header dropdown, so "biriyani"
  // finds "Shan Biryani Masala" here too. A plain substring test did not.
  const products = CATALOG.flatMap(c =>
    c.items.map(p => ({ ...p, _cat: c[getLang()] || c.en })));

  const matched = q
    ? new Set(rank(q, products, getLang()).map(r => r.product.en.toLowerCase()))
    : null;                                   // empty query: everything matches

  $$(".card").forEach(card => {
    // data-key is the English name, which does not change with
    // the interface language; data-name would.
    const hit = !matched || matched.has(card.dataset.key || "");
    if (hit) delete card.dataset.searchHidden;
    else card.dataset.searchHidden = "1";
  });

  if ($("#filters")) return applyFilters();

  let shown = 0;
  $$(".sec").forEach(sec => {
    let visible = 0;
    $$(".card", sec).forEach(card => {
      card.hidden = Boolean(card.dataset.searchHidden);
      if (!card.hidden) visible++;
    });
    sec.hidden = visible === 0;
    shown += visible;
  });

  const empty = $("#empty");
  if (empty) empty.hidden = shown > 0;

  const res = $("#res");
  if (res) res.textContent = q ? itemCount(shown) : "";

  return shown;
}

/** Reorder cards inside each category section. */
export function sortBy(mode){
  const comparators = {
    lo:  (a, b) => a.dataset.price - b.dataset.price,
    hi:  (a, b) => b.dataset.price - a.dataset.price,
    az:  (a, b) => a.dataset.name.localeCompare(b.dataset.name),
    def: (a, b) => a.dataset.i - b.dataset.i
  };
  const cmp = comparators[mode] || comparators.def;

  $$(".sec").forEach(sec => {
    const grid = $(".grid", sec);
    if (!grid) return;
    [...grid.children].sort(cmp).forEach(card => grid.appendChild(card));
  });
}

/** Highlight the chip for the category currently in view. */
export function initScrollSpy(){
  const sections = $$(".sec");
  if (!sections.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      $$(".chip").forEach(chip =>
        chip.classList.toggle("on", chip.getAttribute("href").endsWith("#" + entry.target.id)));
    });
  }, {
    /* Ignore whatever is behind the pinned header and nav: a category
       under them is not the one being read. */
    rootMargin: `-${parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue("--stick-h")) || 56}px 0px -72% 0px`,
  });

  sections.forEach(sec => observer.observe(sec));
}

/** Wire the search box and sort dropdown. */
export function initSearch(){
  // The header's box and the filter panel's both narrow the cards.
  // Bound once each: this runs on every render, and the markup stays.
  for (const sel of ["#search", "#search2"]){
    const el = $(sel);
    if (!el || el.dataset.flBound) continue;
    el.dataset.flBound = "1";
    el.addEventListener("input", e => filter(e.target.value));
  }
  on("#sort", "change", e => sortBy(e.target.value));
}

/** Show/hide the back-to-top button. */
export function initBackToTop(){
  const btn = $("#topBtn");
  if (!btn) return;

  addEventListener("scroll",
    () => btn.classList.toggle("show", scrollY > 500), { passive:true });

  btn.addEventListener("click", () => scrollTo({ top:0, behavior:"smooth" }));
}
