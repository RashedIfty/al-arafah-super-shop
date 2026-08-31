/**
 * A shelf page — New Products, or Popular Products.
 *
 * Both pages are the same thing looked at through a different flag, so
 * they share this one component and differ only by the `data-shelf`
 * attribute on the body. Products keep their category heading, because
 * knowing a jar of pickle is popular is less useful than knowing where to
 * find it next time.
 */
import { esc } from "../../shared/lib/dom.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { onShelf, shelfById } from "../../features/catalog/shelves.js";
import { cardHTML } from "./product-card.js";

/** Which shelf this page is, from the body attribute. */
export const currentShelf = () => document.body.dataset.shelf || "";

/**
 * The shelf, grouped by category.
 *
 * Each product carries the category index and product index it holds in
 * CATALOG, so the lightbox opens the right photograph — the same reason
 * the country page keeps them.
 */
export function shelfHTML(){
  const T = t(), lang = getLang();
  const id = currentShelf();
  const shelf = shelfById(id);
  if (!shelf) return "";

  const items = onShelf(CATALOG, id);

  if (!items.length){
    return `
      <p class="empty">
        <b>${esc(T[`shelf_${id}_none`] || T.noresult)}</b>
        <span>${esc(T[`shelf_${id}_none_s`] || "")}</span>
      </p>`;
  }

  // Group in the shop's own category order rather than inventing one.
  const groups = [];
  for (const x of items){
    let g = groups.find(g => g.ci === x.ci);
    if (!g) groups.push(g = { cat: x.cat, ci: x.ci, items: [] });
    g.items.push(x);
  }
  groups.sort((a, b) => a.ci - b.ci);

  return groups.map(g => `
    <section class="sec" id="shelf-${esc(g.cat.id)}">
      <div class="wrap sec-head">
        <h3>${esc(g.cat[lang] || g.cat.en)}</h3>
        <span>${esc(itemCount(g.items.length))}</span>
      </div>
      <div class="wrap grid">
        ${g.items.map(x => cardHTML(x.p, g.cat, x.ci, x.pi)).join("")}
      </div>
    </section>`).join("");
}
