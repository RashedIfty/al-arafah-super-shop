/**
 * Who is waiting for what.
 *
 * Grouped by product rather than by date. The owner reading this is
 * deciding what to reorder, and five people asking for the same fish is
 * one line of the shopping list, not five — the count is the useful
 * number, and the names sit under it for the phone call.
 *
 * Shaped like admin/orders.js: plain setters and a render function that
 * main.js calls, with its toast, its confirm dialog and its reload
 * passed in rather than imported.
 */
import { $, $$, esc } from "../shared/lib/dom.js";
import { icon } from "../shared/ui/icons.js";
import { jstDate } from "../shared/lib/format.js";
import * as api from "../backend/client.js";

let rows = [];
let busy = new Set();          // products mid-write, so a double press cannot fire twice

export const setRestock = list => { rows = list || []; };
export const restockCount = () => rows.length;

/* ------------------------------ grouping ------------------------------ */

/** One entry per product, newest request first, with everyone waiting. */
function byProduct(){
  const groups = [];

  for (const r of rows){
    let g = groups.find(x => x.product_id === r.product_id);
    if (!g) groups.push(g = {
      product_id: r.product_id,
      en: r.en, w: r.w, img: r.img, tag: r.tag,
      people: [],
    });
    g.people.push(r);
  }

  /* Most wanted first: the thing eight people are waiting for is the
     thing to reorder on Monday. */
  groups.sort((a, b) => b.people.length - a.people.length);
  return groups;
}

/* ------------------------------ rendering ----------------------------- */

export function renderRestock(){
  const line = $("#rsLine");
  const list = $("#rsList");
  const badge = $("#rsCount");

  if (badge) badge.textContent = rows.length ? rows.length : "";
  if (!list) return;

  const groups = byProduct();

  if (line){
    line.textContent = !rows.length
      ? "Nobody is waiting for anything."
      : `${rows.length} request${rows.length === 1 ? "" : "s"} ` +
        `for ${groups.length} product${groups.length === 1 ? "" : "s"}`;
  }

  if (!rows.length){
    list.innerHTML = `
      <div class="none">
        <b>Nobody is waiting</b>
        <span>When a customer asks for a sold-out product, it will appear here.</span>
      </div>`;
    return;
  }

  list.innerHTML = groups.map(g => {
    const working = busy.has(g.product_id);

    return `
      <section class="cat-block rs-block${working ? " working" : ""}">
        <div class="cat-head rs-head">
          ${g.img
            ? `<img class="cat-thumb" src="${esc(g.img)}" alt="" loading="lazy">`
            : ""}
          <b>${esc(g.en)}</b>
          <span class="rs-w">${esc(g.w || "")}</span>
          <em>${g.people.length} waiting</em>

          <button class="act edit rs-go" data-rs-back="${esc(g.product_id)}"
                  ${working ? "disabled" : ""}>
            ${icon("check", { size: 14 })} Back in stock
          </button>
        </div>

        ${g.people.map(p => `
          <div class="arc-row rs-row">
            <div class="prod-tx">
              <span class="rs-nm">
                <b>${esc(p.customer || "—")}</b>
                ${p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ""}
              </span>
              <span class="rs-when">Asked ${esc(jstDate(p.created_at))}</span>
            </div>
            <div class="prod-act">
              ${p.phone
                ? `<a class="act" href="tel:${esc(p.phone)}">
                     ${icon("phone", { size: 14 })} Call</a>`
                : ""}
            </div>
          </div>`).join("")}
      </section>`;
  }).join("");
}

/* ------------------------------- actions ------------------------------ */

export function initRestock({ toast, ask, refresh }){
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-rs-back]");
    if (!btn) return;

    const id = btn.dataset.rsBack;
    if (busy.has(id)) return;

    const g = byProduct().find(x => x.product_id === id);
    if (!g) return;

    const n = g.people.length;
    ask("Tell everyone it is back?",
        `${n} ${n === 1 ? "person is" : "people are"} waiting for ${g.en}. ` +
        `They will be emailed, and it stops showing as sold out.`,
        async () => {
          busy.add(id);
          renderRestock();

          const { error } = await api.markRestocked(id);
          busy.delete(id);

          if (error){
            toast(error.message, true);
            return refresh();
          }

          /* The email goes through an Edge Function, which may not be
             deployed yet. The list is already cleared and the shelf is
             already right, so a failure here is worth saying out loud
             but is not worth undoing any of it. */
          try {
            const { error: mailErr } = await api.notifyRestocked(id);
            toast(mailErr
              ? `Back on the shelf. The emails did not send: ${mailErr.message}`
              : `Told ${n} ${n === 1 ? "person" : "people"}. It is back on the shelf.`,
              Boolean(mailErr));
          } catch (ex){
            toast("Back on the shelf. The emails did not send.", true);
          }

          refresh();
        });
  });
}
