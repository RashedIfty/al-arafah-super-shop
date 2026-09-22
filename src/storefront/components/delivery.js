/**
 * How the shop gets an order to you.
 *
 * Two things a customer wants to know, in this order: can I get it free,
 * and if not, what does it cost. So free delivery comes first and large,
 * and the carrier's table is below it, in full. It was behind a fold at
 * first; the owner wanted it open, and he is right — a price list nobody
 * clicks is a price list nobody reads.
 *
 * Every price here is a guide, and the page says so plainly rather than
 * quietly. These are the rates the shop works to, but what a box costs
 * depends on its size and weight once packed — and a customer told ¥670
 * and charged ¥900 has been misled, whatever the small print said.
 */
import { esc } from "../../shared/lib/dom.js";
import { t } from "../../features/i18n/lang.js";
import { yen } from "../../shared/lib/format.js";
import { icon } from "../../shared/ui/icons.js";
import { SHOP } from "../../shared/shop.js";
import { FREE, SIZES, REGIONS, RATES, QUOTE, LIMITS }
  from "../../features/delivery/rates.js";

export function deliveryHTML(){
  const T = t();
  const lang = document.documentElement.lang || "en";
  const name = r => r[lang] || r.en;
  const pref = r => r.pref[lang] || r.pref.en;

  return `
    <div class="dlv">

      <!-- The two ways to pay nothing. -->
      <div class="dlv-free">
        <div class="dlv-free-card">
          <span class="dlv-free-ic">${icon("pin", { size: 22 })}</span>
          <b>${esc(T.dlv_free)}</b>
          <span class="dlv-free-where">${esc(T.dlv_local_where)}</span>
          <strong>${yen(FREE.localFrom)}</strong>
          <span class="dlv-free-min">${esc(T.dlv_min)}</span>
        </div>

        <!-- Everywhere else there is no free threshold: the carrier
             charges by box and distance, and the shop agrees the figure
             on the phone. The card says so rather than promising. -->
        <div class="dlv-free-card dlv-free-rates">
          <span class="dlv-free-ic">${icon("box", { size: 22 })}</span>
          <b>${esc(T.dlv_japan_where)}</b>
          <span class="dlv-free-where">${esc(T.dlv_japan_rate_where)}</span>
          <strong>${esc(T.dlv_japan_rate)}</strong>
          <span class="dlv-free-min">${esc(T.dlv_japan_rate_s)}</span>
        </div>
      </div>

      <!-- Cash on delivery, which is how most of the shop's orders are paid. -->
      <section class="dlv-block">
        <h2>${icon("cash", { size: 18 })} ${esc(T.dlv_pay_h)}</h2>
        <p>${esc(T.dlv_pay_1)}</p>
        <ul class="dlv-list">
          <li>${esc(T.dlv_pay_cod)}</li>
          <li>${esc(T.dlv_pay_call)}</li>
          <li>${esc(T.dlv_pay_tax)}</li>
        </ul>
      </section>

      <!-- How an order actually travels, start to finish. -->
      <section class="dlv-block">
        <h2>${icon("clock", { size: 18 })} ${esc(T.dlv_how_h)}</h2>
        <ol class="dlv-steps">
          <li><b>${esc(T.dlv_s1_t)}</b><span>${esc(T.dlv_s1_b)}</span></li>
          <li><b>${esc(T.dlv_s2_t)}</b><span>${esc(T.dlv_s2_b)}</span></li>
          <li><b>${esc(T.dlv_s3_t)}</b><span>${esc(T.dlv_s3_b)}</span></li>
          <li><b>${esc(T.dlv_s4_t)}</b><span>${esc(T.dlv_s4_b)}</span></li>
        </ol>
      </section>

      <!-- Local delivery, in detail. -->
      <section class="dlv-block">
        <h2>${icon("pin", { size: 18 })} ${esc(T.dlv_local_h)}</h2>
        <p>${esc(T.dlv_local_1).replace("{km}", FREE.localKm)}</p>
        <ul class="dlv-list">
          <li>${esc(T.dlv_local_free).replace("{amt}", yen(FREE.localFrom))}</li>
          <li>${esc(T.dlv_local_under).replace("{amt}", yen(FREE.localFrom))}</li>
          <li>${esc(T.dlv_local_when)}</li>
          <li>${esc(T.dlv_local_far)}</li>
        </ul>
      </section>

      <!-- Everywhere else, by carrier. -->
      <section class="dlv-block">
        <h2>${icon("box", { size: 18 })} ${esc(T.dlv_ship_h)}</h2>
        <p>${esc(T.dlv_ship_1)}</p>

        <div class="dlv-warn">
          ${icon("warn", { size: 16 })}
          <span>${esc(T.dlv_warn)}</span>
        </div>

        <div class="dlv-rates">
          <p class="dlv-rates-note">${esc(T.dlv_table_note)}</p>

          <div class="dlv-scroll">
            <table class="dlv-table">
              <thead>
                <tr>
                  <th>${esc(T.dlv_th_region)}</th>
                  ${SIZES.map(s => `<th>${s.size}<em>${s.kg ? s.kg + "kg" : "&nbsp;"}</em></th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${REGIONS.map(r => `
                  <tr${r.id === "kanto" ? ' class="here"' : ""}>
                    <th>
                      ${esc(name(r))}${r.id === "kanto" ? ` <i>${esc(T.dlv_here)}</i>` : ""}
                      <small>${esc(pref(r))}</small>
                    </th>
                    ${SIZES.map(s => `<td>${RATES[r.id][s.size].toLocaleString("en-US")}</td>`).join("")}
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>

          <p class="dlv-rates-foot">
            ${esc(T.dlv_size_note)}<br>
            ${esc(T.dlv_limit).replace("{kg}", LIMITS.maxKg).replace("{size}", LIMITS.maxSize)}<br>
            ${esc(T.dlv_source)
                .replace("{carrier}", QUOTE.carrier)
                .replace("{branch}", QUOTE.branch)}
          </p>
        </div>
      </section>

      <!-- Ask, rather than guess. -->
      <section class="dlv-block dlv-ask">
        <h2>${icon("phone", { size: 18 })} ${esc(T.dlv_ask_h)}</h2>
        <p>${esc(T.dlv_ask_1)}</p>
        <div class="dlv-ask-btns">
          <a class="btn btn-red" href="tel:${esc(SHOP.telRaw)}">
            ${icon("phone", { size: 16 })} ${esc(SHOP.tel)}
          </a>
          <a class="btn btn-out" target="_blank" rel="noopener"
             href="https://wa.me/81${esc(SHOP.telRaw.slice(1))}">
            ${esc(T.dlv_wa)}
          </a>
        </div>
      </section>

    </div>`;
}
