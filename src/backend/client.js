/**
 * Supabase client and data access.
 *
 * Everything the site reads goes through here. When Supabase is not
 * configured the functions fall back to the bundled data files, so the
 * site keeps working offline and during setup.
 */
import { SUPABASE, isConfigured, R2 } from "./config.js";

let client = null;

/** Lazily create the client (the SDK is loaded from a CDN on first use). */
/**
 * How long a session may sit idle before it is dropped.
 *
 * Fifteen minutes of no clicking, typing or scrolling and whoever is
 * signed in is signed out — which matters most on a shared machine,
 * where the owner walking away from the admin panel should not leave it
 * open for the next person.
 */
export const IDLE_MS = 15 * 60 * 1000;

/** Where the last activity was seen, shared across tabs. */
const SEEN_KEY = "aa-seen";

/**
 * Sessions live in sessionStorage, not localStorage.
 *
 * localStorage is what the SDK uses by default, and it survives the
 * browser closing — sign in once and you are still signed in tomorrow.
 * sessionStorage is emptied when the tab closes, which is the behaviour
 * the shop wants: the owner's panel should not still be open on a shared
 * machine the next morning.
 *
 * The cost is that each tab is its own session, so signing in twice in
 * two tabs means signing in twice. For a grocery shop's admin panel that
 * is the right trade.
 */
const tabStorage = {
  getItem: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  removeItem: (k) => { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
};

export async function db(){
  if (!isConfigured()) return null;
  if (client) return client;

  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2");

  client = createClient(SUPABASE.URL, SUPABASE.KEY, {
    auth: {
      storage: tabStorage,
      persistSession: true,
      autoRefreshToken: true,
      /* The password-reset link carries its session in the address bar,
         and the page that sets a new password has nothing else to prove
         who the person is. That was written when no link on this site
         signed anybody in; one does now, and refusing to read it made
         every reset link report itself expired. */
      detectSessionInUrl: true,
    },
  });

  startIdleWatch();
  return client;
}

/* ---------------------------- the idle clock -------------------------- */

let watching = false;

/**
 * Sign out after a stretch of doing nothing.
 *
 * The last-seen time is kept in sessionStorage rather than a variable,
 * so a session cannot be kept alive by a page that was left open and
 * never touched: coming back to the tab checks the clock, and a tab
 * reloaded after twenty minutes finds the stamp already stale.
 */
function startIdleWatch(){
  if (watching || typeof document === "undefined") return;
  watching = true;

  const touch = () => {
    try { sessionStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode */ }
  };

  const check = async () => {
    let seen = 0;
    try { seen = Number(sessionStorage.getItem(SEEN_KEY)) || 0; } catch { return; }
    if (!seen || Date.now() - seen < IDLE_MS) return;

    // Only worth acting on if somebody is actually signed in.
    const { data } = await client.auth.getSession();
    if (!data?.session) return;

    try { sessionStorage.removeItem(SEEN_KEY); } catch { /* private mode */ }
    await client.auth.signOut();

    /* The owner's panel shows what it holds, so it has to be reloaded
       rather than left on screen after the session behind it has gone.
       The shop itself only loses a heart or two and can repaint quietly. */
    if (document.body?.classList.contains("admin")
        || document.querySelector("#panel")) location.reload();
  };

  touch();
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach(ev =>
    document.addEventListener(ev, touch, { passive: true }));

  // Coming back to a tab left open all afternoon is exactly when this
  // has to fire, so the check runs then as well as on the minute.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });

  setInterval(check, 60_000);
}

/* ------------------------------- read -------------------------------- */

/**
 * Read live rows straight over REST, without the SDK.
 *
 * The SDK is ~68 KB pulled from a third-party CDN, and the shop cannot
 * ask for a single product until it and its dependencies have arrived.
 * For the first paint that wait is the whole delay, and a plain fetch to
 * the same endpoint needs none of it. The SDK still handles writing,
 * auth and realtime, where it earns its size.
 */
async function readTables(names){
  if (!isConfigured()) return null;

  try {
    const results = await Promise.all(names.map(async name => {
      // A snippet in the page head started these before this module had
      // finished downloading. Take the answer if it is already on its
      // way; ask again only if it is not, or if it failed.
      const early = globalThis.__preload?.[name];
      if (early){
        const data = await early;
        // Used once: a later refresh must see current rows, not these.
        globalThis.__preload[name] = null;
        if (data) return { data };
      }

      const url = `${SUPABASE.URL}/rest/v1/${name}`
        + `?select=*&archived_at=is.null&order=sort`;

      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE.KEY,
          Authorization: `Bearer ${SUPABASE.KEY}`,
        },
      });

      if (!res.ok) throw new Error(`${name}: ${res.status}`);
      return { data: await res.json() };
    }));

    return results;
  } catch (e){
    console.warn("readTables:", e.message);
    return null;
  }
}

/**
 * Categories with their products nested, shaped exactly like the old
 * CATALOG array so nothing downstream needs to change.
 */
