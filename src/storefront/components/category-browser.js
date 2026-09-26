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

  /* One pass of every shelf. Printed twice below, which is what lets
     the row loop: when the first copy has scrolled by, the position is
     wound back by exactly its width and the second copy is already
     sitting where the eye expects it. */
  const run =
    cats.map(c =>
      pill(`${base}#${esc(c.id)}`, c.img || SHOP.placeholder,
           c[lang] || c.en, c.items.length)).join("") +
    SHELVES.map(s => `
      <a class="cstrip-pill shelf is-${s.id}" href="${s.href}">
        <img src="${esc(s.img)}" alt="" loading="lazy"
             width="26" height="26" ${IMG_FALLBACK}>
        <span>${esc(s[lang] || s.en)}</span>
      </a>`).join("");

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
            <div class="cstrip-run">${run}</div>
            <!-- A second copy, so the row can roll from the end of one
                 into the start of the next with no gap and no jump. It
                 is the same shelves, so a screen reader hears them once. -->
            <div class="cstrip-run" aria-hidden="true">${run}</div>
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
 * The row moves by itself, and stops when somebody takes hold of it.
 *
 * Two copies of the shelves sit in the scroller. The position creeps
 * rightwards a fraction of a pixel per frame, and once the first copy
 * has gone by, exactly its width is subtracted — the second copy is
 * already drawn where the eye expects the first, so the wrap is
 * invisible and the row never reaches an end to be stuck at.
 *
 * Driving the scroll position rather than animating a transform keeps
 * every pill a real link at a real place: it can still be swiped,
 * dragged, tabbed to and clicked, which a CSS marquee would have cost.
 *
 * It pauses while a person is moving it — a finger on it, a drag, an
 * arrow's glide — and for a keyboard walking its links or a tab in the
 * background, then carries on by itself. It does not start at all for
 * somebody who has asked for less motion.
 */
const DRIFT = 32;          // pixels per second

