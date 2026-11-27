"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Square, Timer, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type ActiveSession = { id: number; planned_minutes: number; started_at: string };
type ProgressData = {
  totalFocusMinutes: number;
  completedFocusSessions: number;
  quizAttempts: number;
  averageQuizScore: number | null;
  lastSevenDays: { date: string; minutes: number }[];
};

export function FocusTimer() {
  const { t, language } = useLanguage();
  const [planned, setPlanned] = useState(25);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finishSession = useCallback(async (status: "completed" | "cancelled") => {
    if (!active || busy) return;
    setBusy(true);
    const elapsed = Math.floor((Date.now() - Date.parse(active.started_at)) / 60000);
    const completedMinutes = status === "completed"
      ? active.planned_minutes
      : Math.max(0, Math.min(active.planned_minutes, elapsed));
    try {
      const response = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish", sessionId: active.id, completedMinutes, status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not save your focus session."));
      setActive(null);
      setRemaining(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not save your focus session."));
    } finally {
      setBusy(false);
    }
  }, [active, busy, t]);

  useEffect(() => {
    fetch("/api/focus", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("Could not load your focus session."));
        setActive(data.activeSession);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("Could not load your focus session.")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!active) return;
    const update = () => {
      const endAt = Date.parse(active.started_at) + active.planned_minutes * 60000;
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (active && remaining === 0 && !loading && !busy) void finishSession("completed");
  }, [active, remaining, loading, busy, finishSession]);

  async function startSession() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", plannedMinutes: planned })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not start your focus session."));
      setActive(data.activeSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not start your focus session."));
    } finally {
      setBusy(false);
    }
  }

  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");

  return <div className="mt-7 space-y-5" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="rounded-3xl border border-amber-800/15 bg-amber-900/5 p-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-800/10 text-amber-900"><Timer size={24}/></span>
      <h3 className="mt-3 font-bold text-brand-900">{t("Focus timer")}</h3>
      {loading ? <div className="mt-5 flex justify-center"><Loader2 className="animate-spin"/></div> : active ? <>
        <p className="mt-5 text-5xl font-black tabular-nums text-brand-900">{minutes}:{seconds}</p>
        <p className="mt-2 text-sm muted">{t("Stay focused until the timer ends.")}</p>
        <button type="button" disabled={busy} onClick={() => void finishSession("cancelled")} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin"/> : <Square size={16}/>} {t("End session")}
        </button>
      </> : <>
        <p className="mt-2 text-sm muted">{t("Choose a session length and start studying.")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {[15, 25, 45, 60].map((value) => <button type="button" key={value} onClick={() => setPlanned(value)} className={"rounded-xl px-4 py-2 text-sm font-bold " + (planned === value ? "bg-amber-800 text-white" : "border border-amber-800/20 text-brand-900")}>{value} {t("min")}</button>)}
        </div>
        <button type="button" disabled={busy} onClick={() => void startSession()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-900 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>} {t("Start focus")}
        </button>
      </>}
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}

export function ProgressDashboard() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/progress", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t("Could not load your progress."));
        setData(result);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("Could not load your progress.")));
  }, [t]);

  if (error) return <p role="alert" className="mt-7 rounded-xl bg-red-500/10 p-3 text-sm text-red-700">{error}</p>;
  if (!data) return <div className="mt-7 flex items-center gap-2 text-sm muted"><Loader2 size={17} className="animate-spin"/>{t("Loading progress...")}</div>;

  const cards = [
    { label: t("Focus minutes"), value: data.totalFocusMinutes },
    { label: t("Completed sessions"), value: data.completedFocusSessions },
    { label: t("Quiz attempts"), value: data.quizAttempts },
    { label: t("Average quiz score"), value: data.averageQuizScore == null ? "—" : Math.round(data.averageQuizScore) + "%" }
  ];
  const maxMinutes = Math.max(1, ...data.lastSevenDays.map((day) => day.minutes));
  return <div className="mt-7 space-y-5" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => <div key={card.label} className="rounded-2xl border border-black/10 p-4">
        <p className="text-sm muted">{card.label}</p>
        <p className="mt-2 text-3xl font-black text-brand-900">{card.value}</p>
      </div>)}
    </div>
    <div className="rounded-2xl border border-black/10 p-5">
      <div className="mb-4 flex items-center gap-2 font-bold text-brand-900"><TrendingUp size={18}/>{t("Last seven days")}</div>
      {data.lastSevenDays.length === 0 ? <p className="text-sm muted">{t("Complete a focus session to see your activity here.")}</p> :
      <div className="space-y-3">
        {data.lastSevenDays.map((day) => <div key={day.date} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-xs">
          <span className="muted">{new Date(day.date + "T12:00:00").toLocaleDateString(language === "ar" ? "ar-EG" : "en", { weekday: "short" })}</span>
          <div className="h-2 overflow-hidden rounded-full bg-amber-900/10"><div className="h-full rounded-full bg-amber-800" style={{ width: (day.minutes / maxMinutes * 100) + "%" }}/></div>
          <span className="text-right font-semibold text-brand-900">{day.minutes}m</span>
        </div>)}
      </div>}
    </div>
  </div>;
}
