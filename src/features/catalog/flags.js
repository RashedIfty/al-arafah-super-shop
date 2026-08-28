/**
 * Country flags.
 *
 * The files under images/flags are the circle-flags set (MIT licensed),
 * downloaded once and served from the shop rather than fetched from a
 * third party at page load. Circular, so they sit evenly in a row
 * whatever the country's real proportions are.
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

export const hasFlag = id => HAVE.has(id);

/** Path to one flag file. */
export const flagSrc = id => HAVE.has(id) ? `/images/flags/${id}.svg` : "";

/**
 * One flag as an <img>, or an empty string when we have none.
 *
 * `alt` is empty by design: the country name always sits beside it, and
 * a screen reader should not read the name twice.
 */
export function flag(id, { size = 30, cls = "" } = {}){
  if (!HAVE.has(id)) return "";

  return `<img class="flag${cls ? " " + cls : ""}" src="${flagSrc(id)}"
    width="${size}" height="${size}" alt="" loading="lazy" decoding="async">`;
}
