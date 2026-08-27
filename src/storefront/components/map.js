/**
 * Shop location — an embedded Google map with the address beside it.
 *
 * The iframe is lazy-loaded so it does not delay the rest of the page,
 * and carries a title for screen readers.
 */
import { esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { t, getLang } from "../../features/i18n/lang.js";
import { SHOP } from "../../shared/shop.js";

export function mapHTML(){
  const T = t(), lang = getLang();

  return `
    <div class="map-card">
      <div class="map-frame">
        <iframe
          src="${esc(SHOP.map.embed)}"
          title="${esc(SHOP.name)} ${esc(SHOP.name2)} on Google Maps"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen></iframe>
      </div>

      <div class="map-info">
        <h3>${esc(SHOP.name)} ${esc(SHOP.name2)}</h3>

        <div class="map-row">
          <i>${icon("pin", { size: 18 })}</i>
          <span>${esc(SHOP.address[lang])}</span>
        </div>

        <div class="map-row">
          <i>${icon("clock", { size: 18 })}</i>
          <span>${esc(T.daily)} · ${esc(SHOP.hours)}</span>
        </div>

        <div class="map-row">
          <i>${icon("phone", { size: 18 })}</i>
          <a href="tel:${esc(SHOP.telRaw)}">${esc(SHOP.tel)}</a>
        </div>

        <a class="btn btn-red map-go" href="${esc(SHOP.map.link)}"
           target="_blank" rel="noopener">
          ${icon("pin", { size: 16 })} ${esc(T.map_directions)}
        </a>
      </div>
    </div>`;
}
