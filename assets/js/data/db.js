/**
 * Supabase client and data access.
 *
 * Everything the site reads goes through here. When Supabase is not
 * configured the functions fall back to the bundled data files, so the
 * site keeps working offline and during setup.
 */
import { SUPABASE, isConfigured } from "./supabase-config.js";

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
 * Categories with their products nested, shaped exactly like the old
 * CATALOG array so nothing downstream needs to change.
 */
export async function fetchCatalog(){
  const c = await db();
  if (!c) return null;

  const [cats, prods] = await Promise.all([
    c.from("categories").select("*").is("archived_at", null).order("sort"),
    c.from("products").select("*").is("archived_at", null).order("sort")
  ]);

  if (cats.error || prods.error){
    console.error("fetchCatalog:", cats.error || prods.error);
    return null;
  }

  return cats.data.map(cat => ({
    id: cat.id, icon: cat.icon, img: cat.img,
    en: cat.en, bn: cat.bn, ja: cat.ja,
    items: prods.data
      .filter(p => p.category_id === cat.id)
      .map(p => ({
        _id: p.id,
        en: p.en, bn: p.bn, ja: p.ja,
        w: p.w, p: p.p, was: p.was,
        img: p.img, ...(p.tag ? { tag: p.tag } : {})
      }))
  }));
}

/** The homepage deals strip. */
export async function fetchDeals(){
  const c = await db();
  if (!c) return null;

  const { data, error } = await c.from("deals").select("*").is("archived_at", null).order("sort");
  if (error){ console.error("fetchDeals:", error); return null; }

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
    tag: p.tag || null, sort
  }).select().single();
}

export async function updateProduct(id, categoryId, p){
  const c = await db();
  return c.from("products").update({
    category_id: categoryId, en: p.en, bn: p.bn, ja: p.ja,
    w: p.w, p: p.p, was: p.was || 0, img: p.img || "",
    tag: p.tag || null
  }).eq("id", id);
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

/** Gone for good — only offered from the archive. */
export async function destroy(table, id){
  const c = await db();
  return c.from(table).delete().eq("id", id);
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
    .subscribe();
}