export function initCategoryStrip(){
  const box = document.getElementById("cstripScroll");
  if (!box || box.dataset.bound) return;
  box.dataset.bound = "1";

  const strip = box.closest(".cstrip");
  const arrows = strip.querySelectorAll("[data-cstrip]");
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  /* The distance to wind back: from the start of one copy to the start
     of the next, which is a copy's width plus the gap between the two.
     The width alone left every lap nine pixels short, so the row jumped
     at the join. */
  const lap = () => {
    const runs = box.querySelectorAll(".cstrip-run");
    return runs.length > 1 ? runs[1].offsetLeft - runs[0].offsetLeft
                           : runs[0]?.offsetWidth || 0;
  };

  /* Both arrows, or neither.
   *
   * The row loops, so there is always somewhere to go in both
   * directions — hiding the left one at position zero, the way a
   * finite list would, was wrong the moment it started wrapping. They
   * go only when every shelf already fits on screen. */
  const paint = () => {
    const fits = box.scrollWidth - box.clientWidth < 4;
    arrows.forEach(a => { a.hidden = fits; });
  };

  arrows.forEach(a => a.addEventListener("click", () => {
    nudge(Number(a.dataset.cstrip) * box.clientWidth * 0.8);
  }));

  addEventListener("resize", paint, { passive: true });
  paint();

  /* ------------------------------ drifting ------------------------- */

  /* It stops only while somebody is actually moving it — a finger on
     it, a mouse dragging it, an arrow gliding — and starts again by
     itself a moment after they let go. Pausing on hover and on focus,
     as it once did, left it standing still for good: a tapped pill or
     a clicked arrow keeps focus until something else is clicked, and a
     mouse resting over the row is only reading it. A keyboard walking
     the links still stops it, since the focused pill must stay put. */
  let pressed = false;                // a finger on the row
  let quietUntil = 0;                 // no drift before this moment
  const rest = (ms = 1200) => { quietUntil = performance.now() + ms; };

  /* On the whole strip, not just the scroller: a finger lands on a
     pill, and a listener bound to the scroller alone never hears it. */
  strip.addEventListener("touchstart", () => { pressed = true; }, { passive: true });
  for (const end of ["touchend", "touchcancel"])
    strip.addEventListener(end, () => { pressed = false; rest(); }, { passive: true });

  const keyboardInside = () => {
    const f = document.activeElement;
    if (!f || f === document.body || !strip.contains(f)) return false;
    try { return f.matches(":focus-visible"); } catch { return false; }
  };

  /* Where the row really is.
   *
   * scrollLeft is rounded to whole pixels by the browser, so the row
   * could only move a pixel every few frames — a visible stutter. The
   * true position is kept here as a number; scrollLeft takes the whole
   * pixels and the pills are shifted by the fraction left over, so the
   * glide is as smooth as the screen can draw it. */
  let at = 0;
  const put = () => {
    box.scrollLeft = at;             // rounded on the way in
    mine = box.scrollLeft;           // what the browser settled on
    const sub = mine - at;           // under a pixel, either way
    box.style.setProperty("--sub", Math.abs(sub) < 0.01 ? "0px" : `${sub.toFixed(2)}px`);
  };

  /* Keep the position inside the first copy, whichever way it moved.
     At the very start it counts as the end of the first copy — the same
     picture — so there is always room to go left as well as right. */
  const wrap = () => {
    const one = lap();
    if (one < 1) return;
    while (at >= one) at -= one;
    while (at < 1) at += one;
  };

  /* Somebody scrolled it themselves — a swipe, a wheel, a drag. Take
     their position as the new truth, and if it has reached a join, move
     it back across to the same picture in the other copy. Only noting
     the position, as this once did, let a swipe run to the end of the
     second copy and stop dead: that was the row "going back to the
     first" instead of carrying on round. Returns how far it moved. */
  const follow = () => {
    at = box.scrollLeft;
    const was = at;
    wrap();
    if (Math.abs(at - was) > 0.5) box.scrollLeft = at;
    mine = box.scrollLeft;
    box.style.setProperty("--sub", "0px");
    rest();                          // let a swipe's momentum run out first
    return at - was;
  };

  /* An arrow press: a quick glide of most of a screen, animated here
     rather than by the browser's smooth scroll, so that it wraps at the
     join like everything else. The browser's glide ran into the end of
     the second copy and stopped, so pressing on went nowhere. */
  let gliding = 0;

  function nudge(by){
    if (lap() < 1) return;
    const from = at, t0 = performance.now(), run = ++gliding;
    const dur = calm.matches ? 0 : 420;
    const step = now => {
      if (run !== gliding) return;               // a newer press took over
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      at = from + by * (1 - Math.pow(1 - k, 3)); // ease out
      wrap();
      put();
      if (k < 1) requestAnimationFrame(step);
      else { gliding = 0; rest(1500); }          // a moment to read it
    };
    requestAnimationFrame(step);
  }

  let last = 0;
  function tick(now){
    /* A redraw replaces the strip, and a new one starts its own drift.
       This one's box is then out of the page: stop, rather than go on
       running a frame loop for nothing for as long as the tab is open. */
    if (!box.isConnected) return;
    /* Frames are not evenly spaced, and a tab that was in the
       background hands back one enormous gap; 50ms caps the jump. */
    const gap = Math.min(now - last, 50);
    last = now;

    if (!pressed && !gliding && now >= quietUntil
        && !calm.matches && !document.hidden
        && !box.classList.contains("dragging")
        && !keyboardInside()){
      at += DRIFT * gap / 1000;
      wrap();
      put();
    }
    requestAnimationFrame(tick);
  }

  /* Images decide the row's width, so the first lap is measured once
     they have loaded rather than from an empty box. */
  requestAnimationFrame(t => { last = t; tick(t); });
  addEventListener("load", paint, { once: true });

  /* ---------------------------- dragging --------------------------- */

  /* Touch and trackpads already scroll this; a mouse has nothing to
     throw at it, so the strip can be dragged. `moved` is what stops a
     drag that happens to end on a pill from also following it. */
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
    // Crossing a join moves the row a copy; move the drag's anchor with it.
    startLeft += follow();
  });

  const stop = () => {
    if (down) rest();
    down = false; box.classList.remove("dragging");
  };
  box.addEventListener("pointerup", stop);
  box.addEventListener("pointerleave", stop);
  box.addEventListener("click", e => { if (moved) e.preventDefault(); }, true);

  /* A swipe, a wheel or an arrow can also cross the seam.
   *
   * Only a move this code did not make is worth following. The drift
   * writes scrollLeft every frame and the browser rounds it, so the two
   * always differ by under a pixel — reading that back as "somebody
   * moved it" pinned the row to one spot for good. A person's scroll
   * jumps much further than a frame's third of a pixel, so 6px tells
   * the two apart. */
  let mine = 0;                 // the last value this code wrote

  box.addEventListener("scroll", () => {
    if (Math.abs(box.scrollLeft - mine) > 6) follow();
  }, { passive: true });
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
function tileHTML(href, img, name, count, extra = "", still = ""){
  /* An animated picture carries a still frame too, shown instead to
     anyone whose device is set to reduce motion. */
  const pic = `<img src="${esc(img)}" alt="${esc(name)}"
             loading="lazy" width="400" height="400" ${IMG_FALLBACK}>`;
  return `
    <a href="${href}" class="cat-tile${extra}">
      <div class="cat-tile-img">
        ${still ? `<picture>
          <source srcset="${esc(still)}" media="(prefers-reduced-motion: reduce)">
          ${pic}</picture>` : pic}
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
        s.href, s.img, s[lang] || s.en, shelfCount(s),
        ` is-shelf is-${s.id}`, s.still)).join("")}
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
