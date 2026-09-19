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

/**
 * A timestamp as the shop reads it.
 *
 * Always Tokyo, never the reader's own clock. An order placed at eleven
 * at night in Tsukuba must say eleven at night to the owner standing in
 * the shop, and to a customer who happens to be abroad — otherwise the
 * two of them are looking at different times for the same order.
 */
export const jstDate = (iso, withTime = true) => {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";

  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "short", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
};

/** Just the day, for grouping a list of orders. "2026-09-19" in Tokyo. */
export const jstDay = iso => {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";

  // en-CA gives ISO order, which sorts correctly as a plain string.
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
};
