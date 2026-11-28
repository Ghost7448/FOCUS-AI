"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Send, User } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type ChatMessage = { role: "user" | "assistant"; content: string };

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[\s\S]+?\*\*|__[^_]+__|~~[^~]+~~|(?<!\*)\*(?!\*)(?:\\.|[^*])+\*(?!\*)|(?<!_)_(?!_)(?:\\.|[^_])+_(?!_)|\x60[^\x60]+\x60|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<]+)/g;
  const parts = text.split(pattern).filter(Boolean);
  return parts.map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={index} className="font-extrabold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <del key={index} className="opacity-70">{part.slice(2, -2)}</del>;
    if ((part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) || (part.startsWith("_") && part.endsWith("_") && !part.startsWith("__"))) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.charCodeAt(0) === 96 && part.charCodeAt(part.length - 1) === 96) return <code key={index} className="rounded-md px-1.5 py-0.5 font-mono text-[.92em]" style={{background:"var(--accent-soft)"}}>{part.slice(1,-1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(https?:\/\/[^\s)]+\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2" style={{color:"var(--accent-strong)"}}>{link[1]}</a>;
    if (/^https?:\/\//.test(part)) return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all" style={{color:"var(--accent-strong)"}}>{part}</a>;
    return part;
  });
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { blocks.push(<div key={index} className="h-1" />); index++; continue; }

    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const parseCells = (value: string) => value.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(cell => cell.trim());
      const headers = parseCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) { rows.push(parseCells(lines[index])); index++; }
      blocks.push(<div key={blocks.length} className="overflow-x-auto rounded-xl border" style={{borderColor:"var(--border)"}}>
        <table className="w-full border-collapse text-start text-sm">
          <thead style={{background:"var(--accent-soft)"}}><tr>{headers.map((cell, i) => <th key={i} className="border-b px-3 py-2 text-start font-bold" style={{borderColor:"var(--border)"}}>{renderInline(cell)}</th>)}</tr></thead>
          <tbody>{rows.map((row, ri) => <tr key={ri}>{headers.map((_, ci) => <td key={ci} className="border-b px-3 py-2" style={{borderColor:"var(--border)"}}>{renderInline(row[ci] || "")}</td>)}</tr>)}</tbody>
        </table>
      </div>);
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const classes = ["text-2xl font-extrabold","text-xl font-extrabold","text-lg font-bold","text-base font-bold","text-sm font-bold","text-sm font-semibold"];
      const Tag = ("h" + Math.min(level + 2, 6)) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={index} className={classes[level - 1] + " leading-snug"}>{renderInline(heading[2])}</Tag>);
      index++; continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { blocks.push(<hr key={index} className="my-2" style={{borderColor:"var(--border)"}} />); index++; continue; }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      const quoteLines: string[] = [];
      while (index < lines.length) { const match = lines[index].match(/^\s*>\s?(.*)$/); if (!match) break; quoteLines.push(match[1]); index++; }
      blocks.push(<blockquote key={blocks.length} className="border-s-4 ps-3 italic opacity-90" style={{borderColor:"var(--accent-strong)"}}>{quoteLines.map((part, i) => <p key={i}>{renderInline(part)}</p>)}</blockquote>);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[2]);
      const indent = listMatch[1].length;
      const items: { text: string; checked?: boolean }[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);
        if (!match || match[1].length !== indent || /^\d/.test(match[2]) !== ordered) break;
        const task = match[3].match(/^\[([ xX])\]\s+(.*)$/);
        items.push(task ? {text:task[2],checked:task[1].toLowerCase()==="x"} : {text:match[3]});
        index++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(<ListTag key={blocks.length} className={ordered ? "list-decimal ps-6 space-y-1" : "list-disc ps-6 space-y-1"}>{items.map((item, i) => <li key={i}>{item.checked !== undefined ? <span className="inline-flex items-center gap-2"><span aria-hidden="true">{item.checked ? "☑" : "☐"}</span>{renderInline(item.text)}</span> : renderInline(item.text)}</li>)}</ListTag>);
      continue;
    }
    blocks.push(<p key={index}>{renderInline(line)}</p>);
    index++;
  }
  return <div className="space-y-2 break-words">{blocks}</div>;
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
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Could not contact the tutor.");
      }
      const id = Number(response.headers.get("X-Conversation-Id"));
      if (Number.isFinite(id) && id > 0) setConversationId(id);
      if (!response.body) throw new Error("Streaming is not supported by this connection.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      setMessages((current) => [...current, { role: "assistant", content: "" }]);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last?.role === "assistant") next[next.length - 1] = { role: "assistant", content: answer };
          return next;
        });
      }
      const tail = decoder.decode();
      if (tail) {
        answer += tail;
        setMessages((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last?.role === "assistant") next[next.length - 1] = { role: "assistant", content: answer };
          return next;
        });
      }
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
