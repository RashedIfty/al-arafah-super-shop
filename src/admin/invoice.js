/**
 * The invoice that travels with the box.
 *
 * A4, black on white, built to be printed and read by somebody holding
 * it — a delivery driver checking an address, a customer checking what
 * they were charged, the owner filing it in a drawer.
 *
 * It is a print-styled page rather than a generated PDF. No library to
 * load, no font to embed, and Japanese addresses come out right because
 * the browser is already rendering them. The owner presses Print and
 * either sends it to paper or saves it as a PDF — his choice, and the
 * same two taps on a phone as on a laptop.
 *
 * Everything on it is copied from the order row, which froze the prices
 * and the address at the moment of ordering. An invoice that recalculated
 * itself from today's catalogue would quietly disagree with what the
 * customer was told.
 */
import { esc } from "../shared/lib/dom.js";
import { yen, jstDate } from "../shared/lib/format.js";
import { SHOP } from "../shared/shop.js";
import { photoOf } from "./photos.js";

/** 08022289967 -> 080-2228-9967, the way a Japanese number is written. */
const phone = n => {
  const d = String(n ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}` : String(n ?? "");
};

const LABEL = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  dispatched: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/**
 * The whole document, as a standalone HTML page.
 *
 * Standalone on purpose: it opens in its own window with nothing of the
 * panel around it, so what the owner sees on screen is exactly what
 * comes out of the printer.
 */
/**
 * How the customer paid, as it should read on the paper.
 *
 * The owner picks one before printing rather than the invoice assuming
 * cash: a receipt that says "cash on delivery" for an order settled by
 * PayPay is simply wrong, and it is the piece of paper the customer
 * keeps.
 */
export const PAY_METHODS = [
  { id: "cod",        label: "Cash on delivery",
    line: "Cash on delivery. Please pay the driver on receipt." },
  { id: "cash-shop",  label: "Cash at the shop",
    line: "Paid in cash at the shop." },
  { id: "paypay",     label: "PayPay",
    line: "Paid by PayPay." },
  { id: "visa",       label: "Visa",
    line: "Paid by Visa card." },
  { id: "mastercard", label: "Mastercard",
    line: "Paid by Mastercard." },
  { id: "amex",       label: "American Express",
    line: "Paid by American Express." },
  { id: "jcb",        label: "JCB",
    line: "Paid by JCB card." },
  { id: "card-cod",   label: "Card on delivery",
    line: "Card on delivery. Please pay the driver on receipt." },
  { id: "bank",       label: "Bank transfer",
    line: "Paid by bank transfer." },
];

const payLine = id =>
  (PAY_METHODS.find(m => m.id === id) || PAY_METHODS[0]).line;

/** Whether the money has already changed hands, or is owed on delivery. */
const isDue = id => id === "cod" || id === "card-cod";

export function invoiceHTML(o, method = "cod"){
  const items = o.order_items || o.items || [];
  const subtotal = items.reduce((s, i) => s + Number(i.line_total || 0), 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${esc(o.code)} · ${esc(SHOP.name)} ${esc(SHOP.name2)}</title>
<style>
  /* The shop's own colours, so the paper and the website are plainly
     the same business: burnt orange, mid orange, gold, and the red
     reserved for the one number that matters. */
  :root{
    --o:#e2621d;      /* mid orange  */
    --o-d:#b8380f;    /* burnt       */
    --o-l:#fdf1e7;    /* tint        */
    --gold:#f0a500;
    --red:#c8102e;
    --ink:#1f2328;
    --mute:#6b7280;
    --line:#e8eaed;
  }

  @page { size: A4; margin: 0; }

  *{margin:0;padding:0;box-sizing:border-box}
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }

  body{
    font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",
         "Hiragino Sans","Noto Sans JP","Noto Sans Bengali",sans-serif;
    color:var(--ink);background:#eceef1;padding:26px 16px;
  }

  .sheet{
    width:210mm;min-height:297mm;margin:0 auto;background:#fff;
    box-shadow:0 6px 30px rgba(0,0,0,.16);
    display:flex;flex-direction:column;position:relative;overflow:hidden;
  }

  /* ---------------------------- the band ------------------------------ */
  /* A gradient header carries the brand without shouting, and gives the
     document an obvious top edge when it is one sheet among many. */
  .band{
    background:linear-gradient(115deg,var(--o-d) 0%,var(--o) 55%,#ef7a2a 100%);
    color:#fff;padding:10mm 15mm 8.5mm;position:relative;
  }
  /* A thin gold seam along the bottom of the band. */
  .band::after{
    content:"";position:absolute;left:0;right:0;bottom:0;height:3px;
    background:linear-gradient(90deg,var(--gold),#ffd166 45%,var(--gold));
  }

  .band-in{display:flex;gap:16px;align-items:flex-start}

  .logo{
    width:66px;height:66px;object-fit:contain;flex-shrink:0;
    border-radius:9px;background:#fff;padding:4px;
    box-shadow:0 2px 8px rgba(0,0,0,.16);
  }
  .who{flex:1;min-width:0}
  .who h1{font-size:23px;font-weight:800;letter-spacing:-.4px;line-height:1.05}
  .who h1 span{
    display:block;font-size:10.5px;font-weight:700;letter-spacing:3.4px;
    margin-top:3px;color:rgba(255,255,255,.88);
  }
  .who address{
    font-style:normal;font-size:10px;line-height:1.65;margin-top:7px;
    color:rgba(255,255,255,.9);
  }

  .doc{text-align:right;flex-shrink:0}
  .doc .word{
    font-size:25px;font-weight:800;letter-spacing:4px;line-height:1;
    color:rgba(255,255,255,.95);
  }
  .doc .no{
    display:inline-block;margin-top:8px;padding:5px 12px;border-radius:4px;
    background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);
    font-size:13.5px;font-weight:800;letter-spacing:.8px;
  }
  .doc .when{font-size:10px;color:rgba(255,255,255,.82);margin-top:5px}

  .badge{
    display:inline-block;margin-top:7px;padding:3.5px 11px;border-radius:20px;
    font-size:9px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;
    background:#fff;color:var(--o-d);
  }
  .badge.delivered{background:#eaf6f1;color:#0d6b4d}
  .badge.rejected,.badge.cancelled{background:#fdecef;color:var(--red)}

  /* ----------------------------- the body ----------------------------- */
  .body{padding:8mm 15mm 0;flex:1;display:flex;flex-direction:column}

  .to{display:flex;gap:9mm;margin-bottom:7mm}
  .to > div{flex:1;min-width:0}
  .to h2{
    font-size:9px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;
    color:var(--o);margin-bottom:6px;padding-bottom:4px;
    border-bottom:1.5px solid var(--o-l);
  }
  .to b{display:block;font-size:14.5px;font-weight:700;margin-bottom:3px}
  .to p{font-size:11.5px;line-height:1.7;color:#444}
  .to p strong{color:var(--ink);font-weight:600}

  /* ------------------------------ items ------------------------------- */
  table.items{width:100%;border-collapse:collapse;margin-bottom:6mm}
  table.items thead th{
    background:var(--o-d);color:#fff;font-size:9.5px;font-weight:700;
    letter-spacing:.9px;text-transform:uppercase;padding:9px 10px;text-align:left;
  }
  table.items thead th:first-child{border-radius:4px 0 0 0}
  table.items thead th:last-child{border-radius:0 4px 0 0}
  table.items thead th.r{text-align:right}

  table.items tbody td{
    padding:9px 10px;border-bottom:1px solid var(--line);
    font-size:12px;vertical-align:top;
  }
  table.items tbody td.r{text-align:right;white-space:nowrap}
  table.items tbody td.n{color:var(--mute);font-size:11px}
  /* The photograph beside the name, so a driver checking a box against
     the paper can match what is in his hand without reading anything.
     A product since deleted keeps the space, so the column does not
     shift about between lines. */
  /* An icon, not a photograph. Enough to recognise a packet by while
     glancing down the column, small enough that the name is still the
     thing being read. */
  table.items tbody .item{display:flex;align-items:center;gap:7px}
  table.items tbody .thumb{
    width:20px;height:20px;flex-shrink:0;border-radius:3px;
    border:1px solid var(--line);background:#fff;
    object-fit:contain;
  }
  table.items tbody .thumb-none{background:#f5f6f7;border-style:dashed}
  table.items tbody .item-tx{min-width:0}
  table.items tbody .nm{font-weight:600}
  table.items tbody .sub{display:block;font-size:10px;color:var(--mute);margin-top:1.5px}
  table.items tbody tr:nth-child(even) td{background:#fdfaf7}

  /* ------------------------------ totals ------------------------------ */
  .sum{display:flex;justify-content:flex-end}
  .sum table{width:72mm;border-collapse:collapse}
  .sum td{padding:6px 11px;font-size:12px}
  .sum td.r{text-align:right;white-space:nowrap}
  .sum tr.line td{border-bottom:1px solid var(--line)}
  .sum tr.grand td{
    background:var(--o-l);border-top:2px solid var(--o);
    padding:11px;font-size:17px;font-weight:800;color:var(--red);
  }
  .sum tr.grand td:first-child{
    color:var(--o-d);font-size:12px;letter-spacing:.8px;text-transform:uppercase;
  }

  .note{
    margin-top:5.5mm;padding:10px 13px;background:#fdfaf7;
    border-left:3px solid var(--gold);border-radius:0 4px 4px 0;
    font-size:11.5px;line-height:1.65;
  }
  .note b{
    display:block;font-size:9px;letter-spacing:.9px;text-transform:uppercase;
    color:var(--o);margin-bottom:3px;font-weight:800;
  }
  .note.bad{border-left-color:var(--red);background:#fdf3f4}
  .note.bad b{color:var(--red)}

  /* Money still owed and money already taken are different pieces of
     paper. A driver glancing at this must not have to read a sentence
     to know whether to collect anything. */
  .pay{
    margin-top:5.5mm;padding:11px 14px;border-radius:5px;
    font-size:11.5px;line-height:1.7;
    display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  }
  .pay b{font-weight:800;flex-shrink:0}
  .pay.due{border:1.5px dashed #e0b48e;background:#fffdfb}
  .pay.due b{color:var(--o-d)}
  .pay.paid{border:1.5px solid #bfe3d4;background:#f2faf7}
  .pay.paid b{color:#0d6b4d}
  .due-amt{
    margin-left:auto;font-size:16px;font-weight:800;color:var(--red);
    white-space:nowrap;
  }

  /* ------------------------------- foot ------------------------------- */
  .foot{
    margin-top:auto;text-align:center;padding:6mm 15mm 7mm;
    font-size:9.5px;color:var(--mute);line-height:1.8;
  }
  .foot .thanks{
    font-size:13px;font-weight:800;color:var(--o-d);margin-bottom:4px;
    letter-spacing:.2px;
  }
  .foot .rule{
    height:2px;margin:0 auto 9px;max-width:60mm;border-radius:2px;
    background:linear-gradient(90deg,transparent,var(--o),transparent);
  }

  /* The controls live on the screen and never on the paper. */
  .bar{max-width:210mm;margin:0 auto 14px;display:flex;gap:9px;justify-content:flex-end}
  .bar button{
    font:inherit;font-size:13px;font-weight:700;padding:10px 20px;border-radius:9px;
    border:1.5px solid var(--o);background:#fff;color:var(--o-d);cursor:pointer;
  }
  .bar button.go{
    background:linear-gradient(115deg,var(--o-d),var(--o));
    border-color:var(--o-d);color:#fff;
  }
  .bar button:hover{opacity:.9}

  @media print{
    body{background:#fff;padding:0}

    /* A long order runs to a second sheet, which is fine — but it has to
       look deliberate. The column headings repeat at the top of each
       page so the numbers are still labelled, and the footer is only
       pushed to the bottom when there is one page to push it down. */
    thead{display:table-header-group}
    tfoot{display:table-footer-group}
    .foot{margin-top:0}
    .sheet{display:block}
    /* No asserted height. The page box is already A4; a sheet that also
       claims 297mm plus its own padding runs onto a second page. */
    .sheet{width:auto;min-height:0;height:auto;margin:0;box-shadow:none}
    .bar{display:none}
    .band,.items thead th,.sum tr.grand td,.note,.pay{
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }
    /* Never split a row or the totals across the fold. */
    tr,.sum,.note,.pay,.foot{break-inside:avoid;page-break-inside:avoid}
  }
</style>
</head>
<body>

<div class="bar">
  <button class="go" onclick="window.print()">Print / Save as PDF</button>
  <button onclick="window.close()">Close</button>
</div>

<div class="sheet">

  <header class="band">
    <div class="band-in">
      <img class="logo" src="/images/logo.jpeg" alt="">
      <div class="who">
        <h1>${esc(SHOP.name)}<span>${esc(SHOP.name2)}</span></h1>
        <address>
          ${esc(SHOP.address.en)}<br>
          ${esc(SHOP.address.ja)}<br>
          Tel ${esc(SHOP.tel)} &middot; Open ${esc(SHOP.hours)}
        </address>
      </div>
      <div class="doc">
        <div class="word">INVOICE</div>
        <div class="no">${esc(o.code)}</div>
        <div class="when">${esc(jstDate(o.placed_at))}</div>
        <div><span class="badge ${esc(o.status)}">${esc(LABEL[o.status] || o.status)}</span></div>
      </div>
    </div>
  </header>

  <div class="body">

    <div class="to">
      <div>
        <h2>Deliver to</h2>
        <b>${esc(o.name)}</b>
        <p>
          〒${esc(o.postal)}<br>
          ${esc(o.address)}<br>
          Tel ${esc(phone(o.phone))}
        </p>
      </div>
      <div>
        <h2>Order details</h2>
        <p>
          <strong>Order no.</strong> ${esc(o.code)}<br>
          <strong>Placed</strong> ${esc(jstDate(o.placed_at))}<br>
          ${o.confirmed_at ? `<strong>Confirmed</strong> ${esc(jstDate(o.confirmed_at))}<br>` : ""}
          ${o.dispatched_at ? `<strong>Dispatched</strong> ${esc(jstDate(o.dispatched_at))}<br>` : ""}
          ${o.delivered_at ? `<strong>Delivered</strong> ${esc(jstDate(o.delivered_at))}` : ""}
        </p>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th>Item</th>
          <th style="width:66px">Unit</th>
          <th class="r" style="width:48px">Qty</th>
          <th class="r" style="width:76px">Price</th>
          <th class="r" style="width:86px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((i, n) => `
          <tr>
            <td class="n">${n + 1}</td>
            <td>
              <span class="item">
                ${photoOf(i.product_id)
                  ? `<img class="thumb" src="${esc(photoOf(i.product_id))}" alt="">`
                  : `<span class="thumb thumb-none"></span>`}
                <span class="item-tx">
                  <span class="nm">${esc(i.name_en)}</span>
                  ${i.name_ja || i.name_bn
                    ? `<span class="sub">${esc([i.name_ja, i.name_bn].filter(Boolean).join(" · "))}</span>`
                    : ""}
                </span>
              </span>
            </td>
            <td>${esc(i.w || "")}</td>
            <td class="r">${i.qty}</td>
            <td class="r">${yen(i.unit_price)}</td>
            <td class="r">${yen(i.line_total)}</td>
          </tr>`).join("")}
      </tbody>
    </table>

    <div class="sum">
      <table>
        <tr class="line">
          <td>Subtotal</td>
          <td class="r">${yen(subtotal)}</td>
        </tr>
        ${Number(o.total) !== subtotal ? `
          <tr class="line">
            <td>Delivery</td>
            <td class="r">${yen(Number(o.total) - subtotal)}</td>
          </tr>` : ""}
        <tr class="grand">
          <td>Total</td>
          <td class="r">${yen(o.total)}</td>
        </tr>
      </table>
    </div>

    ${o.note ? `
      <div class="note">
        <b>Customer's note</b>
        ${esc(o.note)}
      </div>` : ""}

    ${o.cancel_reason ? `
      <div class="note bad">
        <b>Reason</b>
        ${esc(o.cancel_reason)}
      </div>` : ""}

    <div class="pay${isDue(method) ? " due" : " paid"}">
      <b>${isDue(method) ? "Amount due:" : "Paid:"}</b>
      ${esc(payLine(method))} All prices include tax.
      ${isDue(method) ? `<span class="due-amt">${yen(o.total)}</span>` : ""}
    </div>

  </div>

  <footer class="foot">
    <div class="rule"></div>
    <div class="thanks">Thank you for shopping with us</div>
    ${esc(SHOP.name)} ${esc(SHOP.name2)} &middot; ${esc(SHOP.address.en)}<br>
    Tel ${esc(SHOP.tel)} &middot; alarafahsupershop.com
  </footer>

</div>
</body>
</html>`;
}

/**
 * Open one in its own window.
 *
 * Written into a blank window rather than navigated to, because there is
 * no invoice on the server to navigate to — the document is built here
 * from the order already in hand.
 */
export function openInvoice(o, method = "cod"){
  const w = window.open("", "_blank");
  if (!w) return false;          // a pop-up blocker got in the way
  w.document.write(invoiceHTML(o, method));
  w.document.close();
  return true;
}
