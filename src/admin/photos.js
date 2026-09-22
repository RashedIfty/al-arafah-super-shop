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

/* ---------------------------- the customers --------------------------- */

/* Their faces, by user id. The orders list shows one beside each name,
   so the owner ringing forty people sees who each one is rather than
   reading forty names. Filled once at panel load from a view the owner
   alone may read; a customer with no photo simply is not in it. */
let faces = new Map();

export function setCustomerPhotos(rows){
  faces = new Map();
  for (const r of rows || [])
    if (r.user_id && r.avatar_url) faces.set(String(r.user_id), r.avatar_url);
}

/** A customer's photo, or "" when they have not put one up. */
export const customerPhotoOf = uid => faces.get(String(uid)) || "";

/**
 * Tapping a face shows it large, over the panel, in the same dark box
 * the panel uses for everything else. Bound once on the document;
 * Escape, the backdrop and the cross all close it.
 */
export function initFaces(){
  if (document.body.dataset.facesBound) return;
  document.body.dataset.facesBound = "1";

  const close = () => document.getElementById("faceView")?.remove();

  document.addEventListener("click", e => {
    if (e.target.closest("[data-face-x]")){ close(); return; }

    const btn = e.target.closest("[data-face]");
    if (!btn) return;
    close();

    const box = document.createElement("div");
    box.className = "ad-modal face-modal";
    box.id = "faceView";
    box.innerHTML = `
      <div class="ad-modal-bg" data-face-x></div>
      <div class="face-box">
        <button type="button" class="face-x" data-face-x aria-label="Close">&times;</button>
        <img src="${btn.dataset.face}" alt="">
        ${btn.dataset.faceName ? `<b>${btn.dataset.faceName}</b>` : ""}
      </div>`;
    document.body.appendChild(box);
  });

  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

/**
 * The small round face beside a name, or nothing. Tapping it opens the
 * photo large — see openFace() in main.js — so the whole thing is a
 * button rather than an image.
 */
export function faceHTML(url, name = ""){
  if (!url) return "";
  const safe = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return `
    <button type="button" class="face" data-face="${safe(url)}"
            data-face-name="${safe(name)}" title="See photo">
      <img src="${safe(url)}" alt="" loading="lazy" width="30" height="30">
    </button>`;
}
