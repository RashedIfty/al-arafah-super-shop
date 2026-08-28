/**
 * AL-ARAFAH SUPER SHOP — application entry point.
 *
 * Mounts shared chrome and page content, then re-renders everything whenever
 * the language changes. Every page loads this one module.
 */
import { $, $$, put, esc, on, scrollToId } from "../shared/lib/dom.js";
import { t, setLang, onLangChange, initLang } from "../features/i18n/lang.js";
import { todayIndex } from "../shared/lib/format.js";
import { topbarHTML, headerHTML, navHTML, footerHTML } from "./components/chrome.js";
import { announceBarHTML, initAnnounceBar, initDealsCarousel } from "./components/deals-bar.js";
import { announcementHTML, setAnnouncement } from "./components/announcement.js";
import { lightboxHTML, initLightbox } from "./components/lightbox.js";
import { mapHTML } from "./components/map.js";
import { initSearchBox } from "./components/search-box.js";
import { filtersHTML, initFilters } from "./components/filters.js";
import { catalogHTML, chipsHTML } from "./components/product-card.js";
import { categoryBrowserHTML } from "./components/category-browser.js";
import { countriesHTML, initCountries } from "./components/countries.js";
import { initSearch, initScrollSpy, initBackToTop, sortBy } from "./components/search.js";
import { CATALOG, refreshCatalog } from "../features/catalog/catalog.js";
import { ANNOUNCEMENTS, refreshDeals } from "../features/deals/deals.js";
import { SHOP } from "../shared/shop.js";

/** Pull the banner; silence is fine, the page simply shows none. */
async function loadAnnouncement(){
  try {
    const { fetchAnnouncement } = await import("../backend/client.js");
    setAnnouncement(await fetchAnnouncement());
  } catch { /* offline or not configured */ }
}

/* ------------------------------ rendering ----------------------------- */

/** Fill every [data-t] element from the active translation table. */
function applyTranslations(){
  const T = t();

  $$("[data-t]").forEach(el => {
    const value = T[el.dataset.t];
    if (value === undefined) return;

    // data-html="1" allows the few strings that carry a <br>.
    if (el.dataset.html === "1") el.innerHTML = value;
    else el.textContent = value;
  });

  // Placeholders and aria-labels declared via data-t-attr="attr:key"
  $$("[data-t-attr]").forEach(el => {
    const [attr, key] = el.dataset.tAttr.split(":");
    if (T[key] !== undefined) el.setAttribute(attr, T[key]);
  });
}

/** Opening-hours table, with today highlighted. */
function renderHours(){
  const el = $("#hours");
  if (!el) return;

  const today = todayIndex();
  el.innerHTML = t().days.map((day, i) =>
    `<tr${i === today ? ' class="today"' : ""}>
       <td>${esc(day)}</td><td>${esc(SHOP.hours)}</td>
     </tr>`).join("");
}

/** Product / category counters shown in the hero. */
function renderStats(){
  // Count only what a customer can actually see: empty categories are
  // hidden from the shop, so they must not be counted here either.
  const visible = CATALOG.filter(c => c.items.length);
  put("#stN", visible.reduce((sum, c) => sum + c.items.length, 0));
  put("#stC", visible.length);
}

/** Full address on the contact page. */
function renderCity(){
  const el = $("#cityLine");
  if (!el) return;
  const lang = document.documentElement.lang;
  el.textContent = SHOP.address[lang] || SHOP.address.en;
}

/** Full render — safe to call repeatedly. */
function render(){
  put("#lbMount", lightboxHTML());
  put("#noticeMount", announcementHTML());
  put("#announce", announceBarHTML());
  put("#topbar", topbarHTML());
  put("#header", headerHTML());
  put("#nav",    navHTML());
  put("#footer", footerHTML());

  if ($("#chips"))    put("#chips",    chipsHTML());
  if ($("#catBrowse")) put("#catBrowse", categoryBrowserHTML());
  if ($("#catalog")) put("#catalog", catalogHTML());
  if ($("#mapMount")) put("#mapMount", mapHTML());
  if ($("#filterMount")) put("#filterMount", filtersHTML());
  if ($("#countryMount")) put("#countryMount", countriesHTML());

  applyTranslations();
  renderStats();
  renderHours();
  renderCity();

  bindDynamic();
}

/* ------------------------------- events ------------------------------- */

/** Listeners on markup that render() replaces. */
function bindDynamic(){
  $$(".lang-b").forEach(btn =>
    btn.addEventListener("click", () => setLang(btn.dataset.lang)));

  initAnnounceBar();
  initDealsCarousel();
  initSearch();
  initSearchBox();
  initFilters();
  initCountries($("#countryMount"));
  initScrollSpy();

  // Keep the chosen sort order after a re-render.
  const sort = $("#sort");
  if (sort && sort.value !== "def") sortBy(sort.value);
}

/* -------------------------------- init -------------------------------- */

/**
 * Take the splash down and reveal the finished page.
 *
 * Safe to call more than once — whichever reason gets here first wins.
 */
let revealed = false;
function reveal(){
  if (revealed) return;
  revealed = true;

  document.body.classList.add("ready");

  const splash = $("#splash");
  if (!splash) return;

  // Let the fade finish before the element leaves, so it does not blink.
  splash.classList.add("gone");
  setTimeout(() => splash.remove(), 320);
}

/**
 * However slow the network is, the shop must appear. A customer staring
 * at a logo will leave; one reading a slightly old catalogue will not.
 */
const PATIENCE = 4000;

initLang();

(async () => {
  /* Everything the first screen needs, fetched together so the page can
     be painted once, complete, instead of assembling itself in front of
     the customer. */
  try {
    await Promise.race([
      Promise.all([refreshCatalog(), refreshDeals(), loadAnnouncement()]),
      new Promise(r => setTimeout(r, PATIENCE)),
    ]);
  } catch { /* fall through and paint with whatever we have */ }

  render();
  reveal();

  /* Realtime keeps it current from here on. */
  try {
    const { subscribe } = await import("../backend/client.js");
    await subscribe(async () => {
      await Promise.all([refreshCatalog(), refreshDeals(), loadAnnouncement()]);
      render();
    });
  } catch { /* offline or not configured — what we painted stands */ }
})();

/* A script error must never leave the shop hidden behind the splash. */
window.addEventListener("error", reveal);
window.addEventListener("unhandledrejection", reveal);
initBackToTop();               // outside render — the button is static markup

/* Map a clicked card back to its data object. */
initLightbox(card => {
  if (card.dataset.lbI !== undefined)          // deal / new-arrival card
    return ANNOUNCEMENTS.items[+card.dataset.lbI];
  if (card.dataset.lbC !== undefined)          // catalogue product card
    return CATALOG[+card.dataset.lbC]?.items[+card.dataset.lbP];
  return null;
});
onLangChange(render);          // re-render the whole page on language switch

// Honour a #category link on first load.
if (location.hash) scrollToId(location.hash.slice(1), 80);
