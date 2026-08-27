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

        <div class="ann-scroll">
          <div class="ann-row">${items.map(itemHTML).join("")}</div>
        </div>
      </div>
    </div>`;
}

/** Show the section whenever the admin has items configured. */
export function initAnnounceBar(){
  const bar = document.getElementById("announce");
  if (bar) bar.hidden = !hasAnnouncements();
}
