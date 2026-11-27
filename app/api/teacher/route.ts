import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { generateGeminiText } from "@/lib/gemini";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_class"), name: z.string().trim().min(2).max(160), description: z.string().max(2000).optional(), subjectId: z.number().int().positive().optional() }),
  z.object({ action: z.literal("create_course"), name: z.string().trim().min(2).max(160), description: z.string().max(2000).optional() }),
  z.object({ action: z.literal("create_lesson"), classId: z.number().int().positive(), title: z.string().trim().min(2).max(200), content: z.string().min(5).max(20000), publish: z.boolean().optional() }),
  z.object({ action: z.literal("plan_lesson"), classId: z.number().int().positive(), topic: z.string().trim().min(2).max(300), level: z.string().max(120).optional(), duration: z.number().int().min(10).max(240).default(45), language: z.enum(["ar","en"]).default("en") }),
  z.object({ action: z.literal("create_exam"), classId: z.number().int().positive(), title: z.string().trim().min(2).max(200), topic: z.string().trim().min(2).max(300), count: z.number().int().min(3).max(20).default(10), difficulty: z.enum(["easy","medium","hard"]).default("medium"), language: z.enum(["ar","en"]).default("en") }),
  z.object({ action: z.literal("publish_lesson"), lessonId: z.number().int().positive() })
]);

