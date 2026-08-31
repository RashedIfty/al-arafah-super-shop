/**
 * Category browser — sidebar list plus a grid of large photo tiles,
 * the layout used by most halal grocery storefronts.
 */
import { esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { SHOP } from "../../shared/shop.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { SHELVES } from "../../features/catalog/shelves.js";

/** Link prefix: stay on the page when we are already on products.html. */
const prefix = () =>
  document.body.dataset.page === "products" ? "" : "products.html";

/* Below the categories, under a rule, sit the shelves — Countrywise, New
   and Popular. They are ways of looking across the shop rather than
   places a product lives, so they are kept visibly apart from the
   categories rather than mixed in among them. */

/** Categories worth showing: an empty one is a dead end for a customer. */
const visibleCategories = () => CATALOG.filter(c => c.items.length);

/** What a shelf tile's count reads — countries for one, products for two. */
function shelfCount(shelf){
  const n = shelf.count(CATALOG);
  if (shelf.label !== "countries") return itemCount(n);
  const T = t();
  return n === 1 ? T.one_country : (T.n_countries || "").replace("{n}", n);
}

/** Small thumbnail rows down the left. */
export function categorySidebarHTML(){
  const T = t(), lang = getLang(), base = prefix();

  const row = (href, img, name, count) => `
    <li>
      <a href="${href}">
        <img src="${esc(img)}" alt="" loading="lazy"
             width="40" height="40" ${IMG_FALLBACK}>
        <span>${esc(name)}</span>
        <em>${count}</em>
      </a>
    </li>`;

  return `
    <aside class="cat-side">
      <h3>${esc(T.cats_side)}</h3>
      <ul>
        ${visibleCategories().map(cat =>
          row(`${base}#${esc(cat.id)}`, cat.img || SHOP.placeholder,
              cat[lang] || cat.en, cat.items.length)).join("")}
      </ul>
      <h3 class="cat-side-more">${esc(T.browse_more)}</h3>
      <ul>
        ${SHELVES.map(s =>
          row(s.href, s.img, s[lang] || s.en, s.count(CATALOG))).join("")}
      </ul>
    </aside>`;
}

/**
 * How many columns keep the rows balanced.
 *
 * Fewest rows wins, so nine categories are 5-4 rather than 3-3-3. Ties
 * go to the fullest last row, so eight are 4-4 rather than 5-3.
 *
 * Six is the widest the tiles read at: twelve categories become 6-6
 * rather than three rows of four, which is a lot of scrolling before a
 * customer has seen what the shop sells.
 */
export function columnsFor(count, max = 6){
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

/** One large photo tile. */
function tileHTML(href, img, name, count, extra = ""){
  return `
    <a href="${href}" class="cat-tile${extra}">
      <div class="cat-tile-img">
        <img src="${esc(img)}" alt="${esc(name)}"
             loading="lazy" width="400" height="400" ${IMG_FALLBACK}>
      </div>
      <b>${esc(name)}</b>
      <span>${esc(count)}</span>
    </a>`;
}

/**
 * Large photo tiles on the right: the categories, then the shelves.
 *
 * The rule between them is the whole point of the arrangement. Above it
 * is where a product lives; below it are other ways of finding the same
 * products. Running them together as one grid was what made Countrywise
 * read as a category in the first place.
 */
export function categoryTilesHTML(){
  const T = t(), lang = getLang(), base = prefix();
  const shown = visibleCategories();
  const shelves = SHELVES;

  const catCols = columnsFor(shown.length);

  const cats = `
    <div class="cat-tiles" style="--cols:${catCols}">
      ${shown.map(cat => tileHTML(
        `${base}#${esc(cat.id)}`, cat.img || SHOP.placeholder,
        cat[lang] || cat.en, itemCount(cat.items.length))).join("")}
    </div>`;

  /* Always shown, even at zero.
     A category with nothing in it is a dead end, so it is hidden. A shelf
     is not: it is a fixed part of the shop, and a customer who has learnt
     where New Products lives should find it in the same place tomorrow.
     Its count simply reads zero until the owner ticks something. */
  const rest = `
    <div class="shelf-rule"><span>${esc(T.browse_more)}</span></div>
    <div class="cat-tiles shelf-tiles"
         style="--cols:${shelves.length};--catcols:${catCols}">
      ${shelves.map(s => tileHTML(
        s.href, s.img, s[lang] || s.en, shelfCount(s), " is-shelf")).join("")}
    </div>`;

  /* One column, whatever is in it. The browser is a two-column grid at
     desktop width, so returning two siblings would drop the shelves into
     the sidebar's column instead of under the tiles. */
  return `<div class="cat-main">${cats}${rest}</div>`;
}

/** The whole two-column browser. */
export function categoryBrowserHTML(){
  return `
    <div class="cat-browse">
      ${categorySidebarHTML()}
      ${categoryTilesHTML()}
    </div>`;
}
