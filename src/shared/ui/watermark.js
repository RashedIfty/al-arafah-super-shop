/**
 * The shop's mark, laid across the foot of every photo the owner uploads.
 *
 * A band of the shop's orange that fades upward into the picture, rather
 * than a solid shape sitting on top of it — the product keeps the frame,
 * and the mark still reads on a white packet and a dark shopfront alike.
 * The trolley and the delivery van sit at either end with the name
 * between them, over a line saying what the shop is and where, under a
 * gold hairline, with a gloss falling across the whole band.
 *
 * Drawn in code: there is no image to load, nothing to go missing, and
 * it stays sharp at whatever size the photo happens to be.
 */

/** The band's height, as a share of the photo's. */
const BAND_SHARE = 0.155;

/** How solid the colour gets at the very bottom. */
const STRENGTH = 0.96;

/** The icons, as one small sheet drawn once per photo. */
const ICONS = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="64"
   viewBox="0 0 360 64" fill="#fff">
  <g transform="translate(8,14)">
    <path d="M0 0h6l4.6 17.5h24.6l4.6-11.6H12.4" stroke="#fff" stroke-width="3.6"
      fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="14" cy="24" r="3.2"/><circle cx="32" cy="24" r="3.2"/>
  </g>
  <g transform="translate(276,12)">
    <path d="M14 4h30v13h9l8 9v10h-6a6 6 0 0 0-12 0H32a6 6 0 0 0-12 0h-6V4z"/>
    <circle cx="26" cy="36" r="4.6"/><circle cx="51" cy="36" r="4.6"/>
    <g stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M-2 12h10M-7 20h15M-2 28h10"/></g>
  </g>
</svg>`;

/* Rendered once and kept: the owner may add several photos in a row. */
let sheet = null;

function loadIcons(){
  if (sheet) return sheet;

  sheet = new Promise(resolve => {
    const url = URL.createObjectURL(new Blob([ICONS], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

  return sheet;
}

/**
 * Lay the band across the bottom of a canvas.
 *
 * The colour is painted flat and then masked with a vertical fade, which
 * is what makes it read as tinted glass rather than a printed strip.
 */
export async function stamp(canvas){
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width, H = canvas.height;
  const h = Math.round(H * BAND_SHARE);
  const y = H - h;

  /* Build the band on its own canvas so the fade can be applied to the
     colour alone — masking it in place would take the photo with it. */
  const band = document.createElement("canvas");
  band.width = W; band.height = h;
  const bx = band.getContext("2d");
  if (!bx) return;

  const orange = bx.createLinearGradient(0, 0, W, 0);
  orange.addColorStop(0,   "#f39325");
  orange.addColorStop(.55, "#ee7016");
  orange.addColorStop(1,   "#dd3c17");
  bx.fillStyle = orange;
  bx.fillRect(0, 0, W, h);

  bx.globalCompositeOperation = "destination-in";
  const fade = bx.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0,   "rgba(0,0,0,0)");
  fade.addColorStop(.40, `rgba(0,0,0,${STRENGTH * 0.82})`);
  fade.addColorStop(1,   `rgba(0,0,0,${STRENGTH})`);
  bx.fillStyle = fade;
  bx.fillRect(0, 0, W, h);

  ctx.drawImage(band, 0, y);

  /* A gloss falling across the band, so it reads as a surface catching
     the light rather than a flat rectangle of colour. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, h);
  ctx.clip();
  const gloss = ctx.createLinearGradient(W * 0.05, y, W * 0.60, y + h);
  gloss.addColorStop(0,   "rgba(255,255,255,0)");
  gloss.addColorStop(.48, "rgba(255,255,255,.22)");
  gloss.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(0, y, W, h);
  ctx.restore();

  /* A gold hairline along the top of the band, fading out at both ends
     so it never looks like a border that has been cut off. */
  const rule = ctx.createLinearGradient(0, 0, W, 0);
  rule.addColorStop(0,  "rgba(247,201,72,0)");
  rule.addColorStop(.5, "#f7c948");
  rule.addColorStop(1,  "rgba(247,201,72,0)");
  ctx.fillStyle = rule;
  ctx.fillRect(0, y + Math.round(h * 0.06), W, Math.max(2, Math.round(h * 0.020)));

  /* The contents. The icons hold the two ends; the name and the line
     beneath it stack in the middle. */
  const cy = y + h * 0.50;
  const pad = W * 0.05;

  const icons = await loadIcons();
  if (icons){
    const size = h * 0.42;

    // trolley, from the left of the sheet
    ctx.drawImage(icons, 0, 0, 60, 64,
      pad, cy - size * 0.5, size, size);

    // van, from the right — a wider slice, since it carries motion lines
    const vw = size * 1.35;
    ctx.drawImage(icons, 260, 0, 100, 64,
      W - pad - vw, cy - size * 0.5, vw, size);
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(80,20,0,.45)";
  ctx.shadowBlur = Math.round(h * 0.08);

  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.round(h * 0.27)}px Helvetica Neue, Helvetica, Arial, sans-serif`;
  // Spaced out: at this size tight letters read as a label, spaced ones
  // as a wordmark.
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(h * 0.028)}px`;
  ctx.fillText("Al-Arafah Super Shop", W / 2, cy - h * 0.09);

  /* What the shop is and where, in small caps under the name. It gives
     the band something to say rather than only something to look at. */
  ctx.fillStyle = "rgba(255,238,205,.92)";
  ctx.font = `600 ${Math.round(h * 0.135)}px Helvetica Neue, Helvetica, Arial, sans-serif`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(h * 0.05)}px`;
  ctx.fillText("HALAL GROCERY · TSUKUBA", W / 2, cy + h * 0.20);

  ctx.restore();
}
