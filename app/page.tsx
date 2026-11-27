import Link from "next/link";
import { BookOpen, BrainCircuit, GraduationCap, Mic, Timer, ChartNoAxesCombined, ArrowRight, Presentation } from "lucide-react";
import Brand from "@/components/Brand";

const features = [
  { icon: BrainCircuit, title: "AI Personal Tutor", text: "Understand lessons with explanations adapted to your learning level." },
  { icon: Mic, title: "Lecture Assistant", text: "Turn permitted lecture recordings into searchable notes and summaries." },
  { icon: BookOpen, title: "Book Assistant", text: "Ask questions about your PDF materials and find supporting pages." },
  { icon: Timer, title: "Smart Focus", text: "Organize study sessions, breaks, and daily learning goals." },
  { icon: ChartNoAxesCombined, title: "Learning Progress", text: "Review quiz results and discover topics that need more practice." },
  { icon: Presentation, title: "Teacher Tools", text: "Prepare lessons, create exams, and manage classes in one place." }
];

export default function Home() {
  return <main>
    <header className="container flex items-center justify-between py-5">
      <Brand/>
      <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
        <a href="#features">Features</a><a href="#how">How it works</a>
      </nav>
      <div className="flex gap-2">
        <Link className="btn btn-secondary" href="/login">Log in</Link>
        <Link className="btn btn-primary" href="/register">Get started <ArrowRight size={16}/></Link>
      </div>
    </header>

    <section className="container grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
      <div>
        <span className="mb-5 inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-brand-700">A smarter way to learn and teach</span>
        <h1 className="text-4xl font-black leading-tight text-brand-900 md:text-6xl">Learn Smarter.<br/><span className="text-brand-500">Focus Better.</span><br/>Achieve More.</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Your personal AI learning companion for understanding lessons, organizing study time, and making teaching easier.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/register">Create free account <ArrowRight size={17}/></Link>
          <a className="btn btn-secondary" href="#features">Explore features</a>
        </div>
        <p className="mt-4 text-sm text-slate-500">Free to get started • Student and Teacher workspaces</p>
      </div>
      <div className="card relative overflow-hidden p-6 md:p-8">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-100"/>
        <div className="relative">
          <div className="mb-6 flex items-center justify-between"><Brand/><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">Learning space</span></div>
          <div className="rounded-2xl bg-brand-700 p-6 text-white">
            <p className="text-sm text-blue-100">Your learning journey</p>
            <h2 className="mt-2 text-2xl font-bold">Everything in one place.</h2>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {["AI Tutor","My Lessons","Study Focus","Progress"].map((x,i)=><div key={x} className="rounded-xl bg-white/10 p-4 text-sm font-semibold">{x}</div>)}
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-500">A single workspace designed to support both learners and teachers.</p>
        </div>
      </div>
    </section>

    <section id="features" className="bg-white py-16">
      <div className="container">
        <div className="mx-auto mb-10 max-w-2xl text-center"><p className="font-bold text-brand-500">WHAT YOU CAN DO</p><h2 className="mt-2 text-3xl font-extrabold text-brand-900">Tools for learning and teaching</h2><p className="mt-3 text-slate-600">Purpose-built features for students and teachers.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({icon:Icon,title,text})=><article className="card p-6" key={title}><span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-blue-100 text-brand-600"><Icon size={24}/></span><h3 className="text-lg font-bold text-brand-900">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p></article>)}
        </div>
      </div>
    </section>

    <section id="how" className="container py-16">
      <div className="card grid gap-8 p-8 md:grid-cols-2 md:items-center">
        <div><p className="font-bold text-brand-500">GET STARTED</p><h2 className="mt-2 text-3xl font-extrabold text-brand-900">One platform. Two dedicated experiences.</h2><p className="mt-4 leading-7 text-slate-600">Choose whether you are a student or a teacher. FOCUS AI will take you to a workspace designed for your role.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-blue-50 p-5"><GraduationCap className="text-brand-600"/><h3 className="mt-3 font-bold">Student</h3><p className="mt-1 text-sm text-slate-600">Learn, practice, and track progress.</p></div>
          <div className="rounded-xl bg-blue-50 p-5"><Presentation className="text-brand-600"/><h3 className="mt-3 font-bold">Teacher</h3><p className="mt-1 text-sm text-slate-600">Plan lessons, create exams, and manage classes.</p></div>
        </div>
      </div>
    </section>
    <footer className="border-t border-blue-100 bg-white py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} FOCUS AI. One Platform. A Smarter Way to Learn.</footer>
  </main>;
}