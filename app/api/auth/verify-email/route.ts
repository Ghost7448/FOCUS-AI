import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/mysql";
import { hashToken } from "@/lib/auth";
import { getAppOrigin } from "@/lib/app-url";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (token.length < 30 || token.length > 200) return NextResponse.redirect(new URL("/account-activated?status=invalid", getAppOrigin(request.nextUrl.origin)));
  const [rows] = await db.execute(
    "SELECT user_id FROM email_verification_tokens WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1",
    [hashToken(token)]
  );
  const record = (rows as {user_id:number}[])[0];
  if (!record) return NextResponse.redirect(new URL("/account-activated?status=invalid", getAppOrigin(request.nextUrl.origin)));
  await db.execute("UPDATE users SET email_verified = 1, updated_at = UTC_TIMESTAMP() WHERE id = ?", [record.user_id]);
  await writeAuditLog({ actorUserId:record.user_id, action:"account_activated", entityType:"user", entityId:record.user_id });
  await db.execute("DELETE FROM email_verification_tokens WHERE user_id = ?", [record.user_id]);
  return NextResponse.redirect(new URL("/account-activated", getAppOrigin(request.nextUrl.origin)));
}
