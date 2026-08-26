/**
 * i18n registry — every supported language in one place.
 * To add a language: create i18n.<code>.js, import it, add it below.
 */
import en from "./i18n.en.js";
import bn from "./i18n.bn.js";
import ja from "./i18n.ja.js";

export const UI = { en, bn, ja };

/** Language codes in the order they appear in the switcher. */
export const LANGS = Object.keys(UI);

/** Fallback when the stored/browser language is unsupported. */
export const DEFAULT_LANG = "en";
