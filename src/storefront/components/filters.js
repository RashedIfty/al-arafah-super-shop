/**
 * Product filters for the products page.
 *
 * Narrowing by price, category and availability is usually what people
 * want after a search returns fifteen things - no amount of ranking
 * substitutes for "under ¥1,000".
 */
import { $, $$, esc, on } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { yen } from "../../shared/lib/format.js";
import { t, getLang, itemCount } from "../../features/i18n/lang.js";
import { CATALOG } from "../../features/catalog/catalog.js";

/** Current selection. */
const state = { cat: "", max: 0, sale: false, stock: false };

/** Highest price in the shop, rounded up for a sensible slider top. */
function ceiling(){
  const top = Math.max(0, ...CATALOG.flatMap(c => c.items.map(p => p.p)));
  return Math.ceil(top / 500) * 500;
}

export function filtersHTML(){
  const T = t(), lang = getLang();
  const max = ceiling();
  const shown = CATALOG.filter(c => c.items.length);

  return `
    <div class="filters" id="filters">
      <div class="fl-row">
        <label class="fl-field">
          <span>${esc(T.fl_category)}</span>
          <select id="flCat">
            <option value="">${esc(T.fl_all)}</option>
            ${shown.map(c =>
              `<option value="${esc(c.id)}">${esc(c[lang] || c.en)}</option>`).join("")}
          </select>
        </label>

        <label class="fl-field fl-price">
          <span>${esc(T.fl_upto)} <b id="flPriceOut">${yen(max)}</b></span>
          <input type="range" id="flMax" min="0" max="${max}" step="100" value="${max}">
        </label>

        <label class="fl-field">
          <span>${esc(T.sort)}</span>
          <select id="sort" aria-label="${esc(T.sort)}">
            <option value="def">${esc(T.sort_def)}</option>
            <option value="lo">${esc(T.sort_lo)}</option>
            <option value="hi">${esc(T.sort_hi)}</option>
            <option value="az">${esc(T.sort_az)}</option>
          </select>
        </label>

        <div class="fl-toggles">
          <label class="fl-chip">
            <input type="checkbox" id="flSale">
            <span>${esc(T.fl_sale)}</span>
          </label>
          <label class="fl-chip">
            <input type="checkbox" id="flStock">
            <span>${esc(T.fl_stock)}</span>
          </label>
        </div>

        <button class="fl-clear" id="flClear" type="button" hidden>
          ${icon("close", { size: 14 })} ${esc(T.fl_clear)}
        </button>
      </div>

      <p class="fl-count" id="flCount"></p>
      <span class="res" id="res" hidden></span>
    </div>`;
}

/** Show or hide each card, then hide any category left empty. */
function apply(){
  const max = state.max || Infinity;
  let shown = 0;

  $$(".sec").forEach(sec => {
    const inCat = !state.cat || sec.id === state.cat;
    let visible = 0;

    $$(".card", sec).forEach(card => {
      const price = +card.dataset.price;
      const onSale = card.dataset.sale === "1";
      const out = card.dataset.tag === "out";

      const keep = inCat
        && price <= max
        && (!state.sale || onSale)
        && (!state.stock || !out)
        && !card.dataset.searchHidden;      // respect an active search

      card.hidden = !keep;
      if (keep) visible++;
    });

    sec.hidden = visible === 0;
    shown += visible;
  });

  const count = $("#flCount");
  if (count) count.textContent = itemCount(shown);

  const empty = $("#empty");
  if (empty) empty.hidden = shown > 0;

  const active = state.cat || state.max < ceiling() || state.sale || state.stock;
  $("#flClear")?.toggleAttribute("hidden", !active);
}

export function initFilters(){
  if (!$("#filters")) return;

  state.max = ceiling();

  on("#flCat", "change", e => { state.cat = e.target.value; apply(); });

  on("#flMax", "input", e => {
    state.max = +e.target.value;
    const out = $("#flPriceOut");
    if (out) out.textContent = state.max >= ceiling() ? yen(ceiling()) : yen(state.max);
    apply();
  });

  on("#flSale", "change", e => { state.sale = e.target.checked; apply(); });
  on("#flStock", "change", e => { state.stock = e.target.checked; apply(); });

  on("#flClear", "click", () => {
    state.cat = ""; state.max = ceiling(); state.sale = false; state.stock = false;
    $("#flCat").value = "";
    $("#flMax").value = state.max;
    $("#flPriceOut").textContent = yen(state.max);
    $("#flSale").checked = false;
    $("#flStock").checked = false;
    apply();
  });

  apply();
}
