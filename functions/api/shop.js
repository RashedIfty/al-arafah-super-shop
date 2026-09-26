/**
 * The shop's public rows, from Cloudflare's cache rather than the database.
 *
 * GET /api/shop?t=products | categories | deals [&v=<change stamp>]
 *
 * The same job as api/shop.js does on Vercel: Supabase is asked once and
 * that copy serves everyone, so the database's egress does not grow with
 * the number of customers. With the change stamp in the address the copy
 * is kept a day, since any change the owner makes moves the stamp and
 * pages ask for the new address; without it, five minutes.
 *
 * Only these three tables, only live rows, only the query the page could
 * make itself with the public key.
 */
import { kept, json } from "../../src/backend/edge-cache.js";

const TABLES = new Set(["products", "categories", "deals"]);

export async function onRequestGet(context){
  const q = new URL(context.request.url).searchParams;
  const t = q.get("t");
  if (!TABLES.has(t)) return json({ error: "unknown table" }, 400);

  return kept(context, `${t}?select=*&archived_at=is.null&order=sort`,
              q.get("v") ? 86400 : 300);
}
