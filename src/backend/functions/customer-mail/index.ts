/**
 * A note from the shop to one customer.
 *
 * The owner writes a subject and a few lines from the customer's card
 * and they go out under the shop's name. Sent from here rather than the
 * browser for the same reason the restock notices are: it needs the
 * mail service's key, and anything the page holds is readable by
 * whoever opens the page.
 *
 * Brevo first, Resend behind it — the same order as restock-notify, and
 * for the same reason: the sign-up and password letters go through
 * Resend's SMTP and offer no second slot, so everything the shop sends
 * itself keeps out of that allowance.
 *
 * Only the owner may call it. The caller's token is checked against the
 * same settings.owner_uid row the database uses everywhere else.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const URL_    = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND  = Deno.env.get("RESEND_API_KEY");
const BREVO   = Deno.env.get("BREVO_API_KEY");

const FROM_NAME  = "Al-Arafah Super Shop";
const FROM_EMAIL = "orders@alarafahsupershop.com";
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;
const SHOP = "https://alarafahsupershop.com";

/* A note, not a newsletter. Long enough for anything the owner would
   type by hand; short enough that a runaway request cannot make the
   shop send a novel. */
const MAX_SUBJECT = 150;
const MAX_BODY    = 4000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/* The shop, as the invoice prints it: the logo on a white tile, the
   name with SUPER SHOP spaced out beneath, both addresses, the phone
   and the hours, over the orange band with the gold seam along its
   foot. Built as tables rather than the invoice's flexbox, because a
   mail client — Gmail above all — honours tables and little else. */
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP','Noto Sans Bengali',Arial,sans-serif";

const ADDRESS_EN = "3-chome-4-8 Amakubo, Tsukuba, Ibaraki 305-0005, Japan";
const ADDRESS_JA = "〒305-0005 茨城県つくば市天久保3丁目4-8";
const TEL = "080-5401-8124";
const HOURS = "10:00 – 21:00";

function band(){
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border-collapse:separate;border-radius:14px 14px 0 0;overflow:hidden;background:#b8380f;background-image:linear-gradient(115deg,#b8380f 0%,#d9531e 55%,#ef7a2a 100%)">
  <tr>
    <td style="padding:22px 24px 18px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="top" style="padding-right:16px">
            <img src="${SHOP}/images/logo.jpeg" width="66" height="66" alt="Al-Arafah Super Shop"
                 style="display:block;width:66px;height:66px;border-radius:9px;background:#ffffff;padding:4px;box-sizing:border-box">
          </td>
          <td valign="top" style="font-family:${FONT};color:#ffffff">
            <div style="font-size:23px;font-weight:800;letter-spacing:-.4px;line-height:1.05">AL-ARAFAH</div>
            <div style="font-size:10.5px;font-weight:700;letter-spacing:3.4px;margin-top:3px;color:rgba(255,255,255,.88)">SUPER SHOP</div>
            <div style="font-size:11px;line-height:1.65;margin-top:8px;color:rgba(255,255,255,.92)">
              ${ADDRESS_EN}<br>
              ${ADDRESS_JA}<br>
              Tel ${TEL} &middot; Open ${HOURS}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td height="3" style="height:3px;line-height:3px;font-size:0;background:#d9a441;background-image:linear-gradient(90deg,#d9a441,#ffd166 45%,#d9a441)">&nbsp;</td>
  </tr>
</table>`;
}

function foot(){
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:16px 24px 22px;border-top:1px solid #eee3d9;font-family:${FONT};font-size:12px;line-height:1.7;color:#6b7280">
      <b style="color:#b8380f">AL-ARAFAH SUPER SHOP</b> &middot; Halal grocery in Tsukuba<br>
      ${ADDRESS_EN}<br>
      Tel <a href="tel:+81${TEL.replace(/-/g, "").slice(1)}" style="color:#6b7280;text-decoration:none">${TEL}</a>
      &middot; <a href="${SHOP}" style="color:#d9531e;text-decoration:none;font-weight:700">alarafahsupershop.com</a>
    </td>
  </tr>
</table>`;
}

/** One sheet: the band, the message, the foot — on a card, on a pale ground. */
function sheet(inner: string){
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f1ec">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1ec">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:560px;background:#ffffff;border-radius:14px;box-shadow:0 6px 24px rgba(20,30,50,.10)">
      <tr><td>${band()}</td></tr>
      <tr><td style="padding:24px 24px 8px;font-family:${FONT};font-size:15px;line-height:1.65;color:#1f2328">${inner}</td></tr>
      <tr><td>${foot()}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/**
 * The owner's words, in the shop's frame. Line breaks kept as the owner
 * typed them; nothing else interpreted, so a customer's name or a price
 * pasted in cannot become markup.
 */
function wrap(text: string){
  const paras = text.trim().split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return sheet(paras);
}

/* ----------------------------- sending ------------------------------- */

async function viaResend(to: string, subject: string, html: string, text: string){
  if (!RESEND) return "no key";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    return r.ok ? null : `resend ${r.status}: ${(await r.text()).slice(0, 140)}`;
  } catch (e){
    return `resend unreachable: ${(e as Error).message}`;
  }
}

async function viaBrevo(to: string, subject: string, html: string, text: string){
  if (!BREVO) return "no key";
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    return r.ok ? null : `brevo ${r.status}: ${(await r.text()).slice(0, 140)}`;
  } catch (e){
    return `brevo unreachable: ${(e as Error).message}`;
  }
}

/** Brevo, then Resend. Says which one carried it. */
async function send(to: string, subject: string, html: string, text: string){
  const first = await viaBrevo(to, subject, html, text);
  if (first === null) return { ok: true, via: "brevo" };

  const second = await viaResend(to, subject, html, text);
  if (second === null) return { ok: true, via: "resend", note: first };

  return { ok: false, via: null, note: `${first} | ${second}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { user_id, subject, body } = await req.json();

    const subj = String(subject ?? "").trim();
    const text = String(body ?? "").trim();
    if (!user_id) return json({ error: "user_id is required" }, 400);
    if (!subj)    return json({ error: "A subject is needed" }, 400);
    if (!text)    return json({ error: "The message is empty" }, 400);
    if (subj.length > MAX_SUBJECT || text.length > MAX_BODY)
      return json({ error: "That is too long for a note" }, 400);

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

    /* The address lives in auth.users, which the REST API does not
       expose; the admin endpoint reads it with the service key. The
       browser sends only the id, so the panel can never be made to
       mail an address of its own choosing. */
    const u = await fetch(`${URL_}/auth/v1/admin/users/${user_id}`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    }).then(x => x.ok ? x.json() : null);

    const email = u?.email;
    if (!email) return json({ error: "That customer was not found." }, 404);

    if (!RESEND && !BREVO)
      return json({ error: "Neither RESEND_API_KEY nor BREVO_API_KEY is set." }, 500);

    const out = await send(email, subj, wrap(text), text);
    if (!out.ok) return json({ error: `Could not send: ${out.note}` }, 502);

    return json({ ok: true, to: email, via: out.via, ...(out.note ? { note: out.note } : {}) });

  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