export async function fetchCatalog(){
  const rows = await readTables(["categories", "products"]);
  if (!rows) return null;

  const [cats, prods] = rows;

  return cats.data.map(cat => ({
    id: cat.id, icon: cat.icon, img: cat.img,
    en: cat.en, bn: cat.bn, ja: cat.ja,
    items: prods.data
      .filter(p => p.category_id === cat.id)
      /* Sold-out last, whatever their sort order.
         A customer scanning a category is looking for something they can
         buy today, and a greyed-out card in the middle of the row is a
         gap in that. Their order among themselves is left alone, and
         everything still on the shelf keeps the order the owner gave it.
         Done here rather than in the SQL so every page that reads the
         catalogue — the shelves, the country pages, search — inherits it. */
      .sort((a, b) => (a.tag === "out" ? 1 : 0) - (b.tag === "out" ? 1 : 0))
      .map(p => ({
        _id: p.id,
        en: p.en, bn: p.bn, ja: p.ja,
        w: p.w, p: p.p, was: p.was,
        img: p.img, ...(p.tag ? { tag: p.tag } : {}),
        ...(p.country ? { country: p.country } : {}),
        // The shelves a product sits on, beside the category it lives in.
        isNew: Boolean(p.is_new), isPopular: Boolean(p.is_popular),
        isOffer: Boolean(p.is_offer)
      }))
  }));
}

/** The homepage deals strip. */
export async function fetchDeals(){
  const rows = await readTables(["deals"]);
  if (!rows) return null;

  const { data } = rows[0];

  return data.map(d => ({
    _id: d.id, type: d.type,
    en: d.en, bn: d.bn, ja: d.ja,
    w: d.w, p: d.p, was: d.was, img: d.img
  }));
}

/* ------------------------------- write ------------------------------- */

/**
 * Add a product to the front of its category.
 *
 * What the shop has just got in is what a customer wants to see, and the
 * owner wants it where they can find it. Everything already in the
 * category is pushed down one place rather than the newcomer being given
 * a negative sort: the numbers stay 0,1,2… and nothing drifts as
 * products come and go.
 */
export async function insertProduct(categoryId, p){
  const c = await db();

  /* Order by sort, then by age. Older inserts numbered themselves from a
     count that could be stale, so a category can hold several rows at the
     same sort; created_at breaks those ties, and the renumbering below
     leaves the category clean whatever state it was in. */
  const { data: existing } = await c.from("products")
    .select("id").eq("category_id", categoryId).is("archived_at", null)
    .order("sort").order("created_at");

  const res = await c.from("products").insert({
    category_id: categoryId, en: p.en, bn: p.bn, ja: p.ja,
    w: p.w, p: p.p, was: p.was || 0, img: p.img || "",
    tag: p.tag || null, country: p.country || null, sort: 0,
    is_new: Boolean(p.isNew), is_popular: Boolean(p.isPopular),
    is_offer: Boolean(p.isOffer)
  }).select().single();
  if (res.error) return res;

  // Renumber the rest behind it.
  await Promise.all((existing ?? []).map((row, i) =>
    c.from("products").update({ sort: i + 1 }).eq("id", row.id)));

  return res;
}

export async function updateProduct(id, categoryId, p){
  const c = await db();

  // Note the old photo before overwriting: swapping a picture would
  // otherwise strand the previous one in storage for good.
  const { data: was } = await c.from("products").select("img").eq("id", id).single();

  const res = await c.from("products").update({
    category_id: categoryId, en: p.en, bn: p.bn, ja: p.ja,
    w: p.w, p: p.p, was: p.was || 0, img: p.img || "",
    tag: p.tag || null, country: p.country || null,
    // Always sent, even when false: unticking a shelf has to reach the row.
    is_new: Boolean(p.isNew), is_popular: Boolean(p.isPopular),
    is_offer: Boolean(p.isOffer)
  }).eq("id", id);

  if (!res.error) await dropReplaced(c, was?.img, p.img);
  return res;
}

/* -------------------------- announcement ----------------------------- */

/** The single banner row, or null when the shop has none. */
export async function fetchAnnouncement(){
  if (!isConfigured()) return null;

  // Straight over REST like the catalogue: this sits at the top of the
  // page and must not wait for the SDK to download.
  try {
    const res = await fetch(
      `${SUPABASE.URL}/rest/v1/announcement?select=*&id=eq.1`,
      { headers: {
          apikey: SUPABASE.KEY,
          Authorization: `Bearer ${SUPABASE.KEY}`,
        } });

    if (!res.ok) throw new Error(String(res.status));
    const rows = await res.json();
    return rows[0] ?? null;
  } catch (e){
    console.warn("fetchAnnouncement:", e.message);
    return null;
  }
}

/** Save the banner. Passing active:false hides it without losing the text. */
export async function saveAnnouncement(patch){
  const c = await db();
  return c.from("announcement")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
}

/* ---------------------------- archiving ------------------------------ */

/** Hide from the shop without losing the record. */
/**
 * A deal holds a copy of its product, not a reference to it.
 *
 * That keeps a deal's price independent of the shelf price, which is the
 * point, but it also means nothing removes the deal when the product
 * goes. Without this the homepage carries on advertising something the
 * shop no longer sells.
 *
 * Matched on name and weight, which is what the deal was built from.
 */
async function dealsFor(c, products){
  if (!products?.length) return [];

  const { data } = await c.from("deals").select("id,en,w").is("archived_at", null);
  if (!data?.length) return [];

  const gone = new Set(products.map(p => `${p.en} ${p.w}`));
  return data.filter(d => gone.has(`${d.en} ${d.w}`)).map(d => d.id);
}

