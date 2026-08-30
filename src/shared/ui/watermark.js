/**
 * The shop's ribbon, laid across the bottom of every photo the owner
 * uploads.
 *
 * Drawn here rather than loaded from a file. The artwork it is based on
 * came with a checkerboard painted into the image, and cutting that away
 * was never reliable: the checks' white and the ribbon's own white are
 * the same colour, so every attempt either left grey squares behind or
 * ate into the badge. Drawn in code there is no background to remove —
 * everything outside the shape is simply not painted.
 *
 * It also scales cleanly to any photo size, and weighs nothing.
 */

/** Nearly the full width: this is a band across the photo, not a badge. */
const WIDTH_SHARE = 0.90;

/** Distance from the bottom, as a share of the photo's height.
    Small: the ribbon should sit on the edge of the picture, not float
    above it. Measured against height rather than width, or a tall
    portrait pushes it far up the frame. */
const PAD_SHARE = 0.008;

/** Solid, but not quite flat against the photograph. */
const OPACITY = 0.95;

/**
 * The ribbon as an SVG string.
 *
 * A straight bar with its ends folded away behind darker tails, a
 * highlight along the top edge and a shade along the bottom, so it reads
 * as a band of material rather than a flat rectangle.
 */
export function ribbonSVG(w = 900){
  const h = Math.round(w * 0.20);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
   viewBox="0 0 900 180" fill="none">
  <defs>
    <linearGradient id="rb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="#f39325"/>
      <stop offset=".55" stop-color="#ee7016"/>
      <stop offset="1"   stop-color="#dd3c17"/>
    </linearGradient>
    <linearGradient id="rt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c32d10"/>
      <stop offset="1" stop-color="#9c2109"/>
    </linearGradient>
    <filter id="rl" x="-6%" y="-30%" width="112%" height="180%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity=".30"/>
    </filter>
  </defs>

  <g filter="url(#rl)">
    <!-- the tails, folded behind each end -->
    <path d="M40 52 L 64 44 L 60 118 L 24 96 Z"    fill="url(#rt)"/>
    <path d="M860 52 L 836 44 L 840 118 L 876 96 Z" fill="url(#rt)"/>

    <!-- the band -->
    <path d="M64 44 L 836 44 L 808 136 L 92 136 Z" fill="url(#rb)"/>

    <!-- its ends, angled in -->
    <path d="M64 44 L 92 136 L 60 118 L 40 52 Z"    fill="url(#rb)"/>
    <path d="M836 44 L 808 136 L 840 118 L 860 52 Z" fill="url(#rb)"/>

    <!-- light along the top, shade along the bottom -->
    <path d="M64 44 L 836 44 L 832 58 L 68 58 Z"    fill="#fff" opacity=".20"/>
    <path d="M96 122 L 806 122 L 808 136 L 92 136 Z" fill="#000" opacity=".13"/>
  </g>

  <!-- trolley -->
  <g transform="translate(118,74) scale(1.10)" fill="#fff">
    <path d="M0 0h6l4.6 17.5h24.6l4.6-11.6H12.4" stroke="#fff" stroke-width="3.4"
          fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="14" cy="24" r="3.1"/>
    <circle cx="32" cy="24" r="3.1"/>
  </g>

  <!-- the name -->
  <text x="452" y="105" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="46" font-weight="700" letter-spacing=".2"
        fill="#fff">Al-Arafah Super Shop</text>

  <!-- delivery van -->
  <g transform="translate(726,70)" fill="#fff">
    <path d="M14 4h30v13h9l8 9v10h-6a6 6 0 0 0-12 0H32a6 6 0 0 0-12 0h-6V4z"/>
    <circle cx="26" cy="36" r="4.6"/>
    <circle cx="51" cy="36" r="4.6"/>
    <g stroke="#fff" stroke-width="3" stroke-linecap="round">
      <path d="M-4 12h12M-9 20h17M-4 28h12"/>
    </g>
  </g>
</svg>`;
}

/** Turn the SVG into something a canvas can draw. */
function render(svg){
  return new Promise(resolve => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * Lay the ribbon across the bottom of a canvas.
 *
 * Drawn at the size it will occupy rather than scaled afterwards, so the
 * text and the icons stay sharp whatever the photo's dimensions.
 */
export async function stamp(canvas){
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = Math.round(canvas.width * WIDTH_SHARE);

  const mark = await render(ribbonSVG(w));
  if (!mark) return;                       // a photo without a mark beats none

  const pad = Math.round(canvas.height * PAD_SHARE);
  const x = Math.round((canvas.width - w) / 2);
  const y = canvas.height - mark.height - pad;

  ctx.save();
  ctx.globalAlpha = OPACITY;
  ctx.drawImage(mark, x, y);
  ctx.restore();
}
