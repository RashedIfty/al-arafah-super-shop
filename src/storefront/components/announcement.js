/**
 * Shop announcement banner.
 *
 * One message at a time, set by the owner. Sits above the deals so it is
 * the first thing a customer reads. When there is no message, or the
 * owner switches it off, nothing renders and the page looks as it did.
 */
import { esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { getLang } from "../../features/i18n/lang.js";

const CACHE_KEY = "aa-notice";

/** Filled from the network; seeded from the last visit so the banner
    does not pop in a second late. */
let current = readCache();

export function setAnnouncement(row){
  current = row;
  writeCache(row);
}

/* The banner is small and changes rarely, so showing the previous value
   immediately is far better than a blank gap. The network reply
   overwrites it moments later. */
function readCache(){
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(row){
  try {
    if (row) sessionStorage.setItem(CACHE_KEY, JSON.stringify(row));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch { /* private mode */ }
}

/** True when there is a live message with text in the current language. */
export function hasAnnouncement(){
  if (!current?.active) return false;
  const lang = getLang();
  return Boolean((current[lang] || current.en || "").trim());
}

export function announcementHTML(){
  if (!hasAnnouncement()) return "";

  const lang = getLang();
  const text = (current[lang] || current.en).trim();

  return `
    <div class="notice" role="status">
      <div class="wrap notice-in">
        <span class="notice-icon">${icon("bulb", { size: 20 })}</span>
        <p class="notice-text">${esc(text)}</p>
      </div>
    </div>`;
}
