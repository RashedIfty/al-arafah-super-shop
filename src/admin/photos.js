/**
 * Product photographs, by id, for the printed invoice.
 *
 * Its own module because the alternative was a circle: the invoice needs
 * the photographs, the orders panel owns the catalogue, and the panel
 * opens the invoice. Two files importing each other is how the whole
 * admin stopped loading.
 *
 * order_items freezes the name and the price but not the picture, and it
 * should not — that would copy a photograph into every line of every
 * order for ever. The id is enough to find it again.
 */

let photos = new Map();

/** Refill from the catalogue the panel already holds. */
export function setPhotos(catalog){
  photos = new Map();
  for (const c of catalog || [])
    for (const p of c.items || [])
      if (p._id && p.img) photos.set(String(p._id), p.img);
}

/** The photograph for a product, or "" if it has been deleted since. */
export const photoOf = id => photos.get(String(id)) || "";
