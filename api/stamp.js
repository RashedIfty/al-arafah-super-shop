/**
 * The shop's change stamp, from Vercel's cache. The Vercel twin of
 * functions/api/stamp.js (Cloudflare Pages); see there for why.
 *
 * GET /api/stamp  ->  [{ "at": "..." }]
 */
import { SUPABASE } from "../src/backend/config.js";

export const config = { runtime: "edge" };

export default async function handler(){
  const res = await fetch(`${SUPABASE.URL}/rest/v1/shop_version?select=at&id=eq.1`, {
    headers: { apikey: SUPABASE.KEY, Authorization: `Bearer ${SUPABASE.KEY}` },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": res.ok ? "public, max-age=0, s-maxage=30" : "no-store",
    },
  });
}
