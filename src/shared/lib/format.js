/**
 * Formatting helpers.
 */

/** 3890 → "¥3,890" */
export const yen = n => "¥" + Number(n).toLocaleString("en-US");

/** Percentage saved, or 0 when the item is not discounted. */
export const discount = (was, now) =>
  was && was > now ? Math.round((was - now) / was * 100) : 0;

/** Monday-first index for today (0 = Monday … 6 = Sunday). */
export const todayIndex = () => (new Date().getDay() + 6) % 7;
