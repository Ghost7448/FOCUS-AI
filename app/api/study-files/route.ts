import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { ensureStudyFilesTable } from "@/lib/study-files";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/wav",
  "audio/x-wav", "audio/webm", "audio/ogg", "audio/aac", "audio/flac"
]);

type StudyFileRow = RowDataPacket & {
  id: number;
  tool_type: "lecture" | "book";
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: Date;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const tool = request.nextUrl.searchParams.get("tool");
  if (tool !== "lecture" && tool !== "book") {
    return NextResponse.json({ error: "Choose lecture or book files." }, { status: 400 });
  }
  try {
    await ensureStudyFilesTable();
    const [rows] = await db.execute<StudyFileRow[]>(
      "SELECT id, tool_type, original_name, mime_type, file_size, created_at " +
      "FROM study_files WHERE user_id = ? AND tool_type = ? ORDER BY created_at DESC LIMIT 100",
      [user.id, tool]
    );
    return NextResponse.json({ files: rows });
  } catch (error) {
    console.error("Study file list failed:", error);
    return NextResponse.json({ error: "Could not load your files." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    await ensureStudyFilesTable();
    const form = await request.formData();
    const tool = form.get("tool");
    const file = form.get("file");
    if ((tool !== "lecture" && tool !== "book") || !(file instanceof File)) {
      return NextResponse.json({ error: "Select a valid file and destination." }, { status: 400 });
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Files must be smaller than 15 MB." }, { status: 413 });
    }

    const name = file.name.trim().slice(0, 255);
    const extension = name.toLowerCase().split(".").pop() || "";
    const isPdf = extension === "pdf" &&
      (file.type === "application/pdf" || file.type === "application/octet-stream");
    const audioExtensions = ["mp3", "m4a", "mp4", "wav", "webm", "ogg", "aac", "flac"];
    const isAudio = tool === "lecture" && audioExtensions.includes(extension) && AUDIO_TYPES.has(file.type);

    if (tool === "book" && !isPdf) {
      return NextResponse.json({ error: "Book Assistant accepts PDF files only." }, { status: 415 });
    }
    if (tool === "lecture" && !isPdf && !isAudio) {
      return NextResponse.json({ error: "Lecture Assistant accepts PDF or supported audio files." }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (isPdf && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json({ error: "The selected file is not a valid PDF." }, { status: 415 });
    }
    const mimeType = isPdf ? "application/pdf" : file.type;
    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO study_files (user_id, tool_type, original_name, mime_type, file_size, file_data) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, tool, name, mimeType, bytes.length, bytes]
    );
    return NextResponse.json({
      file: { id: result.insertId, tool_type: tool, original_name: name, mime_type: mimeType, file_size: bytes.length }
    }, { status: 201 });
  } catch (error) {
    console.error("Study file upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
