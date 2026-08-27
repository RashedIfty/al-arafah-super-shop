/**
 * Smart search - re-ranks candidates the local engine already found.
 *
 * The browser sends the query plus a shortlist, never the whole
 * catalogue: that is what exhausted the token budget in the earlier
 * attempt. Roughly 400 tokens a call against a 70,000/minute limit.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "groq/compound-mini";   // 70k tokens/min on the free tier

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" }
  });

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
        max_completion_tokens: 120,     // only ever a list of numbers
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
