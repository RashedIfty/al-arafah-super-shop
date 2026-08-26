/**
 * Language state.
 *
 * Holds the active language, persists the choice, and notifies subscribers
 * when it changes so each component can re-render itself.
 */
import { UI, LANGS, DEFAULT_LANG } from "../data/i18n.js";

const STORAGE_KEY = "aa-lang";
const listeners = new Set();

/** Stored choice → browser language → default. */
function detect(){
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* private browsing — ignore */ }

  const nav = (navigator.language || "").slice(0, 2);
  return LANGS.includes(nav) ? nav : DEFAULT_LANG;
}

let current = detect();

/** Active language code, e.g. "bn". */
export const getLang = () => current;

/** Translation table for the active language. */
export const t = () => UI[current];

/** Change language, persist it, and notify subscribers. */
export function setLang(code){
  if (!LANGS.includes(code) || code === current) return;
  current = code;

  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }

  document.documentElement.lang = code;
  listeners.forEach(fn => fn(code));
}

/** Subscribe to language changes. Returns an unsubscribe function. */
export function onLangChange(fn){
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Apply the language to <html> on first load. */
export function initLang(){
  document.documentElement.lang = current;
}

export { LANGS };
