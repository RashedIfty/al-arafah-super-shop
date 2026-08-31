/**
 * Country flags — the official rectangular designs.
 *
 * Files under images/flags come from flagcdn (public domain), downloaded
 * once and served from the shop rather than fetched from a third party
 * at page load. There is one per country in COUNTRIES, named by its ISO
 * code, so adding a country never means hunting for a picture.
 *
 * Each keeps its own proportions rather than being forced into a square:
 * cropping Bangladesh to a circle cut off the green field, and Nepal is
 * not a rectangle at all. The tiles give every flag the same box and let
 * it sit inside at its true shape.
 *
 * They are plain <img> rather than inline SVG: the browser caches them,
 * and a flag missing for any reason leaves a gap rather than breaking
 * the page.
 */
import { COUNTRIES } from "./countries.js";

/**
 * The two dozen flags kept as PNG rather than SVG.
 *
 * Most national flags are a few bars and a star, and draw as a couple of
 * kilobytes of vector. A handful carry a full coat of arms — El Salvador
 * and Bolivia run past 200 KB each, more than any product photograph in
 * the shop, and no amount of minifying helps because the weight is real
 * detail rather than sloppy markup. At the size a flag is ever shown, a
 * 320-pixel picture is indistinguishable and about a thousandth of the
 * size.
 */
const RASTER = new Set([
  "ad", "af", "bo", "bt", "bz", "cr", "do", "ec", "es", "fj", "gt",
  "hr", "ht", "md", "me", "mx", "om", "rs", "sm", "sv", "tm", "va",
]);

/** Every country we hold a flag for. */
const HAVE = new Set(COUNTRIES.map(c => c.id));

/** Path to one flag file, or "" when we hold none. */
export const flagSrc = id =>
  HAVE.has(id) ? `/images/flags/${id}.${RASTER.has(id) ? "png" : "svg"}` : "";

/**
 * One flag as an <img>, or an empty string when we have none.
 *
 * `size` is the width; the height follows the flag's own ratio, so no
 * flag is squashed. `alt` is empty by design — the country name always
 * sits beside it and a screen reader should not read it twice.
 */
export function flag(id, { size = 30, cls = "" } = {}){
  if (!HAVE.has(id)) return "";

  return `<img class="flag${cls ? " " + cls : ""}" src="${flagSrc(id)}"
    width="${size}" alt="" loading="lazy" decoding="async">`;
}
