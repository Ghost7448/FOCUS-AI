import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { ensureStudyFilesTable, MAX_STUDY_FILE_SIZE, restoreStudyFile } from "@/lib/study-files";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


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
  analysis: string | null;
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
      "SELECT f.id, f.tool_type, f.original_name, f.mime_type, f.file_size, f.created_at, " +
      "(SELECT a.analysis FROM study_file_analyses a WHERE a.file_id = f.id ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS analysis " +
      "FROM study_files f WHERE f.user_id = ? AND f.tool_type = ? ORDER BY f.created_at DESC LIMIT 100",
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
    const compression = form.get("compression")?.toString() || "none";
    const originalSize = Number(form.get("originalSize") || file.size);
    if (file.size < 1 || file.size > MAX_STUDY_FILE_SIZE || !Number.isSafeInteger(originalSize) || originalSize < 1 || originalSize > MAX_STUDY_FILE_SIZE) {
      return NextResponse.json({ error: "Files must be 30 MB or smaller." }, { status: 413 });
    }
    if (compression !== "none" && compression !== "gzip") {
      return NextResponse.json({ error: "Invalid compression format." }, { status: 400 });
    }

    const name = (form.get("originalName")?.toString() || file.name).trim().slice(0, 255);
    const extension = name.toLowerCase().split(".").pop() || "";
    const mimeType = (form.get("originalMimeType")?.toString() || file.type || "").toLowerCase();
    const isPdf = extension === "pdf" && mimeType === "application/pdf";
    const audioExtensions = ["mp3", "m4a", "mp4", "wav", "webm", "ogg", "aac", "flac"];
    const isAudio = tool === "lecture" && audioExtensions.includes(extension) && AUDIO_TYPES.has(mimeType);

    if (tool === "book" && !isPdf) {
      return NextResponse.json({ error: "Book Assistant accepts PDF files only." }, { status: 415 });
    }
    if (tool === "lecture" && !isPdf && !isAudio) {
      return NextResponse.json({ error: "Lecture Assistant accepts PDF or supported audio files." }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (compression === "gzip" && (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b)) {
      return NextResponse.json({ error: "The compressed file is invalid." }, { status: 415 });
    }
    let originalBytes: Buffer;
    try { originalBytes = restoreStudyFile(bytes, compression); }
    catch { return NextResponse.json({ error: "The compressed file could not be verified." }, { status: 415 }); }
    if (originalBytes.length !== originalSize) {
      return NextResponse.json({ error: "The uploaded file size did not match its original size." }, { status: 400 });
    }
    if (isPdf && originalBytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json({ error: "The selected file is not a valid PDF." }, { status: 415 });
    }
    const mimeType = isPdf ? "application/pdf" : file.type;
    const [countRows] = await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM study_files WHERE user_id = ? AND tool_type = ?",
      [user.id, tool]
    );
    if (Number(countRows[0]?.total || 0) >= 100) {
      return NextResponse.json({ error: "You can store up to 100 files in each assistant." }, { status: 409 });
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO study_files (user_id, tool_type, original_name, mime_type, file_size, file_data, compression_method) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
      [user.id, tool, name, mimeType, originalBytes.length, bytes, compression]
    );
    return NextResponse.json({
      file: { id: result.insertId, tool_type: tool, original_name: name, mime_type: mimeType, file_size: originalBytes.length, compressed: compression === "gzip" }
    }, { status: 201 });
  } catch (error) {
    console.error("Study file upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
