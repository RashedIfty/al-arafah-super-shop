/**
 * How to order: the ? button in the corner, and the guide it opens.
 *
 * Ten steps, from tapping Add to the order being placed, each with a
 * picture of the real shop on a phone and the button to press ringed in
 * gold. The pictures are per language, so the words in them match the
 * words under them. They live in /images/tutorial as {lang}-{step}.webp
 * and are only fetched when someone opens the guide.
 *
 * The pictures are screenshots: if a button's wording or place changes,
 * they go stale and should be taken again.
 *
 * Built once and kept in <body> rather than drawn by render(), which
 * replaces what it draws — the guide must not vanish from under someone
 * reading it because the basket count changed.
 */
import { t, getLang } from "../../features/i18n/lang.js";
import { esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";

const STEPS = 10;
const IMG = (l, n) => `images/tutorial/${l}-${n}.webp`;

let step = 1;
let fab = null, wrap = null;
let opener = null;     // what had focus before opening, to give it back
let paintedIn = "";    // the language the open guide was drawn in

const current = () => (["en", "bn", "ja"].includes(getLang()) ? getLang() : "en");

function paint(){
  if (!wrap || wrap.hidden) return;
  const T = t(), L = current(), last = step === STEPS;
  paintedIn = L;

  wrap.innerHTML = `
    <div class="tut-card" role="dialog" aria-modal="true" aria-labelledby="tutH">
      <div class="tut-top">
        <b id="tutH">${esc(T.tut_h)}</b>
        <span class="tut-count">${esc(T.tut_step.replace("{n}", step).replace("{t}", STEPS))}</span>
        <button type="button" class="tut-x" data-tut="close" aria-label="${esc(T.tut_close)}">
          ${icon("close", { size: 18 })}</button>
      </div>

      <figure class="tut-shot">
        <img src="${IMG(L, step)}" width="640" height="755" alt="${esc(T["tut_" + step + "h"])}">
      </figure>

      <div class="tut-text">
        <h3><span class="tut-n">${step}</span>${esc(T["tut_" + step + "h"])}</h3>
        <p>${esc(T["tut_" + step])}</p>
      </div>

      <div class="tut-dots" aria-hidden="true">
        ${Array.from({ length: STEPS }, (_, i) =>
          `<i class="${i + 1 === step ? "on" : ""}"></i>`).join("")}
      </div>

      <div class="tut-acts">
        <button type="button" class="btn btn-out" data-tut="prev" ${step === 1 ? "disabled" : ""}>
          ${esc(T.tut_prev)}</button>
        <button type="button" class="btn btn-red" data-tut="${last ? "close" : "next"}">
          ${esc(last ? T.tut_done : T.tut_next)}</button>
      </div>
    </div>`;

  // The next picture, fetched while this one is being read.
  if (!last) new Image().src = IMG(L, step + 1);
}

function go(n){
  const to = Math.min(STEPS, Math.max(1, n));
  if (to === step) return;
  step = to;
  paint();
  // Keep the keyboard where the hand is: on the forward button.
  wrap.querySelector('[data-tut="next"], .tut-acts .btn-red')?.focus();
}

function open(){
  opener = document.activeElement;
  step = 1;
  wrap.hidden = false;
  document.documentElement.classList.add("tut-lock");
  paint();
  wrap.querySelector(".tut-acts .btn-red")?.focus();
}

function close(){
  wrap.hidden = true;
  wrap.innerHTML = "";
  document.documentElement.classList.remove("tut-lock");
  // Back where the reader was. A tap does not always focus what it
  // taps (Safari never does), and then that is the ? itself.
  const back = opener && opener !== document.body && document.contains(opener) ? opener : fab;
  back?.focus();
}

/** The label on the ? button, in the language of the page. */
function label(){
  const T = t();
  fab.setAttribute("aria-label", T.tut_open);
  fab.title = T.tut_open;
}

/**
 * Called on every render: the first call builds and binds, later ones
 * only bring the words up to date with the language.
 */
export function initTutorial(){
  // Redrawn only for a new language: render() runs on every basket
  // change, and redrawing each time would knock focus off the buttons.
  if (fab){ label(); if (current() !== paintedIn) paint(); return; }

  fab = document.createElement("button");
  fab.type = "button";
  fab.className = "tut-fab";
  fab.innerHTML = `<span aria-hidden="true">?</span>`;
  fab.addEventListener("click", open);

  wrap = document.createElement("div");
  wrap.className = "tut-wrap";
  wrap.hidden = true;

  document.body.append(fab, wrap);
  label();

  wrap.addEventListener("click", e => {
    const act = e.target.closest("[data-tut]")?.dataset.tut;
    if (act === "next") go(step + 1);
    else if (act === "prev") go(step - 1);
    else if (act === "close") close();
    else if (e.target === wrap) close();          // the dimmed backdrop
  });

  document.addEventListener("keydown", e => {
    if (wrap.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") go(step + 1);
    else if (e.key === "ArrowLeft") go(step - 1);
    else if (e.key === "Tab"){
      // Keep Tab inside the guide while it is open.
      const f = [...wrap.querySelectorAll("button:not([disabled])")];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }
  });

  // A swipe across the picture turns the page, as people expect on a phone.
  let x0 = null, y0 = null;
  wrap.addEventListener("touchstart", e => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) go(step + (dx < 0 ? 1 : -1));
  }, { passive: true });
}
