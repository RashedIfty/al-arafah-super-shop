/**
 * The shop's mark, stamped on every photo the owner uploads.
 *
 * The mark is the shop's own logo — the orange ribbon with the trolley
 * and the delivery van — cut out of its background and kept as a PNG
 * with real transparency. Drawing it by hand came close but never quite
 * matched, and the logo already exists.
 *
 * It goes in the bottom-right corner, small. A watermark that covers the
 * packet defeats the photograph: the customer came to see the product,
 * and a mark they cannot see past is worse than no mark at all.
 */

const MARK = "/images/brand/watermark.png";

/** The mark's share of the photo's width. */
const WIDTH_SHARE = 0.52;

/** Never smaller than this, or the name stops being readable. */
const MIN_WIDTH = 220;

/** Distance from the edges, as a share of the photo's width. */
const PAD_SHARE = 0.03;

/** Present, but not competing with the product. */
const OPACITY = 0.88;

/* Fetched once and reused: the owner may add several photos in a row,
   and each would otherwise wait for the same file again. */
let cached = null;

function loadMark(){
  if (cached) return cached;

  cached = new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // a photo without a mark beats none
    img.src = MARK;
  });

  return cached;
}

/**
 * Stamp the mark into the bottom-right of a canvas.
 *
 * A soft shadow sits under it, so the mark holds its shape against a
 * pale packet as well as a dark one.
 */
export async function stamp(canvas){
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const mark = await loadMark();
  if (!mark) return;

  const w = Math.max(MIN_WIDTH, Math.round(canvas.width * WIDTH_SHARE));
  const h = Math.round(w * (mark.height / mark.width));

  const pad = Math.round(canvas.width * PAD_SHARE);
  const x = canvas.width - w - pad;
  const y = canvas.height - h - pad;

  ctx.save();
  ctx.globalAlpha = OPACITY;
  ctx.shadowColor = "rgba(0,0,0,.28)";
  ctx.shadowBlur = Math.round(w * 0.03);
  ctx.shadowOffsetY = 1;
  ctx.drawImage(mark, x, y, w, h);
  ctx.restore();
}
