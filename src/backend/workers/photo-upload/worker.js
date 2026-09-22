/**
 * Photo upload, and deletion, for the shop's R2 bucket.
 *
 * The browser cannot write to R2 directly: doing so needs credentials
 * that grant full write and delete on the bucket, and anything the
 * browser holds is public. This Worker holds them instead. It is bound
 * to the bucket by Cloudflare, so there are no keys in the code at all —
 * `env.BUCKET` is the binding, granted at deploy time.
 *
 * Two kinds of caller. The owner writes and removes product photos and
 * may do as they please. A customer may put up their own photo and take
 * it down again, and nothing else: their uploads are named with their
 * id, and a delete is refused unless the key carries that same id. The
 * browser sends its Supabase session token; this asks Supabase who that
 * is before touching the bucket. Without the check the endpoint would be
 * an open door for anyone to fill the shop's storage — and without the
 * split, any customer could delete the pictures of the rice.
 */

/** Photos the shop will accept. Anything else is refused. */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

/** Generous next to the ~100 KB the admin panel actually sends. */
const MAX_BYTES = 8 * 1024 * 1024;

/* A customer's own photo. Smaller, and no SVG: the page shrinks it to
   about 40 KB before sending, so anything near the cap is not a photo,
   and a vector file is a document that can carry a script. */
const AVATAR_ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Every key a customer writes begins with their own id. */
const avatarPrefix = uid => `av-${uid}-`;

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
 * Who is asking: their id, and whether they are the shop's owner.
 *
 * Supabase is the authority on both, so we ask it rather than trying to
 * verify the token here — once for the user, once for is_owner(), which
 * reads the same settings row the database uses everywhere else, so
 * there is no second idea here of who the owner is. Two requests, and
 * only on writes. Null means refuse: a bad token, or network trouble,
 * and we do not guess.
 */
async function caller(request, env){
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;

    const who = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_owner`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const owner = who.ok && (await who.json()) === true;

    return { uid: user.id, owner };
  } catch {
    return null;                        // network trouble: refuse, do not guess
  }
}

/**
 * A name that cannot collide, and cannot be steered by the uploader.
 * The prefix, when there is one, is the customer's id — see caller().
 */
function newName(type, prefix = ""){
  const stamp = Date.now();
  const rand = crypto.randomUUID().slice(0, 8);
  return `${prefix}${stamp}-${rand}.${EXT[type] || "jpg"}`;
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
      const who = await caller(request, env);
      if (!who) return json(request, env, { error: "Not signed in" }, 401);

      let form;
      try {
        form = await request.formData();
      } catch {
        return json(request, env, { error: "Expected a form upload" }, 400);
      }

      const file = form.get("file");
      if (!file || typeof file === "string")
        return json(request, env, { error: "No file" }, 400);

      /* The owner's limits for product photos; a customer's tighter
         ones for their own picture. */
      const allowed = who.owner ? ALLOWED   : AVATAR_ALLOWED;
      const cap     = who.owner ? MAX_BYTES : AVATAR_MAX_BYTES;

      if (!allowed.has(file.type))
        return json(request, env, { error: `Unsupported type: ${file.type}` }, 415);

      if (file.size > cap)
        return json(request, env, { error: "That photo is too large" }, 413);

      const key = newName(file.type, who.owner ? "" : avatarPrefix(who.uid));

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
      const who = await caller(request, env);
      if (!who) return json(request, env, { error: "Not signed in" }, 401);

      let body;
      try {
        body = await request.json();
      } catch {
        return json(request, env, { error: "Expected JSON" }, 400);
      }

      const key = keyFromUrl(body?.url, env.PUBLIC_BASE);
      if (!key) return json(request, env, { error: "Not a photo of this shop" }, 400);

      /* A customer may take down their own photo and nothing else. The
         key carries their id, so ownership is a prefix check — no lookup,
         and no way to name somebody else's file. */
      if (!who.owner && !key.startsWith(avatarPrefix(who.uid)))
        return json(request, env, { error: "Not your photo" }, 403);

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
