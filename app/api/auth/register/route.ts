import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/mysql";
import { registerSchema } from "@/lib/auth-validation";
import { hashToken } from "@/lib/auth";
import { sendSecurityEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid registration details." }, { status: 400 });
    const input = parsed.data;

    if (input.role === "teacher" && !input.teachingSubject?.trim()) {
      return NextResponse.json({ error: "Please enter your teaching subject." }, { status: 400 });
    }

    const [existing] = await db.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [input.email]);
    if ((existing as unknown[]).length) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const verificationRequired = process.env.EMAIL_VERIFICATION_REQUIRED !== "false";
    const [result] = await db.execute(
      `INSERT INTO users
       (email, password_hash, full_name, role, preferred_language, education_level, grade, teaching_subject, institution, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.email, passwordHash, input.fullName, input.role, input.preferredLanguage,
       input.educationLevel || null, input.grade || null, input.teachingSubject || null,
       input.institution || null, verificationRequired ? 0 : 1]
    );
    const userId = Number((result as { insertId: number }).insertId);

    if (verificationRequired) {
      const token = randomBytes(32).toString("base64url");
      await db.execute(
        "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))",
        [userId, hashToken(token)]
      );
      const baseUrl = process.env.APP_URL || request.nextUrl.origin;
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      try {
        await sendSecurityEmail(input.email, "Verify your FOCUS AI account",
          `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Welcome to FOCUS AI</h2><p>Confirm your email address to activate your account.</p><p><a href="${verifyUrl}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p></div>`);
      } catch {
        return NextResponse.json({ error: "Your account was created, but the verification email could not be sent. Please configure SMTP or contact the administrator." }, { status: 503 });
      }
      return NextResponse.json({ message: "Account created. Check your email to verify your address before logging in." }, { status: 201 });
    }

    return NextResponse.json({ message: "Account created. You can now log in." }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
  }
}
