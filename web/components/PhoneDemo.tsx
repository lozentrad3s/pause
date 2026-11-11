"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ruleCheck, STAGES, SIGNALS, type Msg, type Hit } from "@/lib/analyzer";
import { PLATFORMS, STORIES, type Platform, type Story, type Line } from "@/lib/stories";

type Step =
  | { t: "typing"; wait: number }
  | { t: "msg"; line: Line; wait: number }
  | { t: "sheet"; wait: number }
  | { t: "insist"; wait: number }
  | { t: "wallet"; wait: number }
  | { t: "final"; wait: number };

function buildSteps(story: Story, platform: Platform): { lines: Line[]; steps: Step[] } {
  const intro = PLATFORMS.find((p) => p.id === platform)!.intro;
  const lines: Line[] = story.scam ? [{ from: "them", text: intro, day: "Day 1" }, ...story.lines.map((l, i) => (i === 0 ? { ...l, day: undefined } : l))] : story.lines;
  const steps: Step[] = [];
  for (const line of lines) {
    if (line.from === "them") steps.push({ t: "typing", wait: 500 });
    steps.push({ t: "msg", line, wait: line.from === "them" ? 900 : 800 });
  }
  if (story.scam) {
    steps.push({ t: "sheet", wait: 1100 });
    steps.push({ t: "insist", wait: 3600 });
  }
  steps.push({ t: "wallet", wait: story.scam ? 1200 : 1300 });
  steps.push({ t: "final", wait: 1300 });
  return { lines, steps };
}

const LEVEL_COLOR = { Safe: "var(--ok)", Low: "var(--ok)", Medium: "var(--warn)", High: "var(--bad)" } as const;