/** The products a table row covers: itself, or a category's children. */
async function productsUnder(c, table, id){
  if (table === "products"){
    const { data } = await c.from("products").select("en,w").eq("id", id);
    return data ?? [];
  }
  if (table === "categories"){
    const { data } = await c.from("products").select("en,w").eq("category_id", id);
    return data ?? [];
  }
  return [];
}

export async function archive(table, id){
  const c = await db();

  // Take the deals off the shop first: a deal left behind would outlive
  // the product and keep advertising it.
  const stale = await dealsFor(c, await productsUnder(c, table, id));
  const stamp = new Date().toISOString();

  if (stale.length)
    await c.from("deals").update({ archived_at: stamp }).in("id", stale);

  return c.from(table).update({ archived_at: stamp }).eq("id", id);
}

/** Put it back on the shop. */
export async function restore(table, id){
  const c = await db();
  return c.from(table).update({ archived_at: null }).eq("id", id);
}

/** The storage bucket holding uploaded photos. */
const BUCKET = "product-photos";

/**
 * File name inside the bucket, or null for anything we did not upload.
 *
 * Photos that ship with the code ("/images/products/rice.jpg") must never
 * be touched — they belong to the repository, not to the shop's storage.
 */
function uploadedName(img){
  if (typeof img !== "string") return null;
  const marker = `/${BUCKET}/`;
  const at = img.indexOf(marker);
  return at === -1 ? null : img.slice(at + marker.length) || null;
}

/**
 * Delete uploaded photos from storage.
 *
 * Anything still referenced elsewhere is kept: a deal carries a copy of
 * its product's photo address, so deleting the product must not blank the
 * deal's picture.
 *
 * Best effort: a photo that fails to delete is a little wasted space,
 * which is a far better outcome than blocking the record's deletion.
 */
async function removePhotos(c, images){
  // Photos live in two places during and after the move to R2: anything
  // uploaded from now on, and anything uploaded before it. Both are
  // handled, so an older picture is not stranded.
  const wanted = images.filter(Boolean);
  if (!wanted.length) return;

  // What the shop still points at, whichever store it sits in.
  const keep = new Set();
  for (const table of ["products", "categories", "deals"]){
    const { data } = await c.from(table).select("img");
    for (const r of data ?? []) if (r.img) keep.add(r.img);
  }

  for (const img of new Set(wanted)){
    if (keep.has(img)) continue;                 // another row still uses it

    if (R2.PUBLIC_BASE && img.startsWith(R2.PUBLIC_BASE)){
      await deleteFromR2(img);
      continue;
    }

    const name = uploadedName(img);              // Supabase Storage
    if (!name) continue;                         // a repository file: leave it
    const { error } = await c.storage.from(BUCKET).remove([name]);
    if (error) console.error("removePhotos:", error);
  }
}

/** Drop a photo that an edit has just replaced. */
async function dropReplaced(c, before, after){
  if (!before || before === after) return;
  await removePhotos(c, [before]);
}

/**
 * Gone for good — only offered from the archive.
 *
 * The photo goes with it. Storage is not cleaned up by deleting the row,
 * so without this every removed product leaves its picture behind forever.
 * Deleting a category cascades to its products in the database, so their
 * photos have to be collected here too, before the rows disappear.
 */
export async function destroy(table, id){
  const c = await db();

  // Read the addresses first: once the rows are gone they cannot be found.
  const images = [];

  const { data: row } = await c.from(table).select("img").eq("id", id).single();
  if (row?.img) images.push(row.img);

  if (table === "categories"){
    const { data: kids } = await c.from("products").select("img").eq("category_id", id);
    for (const k of kids ?? []) if (k.img) images.push(k.img);
  }

  // Deals copy their product rather than referencing it, so they have to
  // be found before the product disappears and matching becomes
  // impossible. Deleting a product deletes the deals built from it.
  const stale = table === "deals" ? [] : await dealsFor(c, await productsUnder(c, table, id));

  const res = await c.from(table).delete().eq("id", id);
  if (res.error) return res;                 // row still there: keep the photo

  if (stale.length) await c.from("deals").delete().in("id", stale);

  await removePhotos(c, images);
  return res;
}

/** Everything currently archived, newest first. */
export async function fetchArchive(){
  const c = await db();
  if (!c) return { products: [], categories: [], deals: [] };

  const [p, cat, d] = await Promise.all([
    c.from("products").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false }),
    c.from("categories").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false }),
    c.from("deals").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false })
  ]);

  return { products: p.data ?? [], categories: cat.data ?? [], deals: d.data ?? [] };
}

/** Rename a category or change its photo. */
export async function updateCategory(id, patch){
  const c = await db();

  // Only when the photo is actually part of this edit.
  const swapping = Object.prototype.hasOwnProperty.call(patch, "img");
  const { data: was } = swapping
    ? await c.from("categories").select("img").eq("id", id).single()
    : { data: null };

  const res = await c.from("categories").update(patch).eq("id", id);

  if (!res.error && swapping) await dropReplaced(c, was?.img, patch.img);
  return res;
}

export async function insertCategory(cat, sort = 0){
  const c = await db();
  return c.from("categories").insert({ ...cat, sort });
}



/* -------------------------------- deals ------------------------------ */

/**
 * Add a deal to the front of the strip.
 *
 * A new offer is the news, so it leads. Everything already there is
 * pushed down one place rather than the newcomer being given a negative
 * sort: the numbers stay 0,1,2… and nothing drifts as deals come and go.
 */
