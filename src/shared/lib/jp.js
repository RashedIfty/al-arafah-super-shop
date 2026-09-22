/**
 * Japanese phone numbers and postcodes, as the shop accepts them.
 *
 * Pure functions with no state, shared by the checkout form and the
 * account page — both ask a customer for the same two things and must
 * agree on what counts as right. They used to live with the orders
 * module; they moved here the day a second module needed them.
 */

/**
 * A Japanese mobile: 070, 080 or 090 and eight more digits.
 *
 * Landlines are deliberately not accepted. A delivery needs a number
 * somebody carries, and the owner rings to confirm every order — a
 * house phone nobody is standing next to is worse than no number.
 *
 * Separators are allowed on the way in and stripped on the way out, so
 * a customer may type it however they are used to seeing it written.
 */
export const digitsOnly = s => String(s ?? "").replace(/[^\d]/g, "");

/**
 * The number as the database wants it: eleven digits beginning 0.
 *
 * A customer who has their number saved in international form types
 * +81 90-1234-5678, which is the same phone as 090-1234-5678 with the
 * country code in front of it. Rejecting that would be refusing a
 * correct answer on a technicality, so the +81 is folded back to the
 * leading zero before anything else looks at it.
 */
export const normalisePhone = s => {
  const d = digitsOnly(s);
  return d.startsWith("81") && d.length === 12 ? "0" + d.slice(2) : d;
};

export const isJpMobile = s => /^0[789]0\d{8}$/.test(normalisePhone(s));

/** 305-0005. Stored with the hyphen, which is how Japan writes it. */
export const isJpPostal = s => /^\d{3}-?\d{4}$/.test(String(s ?? "").trim());

export const normalisePostal = s => {
  const d = digitsOnly(s);
  return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : String(s ?? "").trim();
};
