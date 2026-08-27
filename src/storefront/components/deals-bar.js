/**
 * Today's Deal / New Arrival bar — sits at the very top of every page.
 * Content comes from data/announcements.js, which the shop admin edits.
 */
import { esc } from "../../shared/lib/dom.js";
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

  const label = item.type === "deal"
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
        <img src="${esc(img)}" alt="${esc(name)}"
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

  const deals = items.filter(i => i.type === "deal").length;
  const news  = items.filter(i => i.type === "new").length;

  /* Summary line: "3 new arrivals · 2 today's deals" */
  const summary = [
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
export function initDealsCarousel(){
  const rail = document.getElementById("annScroll");
  if (!rail) return;

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

  /* Scroll so that `slide` sits in the middle of the rail. */
  function centre(slide, smooth){
    const el = slides[slide];
    if (!el) return;
    rail.scrollTo({
      left: el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2,
      behavior: smooth ? "smooth" : "auto"
    });
  }

  /**
   * Show real card `i`. Values outside 0..real-1 scroll onto a clone
   * first, then snap back to the equivalent real card once the animation
   * has finished, so the wrap is never visible.
   */
  function goTo(i, smooth = true){
    const wrapped = (i + real) % real;

    if (smooth && (i < 0 || i >= real)){
      centre(slideOf(i), true);            // glide onto the clone
      index = wrapped;
      paint();

      jumping = true;
      setTimeout(() => {
        centre(slideOf(wrapped), false);   // silent jump to the real one
        jumping = false;
      }, 480);                             // just after the smooth scroll
      return;
    }

    index = wrapped;
    centre(slideOf(index), smooth);
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
    rail.addEventListener(ev, hold, { passive: true }));
  ["mouseleave", "focusout", "touchend", "touchcancel"].forEach(ev =>
    rail.addEventListener(ev, release, { passive: true }));

  // Stop entirely when the section is off screen or the tab is hidden.
  if ("IntersectionObserver" in window){
    new IntersectionObserver(([e]) => e.isIntersecting ? start() : stop(),
      { threshold: 0.25 }).observe(rail);
  } else {
    start();
  }
  document.addEventListener("visibilitychange", () =>
    document.hidden ? stop() : start());

  /* ---------------------------- controls -------------------------- */

  prev?.addEventListener("click", () => { goTo(index - 1); start(); });
  next?.addEventListener("click", () => { goTo(index + 1); start(); });

  dots?.addEventListener("click", e => {
    const d = e.target.closest("[data-go]");
    if (d){ goTo(+d.dataset.go); start(); }
  });

  rail.addEventListener("keydown", e => {
    if (e.key === "ArrowRight"){ e.preventDefault(); goTo(index + 1); start(); }
    if (e.key === "ArrowLeft"){  e.preventDefault(); goTo(index - 1); start(); }
  });

  /* A manual swipe should update which card counts as centred. */
  let raf;
  rail.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (jumping) return;                 // our own repositioning
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      let closest = 0, best = Infinity;
      slides.forEach((el, n) => {
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (d < best){ best = d; closest = n; }
      });
      const asReal = ((closest - copy) % real + real) % real;
      if (asReal !== index){ index = asReal; paint(); }
    });
  }, { passive: true });

  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => goTo(index, false), 120);
  });

  // Start centred rather than flush left.
  requestAnimationFrame(() => goTo(0, false));
}
