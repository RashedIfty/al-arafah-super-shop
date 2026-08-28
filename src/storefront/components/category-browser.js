/**
 * Category browser — sidebar list plus a grid of large photo tiles,
 * the layout used by most halal grocery storefronts.
 */
import { esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { SHOP } from "../../shared/shop.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { countriesInUse } from "../../features/catalog/countries.js";

/** Link prefix: stay on the page when we are already on products.html. */
const prefix = () =>
  document.body.dataset.page === "products" ? "" : "products.html";

/**
 * The country category behaves differently from the rest.
 *
 * It holds no products itself — it gathers products from every other
 * category by where they came from — so it links to its own page and is
 * counted by countries rather than items.
 */
const COUNTRY_CAT = "others";

const isCountryCat = cat => cat.id === COUNTRY_CAT;

/** Categories worth showing: those with products, plus the country one
    once at least one product has a country. */
function visibleCategories(){
  const countries = countriesInUse(CATALOG).length;
  return CATALOG.filter(c =>
    isCountryCat(c) ? countries > 0 : c.items.length);
}

/** Where a tile points, and what its count reads. */
function catLink(cat, base){
  return isCountryCat(cat) ? "countries.html" : `${base}#${esc(cat.id)}`;
}

function catCount(cat){
  if (!isCountryCat(cat)) return itemCount(cat.items.length);
  const n = countriesInUse(CATALOG).length;
  const T = t();
  return n === 1 ? T.one_country : (T.n_countries || "").replace("{n}", n);
}

/** Small thumbnail rows down the left. */
export function categorySidebarHTML(){
  const T = t(), lang = getLang(), base = prefix();

  return `
    <aside class="cat-side">
      <h3>${esc(T.cats_side)}</h3>
      <ul>
        ${visibleCategories().map(cat => `
          <li>
            <a href="${catLink(cat, base)}">
              <img src="${esc(cat.img || SHOP.placeholder)}" alt="" loading="lazy"
                   width="40" height="40" ${IMG_FALLBACK}>
              <span>${esc(cat[lang])}</span>
              <em>${isCountryCat(cat)
                    ? countriesInUse(CATALOG).length
                    : cat.items.length}</em>
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
  const lang = getLang(), base = prefix();
  const shown = visibleCategories();

  return `
    <div class="cat-tiles" style="--cols:${columnsFor(shown.length)}">
      ${shown.map(cat => `
        <a href="${catLink(cat, base)}" class="cat-tile">
          <div class="cat-tile-img">
            <img src="${esc(cat.img || SHOP.placeholder)}" alt="${esc(cat[lang])}"
                 loading="lazy" width="400" height="400" ${IMG_FALLBACK}>
          </div>
          <b>${esc(cat[lang])}</b>
          <span>${esc(catCount(cat))}</span>
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
