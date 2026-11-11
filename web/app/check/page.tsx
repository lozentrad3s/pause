"use client";

import { useState } from "react";
import { STAGES, type Analysis } from "@/lib/analyzer";
import { PLATFORMS, STORIES, storyAsText, type Platform } from "@/lib/stories";

const TYPE_LABEL: Record<string, string> = {
  romance: "Romance scam",
  investment: "Investment scam",
  romance_investment: "Romance + crypto investment scam",
  impersonation: "Impersonation scam",
  family_emergency: "Family emergency scam",
  job: "Job or task scam",
  other: "Possible scam",
  none: "No scam pattern",
};

export default function CheckPage() {
  const [chat, setChat] = useState("");
  const [platform, setPlatform] = useState<Platform>("WhatsApp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<Analysis | null>(null);

  const analyse = async () => {
    setBusy(true);
    setError("");
    setRes(null);
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat, platform }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Something went wrong");
      setRes(data);
      setTimeout(() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const v = res?.verdict;
  const stageIdx = v ? STAGES.findIndex((s) => s.id === v.stage) : -1;

  return (
    <main className="check wrap">

      <section className="check-hero">
        <p className="eyebrow">Free chat check</p>
        <h1>Is this person real?</h1>
        <p className="lede">
          Paste a conversation from WhatsApp, Instagram, Facebook, TikTok, X or a dating app. Pause looks for the patterns
          romance and crypto scammers follow, and explains what it finds in plain words.
        </p>
      </section>

      <section className="check-box">
        <div className="check-row">
          <div className="seg seg-wrap" role="group" aria-label="Where did you meet?">
            {PLATFORMS.map((p) => (
              <button key={p.id} className={platform === p.id ? "on" : ""} onClick={() => setPlatform(p.id)}>{p.id}</button>
            ))}
          </div>
          <div className="examples">
            <span className="muted small">Try an example:</span>
            {STORIES.map((s) => (
              <button key={s.id} className="chip" onClick={() => { setChat(storyAsText(s, platform)); setRes(null); }}>
                {s.title}
              </button>
            ))}
          </div>
        </div>
        <label htmlFor="chat" className="sr-only">Chat to check</label>
        <textarea
          id="chat"
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder={"Paste the chat here, for example:\nDaniel: Good morning my love ❤️\nMe: Good morning!\n\nOn WhatsApp: open the chat → ⋮ → More → Export chat → Without media."}
          rows={11}
        />
        <div className="check-actions">
          <p className="muted small">🔒 Checked in private AI hardware on NEAR AI Cloud. Never stored, never shared.</p>
          <button className="btn primary" onClick={analyse} disabled={busy || chat.trim().length < 10}>
            {busy ? "Checking…" : "Check this chat"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {busy && (
        <div className="report report-loading" aria-live="polite">
          <span className="spinner" /> Reading {chat.split("\n").filter(Boolean).length} messages for scam patterns…
        </div>
      )}

      {res && v && (
        <section id="report" className={`report lvl-${v.level}`} aria-live="polite">
          <div className="report-head">
            <div className="report-score">
              <b>{v.score}</b>
              <span>/100</span>
            </div>
            <div>
              <p className="eyebrow">{v.level === "Safe" ? "Looks safe" : `${v.level} risk`} · {TYPE_LABEL[v.scam_type] ?? "Possible scam"}</p>
              <h2>{v.summary}</h2>
            </div>
          </div>

          {v.level !== "Safe" && (
            <ol className="stages stages-wide">
              {STAGES.map((s, k) => (
                <li key={s.id} className={k <= stageIdx ? "on" : ""}><span />{s.label}</li>
              ))}
            </ol>
          )}

          {v.red_flags.length > 0 && (
            <>
              <h3>What Pause found</h3>
              <ul className="flags">
                {v.red_flags.map((f, k) => (
                  <li key={k}>
                    <q>{f.quote}</q>
                    <span>{f.why}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="report-cols">
            <div>
              <h3>What to do now</h3>
              <ul>{v.advice.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
            {v.questions.length > 0 && (
              <div>
                <h3>Ask yourself</h3>
                <ul>{v.questions.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
            )}
          </div>

          {res.rules.addresses.length > 0 && v.level !== "Safe" && (
            <div className="armed">
              <b>⏸ Pause is ready.</b> If you send money to{" "}
              {res.rules.addresses.map((a) => <code key={a}>{a}</code>)} from a Pause wallet, it will be held and your family alerted.
            </div>
          )}

          <p className="muted small report-foot">
            {res.source === "ai" ? `Private AI verdict (${res.model}) checked against ${res.rules.hits.length} fixed rules` : `Fixed rules only (${res.rules.hits.length} signals)`}
            {" · "}{res.messages} messages read. Pause can be wrong. When in doubt, talk to someone you trust.
          </p>
        </section>
      )}
    </main>
  );
}
