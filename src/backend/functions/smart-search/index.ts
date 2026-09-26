/**
 * Smart search - re-ranks candidates the local engine already found.
 *
 * The browser sends the query plus a shortlist, never the whole
 * catalogue: that is what exhausted the token budget in the earlier
 * attempt. Roughly 400 tokens a call against a 70,000/minute limit.
 *
 * It is public — every shopper's search box calls it with the public
 * key — so it is also rationed: 30 calls an hour from one address and
 * 2000 a day from everyone together, counted in the ai_calls table
 * (src/backend/schema/migrate-ai-limit.sql). Past either, the reply is
 * an empty order, which the browser already reads as "keep the local
 * ranking", so a limited shopper still gets their search results.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "openai/gpt-oss-20b";   // 30k tokens/min on the free tier

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" }
  });

const MAX_PER_IP_HOUR = 30;     // one address, last hour
const MAX_PER_DAY     = 2000;   // everyone together, last day

/**
 * The caller's address.
 *
 * Supabase sits behind a proxy, so the socket address is the proxy's.
 * The first entry in x-forwarded-for is the client as the edge saw it —
 * the same reading the login function uses.
 */
function callerIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
}

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Ask the database, with the key that is allowed to touch the counters. */
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
 * How many calls match `filter` since `minutes` ago.
 *
 * Throws if the count cannot be read — a missing table, or the database
 * unreachable — so the caller can refuse rather than spend the shop's
 * allowance with no idea how much is left.
 */
async function countSince(filter: string, minutes: number) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const res = await admin(
    `ai_calls?select=id${filter ? "&" + filter : ""}&at=gte.${since}`,
    { headers: { Prefer: "count=exact", Range: "0-0" } },
  );
  if (!res.ok) throw new Error(`ai_calls count: ${res.status}`);
  // content-range comes back as "0-0/12"; the total is what matters.
  const total = res.headers.get("content-range")?.split("/")[1];
  return Number(total) || 0;
}

/**
 * Throw away calls older than a day, now and then.
 *
 * Nothing reads further back than a day, so older rows are dead weight.
 * Not awaited and failures swallowed, like the login function's own
 * pruning: housekeeping must never slow down or break a search.
 */
function pruneSometimes() {
  if (Math.random() > 0.05) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  admin(`ai_calls?at=lt.${cutoff}`, { method: "DELETE" })
    .catch((e) => console.error("prune:", e));
}

/**
 * Take one call from the ration, or say why not.
 *
 * Returns null when the call may go ahead (and has been recorded), or a
 * short reason when it may not. Only calls that go ahead are recorded,
 * so someone hammering past the limit does not also fill the table.
 *
 * If the counters cannot be read at all, the answer is no: a search
 * without the model is still a search, while an unmetered model is the
 * thing this is here to prevent.
 */
async function takeFromRation(ip: string): Promise<string | null> {
  try {
    const [byIp, today] = await Promise.all([
      countSince(`ip=eq.${encodeURIComponent(ip)}`, 60),
      countSince("", 24 * 60),
    ]);
    if (byIp >= MAX_PER_IP_HOUR) return "limited_ip";
    if (today >= MAX_PER_DAY) return "limited_day";

    const res = await admin("ai_calls", {
      method: "POST",
      body: JSON.stringify({ ip }),
    });
    if (!res.ok) throw new Error(`ai_calls insert: ${res.status}`);

    pruneSometimes();
    return null;
  } catch (e) {
    console.error("smart-search: ration", e);
    return "limit_unavailable";
  }
}

const SYSTEM = `
Rank grocery products for a halal South Asian shop in Japan.

Given a query and a numbered list, reply with ONLY the numbers, best
first, comma separated (e.g. 3,1,7). No words. Never invent numbers.

Drop anything that does not fit - a short accurate list is correct.
Reply with nothing if none fit.

Dish -> its ingredients (biryani: basmati, biryani masala, meat, ghee).
Occasion -> what Muslim families buy (iftar: dates, juice, fried snacks;
eid: premium meat, basmati, sweets).
Vague -> read intent ("spicy": masala/chilli; "quick": noodles, frozen;
"healthy": lentils, fish, honey, nuts; "kids": biscuits, milk, sweets).
"cheap"/"সস্তা"/"安い" favour low prices, "premium"/"best" favour high,
but never above relevance. "offer"/"deal" favour ON SALE items.
Plain product words: keep the given order unless something clearly misfits.

Queries may be English, Bangla, Japanese, or romanised Bangla (murgi =
chicken, gorur mangsho = beef, khejur = dates, chal = rice, dal =
lentils, mach = fish).
`.trim();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { query, candidates } = await req.json();

    if (typeof query !== "string" || !query.trim())
      return json({ error: "No query" }, 400);

    if (!Array.isArray(candidates) || !candidates.length)
      return json({ order: [] });

    // Cap the shortlist so one request cannot balloon.
    const list = candidates.slice(0, 20);

    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) return json({ error: "Not configured" }, 500);

    /* Past the ration the reply is still an empty order: the browser
       keeps its local ranking and the shopper sees results as usual.
       429 says what happened to anyone reading the network log; the
       storefront reads the body either way. */
    const limited = await takeFromRation(callerIp(req));
    if (limited)
      return json({ order: [], fallback: true, reason: limited }, 429);

    // One compact line per product keeps the prompt small.
    const lines = list.map((c: any, i: number) =>
      `${i + 1}. ${c.name} (${c.cat}) ${c.w} ¥${c.p}${c.sale ? " ON SALE" : ""}`
    ).join("\n");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        /* The answer is only ever a list of numbers, but this model
           thinks before it speaks and that thinking is counted here. At
           120 it ran out mid-thought and returned nothing at all, which
           read as "no results fit" rather than as a failure. */
        max_completion_tokens: 512,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Query: ${query.slice(0, 200)}\n\n${lines}` }
        ]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("groq", res.status, detail);

      // The browser keeps its local ordering when order is empty. The
      // reason is returned so failures are visible rather than silent.
      return json({
        order: [],
        fallback: true,
        status: res.status,
        reason: res.status === 429 ? "rate_limited" : "upstream_error",
        detail: detail.slice(0, 200)
      });
    }

    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "";

    // Parse "3,1,7" into indexes, ignoring anything out of range.
    const order = [...new Set(
      (reply.match(/\d+/g) ?? [])
        .map((n: string) => parseInt(n, 10) - 1)
        .filter((n: number) => n >= 0 && n < list.length)
    )];

    return json({ order });

  } catch (e) {
    console.error("smart-search", e);
    return json({
      order: [], fallback: true,
      reason: "exception",
      detail: String((e as Error)?.message ?? e).slice(0, 200)
    });
  }
});