/**
 * Is this product already in the strip?
 *
 * Asked of the database rather than of the copy held in the page. That
 * copy is only as fresh as the last reload, so a check against it can
 * pass twice for the same product — which is how nine copies of one
 * masala ended up in the strip from one impatient double-click.
 *
 * Matched on name and weight, which is what a deal is built from.
 */
export async function dealExists(en, w){
  const c = await db();
  if (!c) return false;

  const { data } = await c.from("deals")
    .select("id").is("archived_at", null)
    .eq("en", en).eq("w", w).limit(1);

  return Boolean(data?.length);
}

export async function insertDeal(d){
  const c = await db();

  const { data: existing } = await c.from("deals")
    .select("id").is("archived_at", null).order("sort");

  const res = await c.from("deals").insert({
    type: d.type, en: d.en, bn: d.bn, ja: d.ja,
    w: d.w, p: d.p, was: d.was || 0, img: d.img || "", sort: 0
  });
  if (res.error) return res;

  // Renumber the rest behind it.
  await Promise.all((existing ?? []).map((row, i) =>
    c.from("deals").update({ sort: i + 1 }).eq("id", row.id)));

  return res;
}

export async function updateDeal(id, d){
  const c = await db();
  return c.from("deals").update({
    type: d.type, p: d.p, was: d.was || 0
  }).eq("id", id);
}



/** Persist the display order after a drag / arrow move. */
export async function reorderDeals(items){
  const c = await db();
  return Promise.all(items.map((d, i) =>
    c.from("deals").update({ sort: i }).eq("id", d._id)));
}

/* ------------------------------ photos ------------------------------- */

/**
 * Upload a photo and return its public URL.
 *
 * Photos live in Cloudflare R2 rather than Supabase Storage: R2 charges
 * nothing for bandwidth, and a shop serves the same pictures to every
 * visitor. The browser cannot write to R2 directly - that needs
 * credentials no browser should hold - so it posts to a Worker that
 * checks the owner is signed in and writes on its behalf.
 */
export async function uploadPhoto(file){
  if (!R2.UPLOAD_URL) throw new Error("Photo upload is not configured");

  // The Worker asks Supabase whether this token is real before writing.
  const c = await db();
  const { data } = await c.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Please sign in again");

  const form = new FormData();
  form.append("file", file, file.name || "photo.jpg");

  const res = await fetch(R2.UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);

  return body.url;
}

/**
 * Remove a photo from R2.
 *
 * Best effort, like the Supabase path it replaces: a picture that will
 * not delete is a little wasted space, which beats blocking the removal
 * of the product itself.
 */
async function deleteFromR2(url){
  if (!R2.UPLOAD_URL) return;

  try {
    const c = await db();
    const { data } = await c.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;

    await fetch(R2.UPLOAD_URL, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    });
  } catch (e){
    console.warn("deleteFromR2:", e.message);
  }
}

/** A customer taking down their own photo. Same best-effort promise. */
export const deletePhoto = url => deleteFromR2(url);

/* ----------------------------- favourites ---------------------------- */

/**
 * The products this customer has saved, newest first.
 *
 * Only ids: the catalogue is already in the page, so returning whole
 * products would be the same rows twice. Empty when nobody is signed in,
 * which is what a signed-out visitor should see.
 */
export async function fetchFavourites(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("favourites")
    .select("product_id").order("created_at", { ascending: false });

  if (error){ console.warn("fetchFavourites:", error.message); return []; }
  return (data ?? []).map(r => r.product_id);
}

/**
 * Save a product, or take it off the list.
 *
 * The row carries the signed-in user's id, and row-level security checks
 * it against the session — so a browser cannot write a favourite onto
 * somebody else's account whatever it sends.
 */
export async function addFavourite(productId){
  const c = await db();
  const { data } = await c.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return { error: { message: "Not signed in" } };

  /* upsert, not insert: saving the same product twice is not an error,
     it is a customer clicking a heart that was already red. */
  return c.from("favourites")
    .upsert({ user_id: uid, product_id: productId },
            { onConflict: "user_id,product_id" });
}

export async function removeFavourite(productId){
  const c = await db();
  const { data } = await c.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return { error: { message: "Not signed in" } };

  return c.from("favourites")
    .delete().eq("user_id", uid).eq("product_id", productId);
}

/* ------------------------------ profiles ----------------------------- */

/**
 * Who this customer is — name, main phone, photo — or null before they
 * have told the shop anything. Where they live is in addresses, below.
 *
 * Row-level security scopes it to whoever is signed in, so there is no
 * user_id filter here — the same reason fetchFavourites has none.
 */
export async function fetchProfile(){
  const c = await db();
  if (!c) return null;

  const { data, error } = await c.from("profiles")
    .select("full_name, phone, avatar_url").maybeSingle();

  if (error){ console.warn("fetchProfile:", error.message); return null; }
  return data ?? null;
}

/**
 * Save some of the profile: only the fields given are written.
 *
 * upsert because a customer filling the form for the second time is
 * editing, not erroring, and because the first thing they save may be a
 * photo, with no row yet to update. Partial, so the checkout can set a
 * name without knowing the phone and the account page can change the
 * photo without knowing the name. The phone shape is checked again by
 * the database, so a malformed value cannot get in by another route.
 *
 * .select() so a refusal is visible: a write that row-level security
 * blocks is not an error to PostgREST — it matches nothing and says so
 * with a 200.
 */
