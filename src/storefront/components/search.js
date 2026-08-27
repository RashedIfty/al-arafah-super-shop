/**
 * Catalogue search, sorting and scroll-spy.
 * Search matches against all three languages at once.
 */
import { $, $$, on } from "../../shared/lib/dom.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { search as rank } from "../../features/search/engine.js";

/** Filter cards; hides a whole section when nothing in it matches. */
export function filter(query){
  const q = query.trim();

  if (!q){
    // Empty query: show everything again.
    $$(".card").forEach(card => {
      delete card.dataset.searchHidden;
      card.hidden = false;
    });
    $$(".sec").forEach(sec => sec.hidden = false);
    $("#empty")?.toggleAttribute("hidden", true);
    const res0 = $("#res");
    if (res0) res0.textContent = "";
    return $$(".card").length;
  }

  // Use the same ranked engine as the header dropdown, so "biriyani"
  // finds "Shan Biryani Masala" here too. A plain substring test did not.
  const products = CATALOG.flatMap(c =>
    c.items.map(p => ({ ...p, _cat: c[getLang()] || c.en })));

  const matched = new Set(
    rank(q, products, getLang()).map(r => r.product.en.toLowerCase()));

  let shown = 0;

  $$(".sec").forEach(sec => {
    let visible = 0;

    $$(".card", sec).forEach(card => {
      // data-key is the English name, which does not change with
      // the interface language; data-name would.
      const name = card.dataset.key || "";
      const hit = matched.has(name);

      // Record the verdict so the filters combine with search instead
      // of the two fighting over `hidden`.
      if (hit) delete card.dataset.searchHidden;
      else card.dataset.searchHidden = "1";

      card.hidden = !hit;
      if (hit) visible++;
    });

    sec.hidden = visible === 0;
    shown += visible;
  });

  const empty = $("#empty");
  if (empty) empty.hidden = shown > 0;

  const res = $("#res");
  if (res) res.textContent = itemCount(shown);

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
  }, { rootMargin: "-56px 0px -72% 0px" });

  sections.forEach(sec => observer.observe(sec));
}

/** Wire the search box and sort dropdown. */
export function initSearch(){
  on("#search", "input", e => filter(e.target.value));
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
