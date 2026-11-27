import {Suspense} from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";
export default function ResetPasswordPage(){return <main className="container flex min-h-screen items-center justify-center py-10"><Suspense fallback={<div className="card p-8">Loading...</div>}><ResetPasswordForm/></Suspense></main>;}
