import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/mysql";
import { hashToken } from "@/lib/auth";
import { sendSecurityEmail } from "@/lib/email";
import { hasSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    const parsed = z.object({ email: z.string().email().max(190).transform(v => v.toLowerCase()) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const email = parsed.data.email;
    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 64);
    const [attemptRows] = await db.execute(
      "SELECT COUNT(*) AS total FROM auth_attempts WHERE email = ? AND ip_address = ? AND attempted_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)",
      [email, ip]
    );
    if (Number((attemptRows as { total: number }[])[0]?.total || 0) >= 5) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await db.execute("INSERT INTO auth_attempts(email,ip_address) VALUES(?,?)", [email, ip]);

    const [rows] = await db.execute(
      "SELECT id FROM users WHERE email = ? AND email_verified = 0 AND status = 'active' LIMIT 1",
      [email]
    );
    const user = (rows as { id: number }[])[0];
    if (user) {
      await db.execute("DELETE FROM email_verification_tokens WHERE user_id = ?", [user.id]);
      const token = randomBytes(32).toString("base64url");
      await db.execute(
        "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))",
        [user.id, hashToken(token)]
      );
      const url = `${process.env.APP_URL || request.nextUrl.origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      await sendSecurityEmail(email, "Verify your FOCUS AI account",
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Welcome to FOCUS AI</h2><p>Confirm your email address to activate your account.</p><p><a href="${url}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p></div>`);
    }
    return NextResponse.json({ message: "If your account needs verification, a new verification email has been sent." });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Unable to send the verification email right now. Check the server log and Resend configuration." }, { status: 503 });
  }
}
