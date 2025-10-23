export class GeminiClient {
  constructor(apiKey) {
    if (!apiKey) throw new Error("Gemini API key required");
    this.apiKey = apiKey;
    this.endpoint =
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent";
  }

  async generate(prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    try {
      const res = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      console.log("[Gemini] API raw data:", data);

      const result =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "⚠️ No text returned from Gemini.";
      return result;
    } catch (err) {
      console.error("[Gemini] Request failed:", err);
      return "❌ Error: Gemini request failed. Please check your API key or connection.";
    }
  }
}