export async function saveProfile(fields){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data: u } = await c.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return { error: { message: "Not signed in" } };

  const { data, error } = await c.from("profiles")
    .upsert({ user_id: uid, ...fields, updated_at: new Date().toISOString() },
            { onConflict: "user_id" })
    .select("full_name, phone, avatar_url")
    .single();

  if (error) return { error };
  return { data };
}

/* ------------------------------ addresses ---------------------------- */

/**
 * The customer's address book, default first. Empty on any error: a
 * page that cannot read the list shows a blank form, which is what a
 * new customer sees anyway.
 */
export async function fetchAddresses(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at");

  if (error){ console.warn("fetchAddresses:", error.message); return []; }
  return data ?? [];
}

/** A new address. The database makes a customer's first one the default. */
export async function insertAddress(a){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data: u } = await c.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return { error: { message: "Not signed in" } };

  const { data, error } = await c.from("addresses")
    .insert({ user_id: uid, ...a })
    .select()
    .single();

  if (error) return { error };
  return { data };
}

/**
 * Change one. .single() turns "no such row" — which is what row-level
 * security says about somebody else's address — into an error rather
 * than a quiet success.
 */
export async function updateAddress(id, a){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("addresses")
    .update({ ...a, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error)
    return { error: error.code === "PGRST116"
      ? { message: "That address could not be changed." } : error };
  return { data };
}

/** Take one out. Nothing returned means the policy refused it. */
export async function deleteAddress(id){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("addresses")
    .delete().eq("id", id).select("id");

  if (error) return { error };
  if (!data?.length)
    return { error: { message: "That address could not be removed." } };
  return { data: data[0] };
}

/** Make one the default. The table clears the others itself. */
export const setDefaultAddress = id => updateAddress(id, { is_default: true });

/* ------------------------------- orders ------------------------------ */

/**
 * A short reference a customer can read out on the phone.
 *
 * Date first so the owner can see at a glance when it was placed, then
 * four characters from a 32-letter alphabet with the easily-confused
 * ones (I, O, 0, 1) left out. Uniqueness is enforced by the database;
 * this only has to make a clash unlikely enough not to matter.
 */
export function orderCode(){
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const d = new Date();
  const ymd = [
    String(d.getFullYear()).slice(2),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");

  let tail = "";
  const r = crypto.getRandomValues(new Uint8Array(4));
  for (const n of r) tail += A[n % A.length];

  return `AA-${ymd}-${tail}`;
}

/**
 * Place an order.
 *
 * The customer's details and every product's name and price are copied
 * into the order rather than referenced, so the receipt still reads
 * correctly after a price change, a rename, or the product being
 * removed from the shop altogether.
 *
 * `lines` is [{ product, qty }] where product is a catalogue item.
 * Returns { data: order } or { error }.
 */
export async function placeOrder({ ship, lines, note = "", code = "", pay = {} }){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data: u } = await c.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return { error: { message: "Not signed in" } };

  if (!lines?.length) return { error: { message: "The cart is empty" } };

  /* How it is being paid. The database refuses anything outside the
     four, but a clear message here beats a constraint name from there.
     Amount and reference only mean something for a prepaid method. */
  const method = ["paypay", "merpay", "bank", "cod"].includes(pay.method) ? pay.method : null;
  if (!method) return { error: { message: "Choose how you will pay" } };
  const prepaid = method !== "cod";
  const amount  = prepaid ? Math.max(0, Math.round(Number(pay.amount) || 0)) : null;
  const ref     = prepaid ? String(pay.ref || "").trim().slice(0, 80) || null : null;

  const items = lines.map(({ product, qty }) => ({
    product_id: product._id,
    name_en: product.en, name_bn: product.bn, name_ja: product.ja,
    w: product.w || "",
    unit_price: product.p,
    qty,
    line_total: product.p * qty,
  }));

  const total = items.reduce((s, i) => s + i.line_total, 0);

  /* `ship` is where this one order goes, as the checkout form had it
     at the moment of pressing — copied in, not joined to the address
     book, so an address edited next month does not move this box. */
  /* The code may arrive from the checkout, which minted it early so the
     customer could write it as the transfer reference before the order
     existed. Its shape is checked; anything else gets a fresh one. */
  const order = await c.from("orders").insert({
    code: /^AA-\d{6}-[A-Z2-9]{4}$/.test(code) ? code : orderCode(),
    user_id: uid,
    name: ship.full_name,
    phone: ship.phone,
    postal: ship.postal,
    address: ship.address,
    total,
    note: note.trim() || null,
    pay_method: method,
    pay_amount: amount,
    pay_ref: ref,
  }).select().single();

  if (order.error) return order;

  const rows = items.map(i => ({ ...i, order_id: order.data.id }));
  const { error } = await c.from("order_items").insert(rows);

  /* An order with no items is worse than no order: the owner would ring
     a customer about an empty basket. Remove it and report the failure
     rather than leaving the wreckage. */
  if (error){
    await c.from("orders").delete().eq("id", order.data.id);
    return { error };
  }

  return { data: { ...order.data, items } };
}

/** One customer's own orders, newest first. RLS does the scoping. */
export async function fetchMyOrders(){
  const c = await db();
  if (!c) return [];

  // Orders the customer removed from their own history stay in the
  // table for the shop's books, but never come back to them.
  const { data, error } = await c.from("orders")
    .select("*, order_items(*)")
    .is("hidden_at", null)
    .order("placed_at", { ascending: false });

  if (error){ console.warn("fetchMyOrders:", error.message); return []; }
  return data ?? [];
}

/**
 * Remove one order from the customer's own history.
 *
 * Their copy only. The shop keeps the record of the sale — otherwise
 * somebody could order, take delivery, and erase the evidence. A
 * trigger on the table refuses every other column, so this cannot be
 * bent into confirming an order or changing its total.
 */
export async function hideMyOrder(id){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("orders")
    .update({ hidden_at: new Date().toISOString() })
    .eq("id", id).is("hidden_at", null).select();

  if (error) return { error };
  if (!data?.length) return { error: { message: "That order is already gone." } };
  return { data: data[0] };
}

/** Every order, newest first. Only the owner may read this. */
export async function fetchOrders(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("orders")
    .select("*, order_items(*)")
    .is("archived_at", null)
    .order("placed_at", { ascending: false });

  if (error){ console.warn("fetchOrders:", error.message); return []; }
  return data ?? [];
}

/** Orders the owner archived, newest first. */
export async function fetchArchivedOrders(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("orders")
    .select("*, order_items(*)")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (error){ console.warn("fetchArchivedOrders:", error.message); return []; }
  return data ?? [];
}

/**
 * The owner's delete: to the archive, the way a product goes.
 *
 * Orders are the shop's books. One removed by a misplaced tap on a
 * phone behind a counter has to be recoverable, so nothing is destroyed
 * here — only hidden from the working list.
 */
export async function archiveOrder(id){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("orders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id).is("archived_at", null).select();

  if (error) return { error };
  if (!data?.length) return { error: { message: "That order is already archived." } };
  return { data: data[0] };
}

/** Put an archived order back on the owner's list. */
export async function restoreOrder(id){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("orders")
    .update({ archived_at: null }).eq("id", id).select();

  if (error) return { error };
  return { data: data?.[0] };
}

/**
 * Delete an archived order for good. Items go with it, by cascade.
 *
 * Only reachable from the archive, so it always takes two deliberate
 * acts — archive, then delete — and never one slip.
 */
export async function destroyOrder(id){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  /* .select() so a refusal is visible. A delete that row-level security
     blocks is not an error — it simply matches nothing and returns 200,
     which is how the button came to do nothing while saying it worked. */
  const { data, error } = await c.from("orders")
    .delete().eq("id", id).select();

  if (error) return { error };
  if (!data?.length)
    return { error: { message: "That order could not be deleted." } };
  return { data: data[0] };
}

/** Everything in the archive, gone for good. Returns how many went. */
export async function destroyArchivedOrders(){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("orders")
    .delete().not("archived_at", "is", null).select();

  if (error) return { error };
  return { data: data ?? [] };
}

/** Put the whole archive back on the owner's list. */
export async function restoreArchivedOrders(){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("orders")
    .update({ archived_at: null }).not("archived_at", "is", null).select();

  if (error) return { error };
  return { data: data ?? [] };
}

/** Every order on the live list into the archive at once. */
export async function archiveAllOrders(){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data, error } = await c.from("orders")
    .update({ archived_at: new Date().toISOString() })
    .is("archived_at", null).select();

  if (error) return { error };
  return { data: data ?? [] };
}

/**
 * Move an order along.
 *
 * The sequence is checked here — pending to confirmed to dispatched to
 * delivered — so a stale page cannot dispatch something that was never
 * confirmed. `.eq("status", from)` makes the guard atomic: two clicks
 * race, the first wins, the second matches no row and changes nothing.
 */
const NEXT = {
  confirmed:  { from: ["pending"],    stamp: "confirmed_at"  },
  dispatched: { from: ["confirmed"],  stamp: "dispatched_at" },
  delivered:  { from: ["dispatched"], stamp: "delivered_at"  },
  rejected:   { from: ["pending"],    stamp: "cancelled_at"  },
  cancelled:  { from: ["pending", "confirmed"], stamp: "cancelled_at" },
};

export async function setOrderStatus(id, status, reason = ""){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const step = NEXT[status];
  if (!step) return { error: { message: `Unknown status: ${status}` } };

  const patch = { status, [step.stamp]: new Date().toISOString() };
  if (reason.trim()) patch.cancel_reason = reason.trim();

  const { data, error } = await c.from("orders")
    .update(patch).eq("id", id).in("status", step.from).select();

  if (error) return { error };

  /* No row came back: the order was not in a state this step could
     follow. Either somebody else moved it, or this is a second click. */
  if (!data?.length)
    return { error: { message: "That order has already moved on. Refreshing." } };

  return { data: data[0] };
}

/**
 * Refuse one line of an order, or put it back.
 *
 * The shop has the rice but not the fish. The line stays on the order
 * struck through rather than vanishing, so the customer can see what was
 * dropped and why — and the order total is recomputed by the database,
 * not here, so the customer's page, the owner's panel and the printed
 * invoice cannot disagree about what is owed.
 *
 * Returns the order's new total, since the caller almost always wants to
 * say it out loud.
 */
export async function rejectOrderItem(itemId, note = "", undo = false){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const patch = undo
    ? { rejected: false, reject_note: null, rejected_at: null }
    : { rejected: true,  reject_note: note.trim() || null,
        rejected_at: new Date().toISOString() };

  const { data, error } = await c.from("order_items")
    .update(patch).eq("id", itemId).select("id, order_id, rejected");

  if (error) return { error };

  /* Nothing came back: row-level security refused it. An update that RLS
     blocks is not an error — it matches no row and returns 200. */
  if (!data?.length)
    return { error: { message: "That line could not be changed." } };

  /* The trigger has already retotalled the order; read it back rather
     than adding the lines up again here. */
  const { data: ord } = await c.from("orders")
    .select("total").eq("id", data[0].order_id).single();

  return { data: { ...data[0], total: ord?.total ?? null } };
}

/* ----------------------------- restocking ---------------------------- */

/**
 * The sold-out products this customer is waiting for.
 *
 * Ids only; the names and pictures come from the catalogue the page
 * already has. Row-level security scopes it to whoever is signed in.
 */
export async function fetchMyRestock(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("restock_requests")
    .select("product_id").is("done_at", null);

  if (error){ console.warn("fetchMyRestock:", error.message); return []; }
  return (data ?? []).map(r => r.product_id);
}

/**
 * Ask for something to come back.
 *
 * An upsert, so pressing the button a second time is not an error and
 * not a second request — the primary key sees to that. A repeat press
 * costs a round trip and changes nothing, which is what it should do.
 */
export async function askRestock(productId){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { error: { message: "Not signed in" } };

  /*
   * done_at cleared, deliberately.
   *
   * The row may already exist and be closed: the shop got this in once,
   * told everybody, and it has since sold out again. Merging without
   * touching done_at left last week's timestamp in place, so the request
   * counted as already handled — the button reset itself on the next
   * refresh and the owner never saw it. Asking again re-opens it.
   *
   * created_at is left alone. The database keeps the original, which is
   * the honest answer to "how long have they been waiting".
   */
  const { data, error } = await c.from("restock_requests").upsert(
    { user_id: user.id, product_id: productId, done_at: null },
    { onConflict: "user_id,product_id" })
    .select();

  if (error) return { error };

  /* Nothing came back means row-level security refused it, which is not
     an error to PostgREST — it matches no row and returns a success. */
  if (!data?.length)
    return { error: { message: "That request could not be saved." } };

  return { data: data[0] };
}

/** Changed their mind. */
export async function withdrawRestock(productId){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data: { user } } = await c.auth.getUser();
  if (!user) return { error: { message: "Not signed in" } };

  return c.from("restock_requests")
    .delete().eq("user_id", user.id).eq("product_id", productId);
}

