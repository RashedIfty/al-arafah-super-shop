/**
 * Who the customer is, and where they live.
 *
 * The name and photo on the account, the main phone, and the address
 * book: several delivery addresses, each with a label and its own
 * phone, one of them the default the checkout fills in.
 *
 * Shaped like features/account/account.js — module state, a listener
 * Set, an announce() that survives one bad listener, and writes that
 * either go to the server first or are put back when the server says
 * no. The header reads the photo from here on every page; the account
 * page and the checkout read the rest.
 *
 * Nothing is kept in the browser. An address is the shop's record of
 * where to take the box, not a convenience for this laptop.
 */
import { isConfigured } from "../../backend/config.js";
import { isJpMobile, isJpPostal, normalisePhone, normalisePostal }
  from "../../shared/lib/jp.js";

let profile = null;         // { full_name, phone, avatar_url } or null
let addresses = [];         // default first, then oldest first
let loaded = false;

const listeners = new Set();
export const onProfileChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

/* ------------------------------- reading ------------------------------ */

export const myProfile     = () => profile;
export const myAddresses   = () => addresses;
export const profileLoaded = () => loaded;
export const avatarUrl     = () => profile?.avatar_url || "";

/** The one the checkout offers first. Falls back to the oldest. */
export const defaultAddress = () =>
  addresses.find(a => a.is_default) ?? addresses[0] ?? null;

/**
 * Can this be delivered? All four fields, with the phone and postcode in
 * the shape the database will accept. Checked before the order is sent,
 * so the customer is told what is missing rather than refused.
 */
export const shipComplete = s => Boolean(
  s && s.full_name?.trim() && s.address?.trim()
    && isJpMobile(s.phone) && isJpPostal(s.postal)
);

/* Default first, then in the order they were added. The same order the
   server returns, kept after every local change so the page never
   reshuffles under the customer. */
const sorted = list => [...list].sort((a, b) =>
  (b.is_default - a.is_default) || (a.created_at < b.created_at ? -1 : 1));

/* ------------------------------- loading ------------------------------ */

/**
 * The profile, and the address book when the page has a use for it.
 *
 * The header wants the photo everywhere; only the account page and the
 * checkout want the addresses, and every other page would be paying for
 * a query it never draws.
 */
export async function refreshProfile({ addresses: withAddresses = false } = {}){
  if (!isConfigured()){ profile = null; addresses = []; loaded = true; return; }

  try {
    const api = await import("../../backend/client.js");
    const user = await api.currentUser();

    if (!user){ profile = null; addresses = []; loaded = true; announce(); return; }

    [profile, addresses] = await Promise.all([
      api.fetchProfile(),
      withAddresses ? api.fetchAddresses() : Promise.resolve(addresses),
    ]);
    addresses = sorted(addresses);
  } catch (e){
    console.warn("profile:", e.message);
    profile = null;
    addresses = [];
  }
  loaded = true;
  announce();
}

/* ------------------------------- writing ------------------------------ */

/**
 * The name and the main phone. Only the fields given are touched, so the
 * checkout can set a name without knowing the phone and the account page
 * can clear a phone without knowing the photo.
 *
 * Returns { ok } or { ok:false, message } — the message is a short code
 * for the two things this checks itself, and the server's words for
 * anything it refuses.
 */
export async function saveMyProfile({ full_name, phone } = {}){
  const clean = {};

  if (full_name !== undefined) clean.full_name = String(full_name).trim() || null;

  if (phone !== undefined){
    const p = normalisePhone(phone);
    if (p && !isJpMobile(p)) return { ok: false, message: "bad-phone" };
    clean.phone = p || null;
  }

  try {
    const api = await import("../../backend/client.js");
    const { data, error } = await api.saveProfile(clean);
    if (error) return { ok: false, message: error.message };

    profile = { ...(profile || {}), ...(data || clean) };
    announce();
    return { ok: true };
  } catch (e){
    return { ok: false, message: e.message || "Could not save." };
  }
}

/**
 * Add an address, or change one. Server first, then the list — the
 * database decides which one is the default, and it may have moved.
 *
 * A customer cannot un-default an address, only make another one the
 * default, so is_default is sent only when it is being set. Without
 * that an edit to the default address would quietly leave them with
 * none.
 */
