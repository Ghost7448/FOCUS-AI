"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, BrainCircuit, ChartNoAxesCombined, ClipboardList, GraduationCap,
  LayoutDashboard, LogOut, Mic, Settings, Timer, Users, FilePlus2, ArrowUpRight,
  LockKeyhole, Sparkles
} from "lucide-react";
import Brand from "@/components/Brand";

type Role = "student" | "teacher" | "admin";
type Item = { icon: typeof BrainCircuit; label: string; description: string; status: "available" | "planned" };

const studentItems: Item[] = [
  {icon:BrainCircuit,label:"AI Personal Tutor",description:"An AI learning assistant for explanations, examples, and guided practice.",status:"planned"},
  {icon:Mic,label:"Lecture Assistant",description:"Record or upload permitted lectures, transcribe them, and create revision notes.",status:"planned"},
  {icon:BookOpen,label:"Book Assistant",description:"Upload PDF references and ask questions with page-based citations.",status:"planned"},
  {icon:Timer,label:"Smart Focus",description:"A study timer with breaks, session history, and daily goals.",status:"planned"},
  {icon:ClipboardList,label:"Smart Quizzes",description:"Generate practice quizzes and review your answers.",status:"planned"},
  {icon:ChartNoAxesCombined,label:"My Progress",description:"Review study activity and learning progress over time.",status:"planned"}
];
const teacherItems: Item[] = [
  {icon:Users,label:"My Classes",description:"Create classes, manage student membership, and share a join code.",status:"planned"},
  {icon:BookOpen,label:"My Courses",description:"Organize teaching materials and lessons.",status:"planned"},
  {icon:FilePlus2,label:"AI Lesson Planner",description:"Draft lesson plans with learning goals and activities.",status:"planned"},
  {icon:ClipboardList,label:"AI Exam Creator",description:"Prepare, review, and publish assessments.",status:"planned"},
  {icon:ChartNoAxesCombined,label:"Results & Reports",description:"Review submissions and class-level results.",status:"planned"}
];
const adminItems: Item[] = [
  {icon:Users,label:"User Management",description:"Review user accounts and account status.",status:"planned"},
  {icon:Settings,label:"Platform Settings",description:"Manage platform configuration and usage limits.",status:"planned"}
];

export default function Workspace({ role, name }: { role: Role; name: string }) {
  const router = useRouter();
  const items = role === "student" ? studentItems : role === "teacher" ? teacherItems : adminItems;
  const title = role === "student" ? "Student Workspace" : role === "teacher" ? "Teacher Workspace" : "Admin Workspace";
  const [active, setActive] = useState<Item | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return <main className="workspace-shell min-h-screen md:flex">
    <aside className="workspace-sidebar w-full p-5 md:min-h-screen md:w-72">
      <Brand />
      <p className="mt-8 px-3 text-xs font-bold uppercase tracking-wider muted">Workspace</p>
      <nav aria-label="Workspace navigation" className="mt-3 space-y-1">
        <button type="button" onClick={() => setActive(null)} className={`workspace-nav-item ${!active ? "is-active" : ""}`}>
          <LayoutDashboard size={18}/> Dashboard
        </button>
        {items.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.label} onClick={() => setActive(item)} className={`workspace-nav-item ${active?.label === item.label ? "is-active" : ""}`}>
            <Icon size={18}/><span>{item.label}</span><ArrowUpRight className="ml-auto opacity-50" size={15}/>
          </button>;
        })}
      </nav>
      <button type="button" disabled={signingOut} onClick={signOut} className="workspace-signout mt-8">
        <LogOut size={17}/>{signingOut ? "Signing out..." : "Sign out"}
      </button>
    </aside>

    <section className="min-w-0 flex-1 p-5 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm muted">{title}</p><h1 className="mt-1 text-3xl font-extrabold text-brand-900">Welcome, {name}</h1></div>
          <span className="role-pill capitalize">{role}</span>
        </div>

        {!active ? <>
          <div className="workspace-hero mt-8 rounded-3xl p-7 text-white md:p-9">
            <div className="mb-3 flex items-center gap-2 text-sm text-amber-100"><Sparkles size={16}/> FOCUS AI</div>
            <h2 className="text-2xl font-bold md:text-3xl">Your learning workspace.</h2>
            <p className="mt-2 max-w-2xl leading-7 text-white/80">Choose a tool below to open its workspace and see its current availability.</p>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const Icon = item.icon;
              return <button type="button" key={item.label} onClick={() => setActive(item)} className="workspace-feature-card card p-5 text-left">
                <span className="workspace-icon inline-grid h-12 w-12 place-items-center rounded-2xl"><Icon size={23}/></span>
                <span className="mt-4 flex items-center justify-between gap-2 font-bold text-brand-900"><span>{item.label}</span><ArrowUpRight size={17}/></span>
                <span className="mt-2 block text-sm leading-6 muted">{item.description}</span>
                <span className="workspace-status mt-4 inline-flex items-center gap-2"><LockKeyhole size={13}/> In development</span>
              </button>;
            })}
          </div>
        </> : <div className="card mt-8 p-6 md:p-8">
          <button type="button" onClick={() => setActive(null)} className="workspace-back mb-6">← Back to dashboard</button>
          <div className="flex items-start gap-4">
            <span className="workspace-icon inline-grid h-14 w-14 shrink-0 place-items-center rounded-2xl"><active.icon size={27}/></span>
            <div><p className="text-sm muted">{title}</p><h2 className="text-2xl font-extrabold text-brand-900">{active.label}</h2></div>
          </div>
          <p className="mt-5 max-w-2xl leading-7 muted">{active.description}</p>
          <div className="workspace-coming mt-7 rounded-2xl p-5">
            <div className="flex items-center gap-2 font-bold text-brand-900"><LockKeyhole size={17}/> This tool is not active yet</div>
            <p className="mt-2 text-sm leading-6 muted">The current repository contains the workspace interface, but this feature's backend and user actions have not been implemented. It will not display fake AI results or pretend to save data.</p>
          </div>
        </div>}
      </div>
    </section>
  </main>;
}
