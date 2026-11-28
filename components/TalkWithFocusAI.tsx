"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Send, Volume2, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type ChatMessage = { role: "user" | "assistant"; content: string };
type RecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export default function TalkWithFocusAI() {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [callActive, setCallActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();
  const recognitionRef = useRef<Recognition | null>(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);

  function startListening() {
    const SpeechRecognitionCtor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor || !activeRef.current || busyRef.current) return;
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = language === "ar" ? "ar-EG" : "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = Array.from({ length: event.results.length }, (_, i) => {
          const result = event.results[i];
          return result?.isFinal ? result[0]?.transcript || "" : "";
        }).join(" ").trim();
        if (transcript) void sendMessage(transcript);
      };
      recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") setError(t("Microphone recognition failed. Check browser microphone permission."));
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setError("");
    } catch {
      setListening(false);
      setError(t("Could not start the microphone. Please try again."));
    }
  }

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId })
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || t("FOCUS AI could not reply right now."));
      }
      const id = Number(response.headers.get("X-Conversation-Id"));
      if (Number.isFinite(id) && id > 0) setConversationId(id);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "assistant", content: answer };
          return next;
        });
      }
      answer += decoder.decode();
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "assistant", content: answer || t("No response received.") };
        return next;
      });
      if (answer.trim() && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(answer);
        utterance.lang = language === "ar" ? "ar-EG" : "en-US";
        utterance.rate = 1;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          if (activeRef.current) startListening();
        };
        utterance.onerror = () => {
          setSpeaking(false);
          if (activeRef.current) startListening();
        };
        window.speechSynthesis.speak(utterance);
      } else if (activeRef.current) {
        startListening();
      }
    } catch (e) {
      const messageText = e instanceof Error ? e.message : t("Something went wrong.");
      setError(messageText);
      setMessages((current) => current[current.length - 1]?.content === "" ? current.slice(0, -1) : current);
      if (activeRef.current) startListening();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function beginCall() {
    const SpeechRecognitionCtor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError(t("Voice recognition is not supported in this browser. You can still type and hear replies."));
      return;
    }
    activeRef.current = true;
    setCallActive(true);
    startListening();
  }

  function endCall() {
    activeRef.current = false;
    setCallActive(false);
    setListening(false);
    setSpeaking(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  return <section className="mt-7 space-y-4">
    <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-brand-900">FOCUS AI Voice</h3>
          <p className="mt-1 text-sm muted">{t("Speak naturally and get spoken answers from your study assistant.")}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
          {speaking ? t("Speaking") : listening ? t("Listening") : busy ? t("Thinking...") : callActive ? t("Call active") : t("Ready")}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!callActive ? <button type="button" onClick={beginCall} className="btn btn-primary"><Mic size={18}/>{t("Start voice call")}</button> :
          <button type="button" onClick={endCall} className="btn btn-primary"><PhoneOff size={18}/>{t("End call")}</button>}
        {callActive && <span className="inline-flex items-center gap-2 text-sm muted"><Mic size={16}/>{listening ? t("Listening to you...") : speaking ? t("Focus AI is speaking...") : t("Preparing microphone...")}</span>}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
    <div className="max-h-[430px] min-h-36 space-y-3 overflow-y-auto rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {!messages.length && <p className="py-8 text-center text-sm muted">{t("Start a voice call or type a question to begin.")}</p>}
      {messages.map((message, index) => <div key={index} className={message.role === "user" ? "ms-auto max-w-[88%] rounded-2xl rounded-ee-sm p-3 text-sm text-white" : "me-auto max-w-[92%] rounded-2xl rounded-es-sm p-3 text-sm"} style={message.role === "user" ? { background: "var(--accent-strong)" } : { background: "var(--accent-soft)", color: "var(--text)" }}>
        <p className="mb-1 text-[11px] font-bold opacity-70">{message.role === "user" ? t("You") : "FOCUS AI"}</p>
        <p className="whitespace-pre-wrap leading-6">{message.content || (busy ? t("Thinking...") : "")}</p>
      </div>)}
    </div>
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const value = draft; setDraft(""); void sendMessage(value); }}>
      <input className="field min-w-0 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("Type a message if you prefer...")} />
      <button type="submit" disabled={busy || !draft.trim()} className="btn btn-primary" aria-label={t("Send message")}><Send size={18}/></button>
    </form>
    <p className="flex items-center gap-2 text-xs muted"><Volume2 size={14}/>{t("Voice features depend on browser support and microphone permission. Use HTTPS for the deployed site.")}</p>
  </section>;
}