/**
 * Everyone waiting, for the owner.
 *
 * Reads the view rather than the table: the customer's name and phone
 * are in profiles and their email is in auth.users, and the view is
 * what reaches across all three. It answers nobody but the owner.
 */
export async function fetchRestock(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("restock_board")
    .select("*").is("done_at", null).order("created_at", { ascending: false });

  if (error){ console.warn("fetchRestock:", error.message); return []; }
  return data ?? [];
}

/**
 * Every registered account, for the owner's customer book. One row per
 * account whether or not they have set anything — the view reads the
 * accounts themselves. The owner alone may read it; anyone else gets an
 * empty list.
 */
export async function fetchCustomers(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("customer_directory").select("*");

  if (error){ console.warn("fetchCustomers:", error.message); return []; }
  return data ?? [];
}

/**
 * Every restock request ever, open or done, for the customer book. The
 * board view already carries the product name; this simply does not
 * filter it to the open ones.
 */
export async function fetchAllRestock(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("restock_board")
    .select("user_id, product_id, created_at, done_at, en, w")
    .order("created_at", { ascending: false });

  if (error){ console.warn("fetchAllRestock:", error.message); return []; }
  return data ?? [];
}

/**
 * Every customer who has put up a photo, for the owner's lists. A view
 * the owner alone may read; anyone else gets an empty list, which draws
 * as no faces at all.
 */
