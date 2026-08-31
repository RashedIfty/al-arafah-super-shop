/**
 * Lightbox — tap a deal or product card to see the photo large.
 *
 * Mounted once per page; opened by passing an item. Closes on backdrop click,
 * the close button, or Escape, and restores focus to whatever opened it.
 */
import { $, esc, IMG_FALLBACK } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t, getLang } from "../../features/i18n/lang.js";
import { yen, discount } from "../../shared/lib/format.js";
import { SHOP } from "../../shared/shop.js";

let opener = null;   // element to refocus on close

/** The empty shell — content is filled on open. */
export function lightboxHTML(){
  return `
    <div class="lb" id="lb" hidden>
      <div class="lb-backdrop" data-close></div>
      <div class="lb-box" role="dialog" aria-modal="true" aria-labelledby="lbTitle">
        <button class="lb-close" data-close aria-label="Close">${icon("close",{size:22})}</button>
        <div class="lb-body" id="lbBody"></div>
      </div>
    </div>`;
}

/** Fill and show. `item` is a catalogue product or an announcement item. */
export function openLightbox(item, opts = {}){
  const box = $("#lb");
  if (!box) return;

  const T = t(), lang = getLang();
  const name = item[lang] || item.en;
  const img  = item.img || SHOP.placeholder;
  const off  = discount(item.was, item.p);

  // The two names we are not showing as the title.
  const alt = ["en", "bn", "ja"]
    .filter(l => l !== lang)
    .map(l => item[l])
    .filter(Boolean)
    .join(" · ");

  const badge = item.type === "deal" ? `<span class="lb-tag deal">${esc(T.ann_deal)}</span>`
              : item.type === "new"  ? `<span class="lb-tag new">${esc(T.ann_new)}</span>`
              : opts.category        ? `<span class="lb-tag cat">${esc(opts.category)}</span>`
              : "";

  $("#lbBody").innerHTML = `
    <figure class="lb-fig">
      ${off ? `<span class="lb-off">-${off}% ${esc(T.off)}</span>` : ""}
      <img src="${esc(img)}" alt="${esc(name)}" ${IMG_FALLBACK}>
    </figure>
    <div class="lb-info">
      ${badge}
      <h3 id="lbTitle">${esc(name)}</h3>
      ${alt ? `<p class="lb-alt">${esc(alt)}</p>` : ""}
      <div class="lb-meta">
        <span class="lb-w">${esc(item.w || "")}</span>
        ${item.tag === "in"  ? `<span class="card-stock in">${esc(T.in_stock)}</span>` : ""}
        ${item.tag === "out" ? `<span class="card-stock out">${esc(T.out_stock)}</span>` : ""}
      </div>
      <div class="lb-price">
        <span class="now">${yen(item.p)}</span>
        ${item.was ? `<span class="was">${yen(item.was)}</span>` : ""}
      </div>
      <p class="lb-tax">${esc(T.withtax)}</p>
      <a href="tel:${esc(SHOP.telRaw)}" class="btn btn-red lb-call">
        ${icon("phone",{size:16})} ${esc(T.callOrder)} · ${esc(SHOP.tel)}
      </a>
    </div>`;

  opener = document.activeElement;
  box.hidden = false;
  document.body.style.overflow = "hidden";      // stop the page scrolling behind
  box.querySelector(".lb-close")?.focus();
}

export function closeLightbox(){
  const box = $("#lb");
  if (!box || box.hidden) return;

  box.hidden = true;
  document.body.style.overflow = "";
  opener?.focus?.();
  opener = null;
}

/**
 * Wire it up. Delegated, so it keeps working after a re-render.
 * `resolve(el)` maps a clicked card back to its data object.
 */
export function initLightbox(resolve){
  // open
  document.addEventListener("click", e => {
    const card = e.target.closest("[data-lb]");
    if (!card) return;
    const item = resolve(card);
    if (item) {
      e.preventDefault();
      openLightbox(item, { category: card.dataset.lbCat });
    }
  });

  // close
  document.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) closeLightbox();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeLightbox(); return; }

    // Enter / Space opens the focused card.
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest?.("[data-lb]");
    if (!card) return;
    const item = resolve(card);
    if (item){
      e.preventDefault();
      openLightbox(item, { category: card.dataset.lbCat });
    }
  });
}
