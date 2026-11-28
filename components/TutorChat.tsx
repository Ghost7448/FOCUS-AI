"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Send, User } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type ChatMessage = { role: "user" | "assistant"; content: string };

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-extrabold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded-md px-1.5 py-0.5 font-mono text-[.92em]" style={{background:"var(--accent-soft)"}}>{part.slice(1,-1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2" style={{color:"var(--accent-strong)"}}>{link[1]}</a>;
    return part;
  });
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  return <div className="space-y-2 break-words">
    {lines.map((line, index) => {
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
        return <Tag key={index} className={level === 1 ? "text-xl font-extrabold leading-snug" : level === 2 ? "text-lg font-bold leading-snug" : "text-base font-bold leading-snug"}>{renderInline(heading[2])}</Tag>;
      }
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (bullet || numbered) return <div key={index} className="flex gap-2 ps-1"><span className="font-bold" style={{color:"var(--accent-strong)"}}>{bullet ? "•" : "›"}</span><span>{renderInline((bullet || numbered)![1])}</span></div>;
      if (!line.trim()) return <div key={index} className="h-1" />;
      return <p key={index}>{renderInline(line)}</p>;
    })}
  </div>;
}

export default function TutorChat() {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage || loading) return;

    setMessages((current) => [...current, { role: "user", content: cleanMessage }]);
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleanMessage, conversationId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not contact the tutor.");
      setConversationId(data.conversationId);
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="mt-7" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="mb-4 flex items-center gap-2 text-sm font-bold muted">
      <img src="/favicon.svg" alt="FOCUS AI" className="h-5 w-5 rounded-md" /> {t("AI learning assistant")}
    </div>
    <div className="min-h-64 max-h-[520px] space-y-3 overflow-y-auto rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-strong)" }}>
      {messages.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center">
        <span className="workspace-icon grid h-14 w-14 place-items-center rounded-2xl"><img src="/favicon.svg" alt="FOCUS AI" className="h-9 w-9 rounded-lg" /></span>
        <p className="mt-4 font-bold text-brand-900">{t("What are you learning today?")}</p>
        <p className="mt-2 max-w-md text-sm leading-6 muted">{t("Ask for an explanation, an example, or a step-by-step walkthrough.")}</p>
      </div> : messages.map((item, index) => <div key={index} className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
        {item.role === "assistant" && <span className="workspace-icon grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl"><img src="/favicon.svg" alt="FOCUS AI avatar" className="h-7 w-7 rounded-lg" /></span>}
        <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7" style={{ background: item.role === "user" ? "var(--accent-soft)" : "var(--page-2)", color: "var(--text)" }}>{item.role === "assistant" ? <FormattedMessage content={item.content} /> : <div className="whitespace-pre-wrap">{item.content}</div>}</div>
        {item.role === "user" && <span className="workspace-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl"><User size={17}/></span>}
      </div>)}
      {loading && <div className="flex items-center gap-3 text-sm muted"><span className="workspace-icon grid h-9 w-9 place-items-center overflow-hidden rounded-xl"><img src="/favicon.svg" alt="FOCUS AI" className="h-7 w-7 rounded-lg" /></span> {t("FOCUS AI is thinking...")}</div>}
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <form onSubmit={sendMessage} className="mt-4 flex items-end gap-3">
      <textarea className="field min-h-14 flex-1 resize-y" rows={2} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("Ask your tutor anything...")} aria-label={t("Ask your tutor anything...")} />
      <button className="btn btn-primary min-h-14" type="submit" disabled={loading || !message.trim()} aria-label="Send message"><Send size={18}/> {t("Send")}</button>
    </form>
    <p className="mt-2 text-xs muted">{t("Your conversation is saved to your FOCUS AI account.")}</p>
  </div>;
}