export async function fetchCustomerPhotos(){
  const c = await db();
  if (!c) return [];

  const { data, error } = await c.from("customer_photos").select("user_id, avatar_url");

  if (error){ console.warn("fetchCustomerPhotos:", error.message); return []; }
  return data ?? [];
}

/**
 * The thing is back in.
 *
 * Clears every open request for that product in one go, and takes the
 * sold-out mark off the product itself — the owner has just told us it
 * is back, and making him say so twice in two places is how one of them
 * ends up forgotten.
 */
export async function markRestocked(productId){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  /* Only the shelf mark. The requests are stamped done by the function
     that sends the emails, because it is the only thing that knows who
     it actually reached — stamping them here first left it looking for
     open requests, finding none, and telling nobody. */
  const { error } = await c.from("products")
    .update({ tag: "in" }).eq("id", productId);

  if (error) return { error };
  return { data: true };
}

/**
 * Clear the requests when the email could not be sent.
 *
 * The owner still pressed the button and the thing is still back on the
 * shelf; leaving the list full would have him pressing it again at
 * people who cannot be emailed anyway.
 */
export async function clearRestock(productId){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  return c.from("restock_requests")
    .update({ done_at: new Date().toISOString() })
    .eq("product_id", productId).is("done_at", null);
}

/**
 * Tell everyone waiting that it is back.
 *
 * Through an Edge Function, because sending mail needs the shop's Resend
 * key and anything the browser holds is readable by whoever opens the
 * page. The function checks the caller is the owner before it sends.
 *
 * Deployed separately from the site, so it may not be there yet — the
 * caller treats a failure as "the list is cleared but nobody was told"
 * rather than as the whole operation failing.
 */
