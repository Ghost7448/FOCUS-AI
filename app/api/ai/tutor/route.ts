import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { generateGeminiText } from "@/lib/gemini";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.number().int().positive().optional()
});

type MessageRow = RowDataPacket & {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Write a message of up to 4,000 characters." }, { status: 400 });
  }

  const { message, conversationId } = parsed.data;
  let activeConversationId = conversationId;

  try {
    if (activeConversationId) {
      const [owned] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ? AND context_type = 'tutor' LIMIT 1",
        [activeConversationId, user.id]
      );
      if (!owned.length) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
    } else {
      const [created] = await db.execute<ResultSetHeader>(
        "INSERT INTO conversations (user_id, title, context_type) VALUES (?, ?, 'tutor')",
        [user.id, message.slice(0, 80)]
      );
      activeConversationId = created.insertId;
    }

    await db.execute(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)",
      [activeConversationId, message]
    );

    const [rows] = await db.execute<MessageRow[]>(
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 20",
      [activeConversationId]
    );

    const contents = rows.reverse().map((row) => ({
      role: row.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: row.content }]
    }));

    const answer = await generateGeminiText(
      contents,
      "You are FOCUS AI Personal Tutor. Help the student learn step by step, explain concepts clearly, ask helpful follow-up questions when useful, and adapt to the student's language. Reply in the same language as the latest user message. Do not claim to have read files or sources that were not provided."
    );

    await db.execute(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)",
      [activeConversationId, answer]
    );

    return NextResponse.json({ conversationId: activeConversationId, answer });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "GEMINI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Gemini is not configured yet. Add GEMINI_API_KEY to the server environment." }, { status: 503 });
    }
    console.error("Tutor request failed:", error);
    return NextResponse.json({ error: "The tutor could not answer right now. Please try again." }, { status: 502 });
  }
}
