"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SCENARIOS,
  VAULT,
  SCAM_LABEL,
  buildScript,
  type CheckId,
  type CheckState,
  type PhoneStatus,
  type Risk,
  type ScamType,
  type Scenario,
} from "@/lib/scenarios";

const CHECKS: { id: CheckId; label: string }[] = [
  { id: "registry", label: "Shared scam registry" },
  { id: "limits", label: "Trusted list and limits" },
  { id: "rules", label: "Fixed risk rules" },
  { id: "agent", label: "Private AI interview" },
  { id: "guardian", label: "Family guardian" },
  { id: "outcome", label: "Result" },
];

const STATUS_TEXT: Record<PhoneStatus, string> = {
  idle: "Ready",
  sending: "Sending…",
  paid: "Paid",
  held: "Held",
  blocked: "Blocked",
  cancelled: "Cancelled",
  vetoed: "Stopped",
  released: "Paid",
  waiting: "Waiting",
  rejected: "Rejected",
};

interface View {
  checks: Record<CheckId, { state: CheckState; detail: string }>;
  phone: { status: PhoneStatus; note?: string };
  chat: { from: "agent" | "owner"; text: string }[];
  guardian: { text: string; action?: string }[];
  chain: string[];
  risk?: { risk: Risk; type: ScamType };
}

const blank = (): View => ({
  checks: Object.fromEntries(CHECKS.map((c) => [c.id, { state: "idle", detail: "" }])) as View["checks"],
  phone: { status: "idle" },
  chat: [],
  guardian: [],
  chain: [],
});

