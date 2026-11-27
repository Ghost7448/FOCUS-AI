import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/mysql";
import { loginSchema } from "@/lib/auth-validation";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const { email, password } = parsed.data;
    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 64);

    const [attemptRows] = await db.execute(
      "SELECT COUNT(*) AS total FROM auth_attempts WHERE email = ? AND ip_address = ? AND attempted_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)",
      [email, ip]
    );
    if (Number((attemptRows as {total:number}[])[0]?.total || 0) >= 8) {
      return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }

    const [rows] = await db.execute(
      "SELECT id, password_hash, role, email_verified, status FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    const user = (rows as {id:number;password_hash:string;role:string;email_verified:number;status:string}[])[0];
    const valid = user ? await bcrypt.compare(password, user.password_hash) : await bcrypt.compare(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEe.9bZ6YV5d6p5g8b4q7eJ8r2L5b5F0z2K");
    await db.execute("INSERT INTO auth_attempts (email, ip_address) VALUES (?, ?)", [email, ip]);
    if (!user || !valid || user.status !== "active") {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    if (!user.email_verified) return NextResponse.json({ error: "Please verify your email before logging in." }, { status: 403 });

    await db.execute("DELETE FROM auth_attempts WHERE email = ? AND ip_address = ?", [email, ip]);
    await createSession(user.id);
    const destination = user.role === "admin" ? "/admin" : user.role === "teacher" ? "/teacher" : "/student";
    return NextResponse.json({ message: "Signed in.", destination });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Unable to log in right now." }, { status: 500 });
  }
}
