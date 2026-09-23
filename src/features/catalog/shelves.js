/**
 * Shelves — the ways of browsing that are not categories.
 *
 * A category is where a product lives: one product, one category, and the
 * owner picks it from a list. A shelf is a way of looking at the shop
 * that cuts across those categories — everything from Bangladesh,
 * everything that just arrived, everything that sells well. A product can
 * sit on several shelves at once, or none, and it never leaves its
 * category to do so.
 *
 * They are defined here rather than as rows in the categories table.
 * Countrywise used to be a row, which is what made it keep turning up as
 * a category the owner could file a product under, or delete by accident.
 * A shelf has no row, so that cannot happen again.
 *
 * The storefront shows them together under the categories, below a rule,
 * because that is what they are: a second way in, not more of the first.
 */
import { countriesInUse } from "./countries.js";

/**
 * The four shelves, in the order they appear. Special Offers leads:
 * it is the one the shop wants noticed.
 *
 * `count` answers "how many things are on this shelf" for the tile, and
 * `has` answers "is there anything here at all" — an empty shelf is
 * hidden, because a customer who clicks one deserves to find something.
 *
 * `img` is a picture that ships with the code. These are fixed parts of
 * the shop rather than things the owner maintains, so unlike a category
 * they have no photo to upload and no name to edit.
 */
export const SHELVES = [
  {
    id: "offer",
    href: "offers.html",
    /* Animated — it bounces and flashes, to be noticed. `still` is one
       frame of it for anyone whose device asks for less motion. */
    img: "/images/shelves/offers.webp",
    still: "/images/shelves/offers.jpg",
    en: "Special Offers", bn: "বিশেষ অফার", ja: "特別セール",
    count: catalog => onShelf(catalog, "offer").length,
    label: "items",
  },
  {
    id: "countrywise",
    href: "countries.html",
    img: "/images/shelves/countrywise.jpg",
    en: "Countrywise", bn: "দেশ অনুযায়ী", ja: "国から探す",
    // Countries, not products: the tile leads to a list of countries.
    count: catalog => countriesInUse(catalog).length,
    label: "countries",
  },
  {
    id: "new",
    href: "new.html",
    img: "/images/shelves/new.jpg",
    en: "New Products", bn: "নতুন পণ্য", ja: "新商品",
    count: catalog => onShelf(catalog, "new").length,
    label: "items",
  },
  {
    id: "popular",
    href: "popular.html",
    img: "/images/shelves/popular.jpg",
    en: "Popular Products", bn: "জনপ্রিয় পণ্য", ja: "人気商品",
    count: catalog => onShelf(catalog, "popular").length,
    label: "items",
  },
];

/** One shelf by id, or null. */
export const shelfById = id => SHELVES.find(s => s.id === id) || null;

/**
 * Which products carry a shelf flag.
 *
 * Kept as booleans on the product rather than a join table: a product
 * is on a shelf or it is not, there are three of them, and the owner sets
 * them with a tick box. A table would buy flexibility nobody has asked
 * for at the cost of a query on every page.
 */
export const SHELF_FLAG = { offer: "isOffer", new: "isNew", popular: "isPopular" };

/**
 * Every product on a shelf, across all categories.
 *
 * Each carries the category it came from and both indices, because the
 * lightbox looks a product up by category and position — renumbering
 * here would open the wrong photograph.
 */
export function onShelf(catalog, shelfId){
  const flag = SHELF_FLAG[shelfId];
  if (!flag) return [];

  const out = [];
  (catalog ?? []).forEach((cat, ci) => {
    cat.items.forEach((p, pi) => {
      if (p[flag]) out.push({ p, cat, ci, pi });
    });
  });
  return out;
}
