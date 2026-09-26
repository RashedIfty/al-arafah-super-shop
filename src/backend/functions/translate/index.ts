/**
 * Translate — fills the Bangla and Japanese fields from the English one.
 *
 * The owner types the English name and the other two appear, still
 * editable. Nothing is ever overwritten without them seeing it: the
 * browser only asks for a field that is empty.
 *
 * A product name is perhaps thirty tokens, so this costs almost nothing
 * against the 70,000-per-minute free tier the search already shares.
 *
 * Only the signed-in owner may use it. The Groq key behind it is the
 * shop's, and a function anyone could call with the public key would be
 * a free translation service for the whole internet, billed to the shop.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/* Groq retires models without warning, and a retired one fails as a
   plain 404 on every request — the owner sees "Could not fill those in"
   and nothing else. `groq/compound-mini` went that way. If this stops
   working again, the list of what the key can actually use is at
   GET https://api.groq.com/openai/v1/models. */
const MODEL    = "openai/gpt-oss-20b";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" }
  });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

/**
 * Is the caller the shop's owner?
 *
 * Supabase is the authority, so we ask it rather than verifying the
 * token here: is_owner() run with the caller's own token reads the same
 * settings row the database uses everywhere else, so there is no second
 * idea in this file of who the owner is. The photo worker does the same.
 *
 * Returns null when they are, or the reply to send when they are not:
 * 401 for no token or one Supabase will not accept (signed out, or
 * expired), 403 for a valid token that is not the owner's — including the
 * public key itself, which is valid but belongs to nobody.
 */
async function refuseUnlessOwner(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ error: "Please sign in." }, 401);

  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/is_owner`, {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (res.status === 401) return json({ error: "Please sign in again." }, 401);
    if (res.ok && (await res.json()) === true) return null;
    return json({ error: "Only the shop's owner can do this." }, 403);
  } catch (e) {
    // Network trouble: refuse rather than guess.
    console.error("translate: owner check", e);
    return json({ error: "Could not check who is asking." }, 503);
  }
}

/**
 * The first balanced {...} in a reply that parses and carries a
 * translation.
 *
 * Braces are counted rather than matched with a regular expression, so
 * a model that thinks out loud before answering — or fences its answer
 * in Markdown — still gives up its JSON.
 */
function firstObject(text: string): { bn?: unknown; ja?: unknown } | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;

    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];

      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }

      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(text.slice(i, j + 1));
            // Their reasoning may be an object too; ours has the words.
            if (parsed && (parsed.bn || parsed.ja)) return parsed;
          } catch { /* not this one; keep looking */ }
          break;
        }
      }
    }
  }
  return null;
}

/**
 * The instructions matter more than the model here.
 *
 * A grocery shop's names are full of brands and loan words, and a
 * literal translation of "Shan Masala" or "Nestlé" is worse than leaving
 * it alone. The rules below are what stop that.
 */
const SYSTEM = `
You translate for a halal South Asian grocery shop in Tsukuba, Japan.

Given English text, return Bangla and Japanese.

Rules:
- Keep brand names as they are. Shan, Nestlé, Maggi, Kaalar, Pran, Radhuni
  and the like are names, not words to translate.
- Use the word a Bangladeshi or Japanese shopper would actually say in a
  shop, not a dictionary rendering. Masoor Dal is মসুর ডাল, not a
  description of red lentils.
- Keep numbers, units and sizes exactly: 5 kg stays 5 kg.
- Japanese: katakana for imported foods, kanji where it is the normal
  word — 米 for rice, 鶏肉 for chicken.
- Translate the meaning of a sentence, not word by word.

Reply with ONLY this JSON and nothing else:
{"bn":"…","ja":"…"}
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Before anything else, so a stranger cannot even spend a request's
  // worth of the shop's Groq allowance.
  const refused = await refuseUnlessOwner(req);
  if (refused) return refused;

  try {
    const { text } = await req.json();

    if (typeof text !== "string" || !text.trim())
      return json({ bn: "", ja: "", reason: "empty" });

    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) return json({ bn: "", ja: "", reason: "no_key" });

    const ask = () => fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,              // low: a name should not be invented
        max_completion_tokens: 400,    // room for a model that thinks first
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text.slice(0, 400) }
        ]
      })
    });

    /* compound-mini routes to whichever model is free, and a busy one
       answers 429. That is a moment's wait rather than a real failure, so
       try once more before giving the owner an empty field. */
    let res = await ask();
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 900));
      res = await ask();
    }

    if (!res.ok) {
      const detail = await res.text();
      console.error("groq", res.status, detail);

      // Empty strings leave the owner's fields alone; the reason is
      // returned so a failure can be shown rather than passing silently.
      return json({
        bn: "", ja: "",
        reason: res.status === 429 ? "rate_limited" : "upstream_error",
        detail: detail.slice(0, 200)
      });
    }

    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "";

    /* The model is asked for bare JSON but sometimes wraps it in prose,
       a code fence, or its own reasoning — and that reasoning can itself
       contain braces. So try every object in the reply, longest first,
       rather than the span from the first brace to the last: that span
       swallows the whole lot and parses as nothing. */
    const out = firstObject(reply);
    if (!out) return json({ bn: "", ja: "", reason: "unparsable" });

    const clean = (v: unknown) =>
      typeof v === "string" ? v.trim().slice(0, 400) : "";

    return json({ bn: clean(out.bn), ja: clean(out.ja) });

  } catch (e) {
    console.error("translate", e);
    return json({
      bn: "", ja: "",
      reason: "exception",
      detail: String((e as Error)?.message ?? e).slice(0, 200)
    });
  }
});
