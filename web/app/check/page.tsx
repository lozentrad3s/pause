"use client";

import { useLang } from "@/lib/lang";
import Photo from "@/components/Photo";
import { useState } from "react";
import ProofBadge from "@/components/ProofBadge";
import { SCAM_NAMES, STAGES, type Analysis } from "@/lib/analyzer";
import { CASES } from "@/lib/cases";
import { LANGS, type Lang } from "@/lib/i18n";
import { PLATFORMS, STORIES, storyAsText, type Platform } from "@/lib/stories";

export default function CheckPage() {
  const [chat, setChat] = useState("");
  const [platform, setPlatform] = useState<Platform>("WhatsApp");
  const { lang, setLang } = useLang();
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
        body: JSON.stringify({ chat, platform, lang }),
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
    <main id="main" className="check-page wrap">

      <section className="check-hero with-photo">
        <div>
        <h1>Is this a scam?</h1>
        <p className="lede">
          Paste a chat, a text message, an email or a crypto pitch. Pause looks for the scripts scammers follow around the
          world, quotes the warning signs, and tells you what to do, in your language.
        </p>
        </div>
        <Photo name="thinking" alt="A young woman wondering whether a message is genuine" ratio="4 / 5" pos="center 35%" priority />
      </section>

      <section className="check-box">
        <div className="check-tools">
          <div className="seg seg-wrap" role="group" aria-label="Where is it from?">
            {PLATFORMS.map((p) => (
              <button key={p.id} className={platform === p.id ? "on" : ""} aria-pressed={platform === p.id} onClick={() => setPlatform(p.id)}>{p.id}</button>
            ))}
          </div>
          <label>
            <span className="sr-only">Answer in</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <div className="examples" style={{ marginBottom: 12 }}>
          <span className="muted small">Try a real script:</span>
          {STORIES.filter((s) => s.scam).slice(0, 1).map((s) => (
            <button key={s.id} className="chip" onClick={() => { setChat(storyAsText(s, platform)); setRes(null); }}>{s.title}</button>
          ))}
          {CASES.filter((c) => ["C1", "C2", "C5", "C9", "C10", "G1"].includes(c.id)).map((c) => (
            <button key={c.id} className="chip" onClick={() => { setChat(c.text); setRes(null); }}>{c.title}</button>
          ))}
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
          <p className="muted small">Checked by a private model on NEAR AI Cloud. Never stored, never shared.</p>
          <button className="btn primary" onClick={analyse} disabled={busy || chat.trim().length < 10}>
            {busy ? "Checking…" : "Check this"}
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
              <p className="report-kicker">{v.level === "Safe" ? "Looks safe" : `${v.level} risk`} · {SCAM_NAMES[v.scam_type] ?? "Possible scam"}</p>
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
              <b>Pause is ready.</b> If you send money to{" "}
              {res.rules.addresses.map((a) => <code key={a}>{a}</code>)} from a Pause wallet, it will be held and your family alerted.
            </div>
          )}

          <div style={{ marginTop: 20 }}><ProofBadge analysis={res} /></div>
          <p className="muted small report-foot">
            {res.rules.hits.length} fixed-rule signals · {res.messages} messages read. Pause can be wrong. When in doubt, talk to someone you trust.
          </p>
        </section>
      )}
    </main>
  );
}
