type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

export async function generateGeminiText(contents: GeminiContent[], systemInstruction: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1400
        }
      }),
      cache: "no-store"
    }
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Gemini API request failed:", response.status, data?.error?.status || "unknown");
    throw new Error("GEMINI_REQUEST_FAILED");
  }

  const answer = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!answer) throw new Error("GEMINI_EMPTY_RESPONSE");
  return answer;
}
