"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck, LoaderCircle, Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type StudentQuestion = { id:number; exam_id:number; question_text:string; options:string[]; points:number };
type StudentExam = { id:number; title:string; class_name:string; question_count:number; submission_status:string|null; score:number|null };
type StudentClass = { id:number; name:string; description:string|null; subject_name:string|null };

export default function StudentTools({ tool }: { tool:"Join a Class"|"My Exams" }) {
  const { t, language } = useLanguage();
  const [code,setCode]=useState("");
  const [classes,setClasses]=useState<StudentClass[]>([]);
  const [exams,setExams]=useState<StudentExam[]>([]);
  const [questions,setQuestions]=useState<StudentQuestion[]>([]);
  const [answers,setAnswers]=useState<Record<number,number>>({});
  const [activeExam,setActiveExam]=useState<number|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/student",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Could not load student tools.");
      setClasses(data.classes||[]);setExams(data.exams||[]);setQuestions(data.questions||[]);
    }catch(e){setError(e instanceof Error?e.message:"Could not load student tools.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  async function join(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/student",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"join_class",code})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not join class.");
      setNotice(data.message);setCode("");await load();
    }catch(e){setError(e instanceof Error?e.message:"Could not join class.");}
    finally{setBusy(false);}
  }
  async function submitExam(examId:number){
    const examQuestions=questions.filter(q=>q.exam_id===examId);
    if(examQuestions.some(q=>answers[q.id]===undefined)){setError("Answer every question before submitting.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/student",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit_exam",examId,answers:examQuestions.map(q=>({questionId:q.id,answer:answers[q.id]}))})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not submit exam.");
      setNotice(language==="ar"?`تم تسليم الاختبار. نتيجتك ${data.score} من ${data.total}`:`Exam submitted. Your score: ${data.score} / ${data.total}`);
      setActiveExam(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Could not submit exam.");}
    finally{setBusy(false);}
  }

  return <div className="mt-7 space-y-5" dir={language==="ar"?"rtl":"ltr"}>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading?<div className="flex items-center gap-2 muted"><LoaderCircle className="animate-spin"/>{t("Loading...")}</div>:<>
      {tool==="Join a Class"&&<>
        <form onSubmit={join} className="card space-y-3 p-5">
          <h3 className="flex items-center gap-2 font-bold"><Users size={19}/>{t("Join a class with a code")}</h3>
          <input className="field" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder={t("Enter class join code")} minLength={4} maxLength={20} required/>
          <button className="btn btn-primary w-full" disabled={busy}>{busy?t("Please wait..."):t("Join class")}</button>
        </form>
        <div className="space-y-2">{classes.map(c=><article key={c.id} className="card p-4"><b>{c.name}</b><p className="mt-1 text-sm muted">{c.subject_name||c.description||""}</p></article>)}</div>
        {classes.length===0&&<p className="text-sm muted">{t("You have not joined any classes yet.")}</p>}
      </>}
      {tool==="My Exams"&&<>
        {exams.map(ex=><article key={ex.id} className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{ex.title}</h3><p className="mt-1 text-sm muted">{ex.class_name} · {ex.question_count} {t("questions")}</p></div>
          {ex.submission_status==="submitted"?<span className="role-pill">{t("Submitted")} · {ex.score}</span>:<button type="button" className="btn btn-primary" onClick={()=>{setActiveExam(activeExam===ex.id?null:ex.id);setAnswers({});setError("");}}>{activeExam===ex.id?t("Close exam"):t("Start exam")}</button>}</div>
          {activeExam===ex.id&&<div className="mt-5 space-y-5">{questions.filter(q=>q.exam_id===ex.id).map((q,index)=><fieldset key={q.id} className="rounded-xl border p-4"><legend className="px-2 font-semibold">{index+1}. {q.question_text}</legend><div className="mt-2 space-y-2">{q.options.map((option,i)=><label key={i} className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name={`q-${q.id}`} checked={answers[q.id]===i} onChange={()=>setAnswers(prev=>({...prev,[q.id]:i}))}/>{option}</label>)}</div></fieldset>)}<button type="button" disabled={busy} onClick={()=>void submitExam(ex.id)} className="btn btn-primary w-full">{busy?t("Please wait..."):t("Submit exam")}</button></div>}
        </article>)}
        {exams.length===0&&<div className="card p-5"><ClipboardCheck size={22}/><p className="mt-2 font-semibold">{t("No exams available yet.")}</p><p className="mt-1 text-sm muted">{t("Join a class using the code from your teacher to see its exams.")}</p></div>}
      </>}
    </>}
  </div>;
}
