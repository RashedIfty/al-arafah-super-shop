/**
 * i18n registry — every supported language in one place.
 * To add a language: create i18n.<code>.js, import it, add it below.
 */
import en from "./en.js";
import bn from "./bn.js";
import ja from "./ja.js";

export const UI = { en, bn, ja };

/** Language codes in the order they appear in the switcher. */
export const LANGS = Object.keys(UI);

/** Fallback when the stored/browser language is unsupported. */
export const DEFAULT_LANG = "en";
