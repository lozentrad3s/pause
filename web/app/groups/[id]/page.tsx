"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useNow } from "@/components/HoldCard";
import { txUrl } from "@/lib/near";
import { api, display, fmt, getLines, getPot, getReport, loadGroupGuest, makeSigner, short, type Line, type Pot, type Report } from "@/lib/groups-client";

interface Caps { treasurer: string | null; demo: boolean; members: string[]; blocked_vendor: string; plan: string; ai: boolean }
interface Msg { id: string; from: "bot" | "me" | "member"; who?: string; html: string; tx?: string | null; at: number }
interface Snap { status: string; contrib: Record<string, string>; lines: Record<string, { status: string; paid: string; note: string | null; refused: string | null; votes: number }> }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const STAGES: string[] = ["Proposed", "Approved", "Waiting", "Paid", "Confirmed"];

export default function GroupRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const potId = Number(id);
  const wallet = useWallet();
  const now = useNow();
  const [caps, setCaps] = useState<Caps | null>(null);
  const [pot, setPot] = useState<Pot | null | undefined>(undefined);
  const [lines, setLines] = useState<Line[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [refund, setRefund] = useState("0");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState("");
  const [plan, setPlan] = useState("");
  const [ask, setAsk] = useState("");
  const [tab, setTab] = useState<"chat" | "pot">("chat");
  const snap = useRef<Snap | null>(null);
  const hashes = useRef(new Map<number, string>());
  const paying = useRef(new Map<number, number>());
  const feedRef = useRef<HTMLDivElement>(null);
  const store = `pause-room-${potId}`;

  const guest = typeof window !== "undefined" ? loadGroupGuest() : null;
  const signer = makeSigner(wallet, guest);
  const me = signer?.account ?? null;
  const isMember = !!(me && pot?.members.includes(me));
  const demoPot = !!(caps?.demo && pot?.members.some((m) => caps.members.includes(m)));

  const push = useCallback((m: Omit<Msg, "id" | "at">) => {
    setMsgs((list) => {
      const next = [...list, { ...m, id: `${Date.now()}-${Math.random()}`, at: Date.now() }].slice(-150);
      try {
        sessionStorage.setItem(store, JSON.stringify({ msgs: next, snap: snap.current }));
      } catch {}
      return next;
    });
  }, [store]);

  // ----------------------------------------------------------- reading NEAR

  const diff = useCallback((p: Pot, ls: Line[], r: Report) => {
    const cur: Snap = {
      status: p.status,
      contrib: Object.fromEntries(p.contributions),
      lines: Object.fromEntries(ls.map((l) => [String(l.id), { status: l.status, paid: l.paid, note: l.vendor_note, refused: l.refused, votes: l.approvals.length }])),
    };
    const before = snap.current;
    snap.current = cur;
    const unpaid = r.unpaid_members.map(display).join(", ");
    if (!before) {
      push({ from: "bot", html: `🤝 Pause is following <b>${esc(p.name)}</b>. ${p.approvals_needed} of ${p.members.length} members must approve every payment, and each approved payment waits ${Math.round(p.hold_secs / 60)} min so anyone can object.` });
      for (const [who, v] of p.contributions) push({ from: "bot", html: `💰 <b>${display(who)}</b> paid ${fmt(v)} NEAR.` });
      for (const l of ls) push({ from: "bot", html: lineSummary(l, p) });
      return;
    }
    for (const [who, v] of Object.entries(cur.contrib)) {
      const was = BigInt(before.contrib[who] ?? "0");
      if (BigInt(v) > was) push({ from: "bot", html: `💰 <b>${display(who)}</b> paid ${fmt(BigInt(v) - was)} NEAR. Raised <b>${fmt(p.raised)} of ${fmt(p.goal)} NEAR</b>.${unpaid ? ` Still to pay: ${unpaid}.` : " Everyone has paid."}` });
    }
    for (const l of ls) {
      const b = before.lines[String(l.id)];
      const tag = `<b>${esc(l.label)}</b>, ${fmt(l.amount)} NEAR to <code>${esc(short(l.vendor))}</code>`;
      if (!b) {
        push({ from: "bot", html: `📝 New budget line: ${tag}. Proposed by ${display(l.proposed_by)}.${l.flagged ? `<br/>⚠️ <b>Pause flagged this:</b> ${esc(l.flagged)}` : ""}` });
        continue;
      }
      if (l.status === "Proposed" && l.approvals.length > b.votes) push({ from: "bot", html: `🗳️ ${tag}: ${l.approvals.length} of ${p.approvals_needed} approvals.` });
      if (b.status === "Proposed" && l.status === "Approved") push({ from: "bot", html: `✅ ${tag}, approved by ${l.approvals.length} of ${p.members.length}. Pays in about ${Math.round(p.hold_secs / 60)} min unless someone taps Object.` });
      if (b.status === "Approved" && l.status === "Proposed") push({ from: "bot", html: `✋ Someone objected to ${tag}. It goes back to a fresh vote.` });
      if (b.status === "Proposed" && l.status === "Rejected" && !l.refused) push({ from: "bot", html: `❌ The group rejected ${tag}.` });
      if (BigInt(l.paid) > BigInt(b.paid)) {
        const left = BigInt(l.amount) - BigInt(l.paid);
        push({ from: "bot", html: `💸 Paid <b>${esc(l.label)}</b>, ${fmt(BigInt(l.paid) - BigInt(b.paid))} NEAR.${left > 0n ? ` ${fmt(left)} NEAR left on this line.` : ""}`, tx: hashes.current.get(l.id) ?? null });
      }
      if (!b.refused && l.refused) push({ from: "bot", html: `🛑 I didn't pay <code>${esc(short(l.vendor))}</code>: ${esc(l.refused)}. Please vote on a different vendor.` });
      if (!b.note && l.vendor_note) push({ from: "bot", html: `📦 <b>${display(l.vendor)}</b> confirmed: ${esc(l.vendor_note)}` });
    }
    if (before.status !== cur.status && (cur.status === "Cancelled" || cur.status === "Closed")) {
      push({ from: "bot", html: `🏁 The pot is ${cur.status === "Cancelled" ? "cancelled" : "closed"}. ${fmt(BigInt(p.raised) - BigInt(p.spent))} NEAR goes back to contributors, split by what each paid in.` });
    }
  }, [push]);

  const load = useCallback(async () => {
    try {
      const [p, ls, r] = await Promise.all([getPot(potId), getLines(potId), getReport(potId)]);
      setPot(p);
      if (!p) return;
      setLines(ls);
      setReport(r);
      diff(p, ls, r);
      if (me) {
        const { view } = await import("@/lib/near");
        setRefund(await view<string>("get_refund", { pot_id: potId, who: me }));
      }
    } catch {
      // A slow RPC; the next poll tries again.
    }
  }, [potId, diff, me]);

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then(setCaps).catch(() => {});
    try {
      const saved = JSON.parse(sessionStorage.getItem(store) || "null");
      if (saved) {
        setMsgs(saved.msgs ?? []);
        snap.current = saved.snap ?? null;
      }
    } catch {}
  }, [store]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  // The treasurer pays approved lines once their hold window ends.
  useEffect(() => {
    if (!pot || !["Raising", "Spending"].includes(pot.status)) return;
    const due = lines.filter((l) => l.status === "Approved" && l.approved_at && now >= l.approved_at + pot.hold_secs + 3);
    const fresh = due.filter((l) => Date.now() - (paying.current.get(l.id) ?? 0) > 20000);
    if (!fresh.length) return;
    fresh.forEach((l) => paying.current.set(l.id, Date.now()));
    api<{ payments: { line: number; hash: string | null; refused?: string }[] }>({ action: "pay", pot: potId })
      .then((r) => {
        r.payments.forEach((p) => p.hash && hashes.current.set(p.line, p.hash));
        load();
      })
      .catch(() => {});
  }, [now, lines, pot, potId, load]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  // ---------------------------------------------------------------- actions

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      push({ from: "bot", html: `⚠️ ${esc((e as Error).message)}` });
    } finally {
      setBusy("");
      load();
    }
  };

  const sign = async (method: string, args: object, deposit = "0", say?: string) => {
    if (!signer) throw new Error("Connect a wallet first.");
    if (say) push({ from: "me", html: esc(say) });
    const r = await signer.call(method, args, deposit);
    return r.hash;
  };

  const contribute = () => run("Paying your share", async () => {
    const share = pot?.contribution_each ?? "0";
    if (BigInt(share) === 0n) throw new Error("This pot has no fixed share.");
    const h = await sign("contribute", { pot_id: potId }, share, `Paying my share: ${fmt(share)} NEAR`);
    push({ from: "bot", html: "Signed on NEAR.", tx: h });
  });

  const vote = (l: Line, kind: "approve_line" | "reject_line" | "object") => run("Voting", async () => {
    const words = { approve_line: "Approve", reject_line: "Reject", object: "Object" }[kind];
    const h = await sign(kind, { line_id: l.id }, "0", `${words}: ${l.label}`);
    push({ from: "bot", html: `Your ${words.toLowerCase()} is recorded on NEAR.`, tx: h });
    if (demoPot && kind !== "object") {
      const r = await api<{ acts: { who: string; what: string; hash: string | null; error?: string }[] }>({ action: "vote", pot: potId, line: l.id, approve: kind === "approve_line" });
      for (const a of r.acts) push({ from: "member", who: display(a.who), html: a.error ? `Couldn't vote: ${esc(a.error)}` : `${a.what === "approved" ? "Approve" : "Reject"} ✔️`, tx: a.hash });
    }
  });

  const sendPlan = () => run("Reading the plan", async () => {
    push({ from: "me", html: `/plan ${esc(plan)}` });
    const r = await api<{ plan: { questions: string[]; warnings: string[]; source: string }; proposed: { line: number; label: string; hash: string | null }[]; errors: string[] }>({ action: "plan", pot: potId, text: plan });
    const parts = [`🧮 I read the plan${r.plan.source === "ai" ? " privately on NEAR AI Cloud" : ""} and proposed ${r.proposed.length} line${r.proposed.length === 1 ? "" : "s"}. Each needs your votes; I can't approve anything.`];
    if (r.plan.questions.length) parts.push(`<b>I need the group to decide:</b><br/>${r.plan.questions.map((q) => `• ${esc(q)}`).join("<br/>")}`);
    if (r.plan.warnings.length) parts.push(`<b>Please check:</b><br/>${r.plan.warnings.map((w) => `⚠️ ${esc(w)}`).join("<br/>")}`);
    if (r.errors.length) parts.push(r.errors.map((e) => `Couldn't propose ${esc(e)}`).join("<br/>"));
    push({ from: "bot", html: parts.join("<br/><br/>"), tx: r.proposed[0]?.hash });
    setPlan("");
  });

  const sendAsk = () => run("Asking", async () => {
    push({ from: "me", html: esc(ask) });
    const history = msgs.filter((m) => m.from !== "member").slice(-10).map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: m.html.replace(/<[^>]+>/g, " ") }));
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pot: potId, messages: [...history, { role: "user", content: ask }] }) }).then((x) => x.json());
    push({ from: "bot", html: esc(r.reply ?? r.error ?? "Sorry, try again.").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br/>") });
    setAsk("");
  });

  const remind = () => run("Reminding", async () => {
    push({ from: "me", html: "Remind the others" });
    push({ from: "bot", html: "👋 I've sent a private reminder to everyone who hasn't paid. No public shaming." });
    const r = await api<{ acts: { who: string; hash: string | null; error?: string }[] }>({ action: "remind", pot: potId });
    if (!r.acts.length) push({ from: "bot", html: "Everyone in the demo has already paid." });
  });

  const addPlug = () => run("Proposing", async () => {
    push({ from: "me", html: "Can we add my guy for drinks? drinks-plug, 0.03 NEAR. Cheaper!" });
    await api({ action: "propose", pot: potId, vendor: caps!.blocked_vendor, label: "Cheap drinks", amount: "0.03" });
  });

  const confirm = (l: Line) => run("Vendor confirming", async () => {
    const r = await api<{ act: { hash: string | null } }>({ action: "confirm", pot: potId, line: l.id });
    push({ from: "member", who: display(l.vendor), html: "Signed the delivery confirmation.", tx: r.act.hash });
  });

  const cancel = () => run("Voting to cancel", async () => {
    const h = await sign("propose_cancel", { pot_id: potId }, "0", "I vote to cancel the event and refund everyone.");
    push({ from: "bot", html: `Vote recorded. ${pot!.approvals_needed} of ${pot!.members.length} members must agree.`, tx: h });
  });

  const claim = () => run("Claiming", async () => {
    const h = await sign("claim_refund", { pot_id: potId }, "0", "Claiming my refund");
    push({ from: "bot", html: `Refund of ${fmt(refund)} NEAR sent to you.`, tx: h });
  });

  // ------------------------------------------------------------------ render

  if (pot === undefined) return <main className="wrap app-page"><div className="skeleton" /></main>;
  if (pot === null) return <main className="wrap app-page"><h1>No pot #{potId}</h1><Link className="btn" href="/groups">Back to groups</Link></main>;

  const raisedPct = Math.min(100, Number((BigInt(pot.raised) * 1000n) / (BigInt(pot.goal) || 1n)) / 10);
  const open = ["Raising", "Spending"].includes(pot.status);
  const myShare = me ? pot.contributions.find(([a]) => a === me)?.[1] ?? "0" : "0";
  const owes = isMember && pot.contribution_each && BigInt(myShare) < BigInt(pot.contribution_each);

  return (
    <main id="main" className="wrap app-page room">
      {demoPot && <div className="banner">Demo members are run by our server. Every transaction is real, on NEAR testnet.</div>}
      {!me && <div className="banner">Viewing read-only. <button className="linkbtn" onClick={wallet.signIn}>Connect a wallet</button> to vote if you&apos;re a member.</div>}

      <header className="room-head">
        <div>
          <h1>{pot.name}</h1>
          <p className="muted">{({ Raising: "Collecting money", Spending: "Paying vendors", Closed: "Finished", Cancelled: "Cancelled" } as Record<string, string>)[pot.status]} · {pot.approvals_needed} of {pot.members.length} must approve each payment · {Math.round(pot.hold_secs / 60)} min to object · treasurer <code>{short(pot.agent)}</code></p>
        </div>
        <div className="seg room-tabs" role="tablist">
          <button className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>Chat</button>
          <button className={tab === "pot" ? "on" : ""} onClick={() => setTab("pot")}>Pot</button>
        </div>
      </header>

      <div className={`room-grid show-${tab}`}>
        {/* Chat feed: what the bot posts in the group */}
        <section className="card feed-card" aria-label="Group chat">
          <div className="feed-top"><span className="feed-avatar">P</span><div><b>{pot.name}</b><span className="muted small"> · Pause is in this group</span></div></div>
          <div className="feed" ref={feedRef} aria-live="polite">
            {msgs.map((m) => (
              <div key={m.id} className={`fmsg ${m.from}`}>
                {m.from !== "me" && <span className="fwho">{m.from === "bot" ? "Pause" : m.who}</span>}
                <div className="fbubble">
                  <span dangerouslySetInnerHTML={{ __html: m.html }} />
                  {m.tx && <a className="ftx" href={txUrl(m.tx)} target="_blank" rel="noreferrer">View on NEAR ↗</a>}
                </div>
              </div>
            ))}
            {busy && <div className="fmsg bot"><div className="fbubble typing">Pause is typing…</div></div>}
          </div>
          {open && (
            <div className="composer">
              <div className="composer-row">
                <input aria-label="Plan" placeholder="/plan Hall: hall-owner.testnet 6 NEAR. Food: …" value={plan} onChange={(e) => setPlan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && plan.length > 9 && sendPlan()} />
                <button className="btn small-btn" onClick={sendPlan} disabled={!!busy || plan.length < 10}>Plan</button>
              </div>
              <div className="composer-row">
                <input aria-label="Ask" placeholder="Ask Pause anything: who hasn't paid? where should we go?" value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask && sendAsk()} />
                <button className="btn small-btn" onClick={sendAsk} disabled={!!busy || !ask}>Ask</button>
              </div>
              <div className="quick">
                {demoPot && lines.length === 0 && <button className="chip" onClick={() => setPlan(caps!.plan.replace(/\n/g, " "))}>Use the reunion plan</button>}
                {demoPot && report && report.unpaid_members.some((m) => caps!.members.includes(m)) && <button className="chip" onClick={remind} disabled={!!busy}>Remind the others</button>}
                {demoPot && lines.length > 0 && !lines.some((l) => l.vendor === caps!.blocked_vendor) && <button className="chip" onClick={addPlug} disabled={!!busy}>Add the drinks plug</button>}
                <button className="chip" onClick={() => setAsk("How much is left?")}>How much is left?</button>
              </div>
            </div>
          )}
        </section>

        {/* Pot panel */}
        <section className="pot-panel" aria-label="Pot">
          <div className="card pot-summary">
            <div className="raised-ring" style={{ ["--pct" as string]: `${raisedPct}%` }}>
              <div><b className="figure">{fmt(pot.raised)}</b><span>of {fmt(pot.goal)} NEAR</span></div>
            </div>
            <dl className="pot-figs">
              <div><dt>Paid out</dt><dd className="figure">{fmt(pot.spent)}</dd></div>
              <div><dt>Approved, waiting</dt><dd className="figure">{report ? fmt(report.approved) : "–"}</dd></div>
              <div><dt>Not promised yet</dt><dd className="figure">{report ? fmt(report.uncommitted) : "–"}</dd></div>
            </dl>
            {owes && open && <button className="btn primary" onClick={contribute} disabled={!!busy}>Pay my share · {fmt(pot.contribution_each!)} NEAR</button>}
            {BigInt(refund) > 0n && <button className="btn primary" onClick={claim} disabled={!!busy}>Claim my refund · {fmt(refund)} NEAR</button>}
          </div>

          <div className="card members-card">
            <h3>Members</h3>
            <ul className="members">
              {pot.members.map((m) => {
                const paid = pot.contributions.find(([a]) => a === m)?.[1] ?? "0";
                const done = pot.contribution_each ? BigInt(paid) >= BigInt(pot.contribution_each) : BigInt(paid) > 0n;
                return (
                  <li key={m} className={done ? "paid" : ""}>
                    <span className="avatar-s" aria-hidden>{display(m)[0]}</span>
                    <span>{display(m)}{m === me ? " (you)" : ""}{m === pot.organizer ? <em> organizer</em> : null}</span>
                    <span className="figure small">{done ? `✓ ${fmt(paid)}` : BigInt(paid) > 0n ? fmt(paid) : "–"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card lines-card">
            <h3>Budget</h3>
            {lines.length === 0 && <p className="muted small">No budget lines yet. Send a /plan in the chat.</p>}
            <ol className="lines">
              {lines.map((l) => {
                const holdEnd = (l.approved_at ?? 0) + pot.hold_secs;
                const waiting = l.status === "Approved" && now < holdEnd;
                const stage = l.status === "Proposed" ? 0 : l.status === "Approved" ? (waiting ? 2 : 1) : l.status === "Paid" ? (l.vendor_note ? 4 : 3) : -1;
                const mine = me ? l.approvals.includes(me) || l.rejections.includes(me) : false;
                return (
                  <li key={l.id} className={`line ls-${l.status}`}>
                    <div className="line-top">
                      <div><b>{l.label}</b><span className="muted small"> · <code>{short(l.vendor)}</code></span></div>
                      <span className="figure">{fmt(l.paid)}/{fmt(l.amount)}</span>
                    </div>
                    {l.status === "Rejected" ? (
                      <p className="small line-refused">{l.refused ? `Refused: ${l.refused}` : "Rejected by the group"}</p>
                    ) : (
                      <ol className="stages-mini" aria-label={`Stage: ${STAGES[Math.max(0, stage)]}`}>
                        {STAGES.map((s, i) => <li key={s} className={i <= stage ? "on" : ""}>{s}</li>)}
                      </ol>
                    )}
                    {l.flagged && <p className="small line-flag">⚠️ {l.flagged}</p>}
                    {l.status === "Proposed" && <p className="small muted">{l.approvals.length} of {pot.approvals_needed} approvals</p>}
                    {waiting && <p className="small">Pays in <b className="figure">{Math.max(0, Math.ceil(holdEnd - now))}s</b> unless someone objects</p>}
                    {l.status === "Approved" && !waiting && <p className="small muted">Hold over. The treasurer is paying…</p>}
                    {l.vendor_note && <p className="small">📦 {l.vendor_note}</p>}
                    <div className="line-actions">
                      {isMember && l.status === "Proposed" && !mine && (
                        <>
                          <button className="btn small-btn primary" onClick={() => vote(l, "approve_line")} disabled={!!busy}>Approve</button>
                          <button className="btn small-btn" onClick={() => vote(l, "reject_line")} disabled={!!busy}>Reject</button>
                        </>
                      )}
                      {isMember && waiting && <button className="btn small-btn danger" onClick={() => vote(l, "object")} disabled={!!busy}>Object</button>}
                      {demoPot && BigInt(l.paid) > 0n && !l.vendor_note && <button className="btn small-btn" onClick={() => confirm(l)} disabled={!!busy}>Vendor confirms</button>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {isMember && open && <button className="linkbtn small" onClick={cancel} disabled={!!busy}>Vote to cancel the event and refund everyone</button>}
        </section>
      </div>
    </main>
  );
}

function lineSummary(l: Line, p: Pot): string {
  const tag = `<b>${esc(l.label)}</b>, ${fmt(l.amount)} NEAR to <code>${esc(short(l.vendor))}</code>`;
  if (l.status === "Proposed") return `📝 ${tag}: ${l.approvals.length} of ${p.approvals_needed} approvals.`;
  if (l.status === "Approved") return `✅ ${tag}, approved.`;
  if (l.status === "Paid") return `💸 Paid ${tag}.${l.vendor_note ? ` 📦 ${esc(l.vendor_note)}` : ""}`;
  return l.refused ? `🛑 Didn't pay ${tag}: ${esc(l.refused)}` : `❌ Rejected: ${tag}.`;
}