export default function Simulation() {
  const [sel, setSel] = useState<Scenario>(SCENARIOS[1]);
  const [slow, setSlow] = useState(false);
  const [view, setView] = useState<View>(blank);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [showSuite, setShowSuite] = useState(false);
  const timers = useRef<number[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);

  const script = useMemo(() => buildScript(sel), [sel]);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => stop, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    chainRef.current?.scrollTo({ top: chainRef.current.scrollHeight, behavior: "smooth" });
  }, [view.chat.length, view.chain.length]);

  const pick = (s: Scenario) => {
    stop();
    setSel(s);
    setView(blank());
    setRunning(false);
    setDone(false);
  };

  const run = () => {
    stop();
    setView(blank());
    setDone(false);
    setRunning(true);
    const k = slow ? 3 : 1;
    let at = 0;
    script.steps.forEach((step, i) => {
      at += step.wait * k;
      const id = window.setTimeout(() => {
        setView((v) => apply(v, step.ev));
        if (i === script.steps.length - 1) {
          setRunning(false);
          setDone(true);
        }
      }, at);
      timers.current.push(id);
    });
  };

  const st = view.phone.status;

  return (
    <div className="sim">
      <div className="sim-head">
        <div>
          <p className="eyebrow">Simulation, sped up</p>
          <p className="muted small">Real holds last {VAULT.holdLabel}. Answers are scripted.</p>
        </div>
        <div className="sim-controls">
          <div className="seg" role="group" aria-label="Speed">
            <button className={!slow ? "on" : ""} onClick={() => setSlow(false)}>Normal</button>
            <button className={slow ? "on" : ""} onClick={() => setSlow(true)}>Slow ×3</button>
          </div>
          <button className="btn primary" onClick={run} disabled={running}>
            {running ? "Running…" : done ? "Replay" : "Run scenario"}
          </button>
        </div>
      </div>

      <div className="chips" role="tablist" aria-label="Scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={sel.id === s.id}
            className={`chip ${sel.id === s.id ? "on" : ""}`}
            onClick={() => pick(s)}
          >
            <span className="chip-id">{s.id}</span> {s.title}
          </button>
        ))}
      </div>
      <p className="sim-blurb">
        <strong>{sel.id}:</strong> {sel.blurb}
        {sel.genuine ? <span className="tag ok">genuine</span> : <span className="tag bad">scam</span>}
      </p>

      <div className="sim-grid">
        {/* Owner's phone */}
        <div className="phone">
          <div className="phone-top">
            <span>Amina · Pause</span>
            <span className="muted">{VAULT.balance} NEAR</span>
          </div>
          {sel.kind === "payment" && (
            <div className={`paycard s-${st}`}>
              <div className="paycard-row">
                <div>
                  <div className="amount">{sel.amount} NEAR</div>
                  <div className="muted small">to {sel.receiver}</div>
                </div>
                <span className={`badge b-${st}`}>{STATUS_TEXT[st]}</span>
              </div>
              {view.phone.note && <div className="paynote">{view.phone.note}</div>}
              {view.risk && (
                <div className={`riskline r-${view.risk.risk}`}>
                  Risk: {view.risk.risk}
                  {view.risk.type !== "none" && ` · ${SCAM_LABEL[view.risk.type]}`}
                </div>
              )}
            </div>
          )}
          {sel.kind !== "payment" && (
            <div className={`paycard s-${st}`}>
              <div className="paycard-row">
                <div className="amount small-amount">{sel.kind === "settings" ? "Remove all guardians" : "Agent key misuse"}</div>
                <span className={`badge b-${st}`}>{STATUS_TEXT[st]}</span>
              </div>
              {view.phone.note && <div className="paynote">{view.phone.note}</div>}
            </div>
          )}
          <div className="chat" ref={chatRef} aria-live="polite">
            {view.chat.length === 0 && <p className="muted small center">Telegram chat with the Pause agent appears here.</p>}
            {view.chat.map((m, i) => (
              <div key={i} className={`bubble ${m.from}`}>{m.text}</div>
            ))}
          </div>
        </div>

        {/* Checks */}
        <ol className="checks">
          {CHECKS.map((c, i) => {
            const v = view.checks[c.id];
            return (
              <li key={c.id} className={`check c-${v.state}`}>
                <span className="dot" aria-hidden>{icon(v.state, i + 1)}</span>
                <div>
                  <div className="check-label">{c.label}</div>
                  {v.detail && <div className="check-detail">{v.detail}</div>}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Guardian's phone */}
        <div className="phone guardian">
          <div className="phone-top">
            <span>Her son · Guardian</span>
            <span className="muted">Alerts</span>
          </div>
          <div className="gfeed">
            {view.guardian.length === 0 && <p className="muted small center">Alerts reach the family only when something looks wrong.</p>}
            {view.guardian.map((g, i) => (
              <div key={i} className="gcard">
                {g.text && <p>{g.text}</p>}
                {g.action && <span className="gaction">{g.action}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chainlog" ref={chainRef}>
        <span className="chainlog-title">NEAR testnet</span>
        {view.chain.length === 0 && <div className="muted">Contract calls and events appear here.</div>}
        {view.chain.map((l, i) => (
          <div key={i}>› {l}</div>
        ))}
      </div>

      {done && (
        <p className="sim-result">
          {script.result.stopped && !sel.genuine ? "Scam stopped. " : ""}
          {script.result.note}.{" "}
          <button className="linkbtn" onClick={() => setShowSuite(true)}>See all 10 results</button>
        </p>
      )}
      {!done && (
        <p className="sim-result muted">
          <button className="linkbtn" onClick={() => setShowSuite((x) => !x)}>
            {showSuite ? "Hide" : "Show"} the full suite results
          </button>
        </p>
      )}
      {showSuite && <Suite />}
    </div>
  );
}

function Suite() {
  const rows = SCENARIOS.map((s) => ({ s, r: buildScript(s).result }));
  const scams = rows.filter((x) => !x.s.genuine);
  const genuine = rows.filter((x) => x.s.genuine);
  const stopped = scams.filter((x) => x.r.stopped).length;
  const delayed = genuine.filter((x) => x.r.delayed).length;
  return (
    <div className="suite">
      <div className="stats">
        <div><b>{stopped}/{scams.length}</b><span>scams stopped</span></div>
        <div><b>{delayed}/{genuine.length}</b><span>genuine payments delayed</span></div>
        <div><b>1 tx</b><span>to block a repeat scam</span></div>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Scenario</th><th>Result</th></tr>
        </thead>
        <tbody>
          {rows.map(({ s, r }) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.title}</td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Scripted answers: this shows the system works as designed, not real-world accuracy.</p>
    </div>
  );
}

function icon(s: CheckState, n: number) {
  switch (s) {
    case "pass": return "✓";
    case "fail": return "✕";
    case "warn": return "!";
    case "skip": return "–";
    case "active": return "…";
    default: return n;
  }
}

function apply(v: View, ev: import("@/lib/scenarios").Ev): View {
  switch (ev.t) {
    case "phone": return { ...v, phone: { status: ev.status, note: ev.note } };
    case "check": return { ...v, checks: { ...v.checks, [ev.id]: { state: ev.state, detail: ev.detail } } };
    case "chat": return { ...v, chat: [...v.chat, { from: ev.from, text: ev.text }] };
    case "guardian": return { ...v, guardian: [...v.guardian, { text: ev.text, action: ev.action }] };
    case "chain": return { ...v, chain: [...v.chain, ev.text] };
    case "risk": return { ...v, risk: { risk: ev.risk, type: ev.type } };
  }
}
