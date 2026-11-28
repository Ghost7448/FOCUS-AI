import { db } from "@/lib/mysql";
import { generateGeminiText } from "@/lib/gemini";
import type { RowDataPacket } from "mysql2";

type TextPart = { text: string };
type TextContent = { role: "user" | "model"; parts: TextPart[] };

let tableReady: Promise<void> | null = null;

async function ensureUsageTable() {
  if (!tableReady) {
    tableReady = db.execute(
      `CREATE TABLE IF NOT EXISTS ai_provider_daily_usage (
        usage_date DATE NOT NULL,
        provider VARCHAR(20) NOT NULL,
        request_count INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (usage_date, provider)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ).then(() => undefined).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

function cairoDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getGeminiDailyLimit() {
  const configured = Number.parseInt(process.env.GEMINI_DAILY_LIMIT || "20", 10);
  return Number.isFinite(configured) ? Math.max(1, Math.min(configured, 10000)) : 20;
}

/** Atomically reserves one of today's primary-provider requests (Egypt time). */
export async function reserveGeminiDailyRequest() {
  await ensureUsageTable();
  const date = cairoDateKey();
  const limit = getGeminiDailyLimit();
  await db.execute(
    "INSERT INTO ai_provider_daily_usage (usage_date, provider, request_count) VALUES (?, 'gemini', 1) " +
    "ON DUPLICATE KEY UPDATE request_count = IF(request_count < ?, request_count + 1, request_count)",
    [date, limit]
  );
  const [rows] = await db.execute<(RowDataPacket & { request_count: number })[]>(
    "SELECT request_count FROM ai_provider_daily_usage WHERE usage_date = ? AND provider = 'gemini' LIMIT 1",
    [date]
  );
  return Number(rows[0]?.request_count || 0) <= limit;
}

function toGroqMessages(contents: TextContent[], systemInstruction: string) {
  return [
    { role: "system", content: systemInstruction },
    ...contents.map((item) => ({
      role: item.role === "model" ? "assistant" : "user",
      content: item.parts.map((part) => part.text).join("\n")
    }))
  ];
}

export async function generateGroqText(
  contents: TextContent[],
  systemInstruction: string,
  maxOutputTokens = 1400
) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_NOT_CONFIGURED");

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: toGroqMessages(contents, systemInstruction),
      temperature: 0.6,
      max_completion_tokens: maxOutputTokens,
      stream: false
    }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Fallback AI request failed:", {
      model,
      httpStatus: response.status,
      message: typeof data?.error?.message === "string" ? data.error.message.slice(0, 800) : "No error message returned"
    });
    throw new Error(response.status === 429 ? "GROQ_RATE_LIMITED" : "GROQ_REQUEST_FAILED");
  }
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("GROQ_EMPTY_RESPONSE");
  return answer.trim();
}

export async function generateFocusText(
  contents: TextContent[],
  systemInstruction: string,
  maxOutputTokens = 1400,
  geminiModelOverride?: string
) {
  if (process.env.GEMINI_API_KEY) {
    const hasPrimarySlot = await reserveGeminiDailyRequest();
    if (hasPrimarySlot) {
      try {
        return await generateGeminiText(contents, systemInstruction, maxOutputTokens, geminiModelOverride);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "GEMINI_QUOTA_EXCEEDED") throw error;
        console.warn("Primary AI daily quota reached; switching to fallback provider.");
      }
    }
  }
  return generateGroqText(contents, systemInstruction, maxOutputTokens);
}

export async function createGroqTutorStream(
  contents: TextContent[],
  systemInstruction: string,
  maxOutputTokens = 900
) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_NOT_CONFIGURED");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: toGroqMessages(contents, systemInstruction),
      temperature: 0.6,
      max_completion_tokens: maxOutputTokens,
      stream: true
    }),
    cache: "no-store"
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    console.error("Fallback AI stream failed:", {
      model,
      httpStatus: response.status,
      message: typeof data?.error?.message === "string" ? data.error.message.slice(0, 800) : "No error message returned"
    });
    throw new Error(response.status === 429 ? "GROQ_RATE_LIMITED" : "GROQ_REQUEST_FAILED");
  }
  return response;
}
