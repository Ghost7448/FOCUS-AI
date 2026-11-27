import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SummaryRow = RowDataPacket & {
  total_minutes: number;
  completed_sessions: number;
};
type QuizSummaryRow = RowDataPacket & {
  attempts: number;
  average_score: number | null;
};
type DayRow = RowDataPacket & {
  study_day: string;
  minutes: number;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    const [[focusRows], [quizRows], [dayRows]] = await Promise.all([
      db.execute<SummaryRow[]>(
        "SELECT COALESCE(SUM(completed_minutes), 0) AS total_minutes, COUNT(*) AS completed_sessions " +
        "FROM focus_sessions WHERE user_id = ? AND status = 'completed'",
        [user.id]
      ),
      db.execute<QuizSummaryRow[]>(
        "SELECT COUNT(*) AS attempts, AVG(score) AS average_score FROM quiz_attempts " +
        "WHERE user_id = ? AND completed_at IS NOT NULL",
        [user.id]
      ),
      db.execute<DayRow[]>(
        "SELECT DATE_FORMAT(started_at, '%Y-%m-%d') AS study_day, SUM(completed_minutes) AS minutes " +
        "FROM focus_sessions WHERE user_id = ? AND status = 'completed' " +
        "AND started_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 DAY) " +
        "GROUP BY DATE(started_at) ORDER BY DATE(started_at)",
        [user.id]
      )
    ]);
    const focus = focusRows[0];
    const quizzes = quizRows[0];
    return NextResponse.json({
      totalFocusMinutes: Number(focus?.total_minutes || 0),
      completedFocusSessions: Number(focus?.completed_sessions || 0),
      quizAttempts: Number(quizzes?.attempts || 0),
      averageQuizScore: quizzes?.average_score == null ? null : Number(quizzes.average_score),
      lastSevenDays: dayRows.map((day) => ({ date: day.study_day, minutes: Number(day.minutes || 0) }))
    });
  } catch (error) {
    console.error("Progress lookup failed:", error);
    return NextResponse.json({ error: "Could not load your progress." }, { status: 500 });
  }
}
