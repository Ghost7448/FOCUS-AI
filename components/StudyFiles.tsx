"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Download, FileAudio, FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type ToolType = "lecture" | "book";
type StudyFile = {
  id: number;
  tool_type: ToolType;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  analysis: string | null;
};

export default function StudyFiles({ tool }: { tool: ToolType }) {
  const { t, language } = useLanguage();
  const [files, setFiles] = useState<StudyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Record<number, string>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/study-files?tool=" + tool, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not load your files."));
      setFiles(data.files || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not load your files."));
    } finally {
      setLoading(false);
    }
  }, [tool, t]);

  useEffect(() => { void loadFiles(); }, [loadFiles]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 30 * 1024 * 1024) {
      setError(t("Files must be 30 MB or smaller."));
      event.target.value = "";
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("tool", tool);
    form.append("originalName", file.name);
    form.append("originalMimeType", file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : ""));
    form.append("originalSize", String(file.size));
    let uploadFile: Blob = file;
    let compression = "none";
    try {
      if (typeof CompressionStream !== "undefined") {
        const compressed = await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
        if (compressed.size < file.size) {
          uploadFile = compressed;
          compression = "gzip";
        }
      }
    } catch {
      uploadFile = file;
      compression = "none";
    }
    form.append("compression", compression);
    form.append("file", new File([uploadFile], file.name, { type: file.type || "application/octet-stream" }));
    try {
      const response = await fetch("/api/study-files", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Upload failed. Please try again."));
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Upload failed. Please try again."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function analyzeFile(id: number) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/study-files/" + id + "/analyze", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Analysis failed. Please try again."));
      setFiles((current) => current.map((file) => file.id === id ? { ...file, analysis: data.analysis } : file));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Analysis failed. Please try again."));
    } finally {
      setBusyId(null);
    }
  }

  async function askFile(id: number) {
    const question = (questions[id] || "").trim();
    if (!question) return;
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/study-files/" + id + "/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not answer this question."));
      setAnswers((current) => ({ ...current, [id]: data.answer }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not answer this question."));
    } finally {
      setBusyId(null);
    }
  }

  async function removeFile(id: number) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/study-files/" + id, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not delete this file."));
      setFiles((current) => current.filter((file) => file.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not delete this file."));
    } finally {
      setBusyId(null);
    }
  }

  const formatSize = (bytes: number) => bytes < 1024 * 1024
    ? Math.max(1, Math.round(bytes / 1024)) + " KB"
    : (bytes / (1024 * 1024)).toFixed(1) + " MB";

  return <div className="mt-7 space-y-5" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="rounded-2xl border border-dashed border-amber-700/30 bg-amber-900/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-brand-900">{t("Upload study material")}</h3>
          <p className="mt-1 text-sm leading-6 muted">
            {tool === "book" ? t("PDF files up to 30 MB.") : t("PDF or audio files up to 30 MB.")}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-800 px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-amber-900">
          {uploading ? <Loader2 size={17} className="animate-spin"/> : <Upload size={17}/>}
          {uploading ? t("Uploading...") : t("Choose file")}
          <input className="sr-only" type="file"
            accept={tool === "book" ? ".pdf,application/pdf" : ".pdf,application/pdf,.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac,.flac,audio/*"}
            onChange={upload} disabled={uploading}/>
        </label>
      </div>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}

    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-brand-900">{t("Your uploaded files")}</h3>
        <span className="text-xs muted">{files.length} / 100</span>
      </div>
      {loading ? <div className="flex items-center gap-2 py-6 text-sm muted"><Loader2 size={17} className="animate-spin"/>{t("Loading files...")}</div>
      : files.length === 0 ? <div className="rounded-2xl border border-black/10 p-6 text-center text-sm muted">{t("No files uploaded yet.")}</div>
      : <div className="space-y-3">
        {files.map((file) => <div key={file.id} className="rounded-2xl border border-black/10 bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-800/10 text-amber-800">
              {file.mime_type.startsWith("audio/") ? <FileAudio size={20}/> : <FileText size={20}/>}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-900">{file.original_name}</p>
              <p className="mt-1 text-xs muted">{formatSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString(language === "ar" ? "ar-EG" : "en")}</p>
            </div>
            <button type="button" disabled={busyId === file.id} onClick={() => void analyzeFile(file.id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-800/10 disabled:opacity-50">
              {busyId === file.id ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
              {file.analysis ? t("Analyze again") : t("Analyze with Gemini")}
            </button>
            <a className="rounded-lg p-2 text-brand-800 transition hover:bg-amber-800/10" href={"/api/study-files/" + file.id} aria-label={t("Download")} title={t("Download")}><Download size={18}/></a>
            <button type="button" disabled={busyId === file.id} onClick={() => void removeFile(file.id)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-500/10 disabled:opacity-50" aria-label={t("Delete")} title={t("Delete")}>
              {busyId === file.id ? <Loader2 size={18} className="animate-spin"/> : <Trash2 size={18}/>}
            </button>
          </div>
          {file.analysis && <div className="mt-4 whitespace-pre-wrap rounded-xl bg-amber-900/5 p-4 text-sm leading-7 text-brand-900">{file.analysis}</div>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={questions[file.id] || ""} onChange={(event) => setQuestions((current) => ({ ...current, [file.id]: event.target.value }))} maxLength={2000} placeholder={t("Ask a question about this file...")} className="min-w-0 flex-1 rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm"/>
            <button type="button" disabled={busyId === file.id || !(questions[file.id] || "").trim()} onClick={() => void askFile(file.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-800/25 px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-50">
              {busyId === file.id ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>} {t("Ask Gemini")}
            </button>
          </div>
          {answers[file.id] && <div className="mt-3 whitespace-pre-wrap rounded-xl border border-amber-800/15 p-4 text-sm leading-7 text-brand-900">{answers[file.id]}</div>}
        </div>)}
      </div>}
    </div>
  </div>;
}
