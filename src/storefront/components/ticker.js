/**
 * The scrolling strip at the top of every page.
 *
 * One long line of text sliding leftwards, wrapping round forever. The
 * trick is that the list is rendered twice: the animation moves the track
 * exactly one copy's width and then snaps back, and because the second
 * copy is identical the join is invisible. A single copy would leave a
 * gap crossing the screen on every loop.
 *
 * The duration is set from the number of lines rather than fixed, so the
 * text always moves at the same speed however much of it there is —
 * adding a line makes the loop longer, not faster.
 */
import { esc } from "../../shared/lib/dom.js";
import { icon } from "../../shared/ui/icons.js";
import { getLang } from "../../features/i18n/lang.js";
import { shuffled } from "../../features/ticker/ticker.js";

/** Seconds each line takes to cross. Slow enough to read in passing. */
const PER_LINE = 7;

/**
 * The order for this page view.
 *
 * Held here rather than reshuffled inside the render, because the page
 * re-renders whenever the language changes or fresh data lands — and the
 * strip jumping to a new order mid-visit would look like a fault. New on
 * each load, steady within it.
 */
const order = shuffled();

/** One line: its icon, its words, and a separator after it. */
function itemHTML(line, lang){
  return `
    <span class="tick-item">
      ${line.icon ? `<i class="tick-ico">${icon(line.icon, { size: 15 })}</i>` : ""}
      <span>${esc(line[lang] || line.en)}</span>
    </span>
    <span class="tick-dot" aria-hidden="true">◆</span>`;
}

export function tickerHTML(){
  const lang = getLang();
  const run = order.map(l => itemHTML(l, lang)).join("");

  /* Two copies, so the end of one meets the start of the next with no
     gap. The second is hidden from screen readers, which should hear the
     list once rather than twice. */
  return `
    <div class="tick" role="complementary" aria-label="Shop highlights">
      <div class="tick-track" style="--dur:${order.length * PER_LINE}s">
        <div class="tick-run">${run}</div>
        <div class="tick-run" aria-hidden="true">${run}</div>
      </div>
    </div>`;
}
