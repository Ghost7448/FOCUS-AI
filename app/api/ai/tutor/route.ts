import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { createGroqTutorStream, markGeminiDailyQuotaExhausted, reserveGeminiDailyRequest } from "@/lib/ai-provider";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.number().int().positive().optional()
});

type MessageRow = RowDataPacket & { role: "user" | "assistant"; content: string };
const SYSTEM_PROMPT = "You are FOCUS AI Personal Tutor. Help the student learn step by step, explain concepts clearly, ask helpful follow-up questions when useful, and adapt to the student's language. Reply in the same language as the latest user message. Keep answers focused and avoid unnecessary repetition. Do not claim to have read files or sources that were not provided.";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message of up to 4,000 characters." }, { status: 400 });

  const { message, conversationId } = parsed.data;
  let activeConversationId = conversationId;

  try {
    if (activeConversationId) {
      const [owned] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ? AND context_type = 'tutor' LIMIT 1",
        [activeConversationId, user.id]
      );
      if (!owned.length) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    } else {
      const [created] = await db.execute<ResultSetHeader>(
        "INSERT INTO conversations (user_id, title, context_type) VALUES (?, ?, 'tutor')",
        [user.id, message.slice(0, 80)]
      );
      activeConversationId = created.insertId;
    }

    await db.execute("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)", [activeConversationId, message]);
    const [rows] = await db.execute<MessageRow[]>(
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 10",
      [activeConversationId]
    );
    const contents = rows.reverse().map((row) => ({
      role: row.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: row.content }]
    }));

    let provider: "gemini" | "groq" = "groq";
    let upstream: Response;
    if (process.env.GEMINI_API_KEY && await reserveGeminiDailyRequest()) {
      const model = process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash";
      const primary = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.6, maxOutputTokens: 900 }
          }),
          cache: "no-store"
        }
      );
      if (primary.ok && primary.body) {
        provider = "gemini";
        upstream = primary;
      } else {
        const errorData = await primary.json().catch(() => null);
        const isQuota = primary.status === 429 || errorData?.error?.status === "RESOURCE_EXHAUSTED" ||
          /quota|rate.?limit|resource exhausted/i.test(String(errorData?.error?.message || ""));
        console.error("Primary tutor provider failed:", {
          httpStatus: primary.status,
          status: errorData?.error?.status || "unknown",
          message: typeof errorData?.error?.message === "string" ? errorData.error.message.slice(0, 800) : "No error message returned"
        });
        if (!isQuota) return NextResponse.json({ error: "FOCUS AI could not start a reply. Please try again in a moment." }, { status: 502 });
        await markGeminiDailyQuotaExhausted();
        upstream = await createGroqTutorStream(contents, SYSTEM_PROMPT, 900);
      }
    } else {
      upstream = await createGroqTutorStream(contents, SYSTEM_PROMPT, 900);
    }

    const responseConversationId = activeConversationId;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";
        let answer = "";
        try {
          const reader = upstream.body!.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const raw = line.slice(5).trim();
              if (!raw || raw === "[DONE]") continue;
              try {
                const chunk = JSON.parse(raw);
                const text = provider === "gemini"
                  ? chunk?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || ""
                  : chunk?.choices?.[0]?.delta?.content || "";
                if (text) {
                  answer += text;
                  controller.enqueue(encoder.encode(text));
                }
              } catch {
                // Ignore non-JSON SSE lines.
              }
            }
          }
          if (buffer.startsWith("data:")) {
            const raw = buffer.slice(5).trim();
            if (raw && raw !== "[DONE]") {
              try {
                const chunk = JSON.parse(raw);
                const text = provider === "gemini"
                  ? chunk?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || ""
                  : chunk?.choices?.[0]?.delta?.content || "";
                if (text) {
                  answer += text;
                  controller.enqueue(encoder.encode(text));
                }
              } catch {}
            }
          }
          if (answer.trim()) {
            await db.execute("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)", [responseConversationId, answer.trim()]);
          }
          controller.close();
        } catch (error) {
          console.error("Tutor stream failed:", error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Conversation-Id": String(responseConversationId)
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "GROQ_NOT_CONFIGURED") {
      return NextResponse.json({ error: "FOCUS AI needs GROQ_API_KEY in Railway Variables when the primary daily limit is reached." }, { status: 503 });
    }
    console.error("Tutor request failed:", error);
    return NextResponse.json({ error: "FOCUS AI could not generate a reply. Please try again in a moment." }, { status: 502 });
  }
}
