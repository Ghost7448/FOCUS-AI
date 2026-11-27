import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { hasSameOrigin } from "@/lib/security";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join_class"), code: z.string().trim().min(4).max(20) }),
  z.object({ action: z.literal("submit_exam"), examId: z.number().int().positive(), answers: z.array(z.object({ questionId: z.number().int().positive(), answer: z.number().int().min(0).max(3) })).min(1).max(100) })
]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") return NextResponse.json({ error: "Student access required." }, { status: 403 });
  try {
    const [classes] = await db.execute<RowDataPacket[]>(
      `SELECT c.id,c.name,c.description,s.name AS subject_name
       FROM class_members cm INNER JOIN classes c ON c.id=cm.class_id
       LEFT JOIN subjects s ON s.id=c.subject_id
       WHERE cm.student_id=? AND c.is_active=1 ORDER BY c.name`, [user.id]);
    const [exams] = await db.execute<RowDataPacket[]>(
      `SELECT e.id,e.title,c.name AS class_name,
        (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id=e.id) AS question_count,
        es.status AS submission_status,es.score
       FROM class_members cm INNER JOIN exams e ON e.class_id=cm.class_id
       INNER JOIN classes c ON c.id=e.class_id
       LEFT JOIN exam_submissions es ON es.exam_id=e.id AND es.student_id=cm.student_id
       WHERE cm.student_id=? ORDER BY e.created_at DESC`, [user.id]);
    const [questions] = await db.execute<RowDataPacket[]>(
      `SELECT q.id,q.exam_id,q.question_text,q.options_json,q.points
       FROM class_members cm INNER JOIN exams e ON e.class_id=cm.class_id
       INNER JOIN exam_questions q ON q.exam_id=e.id
       WHERE cm.student_id=? ORDER BY e.id,q.id`, [user.id]);
    const parsedQuestions = questions.map((q) => ({ ...q, options: typeof q.options_json === "string" ? JSON.parse(q.options_json) : q.options_json }));
    return NextResponse.json({ classes, exams, questions: parsedQuestions });
  } catch (error) {
    console.error("Student workspace load failed:", error);
    return NextResponse.json({ error: "Could not load your classes and exams." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || user.role !== "student") return NextResponse.json({ error: "Student access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request details." }, { status: 400 });
  try {
    if (parsed.data.action === "join_class") {
      const hash = createHash("sha256").update(parsed.data.code.toUpperCase()).digest("hex");
      const [rows] = await db.execute<RowDataPacket[]>("SELECT id FROM classes WHERE join_code_hash=? AND is_active=1 LIMIT 1", [hash]);
      if (!rows.length) return NextResponse.json({ error: "Invalid class code." }, { status: 404 });
      await db.execute("INSERT IGNORE INTO class_members(class_id,student_id) VALUES(?,?)", [rows[0].id,user.id]);
      return NextResponse.json({ message: "You joined the class successfully." });
    }

    const [membership] = await db.execute<RowDataPacket[]>(
      `SELECT e.id FROM exams e INNER JOIN class_members cm ON cm.class_id=e.class_id
       WHERE e.id=? AND cm.student_id=? LIMIT 1`, [parsed.data.examId,user.id]);
    if (!membership.length) return NextResponse.json({ error: "Exam not found in your classes." }, { status: 404 });
    const [questions] = await db.execute<RowDataPacket[]>(
      "SELECT id,answer_key,points FROM exam_questions WHERE exam_id=? ORDER BY id", [parsed.data.examId]);
    if (!questions.length) return NextResponse.json({ error: "This exam has no questions." }, { status: 400 });
    const validIds = new Set(questions.map(q => Number(q.id)));
    if (parsed.data.answers.length !== questions.length || new Set(parsed.data.answers.map(a => a.questionId)).size !== questions.length) {
      return NextResponse.json({ error: "Please answer every question exactly once." }, { status: 400 });
    }
    if (parsed.data.answers.some(a => !validIds.has(a.questionId))) return NextResponse.json({ error: "Some answers do not belong to this exam." }, { status: 400 });
    const answerMap = new Map(parsed.data.answers.map(a => [a.questionId,a.answer]));
    let score = 0;
    for (const q of questions) if (answerMap.get(Number(q.id)) === Number(q.answer_key)) score += Number(q.points || 1);
    const [totalRows] = await db.execute<RowDataPacket[]>("SELECT COALESCE(SUM(points),0) AS total FROM exam_questions WHERE exam_id=?", [parsed.data.examId]);
    const total = Number(totalRows[0]?.total || 0);
    await db.execute(
      `INSERT INTO exam_submissions(exam_id,student_id,status,score,submitted_at)
       VALUES(?,?,'submitted',?,UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE status='submitted',score=VALUES(score),submitted_at=UTC_TIMESTAMP()`,
      [parsed.data.examId,user.id,score]);
    const [submissionRows] = await db.execute<RowDataPacket[]>("SELECT id FROM exam_submissions WHERE exam_id=? AND student_id=? LIMIT 1", [parsed.data.examId,user.id]);
    const submissionId = Number(submissionRows[0].id);
    for (const [questionId,answer] of answerMap) {
      const q = questions.find(item => Number(item.id) === questionId);
      const awarded = q && answer === Number(q.answer_key) ? Number(q.points || 1) : 0;
      await db.execute(
        `INSERT INTO exam_answers(submission_id,question_id,answer_text,awarded_points)
         VALUES(?,?,?,?)
         ON DUPLICATE KEY UPDATE answer_text=VALUES(answer_text),awarded_points=VALUES(awarded_points)`,
        [submissionId,questionId,String(answer),awarded]);
    }
    return NextResponse.json({ message: "Exam submitted.", score, total });
  } catch (error) {
    console.error("Student action failed:", error);
    return NextResponse.json({ error: "Could not complete this action." }, { status: 500 });
  }
}
