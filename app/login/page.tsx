import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
export default function LoginPage(){return <main className="container flex min-h-screen items-center justify-center py-10"><Suspense fallback={<div className="card p-8">Loading...</div>}><LoginForm/></Suspense></main>;}
