/**
 * What the two Cloudflare Pages functions share: ask Supabase once, keep
 * the answer in this data centre's cache, and hand that copy to every
 * visitor until it is due to be asked again.
 *
 * Pages functions are not cached by Cloudflare on their own, so the
 * keeping is done here with the Cache API. (On a *.pages.dev preview
 * address the cache does nothing, and every request goes to Supabase.)
 *
 * Used by functions/api/ (Cloudflare Pages). The files under api/ at
 * the root do the same job on Vercel.
 */
import { SUPABASE } from "./config.js";

/**
 * A GET of `path` on Supabase's REST API, kept for `seconds`.
 * A failure is passed on but never kept, so one bad answer is not
 * served to everyone.
 */
export async function kept(context, path, seconds){
  const cache = caches.default;
  const key = new Request(new URL(context.request.url).toString(), { method: "GET" });

  const hit = await cache.match(key);
  if (hit) return hit;

  let res;
  try {
    res = await fetch(`${SUPABASE.URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE.KEY, Authorization: `Bearer ${SUPABASE.KEY}` },
    });
  } catch {
    return json({ error: "database unreachable" }, 502, "no-store");
  }

  const body = await res.text();
  if (!res.ok) return new Response(body, { status: res.status, headers: headers("no-store") });

  const out = new Response(body, {
    status: 200,
    /* The browser does not keep it (max-age=0): the page keeps its own
       copy in sessionStorage. s-maxage is what the cache here reads. */
    headers: headers(`public, max-age=0, s-maxage=${seconds}`),
  });
  context.waitUntil(cache.put(key, out.clone()));
  return out;
}

const headers = cacheControl => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": cacheControl,
});

export const json = (obj, status = 200, cacheControl = "no-store") =>
  new Response(JSON.stringify(obj), { status, headers: headers(cacheControl) });
