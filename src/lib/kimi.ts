// Thin client for Moonshot AI's Kimi models (OpenAI-compatible chat
// completions API). Plain fetch — no SDK dependency needed for one endpoint.
const KIMI_API_URL = "https://api.moonshot.ai/v1/chat/completions";
const MODEL = "kimi-k3";

export async function askKimi(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error("KIMI_API_KEY not set in .env");
  }

  const res = await fetch(KIMI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kimi API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
