import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/mysql";
import { registerSchema } from "@/lib/auth-validation";
import { hashToken } from "@/lib/auth";
import { sendSecurityEmail } from "@/lib/email";
import { hasSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid registration details." }, { status: 400 });
    const input = parsed.data;
    if (input.role === "teacher" && !input.teachingSubject?.trim()) return NextResponse.json({ error: "Please enter your teaching subject." }, { status: 400 });
    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0,64);
    const [rateRows] = await db.execute("SELECT COUNT(*) AS total FROM auth_attempts WHERE ip_address = ? AND attempted_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)", [ip]);
    if (Number((rateRows as {total:number}[])[0]?.total || 0) >= 20) return NextResponse.json({ error: "Too many account requests. Please try again later." }, { status: 429 });
    const [existing] = await db.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [input.email]);
    if ((existing as unknown[]).length) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    const passwordHash = await bcrypt.hash(input.password,12);
    const verificationRequired = process.env.NODE_ENV === "production" || process.env.EMAIL_VERIFICATION_REQUIRED !== "false";
    const [result] = await db.execute(
      `INSERT INTO users(email,password_hash,full_name,role,preferred_language,education_level,grade,teaching_subject,institution,email_verified)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [input.email,passwordHash,input.fullName,input.role,input.preferredLanguage,input.educationLevel||null,input.grade||null,input.teachingSubject||null,input.institution||null,verificationRequired?0:1]
    );
    const userId = Number((result as {insertId:number}).insertId);
    await db.execute("INSERT INTO auth_attempts(email,ip_address) VALUES(?,?)", [input.email,ip]);
    if (verificationRequired) {
      const token = randomBytes(32).toString("base64url");
      await db.execute("INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))", [userId,hashToken(token)]);
      const url = `${process.env.APP_URL || request.nextUrl.origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      try {
        await sendSecurityEmail(input.email,"Verify your FOCUS AI account",
          `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Welcome to FOCUS AI</h2><p>Confirm your email address to activate your account.</p><p><a href="${url}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p></div>`);
      } catch (mailError) {
        console.error("Verification email could not be sent:",mailError);
        return NextResponse.json({ error: "Your account was created, but the verification email could not be sent. Check the email delivery configuration and request a new verification email from the login page." }, { status: 503 });
      }
      return NextResponse.json({ message: "Account created. Check your email to verify your address before logging in." }, { status: 201 });
    }
    return NextResponse.json({ message: "Account created. You can now log in." }, { status: 201 });
  } catch (error) {
    console.error("Registration error:",error);
    return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
  }
}
