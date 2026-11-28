import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { writeAuditLog } from "@/lib/audit";
import { ensureStudyFilesTable, restoreStudyFile } from "@/lib/study-files";
import { generateGeminiText } from "@/lib/gemini";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileRow = RowDataPacket & {
  id: number;
  tool_type: "lecture" | "book";
  original_name: string;
  mime_type: string;
  file_data: Buffer;
  compression_method: string;
};

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!/^\d{1,18}$/.test(params.id) || Number(params.id) < 1) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  try {
    await ensureStudyFilesTable();
    const [rows] = await db.execute<FileRow[]>(
      "SELECT id, tool_type, original_name, mime_type, file_data, compression_method FROM study_files WHERE id = ? AND user_id = ? LIMIT 1",
      [params.id, user.id]
    );
    const file = rows[0];
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

    let originalBytes: Buffer;
    try { originalBytes = restoreStudyFile(file.file_data, file.compression_method); }
    catch { return NextResponse.json({ error: "This stored file could not be decompressed." }, { status: 415 }); }
    if (originalBytes.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: "FOCUS AI file analysis currently supports files up to 14 MB. Please upload a smaller file." }, { status: 413 });
    }

    const isPdf = file.mime_type === "application/pdf";
    const isAudio = file.tool_type === "lecture" && file.mime_type.startsWith("audio/");
    if (!isPdf && !isAudio) {
      return NextResponse.json({ error: "This file type cannot be analyzed." }, { status: 415 });
    }

    const geminiMimeType = file.mime_type === "audio/x-m4a" ? "audio/mp4" : file.mime_type === "audio/x-wav" ? "audio/wav" : file.mime_type === "audio/mp3" ? "audio/mpeg" : file.mime_type;
    const task = isAudio
      ? "Transcribe the attached lecture recording faithfully, then provide a structured study summary. Include key topics, important terms, explanations, and five review questions. Mark unclear speech instead of guessing."
      : "Read the attached PDF as study material. Create a structured study guide with a concise overview, section-by-section key points, important definitions, and five review questions. Cite page numbers only when you can identify them in the document; never invent page references.";
    const language = user.preferred_language === "ar" ? "Arabic" : "English";
    const prompt = task + "\n\nWrite the response in " + language +
      ". Keep the original technical terms when useful. Base every point on the attached file and clearly say if part of it is unreadable.";

    const analysis = await generateGeminiText(
      [{
        role: "user",
        parts: [
          { text: "Analyze this uploaded study file: " + file.original_name + "\n" + prompt },
          { inlineData: { mimeType: geminiMimeType, data: originalBytes.toString("base64") } }
        ]
      }],
      "You are FOCUS AI Study Assistant. Help students understand their own learning materials. Be accurate, structured, and do not invent content, quotations, transcripts, or page numbers.",
      8192,
      isAudio ? (process.env.GEMINI_AUDIO_MODEL || "gemini-3.5-flash") : undefined
    );

    await db.execute<ResultSetHeader>(
      "INSERT INTO study_file_analyses (file_id, analysis) VALUES (?, ?)",
      [file.id, analysis]
    );
    await writeAuditLog({ actorUserId:user.id, action:"study_file_analyzed", entityType:"study_file", entityId:file.id, metadata:{ tool:file.tool_type, fileName:file.original_name } });
    return NextResponse.json({ analysis });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "GEMINI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "FOCUS AI file analysis is not configured. Please contact the platform administrator." }, { status: 503 });
    }
    if (code === "GEMINI_REQUEST_FAILED") {
      return NextResponse.json({ error: "FOCUS AI could not process this file. Check the model setting and try a smaller or clearer file." }, { status: 502 });
    }
    console.error("Study file analysis failed:", error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 502 });
  }
}
