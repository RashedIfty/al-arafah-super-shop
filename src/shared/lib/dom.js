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
  if (el) el.innerHTML = html;
  return el;
}

/** Escape text destined for innerHTML. */
const ENTITIES = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ENTITIES[c]);

/** Add a listener only if the element exists. */
export function on(sel, event, handler, root = document){
  const el = typeof sel === "string" ? $(sel, root) : sel;
  if (el) el.addEventListener(event, handler);
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
