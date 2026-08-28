/**
 * Countrywise browsing.
 *
 * Two views on one page, chosen by the address:
 *   countries.html          — a tile per country that has products
 *   countries.html#bd       — everything from that country
 *
 * A country with nothing in it never appears, so the customer can never
 * land on an empty page. Countries come and go on their own as the owner
 * sets or clears the country on a product; there is nothing to maintain.
 */
import { esc } from "../../shared/lib/dom.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";
import { countriesInUse, productsFrom, countryById, countryName }
  from "../../features/catalog/countries.js";
import { flag } from "../../features/catalog/flags.js";
import { cardHTML } from "./product-card.js";
import { icon } from "../../shared/ui/icons.js";

/** The country id in the address, or "" for the country list. */
export const currentCountry = () =>
  decodeURIComponent(location.hash.replace(/^#/, "")).trim();

/** Grid of countries that have products. */
function countryTilesHTML(){
  const T = t(), lang = getLang();
  const list = countriesInUse(CATALOG);

  if (!list.length){
    return `
      <p class="empty">
        <b>${esc(T.ctry_none)}</b>
        <span>${esc(T.ctry_none_s)}</span>
      </p>`;
  }

  return `
    <div class="ctry-grid">
      ${list.map(c => `
        <a href="#${esc(c.id)}" class="ctry-tile">
          <div class="ctry-tile-img">
            ${flag(c.id, { size: 96 })}
          </div>
          <b>${esc(c[lang] || c.en)}</b>
          <span>${esc(itemCount(c.count))}</span>
        </a>`).join("")}
    </div>`;
}

/** Every product from one country, grouped by its normal category. */
function oneCountryHTML(countryId){
  const T = t(), lang = getLang();
  const country = countryById(countryId);

  // An address for a country with nothing in it: show the list instead
  // of an empty page.
  if (!country || !productsFrom(CATALOG, countryId).length)
    return countryTilesHTML();

  const name = countryName(countryId, lang);

  // Keep the shop's own category order rather than inventing one, and
  // carry each product's real position: the lightbox looks items up by
  // category and product index, so renumbering here would open the
  // wrong photo.
  const groups = CATALOG
    .map((cat, ci) => ({
      cat, ci,
      items: cat.items
        .map((p, pi) => ({ p, pi }))
        .filter(x => x.p.country === countryId),
    }))
    .filter(g => g.items.length);

  return `
    <div class="ctry-head">
      <a href="#" class="ctry-back">${icon("arrow", { size: 16 })} ${esc(T.ctry_back)}</a>
      ${flag(countryId, { size: 34 })}
      <h2>${esc((T.ctry_from || "").replace("{c}", name))}</h2>
    </div>

    ${groups.map(g => `
      <section class="sec" id="ctry-${esc(g.cat.id)}">
        <div class="wrap sec-head">
          <h3>${esc(g.cat[lang] || g.cat.en)}</h3>
          <span>${esc(itemCount(g.items.length))}</span>
        </div>
        <div class="wrap grid">
          ${g.items.map(x => cardHTML(x.p, g.cat, g.ci, x.pi)).join("")}
        </div>
      </section>`).join("")}`;
}

/** Whichever view the address asks for. */
export function countriesHTML(){
  const id = currentCountry();
  return id ? oneCountryHTML(id) : countryTilesHTML();
}

/**
 * Repaint on hash change, so back and forward work as expected.
 *
 * render() runs again whenever the language changes or live data lands,
 * so the listener is attached once rather than on every pass.
 */
let listening = false;

export function initCountries(mount){
  if (!mount || listening) return;
  listening = true;

  window.addEventListener("hashchange", () => {
    const el = document.querySelector("#countryMount");
    if (!el) return;
    el.innerHTML = countriesHTML();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}
