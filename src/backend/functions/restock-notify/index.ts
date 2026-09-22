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

/* Two ways out, tried in that order. Resend is the shop's own domain and
   sends a clean message; Brevo is there for the day Resend is over its
   quota or simply down. Either key may be absent — one alone works, and
   with neither the function says so plainly rather than reporting
   success for letters nobody received. */
const RESEND = Deno.env.get("RESEND_API_KEY");
const BREVO  = Deno.env.get("BREVO_API_KEY");

const FROM_NAME  = "Al-Arafah Super Shop";
const FROM_EMAIL = "orders@alarafahsupershop.com";
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;
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

/* ----------------------------- sending ------------------------------- */

/** Resend. Returns null when it worked, or why it did not. */
async function viaResend(to: string, subject: string, html: string){
  if (!RESEND) return "no key";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    return r.ok ? null : `resend ${r.status}: ${(await r.text()).slice(0, 140)}`;
  } catch (e){
    return `resend unreachable: ${(e as Error).message}`;
  }
}

/** Brevo, which takes the same message in a different shape. */
async function viaBrevo(to: string, subject: string, html: string){
  if (!BREVO) return "no key";

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    return r.ok ? null : `brevo ${r.status}: ${(await r.text()).slice(0, 140)}`;
  } catch (e){
    return `brevo unreachable: ${(e as Error).message}`;
  }
}

/**
 * One letter, by whichever service will carry it.
 *
 * Brevo first, Resend behind it — deliberately the opposite way round
 * from the shop's other mail.
 *
 * Supabase sends the sign-up and password-reset letters through one
 * SMTP server and offers no second slot, so those are Resend's whatever
 * happens here. Restock notices are the only mail this shop controls,
 * and they are the bursty kind: one press of "Back in stock" with forty
 * people waiting is forty letters in a minute. Putting them on the
 * service with the larger daily allowance keeps them away from the
 * quota that the sign-up letters depend on.
 *
 * So the two never compete. Each service gets its own allowance, and
 * either one failing still leaves the other to carry the message.
 *
 * Which one carried it is returned, so the owner's panel can say when
 * the shop has fallen back — a quota quietly running out otherwise
 * looks exactly like everything being fine.
 */
async function send(to: string, subject: string, html: string){
  const first = await viaBrevo(to, subject, html);
  if (first === null) return { ok: true, via: "brevo" };

  const second = await viaResend(to, subject, html);
  if (second === null) return { ok: true, via: "resend", note: first };

  return { ok: false, via: null, note: `${first} | ${second}` };
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
    const byService: Record<string, number> = {};
    let firstProblem = "";

    for (const r of rows){
      const u = await fetch(`${URL_}/auth/v1/admin/users/${r.user_id}`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      }).then(x => x.ok ? x.json() : null);

      const email = u?.email;
      if (!email) continue;

      const prof = await db(`profiles?select=full_name&user_id=eq.${r.user_id}`);
      const name = prof?.[0]?.full_name ?? "";

      const out = await send(email,
                             `${product} is back in stock`,
                             body(name, product));

      if (out.ok){
        sent.push(email);
        byService[out.via!] = (byService[out.via!] ?? 0) + 1;
      } else {
        failed.push(email);
      }
      if (out.note && !firstProblem) firstProblem = out.note;
    }

    /* Stamped only now. If the sending fell over the requests stay open,
       and pressing the button again tries the ones that were missed
       rather than telling the same people twice. */
    if (sent.length)
      await db(`restock_requests?product_id=eq.${product_id}&done_at=is.null`, {
        method: "PATCH",
        body: JSON.stringify({ done_at: new Date().toISOString() }),
      });

    if (!RESEND && !BREVO)
      return json({ error: "Neither RESEND_API_KEY nor BREVO_API_KEY is set " +
                           "on this project, so nothing could be sent." }, 500);

    /* `via` says who actually carried it. The owner's panel shows this
       when it is not Resend, because a quota quietly running out looks
       exactly like everything being fine. */
    return json({
      sent: sent.length,
      failed: failed.length,
      via: byService,
      ...(firstProblem ? { note: firstProblem } : {}),
    });

  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
