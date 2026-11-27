import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { generateGeminiText } from "@/lib/gemini";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sourceText: z.string().trim().min(30).max(12000)
});

type QuizRow = RowDataPacket & {
  id: number;
  title: string;
  created_at: Date;
  question_id: number | null;
  question_text: string | null;
  options_json: unknown;
};

function readOptions(value: unknown): { options: string[]; explanation: string } {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = null; }
  }
  if (Array.isArray(parsed)) return { options: parsed.map(String), explanation: "" };
  if (parsed && typeof parsed === "object") {
    const item = parsed as { options?: unknown; explanation?: unknown };
    return {
      options: Array.isArray(item.options) ? item.options.map(String) : [],
      explanation: typeof item.explanation === "string" ? item.explanation : ""
    };
  }
  return { options: [], explanation: "" };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    const [rows] = await db.execute<QuizRow[]>(
      "SELECT q.id, q.title, q.created_at, qq.id AS question_id, qq.question_text, qq.options_json " +
      "FROM quizzes q LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id " +
      "WHERE q.user_id = ? ORDER BY q.created_at DESC, qq.id ASC LIMIT 300",
      [user.id]
    );
    const map = new Map<number, { id: number; title: string; created_at: Date; questions: { id: number; question_text: string; options: string[]; explanation: string }[] }>();
    for (const row of rows) {
      let quiz = map.get(row.id);
      if (!quiz) {
        quiz = { id: row.id, title: row.title, created_at: row.created_at, questions: [] };
        map.set(row.id, quiz);
      }
      if (row.question_id && row.question_text) {
        const parsed = readOptions(row.options_json);
        quiz.questions.push({ id: row.question_id, question_text: row.question_text, options: parsed.options, explanation: parsed.explanation });
      }
    }
    return NextResponse.json({ quizzes: Array.from(map.values()).slice(0, 20) });
  } catch (error) {
    console.error("Quiz list failed:", error);
    return NextResponse.json({ error: "Could not load your quizzes." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Add at least 30 characters of study material. Maximum 12,000 characters." }, { status: 400 });
  }

  try {
    const prompt = [
      "Create a study quiz using only the supplied study material.",
      "Return valid JSON only, without markdown fences, with this exact shape:",
      '{"title":"...","questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}',
      "Create 5 multiple-choice questions. Each question must have exactly 4 distinct options.",
      "answerIndex must be an integer from 0 to 3. Explanations must be grounded in the source.",
      "Write the quiz in " + (user.preferred_language === "ar" ? "Arabic" : "English") + ".",
      "Study material:",
      parsed.data.sourceText
    ].join("\n\n");

    const generated = await generateGeminiText(
      [{ role: "user", parts: [{ text: prompt }] }],
      "You are FOCUS AI Quiz Creator. Produce valid JSON and never invent facts beyond the supplied study material.",
      5000
    );
    const start = generated.indexOf("{");
    const end = generated.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("QUIZ_INVALID_JSON");
    const result = JSON.parse(generated.slice(start, end + 1)) as {
      title?: unknown;
      questions?: { question?: unknown; options?: unknown; answerIndex?: unknown; explanation?: unknown }[];
    };
    if (!Array.isArray(result.questions) || result.questions.length !== 5) throw new Error("QUIZ_INVALID_JSON");

    const questions = result.questions.map((question) => {
      if (typeof question.question !== "string" || !question.question.trim() ||
          !Array.isArray(question.options) || question.options.length !== 4 ||
          !question.options.every((option) => typeof option === "string" && option.trim()) ||
          !Number.isInteger(question.answerIndex) || Number(question.answerIndex) < 0 || Number(question.answerIndex) > 3) {
        throw new Error("QUIZ_INVALID_JSON");
      }
      return {
        question: question.question.trim().slice(0, 1500),
        options: (question.options as string[]).map((option) => option.trim().slice(0, 500)),
        answerIndex: Number(question.answerIndex),
        explanation: typeof question.explanation === "string" ? question.explanation.slice(0, 1200) : ""
      };
    });

    const title = (typeof result.title === "string" && result.title.trim()
      ? result.title.trim()
      : parsed.data.title).slice(0, 200);

    const connection = await db.getConnection();
    let quizId = 0;
    let createdQuestions: { id: number; question_text: string; options: string[]; explanation: string }[] = [];
    try {
      await connection.beginTransaction();
      const [quizResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO quizzes (user_id, title, source_type) VALUES (?, ?, 'generated')",
        [user.id, title]
      );
      quizId = quizResult.insertId;
      createdQuestions = [];
      for (const question of questions) {
        const [questionResult] = await connection.execute<ResultSetHeader>(
          "INSERT INTO quiz_questions (quiz_id, question_text, options_json, answer_key, points) VALUES (?, ?, ?, ?, 1)",
          [quizId, question.question, JSON.stringify({ options: question.options, explanation: question.explanation }), String(question.answerIndex)]
        );
        createdQuestions.push({ id: questionResult.insertId, question_text: question.question, options: question.options, explanation: question.explanation });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({
      quiz: {
        id: quizId,
        title,
        questions: createdQuestions
      }
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "GEMINI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY to Railway Variables." }, { status: 503 });
    }
    if (code === "QUIZ_INVALID_JSON") {
      return NextResponse.json({ error: "Gemini returned an invalid quiz. Please try generating it again." }, { status: 502 });
    }
    console.error("Quiz generation failed:", error);
    return NextResponse.json({ error: "Could not generate this quiz right now." }, { status: 502 });
  }
}
