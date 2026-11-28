import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { ensureVisitorTable } from "@/lib/visitors";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    await ensureVisitorTable();
    const [visitors] = await db.execute<RowDataPacket[]>(
      `SELECT v.id,v.ip_address,v.user_agent,v.browser,v.operating_system,v.device_type,v.device_info,
              v.screen_resolution,v.language,v.timezone,v.referrer,v.cookies_enabled,v.platform,
              v.hardware_concurrency,v.device_memory,v.touch_points,v.last_path,v.page_views,
              v.first_seen,v.last_seen,u.full_name account_name,u.email account_email
         FROM visitor_sessions v LEFT JOIN users u ON u.id=v.user_id
        ORDER BY v.last_seen DESC LIMIT 50`
    );
    const [stats] = await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) total_sessions,COUNT(DISTINCT ip_address) unique_ips,SUM(last_seen>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)) active_now,SUM(user_id IS NULL) guests FROM visitor_sessions"
    );
    const response = NextResponse.json({ visitors, stats: stats[0] || {} });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Admin visitors load failed:", error);
    return NextResponse.json({ error: "Could not load visitor records." }, { status: 500 });
  }
}
