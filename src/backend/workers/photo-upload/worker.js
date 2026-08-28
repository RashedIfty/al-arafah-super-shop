/**
 * Photo upload, and deletion, for the shop's R2 bucket.
 *
 * The browser cannot write to R2 directly: doing so needs credentials
 * that grant full write and delete on the bucket, and anything the
 * browser holds is public. This Worker holds them instead. It is bound
 * to the bucket by Cloudflare, so there are no keys in the code at all —
 * `env.BUCKET` is the binding, granted at deploy time.
 *
 * Only a signed-in shop owner may write. The browser sends its Supabase
 * session token; this asks Supabase whether that token is real before
 * touching the bucket. Without that check the endpoint would be an open
 * door for anyone to fill the shop's storage.
 */

/** Photos the shop will accept. Anything else is refused. */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

/** Generous next to the ~100 KB the admin panel actually sends. */
const MAX_BYTES = 8 * 1024 * 1024;

const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * Browsers refuse a cross-origin request without these.
 *
 * A browser will not accept a list, so the caller's own origin is echoed
 * back when it is one we allow. The shop itself, and a local server for
 * working on it. Anything else is refused the header and the browser
 * stops the request.
 */
function allowedOrigin(request, env){
  const origin = request.headers.get("Origin") || "";
  const list = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);

  if (list.includes(origin)) return origin;
  // Local development: any port on the machine running the shop.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return list[0] || "";
}

function corsHeaders(request, env){
  return {
    "Access-Control-Allow-Origin": allowedOrigin(request, env),
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const json = (request, env, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) },
  });

/**
 * True when the bearer token belongs to a real signed-in user.
 *
 * Supabase is the authority on that, so we ask it rather than trying to
 * verify the token here. One request, and only on writes.
 */
async function isOwner(request, env){
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;

  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const user = await res.json();
    return Boolean(user?.id);
  } catch {
    return false;                       // network trouble: refuse, do not guess
  }
}

/** A name that cannot collide, and cannot be steered by the uploader. */
function newName(type){
  const stamp = Date.now();
  const rand = crypto.randomUUID().slice(0, 8);
  return `${stamp}-${rand}.${EXT[type] || "jpg"}`;
}

/** The object's key, taken from a URL we issued. Null if it is not ours. */
function keyFromUrl(url, base){
  if (typeof url !== "string") return null;
  const prefix = base.endsWith("/") ? base : base + "/";
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  // No traversal, no nesting: keys are flat names we generated.
  return /^[A-Za-z0-9._-]+$/.test(key) ? key : null;
}

export default {
  async fetch(request, env){
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    /* ---------------------------- upload ---------------------------- */
    if (request.method === "POST"){
      if (!(await isOwner(request, env)))
        return json(request, env, { error: "Not signed in" }, 401);

      let form;
      try {
        form = await request.formData();
      } catch {
        return json(request, env, { error: "Expected a form upload" }, 400);
      }

      const file = form.get("file");
      if (!file || typeof file === "string")
        return json(request, env, { error: "No file" }, 400);

      if (!ALLOWED.has(file.type))
        return json(request, env, { error: `Unsupported type: ${file.type}` }, 415);

      if (file.size > MAX_BYTES)
        return json(request, env, { error: "That photo is too large" }, 413);

      const key = newName(file.type);

      try {
        await env.BUCKET.put(key, file.stream(), {
          httpMetadata: {
            contentType: file.type,
            // Names are unique, so a photo never changes under its URL.
            cacheControl: "public, max-age=31536000, immutable",
          },
        });
      } catch (e){
        return json(request, env, { error: "Upload failed: " + e.message }, 502);
      }

      return json(request, env, { url: `${env.PUBLIC_BASE}/${key}` }, 201);
    }

    /* ---------------------------- delete ---------------------------- */
    if (request.method === "DELETE"){
      if (!(await isOwner(request, env)))
        return json(request, env, { error: "Not signed in" }, 401);

      let body;
      try {
        body = await request.json();
      } catch {
        return json(request, env, { error: "Expected JSON" }, 400);
      }

      const key = keyFromUrl(body?.url, env.PUBLIC_BASE);
      if (!key) return json(request, env, { error: "Not a photo of this shop" }, 400);

      try {
        await env.BUCKET.delete(key);
      } catch (e){
        return json(request, env, { error: "Delete failed: " + e.message }, 502);
      }

      return json(request, env, { ok: true });
    }

    return json(request, env, { error: "Method not allowed" }, 405);
  },
};
