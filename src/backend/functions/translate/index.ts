/**
 * Translate — fills the Bangla and Japanese fields from the English one.
 *
 * The owner types the English name and the other two appear, still
 * editable. Nothing is ever overwritten without them seeing it: the
 * browser only asks for a field that is empty.
 *
 * A product name is perhaps thirty tokens, so this costs almost nothing
 * against the 70,000-per-minute free tier the search already shares.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "groq/compound-mini";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" }
  });

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

  try {
    const { text } = await req.json();

    if (typeof text !== "string" || !text.trim())
      return json({ bn: "", ja: "", reason: "empty" });

    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) return json({ bn: "", ja: "", reason: "no_key" });

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,              // low: a name should not be invented
        max_completion_tokens: 220,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text.slice(0, 400) }
        ]
      })
    });

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

    /* The model is asked for bare JSON but sometimes wraps it in prose or
       a code fence, so take the first object rather than trusting the
       whole reply. */
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) return json({ bn: "", ja: "", reason: "unparsable" });

    let out: { bn?: unknown; ja?: unknown };
    try {
      out = JSON.parse(match[0]);
    } catch {
      return json({ bn: "", ja: "", reason: "unparsable" });
    }

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
