"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type Question = { id: number; question_text: string; options: string[]; explanation: string };
type Quiz = { id: number; title: string; questions: Question[] };
type Review = { id: number; question: string; selected: number; correctIndex: number; correct: boolean; explanation: string; correctAnswer: string };

export default function QuizWorkspace() {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [review, setReview] = useState<Review[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [saved, setSaved] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadQuizzes() {
    const response = await fetch("/api/quizzes", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setSaved(data.quizzes || []);
  }

  useEffect(() => { void loadQuizzes(); }, []);

  async function generate() {
    setLoading(true);
    setError("");
    setReview(null);
    setScore(null);
    try {
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || t("Study quiz"), sourceText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Quiz generation failed."));
      setQuiz(data.quiz);
      setAnswers({});
      await loadQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Quiz generation failed."));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!quiz) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/quizzes/" + quiz.id + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not submit this quiz."));
      setScore(data.score);
      setReview(data.review);
      await loadQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not submit this quiz."));
    } finally {
      setSubmitting(false);
    }
  }

  function openQuiz(item: Quiz) {
    setQuiz(item);
    setAnswers({});
    setReview(null);
    setScore(null);
  }

  return <div className="mt-7 space-y-5" dir={language === "ar" ? "rtl" : "ltr"}>
    {!quiz && <div className="rounded-2xl border border-amber-800/15 bg-amber-900/5 p-5">
      <h3 className="font-bold text-brand-900">{t("Generate a quiz from your notes")}</h3>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("Quiz title")} maxLength={200} className="mt-4 w-full rounded-xl border border-black/10 bg-transparent px-4 py-3 text-sm"/>
      <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder={t("Paste your lesson or study notes here...")} rows={7} maxLength={12000} className="mt-3 w-full rounded-xl border border-black/10 bg-transparent px-4 py-3 text-sm leading-6"/>
      <p className="mt-2 text-xs muted">{sourceText.length} / 12,000 {t("characters · at least 30 required")}</p>
      <button type="button" disabled={loading || sourceText.trim().length < 30} onClick={() => void generate()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {loading ? <Loader2 size={17} className="animate-spin"/> : <Sparkles size={17}/>} {loading ? t("Generating quiz...") : t("Generate quiz")}
      </button>
    </div>}

    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}

    {quiz && <div className="rounded-2xl border border-black/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-brand-900">{quiz.title}</h3>
        <button type="button" onClick={() => { setQuiz(null); setReview(null); setScore(null); }} className="text-sm font-semibold text-amber-900">{t("Create another quiz")}</button>
      </div>
      {score !== null && <div className="mt-4 rounded-xl bg-amber-900/5 p-4 text-center">
        <p className="text-sm muted">{t("Your score")}</p>
        <p className="mt-1 text-3xl font-black text-brand-900">{score}%</p>
        <p className="text-sm muted">{review?.filter((item) => item.correct).length} / {review?.length} {t("correct answers")}</p>
      </div>}
      <div className="mt-5 space-y-5">
        {quiz.questions.map((question, index) => {
          const result = review?.find((item) => item.id === question.id || item.question === question.question_text);
          return <div key={question.id} className="rounded-xl border border-black/10 p-4">
            <p className="font-semibold text-brand-900">{index + 1}. {question.question_text}</p>
            <div className="mt-3 space-y-2">
              {question.options.map((option, optionIndex) => {
                const selected = answers[String(question.id)] === optionIndex;
                const correct = result?.correctIndex === optionIndex;
                return <label key={optionIndex} className={"flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm " + (result && correct ? "border-green-600/40 bg-green-500/10" : selected ? "border-amber-700/50 bg-amber-800/5" : "border-black/10")}>
                  <input type="radio" name={"question-" + question.id} checked={selected} disabled={!!review} onChange={() => setAnswers((current) => ({ ...current, [String(question.id)]: optionIndex }))}/>
                  <span className="flex-1">{option}</span>
                  {result && correct && <CheckCircle2 size={17} className="text-green-700"/>}
                  {result && selected && !result.correct && <XCircle size={17} className="text-red-600"/>}
                </label>;
              })}
            </div>
            {result && <p className="mt-3 text-sm leading-6 muted">{result.explanation || (result.correct ? t("Correct.") : t("Correct answer:") + " " + result.correctAnswer)}</p>}
          </div>;
        })}
      </div>
      {!review && <button type="button" disabled={submitting || Object.keys(answers).length !== quiz.questions.length} onClick={() => void submit()} className="mt-5 rounded-xl bg-amber-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {submitting ? t("Submitting...") : t("Submit answers")}
      </button>}
    </div>}

    {!quiz && saved.length > 0 && <div>
      <h3 className="mb-3 font-bold text-brand-900">{t("Your saved quizzes")}</h3>
      <div className="space-y-2">
        {saved.map((item) => <button type="button" key={item.id} onClick={() => openQuiz(item)} className="flex w-full items-center justify-between rounded-xl border border-black/10 p-4 text-left transition hover:bg-amber-800/5">
          <span><span className="block font-semibold text-brand-900">{item.title}</span><span className="mt-1 block text-xs muted">{item.questions.length} {t("questions")}</span></span>
          <span className="text-sm font-bold text-amber-900">{t("Open")}</span>
        </button>)}
      </div>
    </div>}
  </div>;
}
