import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { writeAuditLog } from "@/lib/audit";
import { ensureStudyFilesTable, restoreStudyFile } from "@/lib/study-files";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredFile = RowDataPacket & {
  original_name: string;
  mime_type: string;
  file_data: Buffer;
  compression_method: string;
};

function validId(value: string) {
  return /^\d{1,18}$/.test(value) && Number(value) > 0;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!validId(params.id)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    await ensureStudyFilesTable();
    const [rows] = await db.execute<StoredFile[]>(
      "SELECT original_name, mime_type, file_data, compression_method FROM study_files WHERE id = ? AND user_id = ? LIMIT 1",
      [params.id, user.id]
    );
    const stored = rows[0];
    if (!stored) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const bytes = restoreStudyFile(stored.file_data, stored.compression_method);
    await writeAuditLog({ actorUserId:user.id, action:"study_file_downloaded", entityType:"study_file", entityId:Number(params.id), metadata:{ fileName:stored.original_name } });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": stored.mime_type,
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(stored.original_name),
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Study file download failed:", error);
    return NextResponse.json({ error: "Could not download this file." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!validId(params.id)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    await ensureStudyFilesTable();
    const [result] = await db.execute<ResultSetHeader>(
      "DELETE FROM study_files WHERE id = ? AND user_id = ?",
      [params.id, user.id]
    );
    if (!result.affectedRows) return NextResponse.json({ error: "File not found." }, { status: 404 });
    await writeAuditLog({ actorUserId:user.id, action:"study_file_deleted", entityType:"study_file", entityId:Number(params.id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Study file delete failed:", error);
    return NextResponse.json({ error: "Could not delete this file." }, { status: 500 });
  }
}
