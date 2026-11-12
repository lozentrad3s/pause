"use client";

// Talk to Pause. Built for someone who would never paste a chat export: one
// big button, speak in your own language, hear the answer read back.
//
// Speech is turned into text by Whisper on NEAR AI Cloud, the verdict comes
// from the same private model as the chat check, and the browser reads it
// aloud. Three things keep it quick and make sure it hears you:
//   1. The recording stops on its own when you stop talking.
//   2. It is sent as small 16 kHz WAV, which Whisper always accepts.
//   3. The fixed rules answer the instant the words arrive, while the private
//      model is still writing the full answer.

import { useLang } from "@/lib/lang";
import { useEffect, useRef, useState } from "react";
import { Pip } from "@/components/Mascot";
import Photo from "@/components/Photo";
import ProofBadge from "@/components/ProofBadge";
import { parseChat, ruleCheck, SCAM_NAMES, type Analysis } from "@/lib/analyzer";
import { CASES } from "@/lib/cases";
import { CALL_COPY, LANGS, speechCode, type Lang } from "@/lib/i18n";

type Phase = "idle" | "listening" | "hearing" | "thinking" | "answer";

const EXAMPLES = CASES.filter((c) => c.scam && (c.kind === "call" || c.kind === "text")).slice(0, 4);

const SPEECH_LEVEL = 0.018; // RMS above this counts as a voice
const SILENCE_MS = 1700; // stop this long after the last word
const NO_SPEECH_MS = 9000; // give up if nothing is said
const MAX_MS = 45_000;

/** Re-encodes any recording as 16 kHz mono 16-bit WAV. */
async function toWav(blob: Blob): Promise<Blob> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
    text(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    text(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([view], { type: "audio/wav" });
  } finally {
    ctx.close().catch(() => {});
  }
}

