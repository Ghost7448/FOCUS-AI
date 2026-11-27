import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/mysql";
import { hashToken } from "@/lib/auth";
import { sendSecurityEmail } from "@/lib/email";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const parsed = z.object({ email: z.string().email().max(190).transform(v => v.toLowerCase()) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const [rows] = await db.execute("SELECT id FROM users WHERE email = ? AND email_verified = 1 AND status = 'active' LIMIT 1", [parsed.data.email]);
    const user = (rows as {id:number}[])[0];
    if (user) {
      await db.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);
      const token = randomBytes(32).toString("base64url");
      await db.execute(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))",
        [user.id, hashToken(token)]
      );
      const url = `${process.env.APP_URL || request.nextUrl.origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendSecurityEmail(parsed.data.email, "Reset your FOCUS AI password",
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Password reset</h2><p>Use the link below to choose a new password. It expires in 30 minutes.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, ignore this email.</p></div>`);
    }
    return NextResponse.json({ message: "If an eligible account exists, a password reset link has been sent." });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json({ error: "Unable to process the request right now." }, { status: 500 });
  }
}
