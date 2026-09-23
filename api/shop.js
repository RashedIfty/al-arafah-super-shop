/**
 * The shop's public rows, from Vercel's cache rather than the database.
 *
 * GET /api/shop?t=products | categories | deals
 *
 * Supabase's free plan meters egress at 5 GB a month, and every visitor
 * used to read the catalogue from it directly — so the bill grew with
 * the number of customers and with the number of products. This asks
 * Supabase once, and Vercel's edge keeps the answer for five minutes
 * (s-maxage), serving that one copy to everyone. Past five minutes the
 * next visitor still gets the kept copy at once while a fresh one is
 * fetched behind them (stale-while-revalidate). The database's load no
 * longer depends on how many people are shopping.
 *
 * The cost is that an owner's change reaches customers within about
 * five minutes rather than at once. The owner's panel never reads
 * through here, so it always shows what was just saved.
 *
 * Only these three tables, only live rows, only the same public query
 * the page could make with the anon key — nothing here that a visitor
 * could not already read.
 */
import { SUPABASE } from "../src/backend/config.js";

export const config = { runtime: "edge" };

const TABLES = new Set(["products", "categories", "deals"]);

export default async function handler(request){
  const q = new URL(request.url).searchParams;
  const t = q.get("t");
  /* The shop's change stamp (shop_version.at), when the page knows it.
     It makes the address unique to one state of the catalogue, so that
     copy can be kept for a day: any change the owner makes moves the
     stamp, and pages ask for the new address instead. */
  const versioned = Boolean(q.get("v"));
  if (!TABLES.has(t))
    return new Response(JSON.stringify({ error: "unknown table" }),
      { status: 400, headers: { "Content-Type": "application/json" } });

  const res = await fetch(
    `${SUPABASE.URL}/rest/v1/${t}?select=*&archived_at=is.null&order=sort`,
    { headers: { apikey: SUPABASE.KEY, Authorization: `Bearer ${SUPABASE.KEY}` } });

  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      /* Kept at the edge only when the database answered properly: a
         failure must not be served to everyone for five minutes. The
         browser itself does not keep it (max-age=0); the page's own
         five-minute copy in sessionStorage does that job. */
      "Cache-Control": !res.ok ? "no-store"
        : versioned ? "public, max-age=0, s-maxage=86400"
        : "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