/**
 * A note from the owner to one customer, sent under the shop's name.
 *
 * Only the id goes up; the function looks the address up itself, so the
 * panel can never be made to mail an address of its own choosing. The
 * reply says which service carried it, and the panel mentions it only
 * when the spare was used.
 */
export async function mailCustomer(userId, subject, body){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data: { session } } = await c.auth.getSession();
  if (!session) return { error: { message: "Not signed in" } };

  try {
    const res = await fetch(`${SUPABASE.URL}/functions/v1/customer-mail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE.KEY,
      },
      body: JSON.stringify({ user_id: userId, subject, body }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: out.error || `Sending failed (${res.status})` } };
    return { data: out };
  } catch (e){
    return { error: { message: e.message || "Could not reach the mail service" } };
  }
}

export async function notifyRestocked(productId){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { data: { session } } = await c.auth.getSession();
  if (!session) return { error: { message: "Not signed in" } };

  try {
    const res = await fetch(`${SUPABASE.URL}/functions/v1/restock-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE.KEY,
      },
      body: JSON.stringify({ product_id: productId }),
    });

    if (!res.ok){
      const body = await res.json().catch(() => ({}));
      return { error: { message: body.error || `mail service said ${res.status}` } };
    }
    return { data: await res.json() };

  } catch (e){
    return { error: { message: e.message || "could not reach the mail service" } };
  }
}

/* -------------------------------- auth ------------------------------- */

export async function signIn(email, password){
  const c = await db();
  if (!c) return { error: { message: "Supabase not configured" } };
  return c.auth.signInWithPassword({ email, password });
}

/**
 * Send the "set a new password" email.
 *
 * Always answers as though it worked, whatever the address. Telling a
 * stranger "no account with that email" hands them a way to find out
 * which of your customers is registered, one guess at a time.
 */
export async function sendPasswordReset(email, redirectTo){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { error } = await c.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo,
  });
  return { error };
}

/**
 * Set the new password.
 *
 * Only works while the one-time session from the emailed link is in
 * hand, which is what proves the person reading the email is the person
 * who owns the address.
 */
export async function setNewPassword(password){
  const c = await db();
  if (!c) return { error: { message: "Not configured" } };

  const { error } = await c.auth.updateUser({ password });
  return { error };
}

export async function signOut(){
  const c = await db();
  return c?.auth.signOut();
}

/**
 * Is the signed-in account the shop's owner?
 *
 * Asked of the database, which compares auth.uid() against
 * settings.owner_uid — the same function every write policy uses. There
 * is no list of addresses in this code to edit, and changing who the
 * owner is means changing that one row.
 */
export async function amOwner(){
  const c = await db();
  if (!c) return false;

  const { data, error } = await c.rpc("is_owner");
  if (error){ console.warn("is_owner:", error.message); return false; }
  return data === true;
}

/**
 * Is this address the shop's owner? Asked before any sign-in.
 *
 * So that a customer trying the owner's door is told which thing is
 * wrong — the address, not the password — whatever they typed in the
 * password field. It answers only about the address already in front of
 * them and cannot be used to discover any other.
 */
export async function isOwnerEmail(email){
  const c = await db();
  if (!c) return false;

  const { data, error } = await c.rpc("is_owner_email", { addr: String(email ?? "") });
  if (error){ console.warn("is_owner_email:", error.message); return false; }
  return data === true;
}

/** Current signed-in user, or null. */
export async function currentUser(){
  const c = await db();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  return data?.user ?? null;
}

/* ------------------------------ realtime ----------------------------- */

/* A `subscribe()` used to live here, watching products, categories,
   deals and announcements on behalf of every customer with the shop
   open. It is gone rather than merely unused: one held-open connection
   per visitor, each change waking all of them to refetch the whole
   catalogue, was what drove a small instance into swap. Anything that
   wants this back should watch one table and refetch only that.
   The owner's panel keeps its own watches, below. */

/**
 * Tell the owner's panel about orders as they happen.
 *
 * A channel of its own rather than a fifth table on "shop-changes",
 * for two reasons: that callback takes no argument and so cannot say
 * what arrived, and it re-fetches the whole catalogue on every event,
 * which would be absurd work for one order.
 *
 * `onInsert` gets the new row. `onChange` fires for any update, so a
 * status changed from another device reaches this one too.
 */
export async function subscribeOrders({ onInsert, onChange }){
  const c = await db();
  if (!c) return null;

  return c.channel("shop-orders")
    .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        payload => onInsert?.(payload.new))
    .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        payload => onChange?.(payload.new))
    .subscribe();
}

/**
 * Watch one customer's own orders, so a status the owner changes shows
 * on their screen without a refresh.
 *
 * Row-level security applies to realtime as well, so this only ever
 * delivers rows the signed-in customer may read.
 */
export async function subscribeMyOrders(onChange){
  const c = await db();
  if (!c) return null;

  return c.channel("my-orders")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        payload => onChange?.(payload.new))
    .subscribe();
}