async function ownedClass(classId: number, userId: number) {
  const [rows] = await db.execute<RowDataPacket[]>("SELECT id FROM classes WHERE id = ? AND teacher_id = ? AND is_active = 1 LIMIT 1", [classId, userId]);
  return rows.length > 0;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["teacher", "admin"].includes(user.role)) return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  try {
    const ownerFilter = user.role === "admin" ? "" : "WHERE c.teacher_id = ?";
    const params = user.role === "admin" ? [] : [user.id];
    const [classes] = await db.execute<RowDataPacket[]>(
      `SELECT c.id,c.name,c.description,c.created_at,s.name AS subject_name,
        (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id=c.id) AS student_count
       FROM classes c LEFT JOIN subjects s ON s.id=c.subject_id ${ownerFilter} ORDER BY c.created_at DESC`, params);
    const [subjects] = await db.execute<RowDataPacket[]>("SELECT id,name,description FROM subjects ORDER BY name");
    const [lessons] = await db.execute<RowDataPacket[]>(
      `SELECT l.id,l.class_id,l.title,l.status,l.created_at,c.name AS class_name
       FROM lessons l INNER JOIN classes c ON c.id=l.class_id ${user.role === "admin" ? "" : "WHERE l.teacher_id = ?"} ORDER BY l.created_at DESC LIMIT 100`,
      user.role === "admin" ? [] : [user.id]);
    const [exams] = await db.execute<RowDataPacket[]>(
      `SELECT e.id,e.class_id,e.title,e.starts_at,e.ends_at,e.created_at,c.name AS class_name,
        (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id=e.id) AS question_count,
        (SELECT COUNT(*) FROM exam_submissions es WHERE es.exam_id=e.id AND es.status IN ('submitted','graded')) AS submissions
       FROM exams e INNER JOIN classes c ON c.id=e.class_id ${user.role === "admin" ? "" : "WHERE e.teacher_id = ?"} ORDER BY e.created_at DESC LIMIT 100`,
      user.role === "admin" ? [] : [user.id]);
    const [reports] = await db.execute<RowDataPacket[]>(
      `SELECT e.id AS exam_id,e.title AS exam_title,c.name AS class_name,
        COUNT(es.id) AS submissions,ROUND(AVG(es.score),1) AS average_score,
        MAX(es.score) AS highest_score,MIN(es.score) AS lowest_score
       FROM exams e INNER JOIN classes c ON c.id=e.class_id
       LEFT JOIN exam_submissions es ON es.exam_id=e.id AND es.status IN ('submitted','graded')
       ${user.role === "admin" ? "" : "WHERE e.teacher_id = ?"}
       GROUP BY e.id,e.title,c.name ORDER BY e.created_at DESC LIMIT 100`,
      user.role === "admin" ? [] : [user.id]);
    return NextResponse.json({ classes, subjects, lessons, exams, reports });
  } catch (error) {
    console.error("Teacher workspace load failed:", error);
    return NextResponse.json({ error: "Could not load teacher workspace. Check that the latest database schema is installed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !["teacher", "admin"].includes(user.role)) return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const input = parsed.data;
  try {
    if (input.action === "create_course") {
      await db.execute("INSERT INTO subjects(name,description) VALUES(?,?)", [input.name,input.description || null]);
      return NextResponse.json({ message: "Course created." });
    }
    if (input.action === "create_class") {
      const joinCode = randomBytes(4).toString("hex").toUpperCase();
      const hash = createHash("sha256").update(joinCode).digest("hex");
      const [result] = await db.execute<ResultSetHeader>(
        "INSERT INTO classes(teacher_id,subject_id,name,description,join_code_hash) VALUES(?,?,?,?,?)",
        [user.id,input.subjectId || null,input.name,input.description || null,hash]);
      return NextResponse.json({ message: "Class created.", classId: result.insertId, joinCode });
    }
    if (input.action === "publish_lesson") {
      const [result] = await db.execute<ResultSetHeader>(
        user.role === "admin"
          ? "UPDATE lessons SET status='published',published_at=UTC_TIMESTAMP() WHERE id=?"
          : "UPDATE lessons SET status='published',published_at=UTC_TIMESTAMP() WHERE id=? AND teacher_id=?",
        user.role === "admin" ? [input.lessonId] : [input.lessonId,user.id]);
      if (!result.affectedRows) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
      return NextResponse.json({ message: "Lesson published." });
    }
    if (!await ownedClass(input.classId, user.id) && user.role !== "admin") return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (input.action === "create_lesson") {
      const [result] = await db.execute<ResultSetHeader>(
        "INSERT INTO lessons(class_id,teacher_id,title,content,status,published_at) VALUES(?,?,?,?,?,?)",
        [input.classId,user.id,input.title,input.content,input.publish ? "published" : "draft",input.publish ? new Date() : null]);
      return NextResponse.json({ message: "Lesson saved.", lessonId: result.insertId });
    }
    if (input.action === "plan_lesson") {
      const prompt = input.language === "ar"
        ? `أنشئ خطة درس عملية باللغة العربية عن: ${input.topic}. المستوى: ${input.level || "عام"}. المدة: ${input.duration} دقيقة. أخرج أهداف التعلم، المتطلبات السابقة، تقسيم الوقت، شرح الأنشطة، أسئلة التقييم والواجب. استخدم عناوين واضحة.`
        : `Create a practical lesson plan in English about: ${input.topic}. Level: ${input.level || "general"}. Duration: ${input.duration} minutes. Include learning objectives, prerequisites, timed teaching activities, assessment questions, and homework with clear headings.`;
      const plan = await generateGeminiText([{ role: "user", parts: [{ text: prompt }] }], "You are an experienced instructional designer. Produce accurate, classroom-ready lesson plans.", 2200);
      return NextResponse.json({ plan });
    }
    if (input.action === "create_exam") {
      const prompt = `Create exactly ${input.count} ${input.difficulty} multiple-choice questions about "${input.topic}". Language: ${input.language === "ar" ? "Arabic" : "English"}. Return ONLY valid JSON array. Each item: {"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}. answer is zero-based index.`;
      const raw = await generateGeminiText([{ role: "user", parts: [{ text: prompt }] }], "You create fair educational assessments. Return valid JSON only, no markdown.", 3000);
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const questions = JSON.parse(cleaned);
      if (!Array.isArray(questions) || questions.length !== input.count || questions.some((q: any) => typeof q.question !== "string" || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3)) {
        return NextResponse.json({ error: "The AI returned an invalid exam. Please generate it again." }, { status: 502 });
      }
      const [examResult] = await db.execute<ResultSetHeader>("INSERT INTO exams(class_id,teacher_id,title) VALUES(?,?,?)", [input.classId,user.id,input.title]);
      for (const q of questions) {
        await db.execute("INSERT INTO exam_questions(exam_id,question_text,question_type,options_json,answer_key,points) VALUES(?,?,'multiple_choice',?,?,1)",
          [examResult.insertId,q.question,JSON.stringify(q.options),String(q.answer)]);
      }
      return NextResponse.json({ message: "Exam created.", examId: examResult.insertId, questions: questions.map((q: any) => ({ question: q.question, options: q.options, explanation: q.explanation })) });
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "GEMINI_NOT_CONFIGURED") return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY in Railway Variables." }, { status: 503 });
    console.error("Teacher action failed:", error);
    return NextResponse.json({ error: "Could not complete this action. Please check the database and AI configuration." }, { status: 500 });
  }
}
