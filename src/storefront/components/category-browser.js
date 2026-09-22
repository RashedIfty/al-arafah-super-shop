/**
 * Category browser — sidebar list plus a grid of large photo tiles,
 * the layout used by most halal grocery storefronts.
 */
import { esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
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

/**
 * Every category as a row of pills, scrolled sideways.
 *
 * A shop with twenty-odd shelves cannot put them all on screen at once
 * without burying everything else, and a customer who knows they want
 * fish should not have to scroll past the whole front page to say so.
 * One line, dragged or swiped, with the shelves at the end — the same
 * order as the sidebar, so the two never disagree.
 *
 * The list itself is a nav landmark, and the arrows are decoration: a
 * keyboard or a screen reader walks the links, and the buttons are
 * there for a mouse with no trackpad.
 */
export function categoryStripHTML(){
  const T = t(), lang = getLang(), base = prefix();
  const cats = visibleCategories();
  if (!cats.length) return "";

  /* The shelf's own photo rides in the pill. The shop already shows
     these thumbnails down the sidebar and on the tiles, and a picture
     of the fish counter is read faster than the word for it — which
     matters most to the customer whose Japanese or English is the
     shakiest. */
  const pill = (href, img, name, count) => `
    <a class="cstrip-pill" href="${href}">
      <img src="${esc(img)}" alt="" loading="lazy" width="26" height="26" ${IMG_FALLBACK}>
      <span>${esc(name)}</span>
      <em>${count}</em>
    </a>`;

  return `
    <nav class="cstrip" aria-label="${esc(T.cats_side)}">
      <div class="wrap cstrip-in">
        <a class="cstrip-all" href="${base || "products.html"}">
          ${icon("grid", { size: 14 })} <span>${esc(T.fl_all)}</span>
        </a>

        <div class="cstrip-rail">
          <button type="button" class="cstrip-arrow left" data-cstrip="-1"
                  aria-label="${esc(T.ann_prev)}" hidden>
            ${icon("arrow", { size: 15 })}
          </button>

          <div class="cstrip-scroll" id="cstripScroll">
            ${cats.map(c =>
              pill(`${base}#${esc(c.id)}`, c.img || SHOP.placeholder,
                   c[lang] || c.en, c.items.length)).join("")}
            ${SHELVES.map(s => `
              <a class="cstrip-pill shelf" href="${s.href}">
                <img src="${esc(s.img)}" alt="" loading="lazy"
                     width="26" height="26" ${IMG_FALLBACK}>
                <span>${esc(s[lang] || s.en)}</span>
              </a>`).join("")}
          </div>

          <button type="button" class="cstrip-arrow right" data-cstrip="1"
                  aria-label="${esc(T.ann_next)}" hidden>
            ${icon("arrow", { size: 15 })}
          </button>
        </div>
      </div>
    </nav>`;
}

/**
 * The arrows, and dragging with a mouse.
 *
 * Touch and trackpads already scroll this; a mouse has nothing to
 * throw at it, so the strip can be dragged and the two arrows appear
 * only when there is somewhere to go. Bound once.
 */
export function initCategoryStrip(){
  const box = document.getElementById("cstripScroll");
  if (!box || box.dataset.bound) return;
  box.dataset.bound = "1";

  const strip = box.closest(".cstrip");
  const arrows = strip.querySelectorAll("[data-cstrip]");

  /* Hide an arrow that would do nothing. The 2px allows for the
     fractional widths a zoomed-out browser reports. */
  const paint = () => {
    const max = box.scrollWidth - box.clientWidth;
    arrows.forEach(a => {
      const back = a.dataset.cstrip === "-1";
      a.hidden = max < 4 || (back ? box.scrollLeft < 2 : box.scrollLeft > max - 2);
    });
  };

  arrows.forEach(a => a.addEventListener("click", () => {
    box.scrollBy({ left: Number(a.dataset.cstrip) * box.clientWidth * 0.8,
                   behavior: "smooth" });
  }));

  box.addEventListener("scroll", paint, { passive: true });
  addEventListener("resize", paint, { passive: true });
  paint();

  /* Drag to scroll. `moved` is what stops a drag that happens to end on
     a pill from also following it. */
  let down = false, startX = 0, startLeft = 0, moved = false;

  box.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse") return;
    down = true; moved = false;
    startX = e.clientX; startLeft = box.scrollLeft;
    box.classList.add("dragging");
  });

  box.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    box.scrollLeft = startLeft - dx;
  });

  const stop = () => { down = false; box.classList.remove("dragging"); };
  box.addEventListener("pointerup", stop);
  box.addEventListener("pointerleave", stop);
  box.addEventListener("click", e => { if (moved) e.preventDefault(); }, true);
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
      <div class="cat-side-scroll">
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
      </div>
    </aside>`;
}

/**
 * How many columns keep the rows balanced.
 *
 * Fewest rows wins, so nine categories are 5-4 rather than 3-3-3. Ties
 * go to the fullest last row, so eight are 4-4 rather than 5-3.
 *
 * Four across on the products page, where the tiles are what the visitor
 * came for and can afford the room. Six on the homepage, where they have
 * to share the first screen with the shop and the day's deals — smaller,
 * but all of them visible without scrolling, which is the point of having
 * them there at all.
 */
export function columnsFor(count, max = 7){
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
export function categoryTilesHTML(max){
  const T = t(), lang = getLang(), base = prefix();
  const shown = visibleCategories();
  const shelves = SHELVES;

  const catCols = columnsFor(shown.length, max);

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

/**
 * The whole two-column browser.
 *
 * `max` is the widest the tile grid may go — the homepage asks for more
 * columns than the products page, to fit every category on the first
 * screen alongside the shop and the deals.
 */
export function categoryBrowserHTML(max){
  return `
    <div class="cat-browse">
      ${categorySidebarHTML()}
      ${categoryTilesHTML(max)}
    </div>`;
}
