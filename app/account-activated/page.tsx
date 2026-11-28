import Link from "next/link";
import { CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";

export default function AccountActivatedPage({
  searchParams
}: {
  searchParams: { status?: string };
}) {
  const invalid = searchParams.status === "invalid";

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <section className="card w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 shadow-lg">
          {invalid ? (
            <ShieldCheck className="h-12 w-12 text-amber-700" strokeWidth={1.8} />
          ) : (
            <CheckCircle2 className="h-14 w-14 text-emerald-600" strokeWidth={1.8} />
          )}
        </div>

        {invalid ? (
          <>
            <p className="mb-2 text-sm font-bold uppercase tracking-[.18em] text-amber-800">FOCUS AI</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-900">Verification link expired</h1>
            <p className="mx-auto mt-4 max-w-sm leading-7 muted">
              This verification link is invalid or has expired. You can request a new verification email from the login page.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-bold uppercase tracking-[.18em] text-emerald-700">FOCUS AI</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-900">Your Account Has Been Activated</h1>
            <p className="mx-auto mt-4 max-w-sm leading-7 muted">
              Your email has been verified successfully. Your FOCUS AI account is ready to use.
            </p>
          </>
        )}

        <Link href="/login" className="btn btn-primary mt-8 w-full">
          {invalid ? "Back to Login" : "Continue to Login"}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-6 text-xs muted">A smarter, calmer way to learn.</p>
      </section>
    </main>
  );
}
