import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190).transform(v => v.toLowerCase()),
  password: z.string().min(10).max(72).regex(/[a-z]/, "Password must contain a lowercase letter").regex(/[A-Z]/, "Password must contain an uppercase letter").regex(/[0-9]/, "Password must contain a number"),
  role: z.enum(["student", "teacher"]),
  preferredLanguage: z.enum(["ar", "en"]).default("en"),
  educationLevel: z.string().max(80).optional(),
  grade: z.string().max(80).optional(),
  teachingSubject: z.string().max(120).optional(),
  institution: z.string().max(160).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(190).transform(v => v.toLowerCase()),
  password: z.string().min(1).max(72)
});
