/**
 * Today's Deal / New Arrival bar — sits at the very top of every page.
 * Content comes from data/announcements.js, which the shop admin edits.
 */
import { esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t, getLang } from "../../features/i18n/lang.js";
import { yen, discount } from "../../shared/lib/format.js";
import { ANNOUNCEMENTS } from "../../features/deals/deals.js";
import { SHOP } from "../../shared/shop.js";

/** True when the bar should be shown at all. */
export const hasAnnouncements = () =>
  ANNOUNCEMENTS.ACTIVE && ANNOUNCEMENTS.items?.length > 0;

/** One item card — large photo on top, name and price below. */
function itemHTML(item, index){
  const T = t(), lang = getLang();
  const off = discount(item.was, item.p);

  const label = item.type === "offer"
    ? `<span class="ann-tag offer">${esc(T.ann_offer)}</span>`
    : item.type === "deal"
    ? `<span class="ann-tag deal">${esc(T.ann_deal)}</span>`
    : `<span class="ann-tag new">${esc(T.ann_new)}</span>`;

  const name = item[lang] || item.en;
  const img  = item.img || SHOP.placeholder;

  return `
    <article class="ann-item ${esc(item.type)}" data-lb data-lb-i="${index}"
             tabindex="0" role="button">
      <div class="ann-img">
        ${label}
        ${off ? `<span class="ann-off">-${off}%</span>` : ""}
        <img src="${esc(img)}" alt="${esc(name)}" ${IMG_FALLBACK}
             loading="lazy" width="400" height="400">
      </div>
      <div class="ann-tx">
        <b>${esc(name)}</b>
        <span class="ann-w">${esc(item.w || "")}</span>
        <div class="ann-price">
          <span class="now">${yen(item.p)}</span>
          ${item.was ? `<span class="was">${yen(item.was)}</span>` : ""}
        </div>
      </div>
    </article>`;
}

/** The whole bar. Returns "" when the admin has switched it off. */
export function announceBarHTML(){
  if (!hasAnnouncements()) return "";

  const T = t(), lang = getLang();
  const { items, updated } = ANNOUNCEMENTS;

  const offers = items.filter(i => i.type === "offer").length;
  const deals  = items.filter(i => i.type === "deal").length;
  const news   = items.filter(i => i.type === "new").length;

  /* Summary line: "2 special offers · 3 new arrivals · 2 today's deals" */
  const summary = [
    offers ? `${offers} ${esc(T.ann_offer_n)}` : "",
    news  ? `${news} ${esc(T.ann_new_n)}`   : "",
    deals ? `${deals} ${esc(T.ann_deal_n)}` : ""
  ].filter(Boolean).join(" · ");

  return `
    <div class="ann">
      <div class="wrap ann-in">
        <div class="ann-head">
          <span class="ann-star">${icon("star",{size:18})}</span>
          <div>
            <h2>${esc(T.ann_title)}</h2>
            <p>${summary}${summary ? " · " : ""}${esc(updated?.[lang] || "")}</p>
          </div>
        </div>

        <div class="ann-carousel">
          <button class="ann-nav prev" id="annPrev" type="button"
                  aria-label="${esc(T.ann_prev)}">${icon("up",{size:20})}</button>

          <div class="ann-scroll" id="annScroll" tabindex="0" role="region"
               aria-label="${esc(T.ann_title)}">
            <div class="ann-row">${items.map(itemHTML).join("")}</div>
          </div>

          <button class="ann-nav next" id="annNext" type="button"
                  aria-label="${esc(T.ann_next)}">${icon("up",{size:20})}</button>
        </div>

        <div class="ann-dots" id="annDots"></div>
      </div>
    </div>`;
}

/** Show the section whenever the admin has items configured. */
export function initAnnounceBar(){
  const bar = document.getElementById("announce");
  if (bar) bar.hidden = !hasAnnouncements();
}

/* ----------------------------- carousel ------------------------------ */

/**
 * One card centred at a time, its neighbours peeking blurred at the
 * edges. Advances on its own, pausing while the customer is interacting
 * so it never slides out from under a tap.
 */
/* The carousel that is running, as a way to stop it. */
let stopCarousel = null;

