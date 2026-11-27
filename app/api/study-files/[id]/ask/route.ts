import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { ensureStudyFilesTable, restoreStudyFile } from "@/lib/study-files";
import { generateGeminiText } from "@/lib/gemini";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const questionSchema = z.object({ question: z.string().trim().min(1).max(2000) });
type FileRow = RowDataPacket & {
  original_name: string;
  mime_type: string;
  file_data: Buffer;
  compression_method: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!/^\d{1,18}$/.test(params.id) || Number(params.id) < 1) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const parsed = questionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a question up to 2,000 characters." }, { status: 400 });

  try {
    await ensureStudyFilesTable();
    const [rows] = await db.execute<FileRow[]>(
      "SELECT original_name, mime_type, file_data, compression_method FROM study_files WHERE id = ? AND user_id = ? LIMIT 1",
      [params.id, user.id]
    );
    const file = rows[0];
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    let originalBytes: Buffer;
    try { originalBytes = restoreStudyFile(file.file_data, file.compression_method); }
    catch { return NextResponse.json({ error: "This stored file could not be decompressed." }, { status: 415 }); }
    if (originalBytes.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Uploads can be 30 MB, but Gemini questions currently support files up to 15 MB." }, { status: 413 });
    }
    const language = user.preferred_language === "ar" ? "Arabic" : "English";
    const answer = await generateGeminiText(
      [{
        role: "user",
        parts: [
          { text: "Study file: " + file.original_name + "\nStudent question: " + parsed.data.question +
            "\nAnswer in " + language + ". Base the answer on the attached file. Include page references for PDFs only when identifiable. If the file does not contain the answer, say so." },
          { inlineData: { mimeType: file.mime_type, data: originalBytes.toString("base64") } }
        ]
      }],
      "You are FOCUS AI Study Assistant. Answer questions about the student's uploaded learning material accurately. Do not invent facts, quotations, or page numbers.",
      3000
    );
    return NextResponse.json({ answer });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "GEMINI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY to Railway Variables." }, { status: 503 });
    }
    console.error("Study file question failed:", error);
    return NextResponse.json({ error: "Could not answer this question right now." }, { status: 502 });
  }
}
