/**
 * Tiny DOM helpers — the only place we touch the document directly.
 */

/** First match, or null. */
export const $ = (sel, root = document) => root.querySelector(sel);

/** All matches, as a real array. */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Set innerHTML if the target exists; no-op otherwise. */
export function put(sel, html, root = document){
  const el = $(sel, root);
  if (!el) return el;

  /* Only when it has actually changed.
   *
   * render() rebuilds every mount on the page, and it runs again the
   * moment the session comes back from the network — so the catalogue,
   * the footer and seventy images were thrown away and recreated
   * identical a few hundred milliseconds after the first paint. That is
   * the flicker: not slow work, but visible work that did not need
   * doing.
   *
   * Compared against what was last written, not against innerHTML. The
   * browser rewrites what it stores — a <path/> comes back as
   * <path></path> — so reading it back never matches what was generated
   * and every mount rewrote regardless. */
  const next = String(html);
  if (el.__put === next) return el;

  el.innerHTML = next;
  el.__put = next;
  return el;
}

/** Escape text destined for innerHTML. */
const ENTITIES = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ENTITIES[c]);

/**
 * Add a listener only if the element exists.
 *
 * The fourth argument is either a root to search within, or the usual
 * listener options — a touchmove that calls preventDefault needs
 * { passive: false }, and passing it as a root would silently drop it.
 */
export function on(sel, event, handler, opts){
  // Options are a plain object with listener flags; a root is a node.
  const isOpts = Boolean(opts) && typeof opts.addEventListener !== "function"
    && typeof opts.querySelector !== "function";

  const root = (!opts || isOpts) ? document : opts;
  const el = typeof sel === "string" ? $(sel, root) : sel;

  if (el) el.addEventListener(event, handler, isOpts ? opts : undefined);
  return el;
}

/**
 * Fall back to the shop placeholder when a photo will not load.
 *
 * An empty `img` is already handled where the markup is built, but a
 * photo that has been deleted from storage, or fails on a bad
 * connection, leaves a broken-image icon on the shelf. Attribute form,
 * so it survives innerHTML — the pages are rebuilt that way on every
 * language change.
 *
 * Guarded against looping if the placeholder itself ever goes missing.
 */
export const IMG_FALLBACK =
  `onerror="if(!this.dataset.fb){this.dataset.fb=1;` +
  `this.src='/images/placeholder.svg'}"`;

/** Smooth-scroll to an element id, accounting for the sticky nav. */
export function scrollToId(id, delay = 0){
  const el = document.getElementById(id);
  if (!el) return;
  setTimeout(() => el.scrollIntoView({ behavior:"smooth", block:"start" }), delay);
}
