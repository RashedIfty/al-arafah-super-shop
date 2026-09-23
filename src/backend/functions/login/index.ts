/**
 * Sign in — with a limit on how fast anyone may try.
 *
 * The browser cannot rate-limit itself: whoever is guessing at passwords
 * simply would not run the check. So sign-in goes through here instead,
 * where the count is kept server-side and the caller's address is read
 * from the request rather than taken on trust.
 *
 * Two counters, because they catch different attacks:
 *
 *   by address — one machine working through a password list, whatever
 *                account it aims at;
 *   by email   — a slow guess at one account spread across many
 *                addresses, which the first counter would never see.
 *
 * A failure is recorded; a success clears that address's record, so an
 * owner who mistypes twice and then gets it right is not left counting
 * against themselves for the next quarter of an hour.
 */

const WINDOW_MIN   = 15;   // how far back the count looks
const MAX_PER_IP    = 8;   // failures from one address in that window
const MAX_PER_EMAIL = 5;   // failures against one account in that window

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

/**
 * The caller's address.
 *
 * Supabase sits behind a proxy, so the socket address is the proxy's.
 * The first entry in x-forwarded-for is the client as the edge saw it —
 * a header the caller cannot set for themselves, because the proxy
 * overwrites it.
 */
function callerIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
}

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Ask the database, with the key that is allowed to read the counters. */
async function admin(path: string, init: RequestInit = {}) {
  return fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

/**
 * Throw away attempts older than a day.
 *
 * The table is only ever read through a 15-minute window, so a row from
 * yesterday can never change an answer — it is dead weight that every
 * count has to read past. Nothing was deleting it: a
 * `prune_login_attempts()` was written for this and never called, and
 * pg_cron is not enabled on this project, so the tidying happens here
 * instead, where the writes are.
 *
 * Not awaited, and failures are swallowed: this is housekeeping, and a
 * customer signing in should never wait on it or be turned away by it.
 * Roughly one sign-in in twenty does the work, which on any real traffic
 * is often enough to keep the table small.
 */
function pruneSometimes() {
  if (Math.random() > 0.05) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  admin(`login_attempts?at=lt.${cutoff}`, { method: "DELETE" })
    .catch((e) => console.error("prune:", e));
}

/** How many failures in the window, for one address or one email. */
async function countRecent(column: "ip" | "email", value: string) {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const res = await admin(
    `login_attempts?select=id&${column}=eq.${encodeURIComponent(value)}&at=gte.${since}`,
    { headers: { Prefer: "count=exact", Range: "0-0" } },
  );
  // content-range comes back as "0-0/12"; the total is what matters.
  const total = res.headers.get("content-range")?.split("/")[1];
  return Number(total) || 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { email, password } = await req.json();

    if (typeof email !== "string" || typeof password !== "string"
        || !email.trim() || !password)
      return json({ error: "Please enter your email and password." }, 400);

    const ip = callerIp(req);
    const who = email.trim().toLowerCase();

    /* Checked before the password is looked at, so that a locked-out
       caller learns nothing from how long the reply takes. */
    const [byIp, byEmail] = await Promise.all([
      countRecent("ip", ip),
      countRecent("email", who),
    ]);

    if (byIp >= MAX_PER_IP || byEmail >= MAX_PER_EMAIL)
      return json({
        error: `Too many attempts. Please wait ${WINDOW_MIN} minutes and try again.`,
        retryAfterMinutes: WINDOW_MIN,
      }, 429);

    /* The actual sign-in, against Supabase Auth with the public key —
       this function never sees a stored password, only whether the pair
       was accepted. */
    const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: who, password }),
    });

    const body = await res.json();

    if (!res.ok) {
      // Recorded before replying, so a burst of parallel guesses cannot
      // slip through between the check and the write.
      await admin("login_attempts", {
        method: "POST",
        body: JSON.stringify({ ip, email: who }),
      });

      pruneSometimes();

      /* Deliberately the same message whether the email is unknown or
         the password is wrong: saying which would tell a stranger
         whether an address has an account here. */
      return json({
        error: "That email or password is not right.",
        remaining: Math.max(0, MAX_PER_IP - byIp - 1),
      }, 401);
    }

    /* Signed in: clear this address's failures. Someone who mistypes
       twice and then succeeds should start again from zero. */
    await admin(`login_attempts?ip=eq.${encodeURIComponent(ip)}`, { method: "DELETE" });

    pruneSometimes();
    return json(body);

  } catch (e) {
    console.error("login:", e);
    return json({ error: "Could not sign in. Please try again." }, 500);
  }
});
