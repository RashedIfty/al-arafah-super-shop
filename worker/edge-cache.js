/**
 * Ask Supabase once, keep the answer in this Cloudflare data centre's
 * cache, and hand that copy to every visitor until it is due again.
 *
 * A Worker's own responses are not cached by Cloudflare on their own, so
 * the keeping is done here with the Cache API. (On a *.workers.dev
 * address the cache does nothing, and every request goes to Supabase;
 * on alarafahsupershop.com it keeps.)
 */
import { SUPABASE } from "../src/backend/config.js";

/**
 * A GET of `path` on Supabase's REST API, kept for `seconds`.
 * A failure is passed on but never kept, so one bad answer is not
 * served to everyone.
 */
export async function kept(request, ctx, path, seconds){
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: "GET" });

  /* A copy from the cache is handed on under our own Cache-Control, not
     the one it comes out with: Cloudflare stamps cached answers with the
     zone's browser TTL (4 hours), and a browser that kept the change
     stamp that long went on showing the old shop after every edit. */
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, {
    status: hit.status,
    headers: headers(`public, max-age=0, s-maxage=${seconds}`),
  });

  let res;
  try {
    res = await fetch(`${SUPABASE.URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE.KEY, Authorization: `Bearer ${SUPABASE.KEY}` },
    });
  } catch {
    return json({ error: "database unreachable" }, 502);
  }

  const body = await res.text();
  if (!res.ok) return new Response(body, { status: res.status, headers: headers("no-store") });

  const out = new Response(body, {
    status: 200,
    /* The browser does not keep it (max-age=0): the page keeps its own
       copy in sessionStorage. s-maxage is what the cache here reads. */
    headers: headers(`public, max-age=0, s-maxage=${seconds}`),
  });
  ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}

const headers = cacheControl => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": cacheControl,
});

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: headers("no-store") });
