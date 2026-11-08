// Cloudflare Worker: puente seguro entre Jarvis y Gemini.
// Variables que debes crear en Cloudflare (Settings > Variables and Secrets):
//   GEMINI_API_KEY  (tipo Secret)  -> tu clave de Google AI Studio
//   GEMINI_MODEL    (opcional)     -> por defecto gemini-2.5-flash
//   ALLOWED_ORIGIN  (opcional)     -> por ejemplo https://tuusuario.github.io
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return out({ error: "method" }, 405);
    if (!env.GEMINI_API_KEY) return out({ error: "Falta GEMINI_API_KEY" }, 500);
    let b;
    try { b = await req.json(); } catch { return out({ error: "json" }, 400); }
    const contents = (Array.isArray(b.messages) ? b.messages : []).slice(-20).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 8000) }]
    }));
    if (!contents.length) return out({ error: "vacío" }, 400);
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: b.tier === "quick" ? 1024 : 4096 } })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return out({ error: (d.error && d.error.message) || "gemini" }, r.status === 429 ? 429 : 502);
    const text = (((d.candidates || [])[0] || {}).content?.parts || []).map(p => p.text || "").join("").trim();
    return out({ text });
  }
};
