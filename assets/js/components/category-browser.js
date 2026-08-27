/**
 * Category browser — sidebar list plus a grid of large photo tiles,
 * the layout used by most halal grocery storefronts.
 */
import { esc } from "../core/dom.js";
import { t, getLang } from "../core/lang.js";
import { CATALOG } from "../data/catalog.js";

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

/** Large photo tiles on the right. */
export function categoryTilesHTML(){
  const T = t(), lang = getLang(), base = prefix();

  return `
    <div class="cat-tiles">
      ${CATALOG.filter(c => c.items.length).map(cat => `
        <a href="${base}#${esc(cat.id)}" class="cat-tile">
          <div class="cat-tile-img">
            <img src="${esc(cat.img)}" alt="${esc(cat[lang])}"
                 loading="lazy" width="400" height="400">
          </div>
          <b>${esc(cat[lang])}</b>
          <span>${cat.items.length} ${esc(T.items)}</span>
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
