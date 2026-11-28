type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

export async function generateGeminiText(
  contents: GeminiContent[],
  systemInstruction: string,
  maxOutputTokens = 1400,
  modelOverride?: string
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const model = modelOverride || process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent",
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
          maxOutputTokens
        }
      }),
      cache: "no-store"
    }
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Gemini API request failed:", {
      model,
      httpStatus: response.status,
      status: data?.error?.status || "unknown",
      message: typeof data?.error?.message === "string" ? data.error.message.slice(0, 1000) : "No error message returned"
    });
    if (response.status === 429 || data?.error?.status === "RESOURCE_EXHAUSTED" || /quota|rate.?limit|resource exhausted/i.test(String(data?.error?.message || ""))) {
      throw new Error("GEMINI_QUOTA_EXCEEDED");
    }
    throw new Error("GEMINI_REQUEST_FAILED");
  }

  const answer = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!answer) throw new Error("GEMINI_EMPTY_RESPONSE");
  return answer;
}
