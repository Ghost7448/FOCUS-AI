import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/mysql";

export type UserRole = "student" | "teacher" | "admin";
export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  preferred_language: "ar" | "en";
  education_level: string | null;
  grade: string | null;
  teaching_subject: string | null;
  institution: string | null;
  email_verified: boolean;
};

export const SESSION_COOKIE = "focus_session";
const SESSION_DAYS = 30;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  await db.execute(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))",
    [userId, tokenHash, SESSION_DAYS]
  );
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [rows] = await db.execute(
    `SELECT u.id, u.email, u.full_name, u.role, u.preferred_language,
            u.education_level, u.grade, u.teaching_subject, u.institution,
            u.email_verified
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()
        AND u.status = 'active'
      LIMIT 1`,
    [sha256(token)]
  );
  const result = rows as AuthUser[];
  return result[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(user.role === "admin" ? "/admin" : user.role === "teacher" ? "/teacher" : "/student");
  return user;
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await db.execute("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export function hashToken(token: string) {
  return sha256(token);
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}
