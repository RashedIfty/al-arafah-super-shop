/**
 * Fill the Bangla and Japanese fields from the English one.
 *
 * The owner types the English name and the other two appear a moment
 * later, still editable. A translation is a starting point, not an
 * answer: brand names and shop words are exactly what a model gets wrong,
 * and the owner is the one who knows what the packet actually says.
 *
 * Two rules keep it out of the way:
 *   - a field the owner has typed into is never touched
 *   - anything that goes wrong leaves all three fields as they were
 */
import { SUPABASE, isConfigured } from "../backend/config.js";

const ENDPOINT = () => `${SUPABASE.URL}/functions/v1/translate`;

/** Give up rather than leave the owner waiting on a form. */
const TIMEOUT = 4000;

/** The same name typed twice in a session costs nothing the second time. */
const cache = new Map();
const CACHE_MAX = 60;

/**
 * Ask for a translation. Returns empty strings on any failure, which the
 * caller reads as "leave the fields alone".
 */
export async function translate(text){
  const key = text.trim().toLowerCase();
  if (!key || !isConfigured()) return { bn: "", ja: "" };

  if (cache.has(key)) return cache.get(key);

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT);

  try {
    const res = await fetch(ENDPOINT(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE.KEY}`,
      },
      body: JSON.stringify({ text: text.trim() }),
      signal: stop.signal,
    });

    if (!res.ok) return { bn: "", ja: "" };

    const out = await res.json();
    const result = { bn: out.bn || "", ja: out.ja || "", reason: out.reason };

    if (result.bn || result.ja){
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(key, result);
    }

    return result;

  } catch {
    return { bn: "", ja: "" };             // aborted, offline, or refused
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wire an English field to the two it fills.
 *
 * `en`, `bn` and `ja` are element ids. The translation runs when the
 * owner leaves the English field, and only fills a box they have left
 * empty — their own words are never replaced.
 *
 * `onState` is called with "working", "done" or "failed" so the caller
 * can say what is happening.
 */
export function autoTranslate({ en, bn, ja, onState }){
  const source = document.getElementById(en);
  const target = {
    bn: document.getElementById(bn),
    ja: document.getElementById(ja),
  };
  if (!source || !target.bn || !target.ja) return;

  /* Newest request wins. Typing a name, correcting it, and leaving the
     field twice must not let the first answer land after the second. */
  let run = 0;

  /* What this filled in last time.
   *
   * Changing "Chicken" to "Beef" has to change the other two, so an
   * empty box is not the test for whether we may write. The test is
   * whether the box still holds what we put there: our own work is ours
   * to replace, the owner's is not. */
  const ours = { bn: "", ja: "" };

  /** True when we may write here: it is empty, or still holds our text. */
  const mayFill = k => {
    const now = target[k].value.trim();
    return !now || now === ours[k];
  };

  /** The English we last translated, so leaving the field twice with the
      same text does not ask again. */
  let last = "";

  async function fill(){
    const text = source.value.trim();
    if (!text || text === last) return;

    const wanted = ["bn", "ja"].filter(mayFill);
    if (!wanted.length) return;            // the owner has written both

    const mine = ++run;
    last = text;
    onState?.("working");

    const out = await translate(text);
    if (mine !== run) return;              // a newer request has started

    let filled = 0;
    for (const k of wanted){
      // Check again: the owner may have typed while we waited.
      if (out[k] && mayFill(k)){
        target[k].value = out[k];
        ours[k] = out[k];
        target[k].dispatchEvent(new Event("input", { bubbles: true }));
        filled++;
      }
    }

    // A failure should not stop the next attempt from trying again.
    if (!filled) last = "";

    onState?.(filled ? "done" : "failed");
  }

  /* Fill while they type, once they stop.
   *
   * Waiting for the field to lose focus meant the owner had to know to
   * click elsewhere before anything happened — and typing a name and
   * looking at it is the obvious thing to do instead. A pause of about a
   * second reads as finished without asking on every keystroke. */
  let idle;
  source.addEventListener("input", () => {
    clearTimeout(idle);
    idle = setTimeout(fill, 900);
  });

  // Leaving the field fills immediately rather than waiting out the pause.
  source.addEventListener("blur", () => { clearTimeout(idle); fill(); });

  // Enter should fill without submitting the form half-finished.
  source.addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault(); clearTimeout(idle); fill(); }
  });

  /* Editing a different product starts again: what is in the boxes then
     belongs to that product, not to us, and must not be overwritten. */
  return () => { ours.bn = ""; ours.ja = ""; last = ""; };
}