export default function CallPage() {
  const { lang, setLang } = useLang();
  const [noVoice, setNoVoice] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [quick, setQuick] = useState<{ level: string; flags: string[] } | null>(null);
  const [res, setRes] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [canRecord, setCanRecord] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const talkBtn = useRef<HTMLButtonElement | null>(null);
  const meter = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const langRef = useRef<Lang>("en");
  langRef.current = lang;
  const copy = CALL_COPY[lang];

  useEffect(() => {
    setCanRecord(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
    // Voices load late in some browsers; asking early makes them ready.
    window.speechSynthesis?.getVoices();
    return () => {
      window.speechSynthesis?.cancel();
      stopMeter();
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speak = (text: string, queue = false) => {
    if (!("speechSynthesis" in window)) return;
    if (!queue) window.speechSynthesis.cancel();
    const code = speechCode(langRef.current);
    const voices = window.speechSynthesis.getVoices();
    // Prefer an exact match (fr-FR), then any voice in the language (fr-CA).
    const voice = voices.find((x) => x.lang.replace("_", "-") === code) ?? voices.find((x) => x.lang.slice(0, 2) === code.slice(0, 2));
    // With no voice for the language a browser stays silent or reads it in an
    // English accent, so say so and leave the answer on screen.
    setNoVoice(voices.length > 0 && !voice);
    if (voices.length > 0 && !voice) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = code;
    if (voice) u.voice = voice;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const stopMeter = () => {
    if (!meter.current) return;
    cancelAnimationFrame(meter.current.raf);
    meter.current.ctx.close().catch(() => {});
    meter.current = null;
    talkBtn.current?.style.removeProperty("--voice");
    talkBtn.current?.style.removeProperty("--level");
  };

  const ask = async (text: string) => {
    setHeard(text);
    setPhase("thinking");
    setError("");
    setRes(null);

    // The fixed rules run here in the browser, so a clear scam is called out
    // at once. They only read English.
    let spokeQuick = false;
    if (langRef.current.startsWith("en")) {
      const rules = ruleCheck(parseChat(text));
      if (rules.level === "High" || rules.level === "Medium") {
        setQuick({ level: rules.level, flags: rules.hits.slice(0, 3).map((h) => h.label) });
        speak(rules.level === "High" ? "This sounds like a scam. Don't send any money yet. I'm checking the details." : "Be careful with this one. I'm checking the details.");
        spokeQuick = true;
      } else setQuick(null);
    } else setQuick(null);

    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: text, platform: "a phone call or text message the user is describing aloud", lang: langRef.current }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Something went wrong.");
      setRes(data);
      setPhase("answer");
      const v = (data as Analysis).verdict;
      speak([v.summary, ...v.advice.slice(0, 2)].join(" "), spokeQuick);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("idle");
    }
  };

  const startListening = async () => {
    setError("");
    setRes(null);
    setQuick(null);
    setHeard("");
    window.speechSynthesis?.cancel();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch {
      setCanRecord(false);
      setError("Pause can't reach the microphone. Allow it in your browser's address bar, or type what happened below.");
      return;
    }

    const rec = new MediaRecorder(stream);
    chunks.current = [];
    let spokeMs = 0;
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      stopMeter();
      if (spokeMs < 250) {
        setPhase("idle");
        setError("I didn't hear anything. Check the microphone isn't muted, move a little closer, and tap again.");
        return;
      }
      setPhase("hearing");
      try {
        const raw = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        let audio: Blob = raw;
        let name = `question.${(rec.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm"}`;
        try {
          audio = await toWav(raw);
          name = "question.wav";
        } catch {
          // Send the browser's own format if it can't be re-encoded.
        }
        const form = new FormData();
        form.append("audio", audio, name);
        form.append("lang", langRef.current.slice(0, 2));
        const r = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "I couldn't hear that.");
        await ask(data.text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "I couldn't hear that.");
        setPhase("idle");
      }
    };

    // Level meter and end-of-speech detection.
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const started = performance.now();
    let last = started;
    let lastVoice = 0;
    let smooth = 0;
    const tick = () => {
      const now = performance.now();
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      smooth = smooth * 0.7 + Math.min(1, rms * 9) * 0.3;
      talkBtn.current?.style.setProperty("--voice", smooth.toFixed(3));
      talkBtn.current?.style.setProperty("--level", (1 + smooth * 0.35).toFixed(3));
      if (rms > SPEECH_LEVEL) {
        spokeMs += now - last;
        lastVoice = now;
      }
      last = now;
      const done =
        (spokeMs >= 400 && now - lastVoice > SILENCE_MS) || // finished talking
        (spokeMs < 250 && now - started > NO_SPEECH_MS) || // never started
        now - started > MAX_MS;
      if (done && rec.state === "recording") return rec.stop();
      if (meter.current) meter.current.raf = requestAnimationFrame(tick);
    };
    meter.current = { ctx, raf: requestAnimationFrame(tick) };

    recorder.current = rec;
    rec.start();
    setPhase("listening");
  };

  const stopListening = () => recorder.current?.state === "recording" && recorder.current.stop();

  const reset = () => {
    window.speechSynthesis?.cancel();
    setPhase("idle");
    setRes(null);
    setQuick(null);
    setHeard("");
  };

  const v = res?.verdict;
  const tone = !v ? "" : v.level === "High" ? "bad" : v.level === "Medium" ? "warn" : "ok";
  const busy = phase === "hearing" || phase === "thinking";
  const stepState = (i: number) => {
    const at = phase === "listening" ? 0 : phase === "hearing" ? 1 : phase === "thinking" ? 2 : -1;
    return at === i ? "on" : at > i ? "done" : "";
  };

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

      <div className="call-stage">
        <Photo name="grandad-phone" alt="An older man smiling as he uses his phone in an armchair" ratio="4 / 5" priority>
          <figcaption className="photo-cap glass">No app, no account. Just talk.</figcaption>
        </Photo>

        <section className={`call-card ${phase}`} aria-live="polite">
          {phase !== "answer" && (
            <>
              <p className="call-greet">{phase === "listening" ? copy.listening : busy ? copy.thinking : copy.greet}</p>
              <button
                ref={talkBtn}
                className={`talk ${phase === "listening" ? "listening" : busy ? "thinking" : ""}`}
                onClick={phase === "listening" ? stopListening : startListening}
                disabled={busy || !canRecord}
                aria-label={phase === "listening" ? "Stop and get the answer" : "Start talking"}
              >
                <span className="talk-bars" aria-hidden><i /><i /></span>
              </button>
              {phase === "idle" && <p className="call-hint">{canRecord ? "Tap once, then talk. Pause stops listening when you do." : "Type what happened below"}</p>}
              {phase !== "idle" && (
                <ol className="call-steps" aria-label="Progress">
                  <li className={stepState(0)}>Listening</li>
                  <li className={stepState(1)}>Writing it down</li>
                  <li className={stepState(2)}>Checking privately</li>
                </ol>
              )}
              {phase === "listening" && <p className="call-live empty">Pause will stop on its own when you finish, or tap the button.</p>}
              {busy && heard && <p className="call-live">&ldquo;{heard.slice(0, 180)}{heard.length > 180 ? "…" : ""}&rdquo;</p>}
              {phase === "thinking" && quick && (
                <div className={`call-quick glass-dark ${quick.level === "High" ? "bad" : ""}`}>
                  <b>{quick.level === "High" ? "This sounds like a scam. Don't send any money yet." : "Be careful with this one."}</b>
                  <span>{quick.flags.join(" · ")}</span>
                </div>
              )}
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
                <button className="btn primary" onClick={reset}>{copy.again}</button>
              </div>
              {noVoice && <p className="notice">This device has no {LANGS.find((l) => l.id === lang)?.label} voice installed, so Pause can&apos;t read the answer aloud here. It is written above in your language.</p>}
              <details className="call-heard">
                <summary>What Pause heard</summary>
                <p>{heard}</p>
              </details>
              <ProofBadge analysis={res} />
            </div>
          )}
          {error && <p className="notice bad" role="alert">{error}</p>}
        </section>
      </div>

      {phase !== "answer" && (
        <section className="call-type-in">
          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim().length >= 10) ask(typed.trim()); }}>
            <label htmlFor="typed">Or type it</label>
            <textarea id="typed" rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="A man called and said he was from my bank…" />
            <button className="btn" disabled={typed.trim().length < 10 || busy}>Ask Pause</button>
          </form>
          <div className="examples">
            <span className="muted small">Or try one that people really receive:</span>
            {EXAMPLES.map((c) => (
              <button key={c.id} className="chip" onClick={() => { setTyped(c.text); ask(c.text); }} disabled={busy || phase === "listening"}>{c.title}</button>
            ))}
          </div>
        </section>
      )}

      <section className="call-ways" aria-labelledby="ways-h">
        <Pip size={104} />
        <div>
          <h2 id="ways-h">Three ways to reach Pause</h2>
          <ul>
            <li>
              <b>Here, in your browser.</b> Tap the button above and talk. Pause stops listening when you do.
            </li>
            <li>
              <b>On Telegram.</b> Open the Pause bot, hold the microphone, say what happened and let go. Telegram bots can&apos;t take live calls, so this is a voice message; the answer comes back in a few seconds.{" "}
              <a className="more" href="https://t.me/Pausenearai_bot?start=call">Open the Pause bot</a>
            </li>
            <li>
              <b>By telephone.</b> A number you can ring from any phone, with no internet, is coming soon. It is not live yet.
            </li>
          </ul>
        </div>
      </section>

      <p className="muted small call-foot">
        Your voice is turned into text by Whisper on NEAR AI Cloud and checked by a private model. Nothing is stored. Pause can be wrong: if
        you&apos;re unsure, hang up and call someone you trust.
      </p>
    </main>
  );
}
