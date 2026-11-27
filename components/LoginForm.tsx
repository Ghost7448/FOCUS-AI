"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, ArrowLeft } from "lucide-react";
import Brand from "@/components/Brand";
import { useLanguage } from "@/components/LanguageProvider";

export default function LoginForm() {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const params = useSearchParams();

  async function submit(data: FormData) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(data.get("email") || ""), password: String(data.get("password") || "") })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to log in.");
      const destination = params.get("next");
      const safeNext = destination && destination.startsWith("/") && !destination.startsWith("//") ? destination : result.destination;
      router.replace(safeNext || "/student");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to log in.");
    } finally { setBusy(false); }
  }

  async function resendVerification() {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setResending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not resend verification email.");
      setNotice(result.message || "If your account needs verification, a new email has been sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend verification email.");
    } finally { setResending(false); }
  }

  return <section className="card w-full max-w-md p-6 sm:p-9" dir={language === "ar" ? "rtl" : "ltr"}>
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600"><ArrowLeft size={16}/> {t("Back to home")}</Link>
    <Brand/><h1 className="mt-7 text-3xl font-extrabold text-brand-900">{t("Welcome back")}</h1>
    <p className="mt-2 text-slate-600">{t("Log in to your FOCUS AI workspace.")}</p>
    {params.get("verified") === "success" && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{t("Email verified successfully. You can log in now.")}</p>}
    {params.get("verified") === "invalid" && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t("This verification link is invalid or expired. Contact support to request a new link.")}</p>}
    <form action={submit} className="mt-7 space-y-4">
      <label className="block text-sm font-semibold">{t("Email")}<input className="field mt-2" name="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="block text-sm font-semibold">{t("Password")}<input className="field mt-2" name="password" type="password" required autoComplete="current-password"/></label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
      {error.toLowerCase().includes("verify your email") && <button type="button" onClick={resendVerification} disabled={resending} className="w-full text-sm font-semibold text-brand-600 underline disabled:opacity-50">{resending ? t("Sending...") : t("Resend verification email")}</button>}
      <button disabled={busy} className="btn btn-primary w-full">{busy ? <><LoaderCircle className="animate-spin" size={18}/> {t("Signing in...")}</> : t("Log in")}</button>
    </form>
    <p className="mt-4 text-center text-sm"><Link className="font-semibold text-brand-600" href="/forgot-password">{t("Forgot password?")}</Link></p>
    <p className="mt-5 text-center text-sm text-slate-600">{t("New to FOCUS AI?")} <Link className="font-bold text-brand-600" href="/register">{t("Create account")}</Link></p>
  </section>;
}
