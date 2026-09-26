/**
 * Puts one night's database backup in the private R2 bucket.
 *
 *   PUT /2026-09-27.sql.gz.enc
 *   Authorization: Bearer <BACKUP_TOKEN>
 *   <the encrypted file>
 *
 * That is all it does. It cannot read, list or delete anything, so the
 * token, if it ever leaked, would let someone add files and nothing
 * more. The files themselves are encrypted before they leave GitHub;
 * nothing here can read them either.
 */

/** Only a date and the one extension, so nothing else can be written. */
const NAME = /^\d{4}-\d{2}-\d{2}\.sql\.gz\.enc$/;
const MAX_BYTES = 200 * 1024 * 1024;       // the dump is ~a few MB today

export default {
  async fetch(request, env){
    if (request.method !== "PUT") return text("PUT only", 405);

    if (!env.BACKUP_TOKEN || !await same(request.headers.get("Authorization") || "",
                                         `Bearer ${env.BACKUP_TOKEN}`))
      return text("unauthorised", 401);

    const name = new URL(request.url).pathname.slice(1);
    if (!NAME.test(name)) return text("bad name", 400);

    const size = Number(request.headers.get("Content-Length") || 0);
    if (!size) return text("empty", 400);
    if (size > MAX_BYTES) return text("too large", 413);

    await env.BACKUPS.put(name, request.body, {
      httpMetadata: { contentType: "application/octet-stream" },
    });
    return text(`stored ${name} (${size} bytes)`, 201);
  },
};

const text = (body, status) => new Response(body, { status });

/** Compare without leaking, through timing, how much of the token was right. */
async function same(a, b){
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([a, b].map(s => crypto.subtle.digest("SHA-256", enc.encode(s))));
  return crypto.subtle.timingSafeEqual(ha, hb);
}
