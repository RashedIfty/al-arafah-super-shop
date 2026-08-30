/**
 * The shop's ribbon, laid along the bottom of every photo the owner
 * uploads.
 *
 * The badge keeps its own white background rather than being cut out.
 * Its artwork was drawn over a checkerboard painted into the file, and
 * separating that from the badge's own white was never reliable — the
 * two are the same colour, and every attempt either left grey squares
 * behind or ate into the white panels holding the trolley and the van.
 * Kept whole, it reads as a label across the foot of the picture, which
 * is what a watermark on a shop photo should look like anyway.
 */

const MARK = "/images/brand/watermark.jpg";

/** Nearly the full width: this is a strip, not a badge in a corner. */
const WIDTH_SHARE = 0.94;

/** Distance from the bottom, as a share of the photo's width. */
const PAD_SHARE = 0.025;

/** Solid, but not quite flat against the photograph. */
const OPACITY = 0.96;

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
 * Lay the ribbon across the bottom of a canvas.
 *
 * A soft shadow lifts the strip off the photograph, so it reads as
 * something placed on top rather than part of the picture.
 */
export async function stamp(canvas){
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const mark = await loadMark();
  if (!mark) return;

  const w = Math.round(canvas.width * WIDTH_SHARE);
  const h = Math.round(w * (mark.height / mark.width));

  const pad = Math.round(canvas.width * PAD_SHARE);
  const x = Math.round((canvas.width - w) / 2);   // centred
  const y = canvas.height - h - pad;

  ctx.save();
  ctx.globalAlpha = OPACITY;
  ctx.shadowColor = "rgba(0,0,0,.22)";
  ctx.shadowBlur = Math.round(canvas.width * 0.012);
  ctx.shadowOffsetY = 2;
  ctx.drawImage(mark, x, y, w, h);
  ctx.restore();
}
