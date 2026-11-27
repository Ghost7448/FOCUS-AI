"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Plus, Sparkles, Users, ClipboardList, ChartNoAxesCombined, LoaderCircle, Copy, WandSparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type ClassItem = { id: number; name: string; description: string | null; subject_name: string | null; student_count: number };
type Subject = { id: number; name: string; description: string | null };
type Lesson = { id: number; class_id: number; title: string; status: string; class_name: string };
type Exam = { id: number; class_id: number; title: string; question_count: number; submissions: number; class_name: string };
type Report = { exam_id: number; exam_title: string; class_name: string; submissions: number; average_score: number | null; highest_score: number | null; lowest_score: number | null };

export default function TeacherTools({ tool }: { tool: string }) {
  const { t, language } = useLanguage();
  const [classes,setClasses] = useState<ClassItem[]>([]);
  const [subjects,setSubjects] = useState<Subject[]>([]);
  const [lessons,setLessons] = useState<Lesson[]>([]);
  const [exams,setExams] = useState<Exam[]>([]);
  const [reports,setReports] = useState<Report[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [joinCode,setJoinCode] = useState("");
  const [className,setClassName] = useState("");
  const [classDescription,setClassDescription] = useState("");
  const [subjectId,setSubjectId] = useState("");
  const [courseName,setCourseName] = useState("");
  const [courseDescription,setCourseDescription] = useState("");
  const [selectedClass,setSelectedClass] = useState("");
  const [topic,setTopic] = useState("");
  const [level,setLevel] = useState("");
  const [duration,setDuration] = useState("45");
  const [plan,setPlan] = useState("");
  const [lessonTitle,setLessonTitle] = useState("");
  const [examTitle,setExamTitle] = useState("");
  const [questionCount,setQuestionCount] = useState("10");
  const [difficulty,setDifficulty] = useState("medium");
  const [generatedQuestions,setGeneratedQuestions] = useState<{question:string;options:string[];explanation?:string}[]>([]);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/teacher",{cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load teacher tools.");
      setClasses(data.classes || []); setSubjects(data.subjects || []);
      setLessons(data.lessons || []); setExams(data.exams || []); setReports(data.reports || []);
      if (!selectedClass && data.classes?.length) setSelectedClass(String(data.classes[0].id));
    } catch(e) { setError(e instanceof Error ? e.message : "Could not load teacher tools."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function send(payload: Record<string,unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/teacher",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed.");
      if (data.joinCode) setJoinCode(data.joinCode);
      setNotice(data.message || "Done.");
      await load();
      return data;
    } catch(e) { setError(e instanceof Error ? e.message : "Action failed."); return null; }
    finally { setBusy(false); }
  }

  async function createClass(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result=await send({action:"create_class",name:className,description:classDescription,subjectId:subjectId ? Number(subjectId) : undefined});
    if(result){setClassName("");setClassDescription("");}
  }
  async function createCourse(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result=await send({action:"create_course",name:courseName,description:courseDescription});
    if(result){setCourseName("");setCourseDescription("");}
  }
  async function generatePlan(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!selectedClass) return setError("Create a class first.");
    const result=await send({action:"plan_lesson",classId:Number(selectedClass),topic,level,duration:Number(duration),language});
    if(result?.plan){setPlan(result.plan);setLessonTitle(topic);}
  }
  async function savePlan() {
    if(!selectedClass || !plan) return;
    await send({action:"create_lesson",classId:Number(selectedClass),title:lessonTitle || topic,content:plan,publish:false});
    setPlan("");
  }
  async function createExam(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!selectedClass) return setError("Create a class first.");
    const result=await send({action:"create_exam",classId:Number(selectedClass),title:examTitle,topic,count:Number(questionCount),difficulty,language});
    if(result?.questions) setGeneratedQuestions(result.questions);
  }

  const heading = tool;
  const noClasses = classes.length===0;
  return <div className="mt-7 space-y-6" dir={language==="ar"?"rtl":"ltr"}>
    {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {joinCode && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><b>{t("Class join code")}: {joinCode}</b><button type="button" className="ml-3 inline-flex items-center gap-1 underline" onClick={()=>navigator.clipboard.writeText(joinCode)}><Copy size={14}/>{t("Copy")}</button><p className="mt-1 text-xs">{t("Share this code with your students. It is shown only once.")}</p></div>}
    {loading ? <div className="flex items-center gap-2 muted"><LoaderCircle className="animate-spin"/>{t("Loading...")}</div> : <>
      {tool==="My Classes" && <section className="space-y-5">
        <form onSubmit={createClass} className="card grid gap-3 p-5 md:grid-cols-2">
          <h3 className="md:col-span-2 flex items-center gap-2 font-bold"><Plus size={18}/>{t("Create a class")}</h3>
          <input className="field" placeholder={t("Class name")} value={className} onChange={e=>setClassName(e.target.value)} required/>
          <select className="field" value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">{t("Select course (optional)")}</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input className="field md:col-span-2" placeholder={t("Description (optional)")} value={classDescription} onChange={e=>setClassDescription(e.target.value)}/>
          <button disabled={busy} className="btn btn-primary md:col-span-2">{busy?t("Please wait..."):t("Create class")}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">{classes.map(c=><article key={c.id} className="card p-5"><div className="flex items-center justify-between"><h3 className="font-bold">{c.name}</h3><Users size={19}/></div><p className="mt-2 text-sm muted">{c.subject_name || t("No course assigned")}</p><p className="mt-3 text-sm">{c.student_count} {t("students")}</p>{c.description&&<p className="mt-2 text-sm muted">{c.description}</p>}</article>)}</div>
        {noClasses&&<p className="muted">{t("No classes yet. Create your first class above.")}</p>}
      </section>}

      {tool==="My Courses" && <section className="space-y-5">
        <form onSubmit={createCourse} className="card grid gap-3 p-5">
          <h3 className="flex items-center gap-2 font-bold"><Plus size={18}/>{t("Create a course")}</h3>
          <input className="field" placeholder={t("Course name")} value={courseName} onChange={e=>setCourseName(e.target.value)} required/>
          <textarea className="field min-h-24" placeholder={t("Course description")} value={courseDescription} onChange={e=>setCourseDescription(e.target.value)}/>
          <button disabled={busy} className="btn btn-primary">{busy?t("Please wait..."):t("Add course")}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">{subjects.map(s=><article key={s.id} className="card p-5"><BookOpen size={20}/><h3 className="mt-3 font-bold">{s.name}</h3><p className="mt-2 text-sm muted">{s.description || t("No description provided.")}</p></article>)}</div>
      </section>}

      {tool==="AI Lesson Planner" && <section className="space-y-4">
        <form onSubmit={generatePlan} className="card grid gap-3 p-5 md:grid-cols-2">
          <h3 className="md:col-span-2 flex items-center gap-2 font-bold"><WandSparkles size={18}/>{t("Generate a lesson plan")}</h3>
          <select className="field md:col-span-2" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} required><option value="">{t("Choose class")}</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="field md:col-span-2" placeholder={t("Lesson topic")} value={topic} onChange={e=>setTopic(e.target.value)} required/>
          <input className="field" placeholder={t("Student level")} value={level} onChange={e=>setLevel(e.target.value)}/>
          <input className="field" type="number" min="10" max="240" value={duration} onChange={e=>setDuration(e.target.value)}/>
          <button disabled={busy||noClasses} className="btn btn-primary md:col-span-2">{busy?<LoaderCircle className="animate-spin"/>:<Sparkles size={17}/>} {t("Generate with AI")}</button>
        </form>
        {plan&&<article className="card p-5"><input className="field mb-4" value={lessonTitle} onChange={e=>setLessonTitle(e.target.value)}/><pre className="whitespace-pre-wrap font-sans text-sm leading-7">{plan}</pre><button disabled={busy} onClick={savePlan} className="btn btn-primary mt-5">{t("Save as draft lesson")}</button></article>}
        <div className="space-y-2">{lessons.map(l=><article key={l.id} className="card flex items-center justify-between gap-3 p-4"><div><b>{l.title}</b><p className="text-sm muted">{l.class_name} · {t(l.status)}</p></div></article>)}</div>
      </section>}

      {tool==="AI Exam Creator" && <section className="space-y-4">
        <form onSubmit={createExam} className="card grid gap-3 p-5 md:grid-cols-2">
          <h3 className="md:col-span-2 flex items-center gap-2 font-bold"><ClipboardList size={18}/>{t("Create an AI exam")}</h3>
          <select className="field md:col-span-2" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} required><option value="">{t("Choose class")}</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="field" placeholder={t("Exam title")} value={examTitle} onChange={e=>setExamTitle(e.target.value)} required/>
          <input className="field" placeholder={t("Exam topic")} value={topic} onChange={e=>setTopic(e.target.value)} required/>
          <select className="field" value={questionCount} onChange={e=>setQuestionCount(e.target.value)}><option value="5">5 {t("questions")}</option><option value="10">10 {t("questions")}</option><option value="15">15 {t("questions")}</option><option value="20">20 {t("questions")}</option></select>
          <select className="field" value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="easy">{t("Easy")}</option><option value="medium">{t("Medium")}</option><option value="hard">{t("Hard")}</option></select>
          <button disabled={busy||noClasses} className="btn btn-primary md:col-span-2">{busy?<LoaderCircle className="animate-spin"/>:<Sparkles size={17}/>} {t("Generate and save exam")}</button>
        </form>
        {generatedQuestions.length>0&&<div className="card space-y-4 p-5"><h3 className="font-bold">{t("Generated exam preview")}</h3>{generatedQuestions.map((q,i)=><div key={i}><b>{i+1}. {q.question}</b><ol className="mt-2 list-inside list-[upper-alpha] space-y-1 text-sm muted">{q.options.map((o,j)=><li key={j}>{o}</li>)}</ol></div>)}</div>}
        <div className="space-y-2">{exams.map(ex=><article key={ex.id} className="card flex items-center justify-between gap-3 p-4"><div><b>{ex.title}</b><p className="text-sm muted">{ex.class_name} · {ex.question_count} {t("questions")} · {ex.submissions} {t("submissions")}</p></div></article>)}</div>
      </section>}

      {tool==="Results & Reports" && <section className="space-y-3">
        <div className="card overflow-x-auto p-4"><div className="mb-4 flex items-center gap-2 font-bold"><ChartNoAxesCombined size={19}/>{t("Exam performance")}</div>
          <table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs muted"><th className="p-3">{t("Exam")}</th><th className="p-3">{t("Class")}</th><th className="p-3">{t("Submissions")}</th><th className="p-3">{t("Average")}</th><th className="p-3">{t("Highest")}</th><th className="p-3">{t("Lowest")}</th></tr></thead><tbody>{reports.map(r=><tr key={r.exam_id} className="border-b"><td className="p-3 font-semibold">{r.exam_title}</td><td className="p-3">{r.class_name}</td><td className="p-3">{r.submissions}</td><td className="p-3">{r.average_score ?? "—"}</td><td className="p-3">{r.highest_score ?? "—"}</td><td className="p-3">{r.lowest_score ?? "—"}</td></tr>)}</tbody></table>
          {reports.length===0&&<p className="py-5 text-sm muted">{t("No exam results yet. Results will appear after students submit exams.")}</p>}
        </div>
      </section>}
    </>}
  </div>;
}