export function initDealsCarousel(){
  /* render() calls this again whenever it redraws — the catalogue
     arriving, the language, the basket — and each call used to start a
     second carousel without stopping the first. The old one kept its own
     timer and listeners and a list of copies that had since been taken
     out of the page; steering by those, it dragged the strip back across
     every card towards the start, which is what the owner saw instead of
     a loop. Now the previous one is stopped completely before anything
     is set up. */
  stopCarousel?.();
  stopCarousel = null;

  const rail = document.getElementById("annScroll");
  if (!rail) return;

  const ac = new AbortController();
  const on = (el, ev, fn, opts = {}) =>
    el?.addEventListener(ev, fn, { ...opts, signal: ac.signal });

  /* render() runs again whenever the language, basket or session
     changes, and this used to clone the cards on top of the clones it
     made last time — six became twelve became eighteen. Anything left
     from a previous run goes first. */
  rail.querySelectorAll('.ann-item[data-clone]').forEach(el => el.remove());

  const cards = [...rail.querySelectorAll(".ann-item")];
  if (!cards.length) return;

  const prev = document.getElementById("annPrev");
  const next = document.getElementById("annNext");
  const dots = document.getElementById("annDots");

  // Nothing to rotate through with a single card.
  if (cards.length < 2){
    document.getElementById("annPrev")?.remove();
    document.getElementById("annNext")?.remove();
    cards[0].classList.add("is-active");
    return;
  }

  const DWELL = 2000;      // how long each card stays centred
  const real  = cards.length;

  /* --------------------------- looping ----------------------------
     Without clones the first card has empty space to its left and the
     last has empty space to its right, which looks broken mid-rotation.
     Copying a few cards onto each end means a neighbour is always
     visible; when the scroll reaches a clone we jump silently back to
     the matching real card.
     ---------------------------------------------------------------- */
  const row  = rail.querySelector(".ann-row");
  const copy = Math.min(real, 3);          // enough to fill the edges

  for (let i = 0; i < copy; i++){
    const head = cards[i].cloneNode(true);
    const tail = cards[real - 1 - i].cloneNode(true);
    head.dataset.clone = "1";
    tail.dataset.clone = "1";
    row.appendChild(head);                 // copies of the first cards, at the end
    row.insertBefore(tail, row.firstChild); // copies of the last cards, at the start
  }

  /* All slides, clones included. Real card n lives at slide n + copy. */
  const slides = [...row.querySelectorAll(".ann-item")];
  const slideOf = i => i + copy;

  let index = 0;           // which REAL card is centred
  let timer = null;
  let held = false;        // true while hovering, focused or touching
  let jumping = false;     // suppress the scroll handler during a silent jump

  /* Room at both ends of the row, half the rail wide, so that every
     slide — the copies at the ends included — can be brought to the
     middle. Without it the rail ran out of scroll before the copies
     after the last card could be centred: the strip stopped on the last
     card and then went back to the first, which is exactly what the loop
     exists to avoid. */
  const pad = () => {
    const half = Math.ceil(rail.clientWidth / 2) + "px";
    row.style.paddingLeft = row.style.paddingRight = half;
  };
  pad();

  /* Where the rail must be for `slide` to sit in its middle. Measured
     against the rail itself: offsetLeft counts from the carousel around
     it, arrows and all, which put every card a little off centre. */
  const leftOf = slide => {
    const el = slides[slide];
    if (!el) return null;
    const r = rail.getBoundingClientRect(), e = el.getBoundingClientRect();
    return rail.scrollLeft + (e.left - r.left) - (rail.clientWidth - e.width) / 2;
  };

  /**
   * Scroll so that `slide` sits in the middle of the rail.
   *
   * The glide is animated here rather than left to the browser's smooth
   * scroll. How long that takes varies by phone, and the loop has to
   * know when the glide has finished to swap a copy for the real card:
   * guessing wrong is what made the strip slide back across every card
   * to the first instead of carrying on round. Snapping is switched off
   * for the moment the strip is being moved by code, or it pulls each
   * frame back to the nearest card; it is back on for swipes.
   */
  let glide = 0;
  function centre(slide, smooth){
    const to = leftOf(slide);
    if (to === null) return;
    const run = ++glide;
    rail.style.scrollSnapType = "none";

    const done = () => {
      if (run !== glide) return;
      rail.style.scrollSnapType = "";
      gliding = false;
      settle();
    };

    if (!smooth || calm.matches){
      rail.scrollLeft = to;
      requestAnimationFrame(done);
      return;
    }

    gliding = true;
    const from = rail.scrollLeft, t0 = performance.now(), DUR = 460;
    const step = now => {
      if (run !== glide) return;           // a newer move took over
      const k = Math.min(1, (now - t0) / DUR);
      const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      rail.scrollLeft = from + (to - from) * e;
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  }
  let gliding = false;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  /**
   * Show real card `i`. Past either end it glides onto the copy of the
   * card it wraps to, and settle() swaps the copy for the real card once
   * the strip has stopped moving — so the loop runs on round, never
   * sliding back across every card to the start.
   *
   * The swap used to fire on a fixed 480ms timer. A phone's smooth
   * scroll can take longer than that, so the jump landed mid-glide and
   * was lost, and the next step slid the whole way back from the end.
   */
  function goTo(i, smooth = true){
    index = (i + real) % real;
    centre(smooth && (i < 0 || i >= real) ? slideOf(i) : slideOf(index), smooth);
    paint();
  }

  /** The slide nearest the middle of the strip. */
  function centredSlide(){
    const r = rail.getBoundingClientRect();
    const mid = r.left + rail.clientWidth / 2;
    let closest = 0, best = Infinity;
    slides.forEach((el, n) => {
      const e = el.getBoundingClientRect();
      const d = Math.abs(e.left + e.width / 2 - mid);
      if (d < best){ best = d; closest = n; }
    });
    return closest;
  }

  /**
   * Once the strip has come to rest: if a copy is in the middle, put the
   * real card there instead, in one unseen jump (the two look the same).
   * Covers the automatic steps, the arrows and a swipe alike, so the
   * strip can be turned round and round in either direction.
   */
  function settle(){
    if (jumping || gliding) return;
    const n = centredSlide();
    const asReal = ((n - copy) % real + real) % real;
    if (slides[n]?.dataset.clone){
      jumping = true;
      rail.style.scrollSnapType = "none";
      rail.scrollLeft = leftOf(slideOf(asReal));
      requestAnimationFrame(() => {
        rail.style.scrollSnapType = "";
        requestAnimationFrame(() => { jumping = false; });
      });
    }
    index = asReal;
    paint();
  }

  /* Dots are built once; rebuilding them on every scroll frame froze the
     page, since a smooth scroll fires ~60 times a second. */
  if (dots){
    dots.innerHTML = cards.map((_, i) =>
      `<button class="ann-dot" type="button" data-go="${i}"
               aria-label="Item ${i + 1}"></button>`).join("");
  }
  const dotEls = dots ? [...dots.children] : [];

  /* Mark the centred card. Only toggles classes - no DOM rebuilding. */
  function paint(){
    slides.forEach((el, n) => {
      // A slide is active if it represents the current real card.
      const isReal = ((n - copy) % real + real) % real === index;
      el.classList.toggle("is-active", isReal);
    });
    dotEls.forEach((d, i) => d.classList.toggle("on", i === index));
  }

  /* ------------------------- auto-advance ------------------------- */

  const stop  = () => { clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (cards.length < 2) return;
    timer = setInterval(() => { if (!held) goTo(index + 1); }, DWELL);
  };

  const hold    = () => { held = true; };
  const release = () => { held = false; };

  ["mouseenter", "focusin", "touchstart"].forEach(ev =>
    on(rail, ev, hold, { passive: true }));
  ["mouseleave", "focusout", "touchend", "touchcancel"].forEach(ev =>
    on(rail, ev, release, { passive: true }));

  // Stop entirely when the section is off screen or the tab is hidden.
  let seen = null;
  if ("IntersectionObserver" in window){
    seen = new IntersectionObserver(([e]) => e.isIntersecting ? start() : stop(),
      { threshold: 0.25 });
    seen.observe(rail);
  } else {
    start();
  }
  on(document, "visibilitychange", () =>
    document.hidden ? stop() : start());

  /* ---------------------------- controls -------------------------- */

  on(prev, "click", () => { goTo(index - 1); start(); });
  on(next, "click", () => { goTo(index + 1); start(); });

  on(dots, "click", e => {
    const d = e.target.closest("[data-go]");
    if (d){ goTo(+d.dataset.go); start(); }
  });

  on(rail, "keydown", e => {
    if (e.key === "ArrowRight"){ e.preventDefault(); goTo(index + 1); start(); }
    if (e.key === "ArrowLeft"){  e.preventDefault(); goTo(index - 1); start(); }
  });

  /* While it moves, keep the dot on the card in the middle; once it has
     stopped — scrollend where the browser has it, a short quiet spell
     where it does not — settle(). */
  let raf, quiet;
  on(rail, "scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (jumping || gliding) return;      // our own repositioning
      const asReal = ((centredSlide() - copy) % real + real) % real;
      if (asReal !== index){ index = asReal; paint(); }
    });
    if (gliding || jumping) return;        // centre() settles when it is done
    clearTimeout(quiet);
    quiet = setTimeout(settle, 160);
  }, { passive: true });
  on(rail, "scrollend", () => { clearTimeout(quiet); settle(); });

  let resizeTimer;
  on(window, "resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { pad(); goTo(index, false); }, 120);
  });

  // Start centred rather than flush left.
  requestAnimationFrame(() => { if (!ac.signal.aborted) goTo(0, false); });

  stopCarousel = () => {
    ac.abort();                  // every listener above
    stop();                      // the timer
    seen?.disconnect();
    glide++;                     // any glide in flight stops at its next frame
    clearTimeout(quiet); clearTimeout(resizeTimer);
    cancelAnimationFrame(raf);
  };
}
