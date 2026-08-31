/**
 * Country flags — the official rectangular designs.
 *
 * Files under images/flags come from flagcdn (public domain), downloaded
 * once and served from the shop rather than fetched from a third party
 * at page load.
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

/** Countries we hold a flag file for. */
const HAVE = new Set([
  "bd", "in", "pk", "jp", "id", "th", "tr", "my",
  "np", "lk", "cn", "kr", "vn", "ph", "mm",
]);

/** Path to one flag file. */
export const flagSrc = id => HAVE.has(id) ? `/images/flags/${id}.svg` : "";

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
