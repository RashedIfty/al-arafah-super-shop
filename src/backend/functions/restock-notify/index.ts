/**
 * "The thing you asked for is back."
 *
 * Sent from here rather than from the browser because it needs the
 * shop's Resend key, and anything the page holds is readable by whoever
 * opens the page — a key in the source is a key anybody can send mail
 * with.
 *
 * The owner presses one button; this reads who is waiting for that
 * product, writes to each of them, and stamps the requests done so
 * nobody is told twice.
 *
 * Only the owner may call it. The caller's token is checked against the
 * same settings.owner_uid row the database uses everywhere else, so
 * there is no second idea here of who the owner is.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const URL_    = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND  = Deno.env.get("RESEND_API_KEY");

const FROM = "Al-Arafah Super Shop <orders@alarafahsupershop.com>";
const SHOP = "https://alarafahsupershop.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/** A small REST call against the project, as the service role. */
async function db(path: string, init: RequestInit = {}){
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : await res.json();
}

/**
 * The message, in all three languages.
 *
 * The shop does not record which language a customer reads, and asking
 * would have been one more field on a form nobody wants to fill in. All
 * three in one short email is the honest answer.
 */
function body(name: string, product: string){
  const greet = name ? `${name},` : "Hello,";

  return `
<div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP','Noto Sans Bengali',sans-serif;color:#1f2328;max-width:520px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(115deg,#b8380f,#e2621d);color:#fff;border-radius:12px;padding:20px 22px;margin-bottom:20px">
    <b style="font-size:19px;letter-spacing:-.3px">AL-ARAFAH<span style="display:block;font-size:10px;letter-spacing:3px;font-weight:700;opacity:.9">SUPER SHOP</span></b>
  </div>

  <p>${greet}</p>
  <p><b>${product}</b> is back on the shelf. You asked us to let you know.</p>
  <p style="color:#6b7280;font-size:13.5px">
    <b>${product}</b> が再入荷しました。お知らせのご依頼をいただいておりました。<br>
    <b>${product}</b> আবার স্টকে এসেছে। আপনি জানাতে বলেছিলেন।
  </p>

  <p style="margin:22px 0">
    <a href="${SHOP}/products.html"
       style="background:#c8102e;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:9px;display:inline-block">
      See it in the shop
    </a>
  </p>

  <p style="color:#6b7280;font-size:12.5px;border-top:1px solid #e8eaed;padding-top:14px;margin-top:24px">
    Al-Arafah Super Shop · 3-chome-4-8 Amakubo, Tsukuba, Ibaraki 305-0005<br>
    Tel 080-5401-8124 · <a href="${SHOP}" style="color:#e2621d">alarafahsupershop.com</a>
  </p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { product_id } = await req.json();
    if (!product_id) return json({ error: "product_id is required" }, 400);

    /* Who is asking. The token is the caller's, not the service role's,
       so is_owner() answers about them. */
    const auth = req.headers.get("Authorization") ?? "";
    const who = await fetch(`${URL_}/rest/v1/rpc/is_owner`, {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    if (!who.ok || (await who.json()) !== true)
      return json({ error: "Only the shop's owner may send this." }, 403);

    /* Everyone still waiting, with the name to greet them by. */
    const rows = await db(
      `restock_requests?select=user_id,product_id&product_id=eq.${product_id}&done_at=is.null`);

    if (!rows?.length) return json({ sent: 0, note: "nobody was waiting" });

    const product = (await db(`products?select=en&id=eq.${product_id}`))?.[0]?.en
      ?? "The item you asked about";

    /* Addresses live in auth.users, which the REST API does not expose,
       so they come through the admin endpoint. */
    const sent: string[] = [];
    const failed: string[] = [];

    for (const r of rows){
      const u = await fetch(`${URL_}/auth/v1/admin/users/${r.user_id}`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      }).then(x => x.ok ? x.json() : null);

      const email = u?.email;
      if (!email) continue;

      const prof = await db(`profiles?select=full_name&user_id=eq.${r.user_id}`);
      const name = prof?.[0]?.full_name ?? "";

      if (!RESEND){ failed.push(email); continue; }

      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: `${product} is back in stock`,
          html: body(name, product),
        }),
      });

      mail.ok ? sent.push(email) : failed.push(email);
    }

    /* Stamped only now. If the sending fell over the requests stay open,
       and pressing the button again tries the ones that were missed
       rather than telling the same people twice. */
    if (sent.length)
      await db(`restock_requests?product_id=eq.${product_id}&done_at=is.null`, {
        method: "PATCH",
        body: JSON.stringify({ done_at: new Date().toISOString() }),
      });

    if (!RESEND)
      return json({ error: "RESEND_API_KEY is not set on this project." }, 500);

    return json({ sent: sent.length, failed: failed.length });

  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
