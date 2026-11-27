"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, ArrowLeft } from "lucide-react";
import Brand from "@/components/Brand";

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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

  return <section className="card w-full max-w-md p-6 sm:p-9">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600"><ArrowLeft size={16}/> Back to home</Link>
    <Brand/><h1 className="mt-7 text-3xl font-extrabold text-brand-900">Welcome back</h1>
    <p className="mt-2 text-slate-600">Log in to your FOCUS AI workspace.</p>
    <form action={submit} className="mt-7 space-y-4">
      <label className="block text-sm font-semibold">Email<input className="field mt-2" name="email" type="email" required autoComplete="email"/></label>
      <label className="block text-sm font-semibold">Password<input className="field mt-2" name="password" type="password" required autoComplete="current-password"/></label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="btn btn-primary w-full">{busy ? <><LoaderCircle className="animate-spin" size={18}/> Signing in...</> : "Log in"}</button>
    </form>
    <p className="mt-4 text-center text-sm"><Link className="font-semibold text-brand-600" href="/forgot-password">Forgot password?</Link></p>
    <p className="mt-5 text-center text-sm text-slate-600">New to FOCUS AI? <Link className="font-bold text-brand-600" href="/register">Create account</Link></p>
  </section>;
}