export default function PhoneDemo({ variant = "full" }: { variant?: "full" | "hero" }) {
  const hero = variant === "hero";
  const [storyId, setStoryId] = useState("romance");
  const [platform, setPlatform] = useState<Platform>("WhatsApp");
  const [i, setI] = useState(0); // steps shown
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const started = useRef(false);

  const story = STORIES.find((s) => s.id === storyId)!;
  const plat = PLATFORMS.find((p) => p.id === platform)!;
  const { steps } = useMemo(() => buildSteps(story, platform), [story, platform]);

  // Derive the screen from the steps shown so far.
  const shown = steps.slice(0, i);
  const msgs: (Line & { key: number })[] = [];
  shown.forEach((s, k) => s.t === "msg" && msgs.push({ ...s.line, key: k }));
  const typing = shown.length > 0 && shown[shown.length - 1].t === "typing";
  const has = (t: Step["t"]) => shown.some((s) => s.t === t);
  const parsed: Msg[] = msgs.map((m) => ({ who: m.from === "them" ? story.contact : "Me", text: m.text }));
  const rules = ruleCheck(parsed, story.contact);
  const latestHit: Hit | undefined = rules.hits.length ? rules.hits[rules.hits.length - 1] : undefined;
  const done = i >= steps.length;

  useEffect(() => {
    if (!playing) return;
    if (i >= steps.length) {
      if (!hero) setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setI((x) => x + 1), steps[i].wait);
    return () => clearTimeout(timer.current);
  }, [playing, i, steps]);

  // The hero phone loops on its own.
  useEffect(() => {
    if (!hero || i < steps.length) return;
    const t = window.setTimeout(() => setI(0), 5000);
    return () => clearTimeout(t);
  }, [hero, i, steps.length]);

  useEffect(() => {
    if (hero && !playing && i === 0) setPlaying(true);
  }, [hero, playing, i]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, typing]);

  // Start once the phone scrolls into view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        setPlaying(true);
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const restart = (nextStory = storyId, nextPlatform = platform) => {
    clearTimeout(timer.current);
    setStoryId(nextStory);
    setPlatform(nextPlatform);
    setI(0);
    setPlaying(true);
    started.current = true;
  };

  const sheetOpen = has("sheet") && !has("wallet");
  const onWallet = has("wallet");
  const final = has("final");

  return (
    <div className={hero ? "pdemo-hero" : "pdemo"} ref={rootRef}>
      {!hero && <div className="pdemo-controls">
        <div className="seg" role="group" aria-label="Story">
          {STORIES.map((s) => (
            <button key={s.id} className={storyId === s.id ? "on" : ""} onClick={() => restart(s.id, platform)}>
              {s.title}
            </button>
          ))}
        </div>
        <div className="seg seg-wrap" role="group" aria-label="App">
          {PLATFORMS.map((p) => (
            <button key={p.id} className={platform === p.id ? "on" : ""} onClick={() => restart(storyId, p.id)}>
              {p.id}
            </button>
          ))}
        </div>
      </div>}

      <div className={hero ? "" : "pdemo-grid"}>
        {/* ------------------------------------------------ the phone */}
        <div className="device" aria-label="Phone simulation">
          <div className="device-screen">
            <div className="statusbar">
              <span>9:41</span>
              <span className={`shield lv-${rules.level}`} title="Pause risk">
                <ShieldIcon /> {rules.score}%
              </span>
            </div>

            {!onWallet && (
              <>
                <div className="apphead" style={{ background: plat.color }}>
                  <span className="back">‹</span>
                  <span className="avatar">{story.avatar}</span>
                  <div>
                    <div className="apphead-name">{story.contact}</div>
                    <div className="apphead-sub">{typing ? "typing…" : `${platform} · online`}</div>
                  </div>
                </div>

                {latestHit && rules.level !== "Safe" && !sheetOpen && (
                  <div className={`ptoast lv-${rules.level}`} key={latestHit.id} role="status">
                    <ShieldIcon />
                    <div>
                      <b>Pause noticed: {latestHit.label.toLowerCase()}</b>
                      <span>Only you can see this</span>
                    </div>
                  </div>
                )}

                <div className="pchat" ref={chatRef}>
                  {msgs.map((m) => (
                    <div key={m.key} className="pline">
                      {m.day && <div className="pday">{m.day}</div>}
                      <div className={`pbubble ${m.from}`}>{m.text}</div>
                    </div>
                  ))}
                  {typing && (
                    <div className="pbubble them typing-dots" aria-label="typing">
                      <i /><i /><i />
                    </div>
                  )}
                </div>
                <div className="pinput">Message</div>
              </>
            )}

            {sheetOpen && story.payment && (
              <div className="psheet" role="dialog" aria-label="Pause warning">
                <div className="psheet-grab" />
                <p className="psheet-eyebrow"><ShieldIcon /> Pause</p>
                <h4>Stop. This looks like a {story.id === "investment" ? "crypto investment" : "romance"} scam.</h4>
                <div className="psheet-score">
                  <Ring value={rules.score} />
                  <div>
                    <b>{rules.hits.length} warning signs</b>
                    <span>at the “{STAGES.find((s) => s.id === rules.stage)!.label.toLowerCase()}” stage</span>
                  </div>
                </div>
                <ul className="psheet-flags">
                  {rules.hits.slice(-3).map((h) => (
                    <li key={h.id}>
                      <b>{h.label}</b>
                      <q>{h.quote.length > 70 ? h.quote.slice(0, 70) + "…" : h.quote}</q>
                    </li>
                  ))}
                </ul>
                <div className="psheet-actions">
                  <span className="pbtn primary">Call my son</span>
                  <span className={`pbtn ${has("insist") ? "pressed" : ""}`}>I still want to pay</span>
                </div>
              </div>
            )}

            {onWallet && story.payment && (
              <div className="pwallet">
                <p className="pwallet-title"><ShieldIcon /> Pause wallet</p>
                <div className="pwallet-card">
                  <span className="muted small">Paying</span>
                  <div className="pwallet-amt">{story.payment.amount} NEAR</div>
                  <span className="muted small">to {story.payment.to}</span>
                </div>
                {!final && <div className="pwallet-wait"><span className="spinner" /> Checking…</div>}
                {final && story.scam && (
                  <div className="pwallet-result held">
                    <div className="big-icon">⏸</div>
                    <b>Held for 24 hours</b>
                    <p>This receiver was named in a chat Pause flagged. Your son has been told. Nothing has left your wallet, and you can cancel at any time.</p>
                  </div>
                )}
                {final && !story.scam && (
                  <div className="pwallet-result paid">
                    <div className="big-icon">✓</div>
                    <b>Paid</b>
                    <p>Tolu is a trusted payee. Pause stayed out of the way.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------ what Pause sees */}
        {!hero && <div className="insight" aria-live="polite">
          <p className="eyebrow">What Pause sees</p>
          <div className="meter">
            <div className="meter-top">
              <b style={{ color: LEVEL_COLOR[rules.level] }}>{rules.level === "Safe" ? "No warning signs" : `${rules.level} risk`}</b>
              <span className="muted">{rules.score}/100</span>
            </div>
            <div className="meter-bar"><span style={{ width: `${rules.score}%`, background: LEVEL_COLOR[rules.level] }} /></div>
          </div>

          <ol className="stages">
            {STAGES.map((s, k) => {
              const reached = STAGES.findIndex((x) => x.id === rules.stage) >= k && rules.hits.length > 0;
              return (
                <li key={s.id} className={reached ? (story.scam || rules.level !== "Safe" ? "on" : "") : ""}>
                  <span />{s.label}
                </li>
              );
            })}
          </ol>

          <ul className="signals">
            {(rules.hits.length === 0 || rules.level === "Safe") && (
              <li className="muted signal-empty">
                {done && !story.scam ? "A normal chat between friends. No alerts, no delays." : "Reading the chat… nothing suspicious yet."}
              </li>
            )}
            {rules.level !== "Safe" && rules.hits.map((h) => (
              <li key={h.id} className="signal">
                <b>{h.label} <em>+{SIGNALS[h.id].weight}</em></b>
                <span>{h.why}</span>
              </li>
            ))}
          </ul>

          {story.scam && has("sheet") && (
            <div className="autopause">
              <p className="eyebrow">Automatic pause</p>
              <ol>
                <li className="done">Warned Grace privately, before any money moved</li>
                <li className={onWallet ? "done" : ""}>Pre-flagged <code>{story.payment!.to}</code> found in the chat</li>
                <li className={final ? "done" : ""}>Payment held on NEAR, risk set to High</li>
                <li className={final ? "done" : ""}>Guardian alerted to step in</li>
              </ol>
            </div>
          )}

          <div className="insight-foot">
            <button className="btn small-btn" onClick={() => restart()}>{done ? "Replay" : playing ? "Restart" : "Play"}</button>
            <a className="linkbtn" href="/check">Check a real chat →</a>
          </div>
        </div>}
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}

function Ring({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-label={`Risk ${value} of 100`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--bad)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{value}</text>
    </svg>
  );
}
