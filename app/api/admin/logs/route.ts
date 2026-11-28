import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const search = (params.get("q") || "").trim().slice(0, 120);
  const category = params.get("category") || "all";
  const from = params.get("from");
  const to = params.get("to");
  const requestedLimit = Number(params.get("limit") || 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(20, requestedLimit)) : 100;
  const conditions: string[] = [];
  const values: string[] = [];

  if (search) {
    conditions.push("(l.action LIKE ? OR l.entity_type LIKE ? OR COALESCE(u.full_name,'') LIKE ? OR COALESCE(u.email,'') LIKE ? OR CAST(l.metadata AS CHAR) LIKE ?)");
    const pattern = `%${search}%`;
    values.push(pattern, pattern, pattern, pattern, pattern);
  }
  const categories: Record<string,string> = {
    auth: "(l.action LIKE 'login_%' OR l.action LIKE 'account_%' OR l.action LIKE 'password_%' OR l.action LIKE 'logout_%' OR l.action LIKE 'verification_%')",
    users: "(l.entity_type='user' OR l.action LIKE 'user_%')",
    platform: "(l.entity_type='platform_settings' OR l.action LIKE 'platform_%')",
    learning: "(l.action LIKE 'focus_%' OR l.action LIKE 'quiz_%' OR l.action LIKE 'tutor_%' OR l.action LIKE 'exam_%')",
    content: "(l.action LIKE 'class_%' OR l.action LIKE 'course_%' OR l.action LIKE 'lesson_%' OR l.action LIKE 'study_file_%')",
    navigation: "(l.action='page_view')"
  };
  if (categories[category]) conditions.push(categories[category]);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { conditions.push("l.created_at >= ?"); values.push(`${from} 00:00:00`); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { conditions.push("l.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(to); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT l.id,l.actor_user_id,l.action,l.entity_type,l.entity_id,l.metadata,l.ip_address,l.created_at,
              u.full_name actor_name,u.email actor_email
         FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_user_id
         ${where} ORDER BY l.created_at DESC,l.id DESC LIMIT ${limit}`,
      values
    );
    const [countRows] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) total FROM audit_logs");
    const response = NextResponse.json({ logs: rows, total: Number(countRows[0]?.total || 0) });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Admin logs load failed:", error);
    return NextResponse.json({ error: "Could not load activity logs." }, { status: 500 });
  }
}
