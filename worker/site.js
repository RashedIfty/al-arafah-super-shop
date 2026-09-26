/**
 * The shop on Cloudflare Workers.
 *
 * Every page, script, stylesheet and picture is a static asset, served
 * by Cloudflare straight from the files in this repository (see
 * wrangler.jsonc and .assetsignore). Those requests never reach this
 * code and cost nothing. Only the two addresses below run here:
 *
 *   GET /api/shop?t=products|categories|deals[&v=<stamp>]
 *       The shop's public rows. Supabase is asked once and that copy
 *       serves everyone, so the database's egress does not grow with the
 *       number of customers. With the change stamp in the address it is
 *       kept a day (any change moves the stamp); without it, five minutes.
 *
 *   GET /api/stamp
 *       When products, categories or deals last changed. Every page asks
 *       on opening and every ninety seconds while open, to know whether
 *       its prices are still current. Kept 30 seconds here, the database
 *       is asked twice a minute however many people are shopping.
 *
 * Only those three tables, only live rows, only what the page could ask
 * for itself with the public key. The files under api/ are the same two
 * on Vercel.
 */
import { kept, json } from "./edge-cache.js";

const TABLES = new Set(["products", "categories", "deals"]);

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);

    if (url.pathname === "/api/stamp")
      return kept(request, ctx, "shop_version?select=at&id=eq.1", 30);

    if (url.pathname === "/api/shop"){
      const t = url.searchParams.get("t");
      if (!TABLES.has(t)) return json({ error: "unknown table" }, 400);
      return kept(request, ctx, `${t}?select=*&archived_at=is.null&order=sort`,
                  url.searchParams.get("v") ? 86400 : 300);
    }

    // Anything else under /api/ that is not one of the two.
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
};
