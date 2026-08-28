/**
 * Supabase client and data access.
 *
 * Everything the site reads goes through here. When Supabase is not
 * configured the functions fall back to the bundled data files, so the
 * site keeps working offline and during setup.
 */
import { SUPABASE, isConfigured } from "./config.js";

let client = null;

/** Lazily create the client (the SDK is loaded from a CDN on first use). */
export async function db(){
  if (!isConfigured()) return null;
  if (client) return client;

  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2");
  client = createClient(SUPABASE.URL, SUPABASE.KEY);
  return client;
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
      .map(p => ({
        _id: p.id,
        en: p.en, bn: p.bn, ja: p.ja,
        w: p.w, p: p.p, was: p.was,
        img: p.img, ...(p.tag ? { tag: p.tag } : {}),
        ...(p.country ? { country: p.country } : {})
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

export async function insertProduct(categoryId, p, sort = 0){
  const c = await db();
  return c.from("products").insert({
    category_id: categoryId, en: p.en, bn: p.bn, ja: p.ja,
    w: p.w, p: p.p, was: p.was || 0, img: p.img || "",
    tag: p.tag || null, country: p.country || null, sort
  }).select().single();
}

export async function updateProduct(id, categoryId, p){
  const c = await db();

  // Note the old photo before overwriting: swapping a picture would
  // otherwise strand the previous one in storage for good.
  const { data: was } = await c.from("products").select("img").eq("id", id).single();

  const res = await c.from("products").update({
    category_id: categoryId, en: p.en, bn: p.bn, ja: p.ja,
    w: p.w, p: p.p, was: p.was || 0, img: p.img || "",
    tag: p.tag || null, country: p.country || null
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
export async function archive(table, id){
  const c = await db();
  return c.from(table).update({ archived_at: new Date().toISOString() }).eq("id", id);
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
  const names = [...new Set(images.map(uploadedName).filter(Boolean))];
  if (!names.length) return;

  const keep = new Set();
  for (const table of ["products", "categories", "deals"]){
    const { data } = await c.from(table).select("img");
    for (const r of data ?? []){
      const n = uploadedName(r.img);
      if (n) keep.add(n);
    }
  }

  const gone = names.filter(n => !keep.has(n));
  if (!gone.length) return;

  const { error } = await c.storage.from(BUCKET).remove(gone);
  if (error) console.error("removePhotos:", error);
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

  const res = await c.from(table).delete().eq("id", id);
  if (res.error) return res;                 // row still there: keep the photo

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

export async function insertDeal(d, sort = 0){
  const c = await db();
  return c.from("deals").insert({
    type: d.type, en: d.en, bn: d.bn, ja: d.ja,
    w: d.w, p: d.p, was: d.was || 0, img: d.img || "", sort
  });
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

/** Upload a photo and return its public URL. */
export async function uploadPhoto(file){
  const c = await db();
  if (!c) throw new Error("Supabase not configured");

  const ext  = (file.name.split(".").pop() || "jpg").toLowerCase();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await c.storage
    .from("product-photos")
    .upload(name, file, { cacheControl: "31536000", upsert: false });

  if (error) throw error;

  return c.storage.from("product-photos").getPublicUrl(name).data.publicUrl;
}

/* -------------------------------- auth ------------------------------- */

export async function signIn(email, password){
  const c = await db();
  if (!c) return { error: { message: "Supabase not configured" } };
  return c.auth.signInWithPassword({ email, password });
}

export async function signOut(){
  const c = await db();
  return c?.auth.signOut();
}

/** Current signed-in user, or null. */
export async function currentUser(){
  const c = await db();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  return data?.user ?? null;
}

/* ------------------------------ realtime ----------------------------- */

/**
 * Call `onChange` whenever products, categories or deals change —
 * this is what makes an edit on the owner's phone appear on a
 * customer's screen without a refresh.
 */
export async function subscribe(onChange){
  const c = await db();
  if (!c) return null;

  return c.channel("shop-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "products"   }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "deals"      }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "announcement" }, onChange)
    .subscribe();
}
