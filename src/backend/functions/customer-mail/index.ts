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

/**
 * The owner's words, in the shop's frame. Line breaks kept as the owner
 * typed them; nothing else interpreted, so a customer's name or a price
 * pasted in cannot become markup.
 */
function wrap(text: string){
  const paras = text.trim().split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

  return `
<div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP','Noto Sans Bengali',sans-serif;color:#1f2328;max-width:520px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(115deg,#b8380f,#e2621d);color:#fff;border-radius:12px;padding:20px 22px;margin-bottom:20px">
    <b style="font-size:19px;letter-spacing:-.3px">AL-ARAFAH<span style="display:block;font-size:10px;letter-spacing:3px;font-weight:700;opacity:.9">SUPER SHOP</span></b>
  </div>

  ${paras}

  <p style="color:#6b7280;font-size:12.5px;border-top:1px solid #e8eaed;padding-top:14px;margin-top:24px">
    Al-Arafah Super Shop · 3-chome-4-8 Amakubo, Tsukuba, Ibaraki 305-0005<br>
    Tel 080-5401-8124 · <a href="${SHOP}" style="color:#e2621d">alarafahsupershop.com</a>
  </p>
</div>`;
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
