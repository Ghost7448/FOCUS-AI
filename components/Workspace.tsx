import { BookOpen, BrainCircuit, ChartNoAxesCombined, ClipboardList, GraduationCap, LayoutDashboard, LogOut, Mic, Presentation, Settings, Timer, Users, FilePlus2 } from "lucide-react";
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";
import Brand from "@/components/Brand";

type Role = "student" | "teacher" | "admin";
const studentItems = [
  [BrainCircuit,"AI Personal Tutor","Coming in a later phase"],
  [Mic,"Lecture Assistant","Coming in a later phase"],
  [BookOpen,"Book Assistant","Coming in a later phase"],
  [Timer,"Smart Focus","Coming in a later phase"],
  [ClipboardList,"Smart Quizzes","Coming in a later phase"],
  [ChartNoAxesCombined,"My Progress","Coming in a later phase"]
] as const;
const teacherItems = [
  [Users,"My Classes","Class management will be implemented in Phase 2"],
  [BookOpen,"My Courses","Course management will be implemented in Phase 2"],
  [FilePlus2,"AI Lesson Planner","Lesson generation will be implemented in Phase 3"],
  [ClipboardList,"AI Exam Creator","Exam creation will be implemented in Phase 4"],
  [ChartNoAxesCombined,"Results & Reports","Reports will be implemented in Phase 4"]
] as const;

export default function Workspace({ role, name }: { role: Role; name: string }) {
  const items = role === "student" ? studentItems : role === "teacher" ? teacherItems : [
    [Users,"User Management","Admin tools will be implemented in a later phase"],
    [Settings,"Platform Settings","Admin tools will be implemented in a later phase"]
  ] as const;
  const title = role === "student" ? "Student Workspace" : role === "teacher" ? "Teacher Workspace" : "Admin Workspace";

  async function signOut() {
    "use server";
    await destroySession();
    redirect("/login");
  }

  return <main className="min-h-screen md:flex">
    <aside className="w-full border-b border-blue-100 bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <Brand/>
      <p className="mt-8 text-xs font-bold uppercase tracking-wider text-slate-400">Workspace</p>
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 font-bold text-brand-700"><LayoutDashboard size={18}/> Dashboard</div>
        {items.map(([Icon,label])=><div key={label} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600"><Icon size={18}/>{label}</div>)}
      </div>
      <form action={signOut} className="mt-8"><button className="flex items-center gap-2 text-sm font-semibold text-slate-500"><LogOut size={17}/> Sign out</button></form>
    </aside>
    <section className="min-w-0 flex-1 p-5 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-slate-500">{title}</p><h1 className="mt-1 text-3xl font-extrabold text-brand-900">Welcome, {name}</h1></div>
          <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold capitalize text-brand-700">{role}</span>
        </div>
        <div className="mt-8 rounded-2xl bg-brand-700 p-7 text-white">
          <p className="text-sm text-blue-100">FOCUS AI</p>
          <h2 className="mt-2 text-2xl font-bold">Your workspace is ready to grow.</h2>
          <p className="mt-2 max-w-2xl leading-7 text-blue-100">This is the Phase 1 foundation. Features will be activated and tested in their development phases.</p>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(([Icon,label,description])=><article key={label} className="card p-5"><span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-brand-600"><Icon size={22}/></span><h3 className="mt-4 font-bold text-brand-900">{label}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></article>)}
        </div>
      </div>
    </section>
  </main>;
}