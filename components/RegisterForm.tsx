"use client";
import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Presentation, ArrowLeft, LoaderCircle } from "lucide-react";
import Brand from "@/components/Brand";

type Role = "student" | "teacher";

export default function RegisterForm() {
  const [role, setRole] = useState<Role>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setBusy(true); setError(""); setMessage("");
    const payload = {
      fullName: String(formData.get("fullName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      role,
      preferredLanguage: String(formData.get("language") || "en"),
      educationLevel: String(formData.get("educationLevel") || formData.get("teacherLevel") || ""),
      grade: String(formData.get("grade") || ""),
      teachingSubject: String(formData.get("teachingSubject") || ""),
      institution: String(formData.get("institution") || "")
    };
    if (payload.password !== String(formData.get("confirmPassword") || "")) {
      setError("Passwords do not match."); setBusy(false); return;
    }
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create your account.");
      setMessage(result.message || "Account created. Check your email to verify your address.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your account.");
    } finally { setBusy(false); }
  }

  return <section className="card w-full max-w-xl p-6 sm:p-9">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600"><ArrowLeft size={16}/> Back to home</Link>
    <Brand/>
    <h1 className="mt-7 text-3xl font-extrabold text-brand-900">Create your account</h1>
    <p className="mt-2 text-slate-600">Choose how you want to use FOCUS AI.</p>
    <div className="mt-6 grid grid-cols-2 gap-3">
      <button type="button" onClick={() => setRole("student")} className={`rounded-xl border p-4 text-left ${role === "student" ? "border-brand-500 bg-blue-50" : "border-slate-200"}`}><GraduationCap className="text-brand-600"/><b className="mt-2 block">Student</b><small className="text-slate-500">Learn and practice</small></button>
      <button type="button" onClick={() => setRole("teacher")} className={`rounded-xl border p-4 text-left ${role === "teacher" ? "border-brand-500 bg-blue-50" : "border-slate-200"}`}><Presentation className="text-brand-600"/><b className="mt-2 block">Teacher</b><small className="text-slate-500">Teach and manage classes</small></button>
    </div>
    <form action={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">Full name<input className="field mt-2" name="fullName" required autoComplete="name"/></label>
      <label className="block text-sm font-semibold">Email<input className="field mt-2" name="email" type="email" required autoComplete="email"/></label>
      {role === "student" ? <>
        <label className="block text-sm font-semibold">Education level<select className="field mt-2" name="educationLevel"><option value="school">School</option><option value="university">University</option></select></label>
        <label className="block text-sm font-semibold">Grade / Academic year<input className="field mt-2" name="grade" placeholder="e.g. Grade 11 or Year 1"/></label>
        <label className="block text-sm font-semibold">Preferred language<select className="field mt-2" name="language"><option value="ar">Arabic</option><option value="en">English</option></select></label>
      </> : <>
        <label className="block text-sm font-semibold">Teaching subject / specialization<input className="field mt-2" name="teachingSubject" required placeholder="e.g. Mathematics"/></label>
        <label className="block text-sm font-semibold">Education level<select className="field mt-2" name="teacherLevel"><option value="school">School</option><option value="university">University</option><option value="both">Both</option></select></label>
        <label className="block text-sm font-semibold">School / Institution (optional)<input className="field mt-2" name="institution"/></label>
      </>}
      <label className="block text-sm font-semibold">Password (10+ characters, upper/lowercase and number)<input className="field mt-2" name="password" type="password" minLength={10} required autoComplete="new-password"/></label>
      <label className="block text-sm font-semibold">Confirm password<input className="field mt-2" name="confirmPassword" type="password" minLength={10} required autoComplete="new-password"/></label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" size={18}/> Creating...</> : "Create free account"}</button>
    </form>
    <p className="mt-5 text-center text-sm text-slate-600">Already have an account? <Link className="font-bold text-brand-600" href="/login">Log in</Link></p>
    <p className="mt-4 text-xs leading-5 text-slate-500">Admin accounts are created separately by the platform owner and cannot be selected here.</p>
  </section>;
}
