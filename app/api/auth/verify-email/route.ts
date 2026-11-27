import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/mysql";
import { hashToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (token.length < 30 || token.length > 200) return NextResponse.redirect(new URL("/login?verified=invalid", request.url));
  const [rows] = await db.execute(
    "SELECT user_id FROM email_verification_tokens WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1",
    [hashToken(token)]
  );
  const record = (rows as {user_id:number}[])[0];
  if (!record) return NextResponse.redirect(new URL("/login?verified=invalid", request.url));
  await db.execute("UPDATE users SET email_verified = 1, updated_at = UTC_TIMESTAMP() WHERE id = ?", [record.user_id]);
  await db.execute("DELETE FROM email_verification_tokens WHERE user_id = ?", [record.user_id]);
  return NextResponse.redirect(new URL("/login?verified=success", request.url));
}
