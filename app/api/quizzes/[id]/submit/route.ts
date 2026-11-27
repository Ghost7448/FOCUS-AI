import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const answerSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(3))
});

type QuestionRow = RowDataPacket & {
  id: number;
  question_text: string;
  options_json: unknown;
  answer_key: string;
  points: number;
};

function readQuestionData(value: unknown) {
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!/^\d{1,18}$/.test(params.id) || Number(params.id) < 1) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Submit an answer for each question." }, { status: 400 });

  try {
    const [rows] = await db.execute<QuestionRow[]>(
      "SELECT qq.id, qq.question_text, qq.options_json, qq.answer_key, qq.points " +
      "FROM quiz_questions qq INNER JOIN quizzes q ON q.id = qq.quiz_id " +
      "WHERE q.id = ? AND q.user_id = ? ORDER BY qq.id",
      [params.id, user.id]
    );
    if (!rows.length) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    if (rows.some((question) => !Object.prototype.hasOwnProperty.call(parsed.data.answers, String(question.id)))) {
      return NextResponse.json({ error: "Answer every question before submitting." }, { status: 400 });
    }

    let earned = 0;
    let total = 0;
    const review = rows.map((question) => {
      const selected = parsed.data.answers[String(question.id)];
      const correctIndex = Number(question.answer_key);
      const points = Number(question.points || 1);
      total += points;
      const correct = selected === correctIndex;
      if (correct) earned += points;
      const data = readQuestionData(question.options_json);
      return {
        id: question.id,
        question: question.question_text,
        selected,
        correctIndex,
        correct,
        explanation: data.explanation,
        correctAnswer: data.options[correctIndex] || ""
      };
    });
    const score = total ? Math.round((earned / total) * 10000) / 100 : 0;
    await db.execute<ResultSetHeader>(
      "INSERT INTO quiz_attempts (quiz_id, user_id, score, answers_json, completed_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())",
      [params.id, user.id, score, JSON.stringify(parsed.data.answers)]
    );
    return NextResponse.json({ score, correctCount: review.filter((item) => item.correct).length, totalQuestions: rows.length, review });
  } catch (error) {
    console.error("Quiz submission failed:", error);
    return NextResponse.json({ error: "Could not submit this quiz." }, { status: 500 });
  }
}