export async function saveAddress(a){
  const clean = {
    label:   String(a.label ?? "").trim() || "Home",
    phone:   normalisePhone(a.phone),
    postal:  normalisePostal(a.postal),
    address: String(a.address ?? "").trim(),
  };
  if (a.is_default) clean.is_default = true;

  if (!isJpMobile(clean.phone))  return { ok: false, message: "bad-phone" };
  if (!isJpPostal(clean.postal)) return { ok: false, message: "bad-postal" };
  if (!clean.address)            return { ok: false, message: "bad-address" };

  try {
    const api = await import("../../backend/client.js");
    const { data, error } = a.id
      ? await api.updateAddress(a.id, clean)
      : await api.insertAddress({ is_default: false, ...clean });
    if (error) return { ok: false, message: error.message };

    let list = data.is_default
      ? addresses.map(x => ({ ...x, is_default: false }))
      : [...addresses];
    const i = list.findIndex(x => x.id === data.id);
    if (i === -1) list.push(data); else list[i] = data;

    addresses = sorted(list);
    announce();
    return { ok: true, address: data };
  } catch (e){
    return { ok: false, message: e.message || "Could not save." };
  }
}

/**
 * Take an address out. Gone from the list before the request finishes,
 * put back if it fails; read back afterwards, because deleting the
 * default hands it to another and only the database knows which.
 */
export async function deleteAddress(id){
  const before = addresses;
  addresses = addresses.filter(a => a.id !== id);
  announce();

  try {
    const api = await import("../../backend/client.js");
    const { error } = await api.deleteAddress(id);
    if (error) throw error;

    addresses = sorted(await api.fetchAddresses());
    announce();
    return { ok: true };
  } catch (e){
    addresses = before;
    announce();
    return { ok: false, message: e.message || "Could not remove it." };
  }
}

/** Make one the default. The badge moves at once; back if refused. */
export async function setDefaultAddress(id){
  const before = addresses;
  addresses = sorted(addresses.map(a => ({ ...a, is_default: a.id === id })));
  announce();

  try {
    const api = await import("../../backend/client.js");
    const { error } = await api.setDefaultAddress(id);
    if (error) throw error;
    return { ok: true };
  } catch (e){
    addresses = before;
    announce();
    return { ok: false, message: e.message || "Could not change it." };
  }
}

/**
 * A new photo.
 *
 * Shrunk in the browser first, to exactly what a product photo gets —
 * 1000px on the long edge, about 100 KB. It is drawn small in the
 * header, but the owner taps it and sees it full size, and a smaller
 * file looked poor there. Plain, without the shop's ribbon: that marks
 * a photograph of something the shop sells, not a person. Then
 * uploaded, then written to the profile; and only once all three have
 * landed is the old one taken down. Nothing is said about the
 * shrinking: the customer chose a photo and got a photo.
 */
export async function changeAvatar(file){
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type))
    return { ok: false, message: "bad-photo" };

  try {
    const api = await import("../../backend/client.js");
    const { shrinkImage } = await import("../../shared/lib/image.js");

    let small = file;
    try {
      small = await shrinkImage(file, { plain: true });
    } catch { /* the original will do */ }

    const url = await api.uploadPhoto(small);

    const { error } = await api.saveProfile({ avatar_url: url });
    if (error){
      api.deletePhoto(url);                 // do not leave an orphan behind
      return { ok: false, message: error.message };
    }

    const old = profile?.avatar_url;
    profile = { ...(profile || {}), avatar_url: url };
    announce();

    if (old && old !== url) api.deletePhoto(old);   // best effort
    return { ok: true, url };
  } catch (e){
    return { ok: false, message: e.message || "upload-failed" };
  }
}

/** Back to the initial. */
export async function removeAvatar(){
  const old = profile?.avatar_url;
  if (!old) return { ok: true };

  try {
    const api = await import("../../backend/client.js");
    const { error } = await api.saveProfile({ avatar_url: null });
    if (error) return { ok: false, message: error.message };

    profile = { ...(profile || {}), avatar_url: null };
    announce();
    api.deletePhoto(old);
    return { ok: true };
  } catch (e){
    return { ok: false, message: e.message || "Could not remove it." };
  }
}
