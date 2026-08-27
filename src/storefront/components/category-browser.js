/**
 * Category browser — sidebar list plus a grid of large photo tiles,
 * the layout used by most halal grocery storefronts.
 */
import { esc } from "../../shared/lib/dom.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";

/** Link prefix: stay on the page when we are already on products.html. */
const prefix = () =>
  document.body.dataset.page === "products" ? "" : "products.html";

/** Small thumbnail rows down the left. */
export function categorySidebarHTML(){
  const T = t(), lang = getLang(), base = prefix();

  return `
    <aside class="cat-side">
      <h3>${esc(T.cats_side)}</h3>
      <ul>
        ${CATALOG.filter(c => c.items.length).map(cat => `
          <li>
            <a href="${base}#${esc(cat.id)}">
              <img src="${esc(cat.img)}" alt="" loading="lazy" width="40" height="40">
              <span>${esc(cat[lang])}</span>
              <em>${cat.items.length}</em>
            </a>
          </li>`).join("")}
      </ul>
    </aside>`;
}

/**
 * How many columns keep the rows balanced.
 *
 * Fewest rows wins, so nine categories are 5-4 rather than 3-3-3. Ties
 * go to the fullest last row, so eight are 4-4 rather than 5-3.
 */
export function columnsFor(count, max = 5){
  if (count <= max) return count;

  let best = null;
  for (let cols = 3; cols <= max; cols++){
    const rows = Math.ceil(count / cols);
    const last = count - (rows - 1) * cols;
    const gap  = cols - last;          // empty slots in the final row

    // Compare field by field: array comparison in JS is string-based
    // and would order these wrongly.
    if (!best
      || rows < best.rows
      || (rows === best.rows && gap < best.gap)
      || (rows === best.rows && gap === best.gap && cols > best.cols))
      best = { rows, gap, cols };
  }
  return best.cols;
}

/** Large photo tiles on the right. */
export function categoryTilesHTML(){
  const T = t(), lang = getLang(), base = prefix();
  const shown = CATALOG.filter(c => c.items.length);

  return `
    <div class="cat-tiles" style="--cols:${columnsFor(shown.length)}">
      ${CATALOG.filter(c => c.items.length).map(cat => `
        <a href="${base}#${esc(cat.id)}" class="cat-tile">
          <div class="cat-tile-img">
            <img src="${esc(cat.img)}" alt="${esc(cat[lang])}"
                 loading="lazy" width="400" height="400">
          </div>
          <b>${esc(cat[lang])}</b>
          <span>${esc(itemCount(cat.items.length))}</span>
        </a>`).join("")}
    </div>`;
}

/** The whole two-column browser. */
export function categoryBrowserHTML(){
  return `
    <div class="cat-browse">
      ${categorySidebarHTML()}
      ${categoryTilesHTML()}
    </div>`;
}
