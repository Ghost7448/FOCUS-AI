import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { writeAuditLog } from "@/lib/audit";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActiveSession = RowDataPacket & {
  id: number;
  planned_minutes: number;
  started_at: string;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    const [rows] = await db.execute<ActiveSession[]>(
      "SELECT id, planned_minutes, DATE_FORMAT(started_at, '%Y-%m-%dT%H:%i:%sZ') AS started_at " +
      "FROM focus_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
      [user.id]
    );
    return NextResponse.json({ activeSession: rows[0] || null });
  } catch (error) {
    console.error("Focus session lookup failed:", error);
    return NextResponse.json({ error: "Could not load your focus session." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid focus session request." }, { status: 400 });
  }

  try {
    if (body.action === "start") {
      const planned = Number(body.plannedMinutes);
      if (!Number.isInteger(planned) || planned < 1 || planned > 180) {
        return NextResponse.json({ error: "Choose between 1 and 180 minutes." }, { status: 400 });
      }
      const [existing] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM focus_sessions WHERE user_id = ? AND ended_at IS NULL LIMIT 1",
        [user.id]
      );
      if (existing.length) return NextResponse.json({ error: "You already have an active focus session." }, { status: 409 });

      const [result] = await db.execute<ResultSetHeader>(
        "INSERT INTO focus_sessions (user_id, planned_minutes, completed_minutes, status, started_at) " +
        "VALUES (?, ?, 0, 'interrupted', UTC_TIMESTAMP())",
        [user.id, planned]
      );
      const [created] = await db.execute<ActiveSession[]>(
        "SELECT id, planned_minutes, DATE_FORMAT(started_at, '%Y-%m-%dT%H:%i:%sZ') AS started_at " +
        "FROM focus_sessions WHERE id = ? AND user_id = ? LIMIT 1",
        [result.insertId, user.id]
      );
      await writeAuditLog({ actorUserId:user.id, action:"focus_session_started", entityType:"focus_session", entityId:result.insertId, metadata:{ plannedMinutes:planned } });
      return NextResponse.json({ activeSession: created[0] }, { status: 201 });
    }

    if (body.action === "finish") {
      const sessionId = Number(body.sessionId);
      const completed = Number(body.completedMinutes);
      const status = body.status === "completed" ? "completed" : "cancelled";
      if (!Number.isSafeInteger(sessionId) || sessionId < 1 || !Number.isInteger(completed) || completed < 0 || completed > 180) {
        return NextResponse.json({ error: "Invalid focus session details." }, { status: 400 });
      }
      const [result] = await db.execute<ResultSetHeader>(
        "UPDATE focus_sessions SET completed_minutes = ?, status = ?, ended_at = UTC_TIMESTAMP() " +
        "WHERE id = ? AND user_id = ? AND ended_at IS NULL",
        [completed, status, sessionId, user.id]
      );
      if (!result.affectedRows) return NextResponse.json({ error: "Focus session not found." }, { status: 404 });
      await writeAuditLog({ actorUserId:user.id, action:status==="completed"?"focus_session_completed":"focus_session_cancelled", entityType:"focus_session", entityId:sessionId, metadata:{ completedMinutes:completed } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown focus session action." }, { status: 400 });
  } catch (error) {
    console.error("Focus session update failed:", error);
    return NextResponse.json({ error: "Could not save your focus session." }, { status: 500 });
  }
}
