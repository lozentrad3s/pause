"use client";

// Talk to Pause. Built for someone who would never paste a chat export: one
// big button, speak in your own language, hear the answer read back.
// Speech is turned into text by Whisper on NEAR AI Cloud, the verdict comes
// from the same private model as the chat check, and the browser reads it aloud.

import { useEffect, useRef, useState } from "react";
import ProofBadge from "@/components/ProofBadge";
import { SCAM_NAMES, type Analysis } from "@/lib/analyzer";
import { CASES } from "@/lib/cases";
import { CALL_COPY, LANGS, speechCode, type Lang } from "@/lib/i18n";

type Phase = "idle" | "listening" | "thinking" | "answer";

const EXAMPLES = CASES.filter((c) => c.scam && (c.kind === "call" || c.kind === "text")).slice(0, 4);

export default function CallPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [res, setRes] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [canRecord, setCanRecord] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const copy = CALL_COPY[lang];

  useEffect(() => {
    setCanRecord(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
    const browser = navigator.language;
    const match = LANGS.find((l) => l.speech === browser) ?? LANGS.find((l) => l.id !== "en-GB" && browser.startsWith(l.id.slice(0, 2)));
    if (match) setLang(match.id);
    return () => window.speechSynthesis?.cancel();
  }, []);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechCode(lang);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  };

  const ask = async (text: string) => {
    setHeard(text);
    setPhase("thinking");
    setError("");
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: text, platform: "a phone call or text message the user is describing aloud", lang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Something went wrong.");
      setRes(data);
      setPhase("answer");
      const v = (data as Analysis).verdict;
      speak([v.summary, ...v.advice.slice(0, 2)].join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("idle");
    }
  };

  const startListening = async () => {
    setError("");
    setRes(null);
    window.speechSynthesis?.cancel();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        setPhase("thinking");
        try {
          const form = new FormData();
          form.append("audio", blob, `question.${(rec.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm"}`);
          const r = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "I couldn't hear that.");
          await ask(data.text);
        } catch (e) {
          setError(e instanceof Error ? e.message : "I couldn't hear that.");
          setPhase("idle");
        }
      };
      recorder.current = rec;
      rec.start();
      setPhase("listening");
      // Stop on its own after 45 seconds so a forgotten recording can't run on.
      setTimeout(() => rec.state === "recording" && rec.stop(), 45_000);
    } catch {
      setCanRecord(false);
      setError("The microphone isn't available. You can type what happened instead.");
    }
  };

  const stopListening = () => recorder.current?.state === "recording" && recorder.current.stop();

  const v = res?.verdict;
  const tone = !v ? "" : v.level === "High" ? "bad" : v.level === "Medium" ? "warn" : "ok";

  return (
    <main id="main" className="wrap call-page">
      <header className="call-head">
        <h1>Call Pause</h1>
        <p className="lede">Got a strange call or message? Say what happened, in your own words and your own language. Pause tells you if it&apos;s a scam and what to do.</p>
        <label className="call-lang">
          <span>Language</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      </header>

      <section className={`call-card ${phase}`} aria-live="polite">
        {phase !== "answer" && (
          <>
            <p className="call-greet">{phase === "listening" ? copy.listening : phase === "thinking" ? copy.thinking : copy.greet}</p>
            <button
              className={`talk ${phase}`}
              onClick={phase === "listening" ? stopListening : startListening}
              disabled={phase === "thinking" || !canRecord}
              aria-label={phase === "listening" ? "Stop and get the answer" : "Start talking"}
            >
              <span className="talk-bars" aria-hidden><i /><i /></span>
            </button>
            <p className="call-hint">
              {phase === "listening" ? "Tap again when you've finished" : phase === "thinking" ? heard && `“${heard.slice(0, 140)}${heard.length > 140 ? "…" : ""}”` : canRecord ? "Tap, then talk" : "Type what happened below"}
            </p>
          </>
        )}

        {phase === "answer" && v && res && (
          <div className={`call-answer ${tone}`}>
            <p className="call-level">{v.level === "Safe" ? "This looks safe" : v.level === "Low" ? "Probably fine, stay alert" : v.level === "Medium" ? "Be careful" : "This looks like a scam"}</p>
            {v.scam_type !== "none" && <p className="call-type">{SCAM_NAMES[v.scam_type]}</p>}
            <p className="call-summary">{v.summary}</p>
            <ol className="call-advice">{v.advice.map((a) => <li key={a}>{a}</li>)}</ol>
            <div className="hold-actions">
              <button className="btn" onClick={() => speak([v.summary, ...v.advice].join(" "))}>Read it to me again</button>
              <button className="btn primary" onClick={() => { window.speechSynthesis?.cancel(); setPhase("idle"); setRes(null); setHeard(""); }}>{copy.again}</button>
            </div>
            <details className="call-heard">
              <summary>What Pause heard</summary>
              <p>{heard}</p>
            </details>
            <ProofBadge analysis={res} />
          </div>
        )}
        {error && <p className="notice bad" role="alert">{error}</p>}
      </section>

      {phase !== "answer" && (
        <section className="call-type-in">
          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim().length >= 10) ask(typed.trim()); }}>
            <label htmlFor="typed">Or type it</label>
            <textarea id="typed" rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="A man called and said he was from my bank…" />
            <button className="btn" disabled={typed.trim().length < 10 || phase === "thinking"}>Ask Pause</button>
          </form>
          <div className="examples">
            <span className="muted small">Or try one that people really receive:</span>
            {EXAMPLES.map((c) => (
              <button key={c.id} className="chip" onClick={() => { setTyped(c.text); ask(c.text); }} disabled={phase === "thinking"}>{c.title}</button>
            ))}
          </div>
        </section>
      )}

      <p className="muted small call-foot">
        Your voice is turned into text by Whisper on NEAR AI Cloud and checked by a private model. Nothing is stored. Pause can be wrong: if
        you&apos;re unsure, hang up and call someone you trust.
      </p>
    </main>
  );
}
