import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/mysql";
import { hashToken } from "@/lib/auth";
import { sendSecurityEmail } from "@/lib/email";
import { hasSameOrigin } from "@/lib/security";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    const parsed = z.object({ email: z.string().email().max(190).transform(v => v.toLowerCase()) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const email = parsed.data.email;
    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0,64);
    const [rateRows] = await db.execute("SELECT COUNT(*) AS total FROM auth_attempts WHERE email = ? AND ip_address = ? AND attempted_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)", [email,ip]);
    if (Number((rateRows as {total:number}[])[0]?.total || 0) >= 3) {
      return NextResponse.json({ message: "If an eligible account exists, a password reset link has been sent." });
    }
    await db.execute("INSERT INTO auth_attempts(email,ip_address) VALUES(?,?)", [email,ip]);
    const [rows] = await db.execute("SELECT id FROM users WHERE email = ? AND email_verified = 1 AND status = 'active' LIMIT 1", [email]);
    const user = (rows as {id:number}[])[0];
    if (user) {
      await writeAuditLog({ actorUserId:user.id, action:"password_reset_requested", entityType:"user", entityId:user.id, ipAddress:ip });
      await db.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);
      const token = randomBytes(32).toString("base64url");
      await db.execute("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))", [user.id,hashToken(token)]);
      const url = `${process.env.APP_URL || request.nextUrl.origin}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendSecurityEmail(email,"Reset your FOCUS AI password",
          `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Password reset</h2><p>Use the link below to choose a new password. It expires in 30 minutes.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, ignore this email.</p></div>`);
      } catch (mailError) {
        console.error("Password reset email could not be sent:", mailError);
      }
    }
    return NextResponse.json({ message: "If an eligible account exists, a password reset link has been sent." });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json({ error: "Unable to process the request right now." }, { status: 500 });
  }
}
