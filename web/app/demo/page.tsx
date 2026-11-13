"use client";

// The judge path. One button gives a visitor two real testnet accounts, an
// owner and their guardian, shown as two phones. Every button below sends a
// real transaction signed in this browser, and links to it on the explorer.

import { useLang } from "@/lib/lang";
import Photo from "@/components/Photo";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ProofBadge from "@/components/ProofBadge";
import Ring from "@/components/Ring";
import { useNow } from "@/components/HoldCard";
import type { Analysis } from "@/lib/analyzer";
import { SCAM_NAMES } from "@/lib/analyzer";
import { closeGuest, createGuest, friendly, GUEST, guestCall, loadGuest, signInterview, type GuestSet } from "@/lib/guest";
import { LANGS, QUESTIONS, type Lang } from "@/lib/i18n";
import { fromYocto, toYocto, txUrl, until, view, type Hold, type RegistryEntry, type Vault } from "@/lib/near";

interface LogLine {
  id: number;
  who: "Grace" | "Her son" | "Pause agent" | "Setup";
  text: string;
  hash: string | null;
}

interface InterviewResult {
  level: "Low" | "Medium" | "High";
  scam_type: string | null;
  reasons: string[];
  tx: string | null;
  note?: string;
  analysis: Analysis;
}

// One tap fills an answer. The first set is what a coached victim says; the
// second is an ordinary payment. Judges can also type their own.
const SCRIPTED = [
  ["My trading mentor's exchange. He's teaching me.", "A deposit for a second-hand bike I went to see.", "I don't know. I didn't make this payment."],
  ["He messaged me on Instagram last month.", "I found the advert and contacted the seller.", "Nobody. I clicked a link to claim an airdrop and my wallet asked me to sign."],
  ["He said not to tell my family until the profits come in.", "No, my son knows about it.", "No."],
  ["Yes, the bonus round closes today.", "No, there's no rush.", "The page said the claim closes in ten minutes."],
  ["He promised 3% a day.", "No, nothing like that.", "It said I would receive free tokens."],
  ["Yes, he's on WhatsApp with me right now.", "No, I'm on my own.", "No, I'm on my own."],
];
const SCRIPT_NAMES = ["Coached victim", "Ordinary payment", "I didn't send this"];

const short = (id: string) => (id.length > 26 ? `${id.slice(0, 14)}…${id.slice(-8)}` : id);

export default function DemoPage() {
  const [guest, setGuest] = useState<GuestSet | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [vault, setVault] = useState<Vault | null>(null);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [reported, setReported] = useState<RegistryEntry | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [tab, setTab] = useState<"owner" | "guardian">("owner");
  const { lang, setLang } = useLang();
  const [interview, setInterview] = useState<{ holdId: number; answers: string[]; draft: string; sending: boolean } | null>(null);
  const [verdicts, setVerdicts] = useState<Record<number, InterviewResult>>({});
  const [sets, setSets] = useState<number | null>(null);
  const logId = useRef(0);
  const now = useNow();

  const note = useCallback((who: LogLine["who"], text: string, hash: string | null = null) => {
    setLog((l) => [{ id: ++logId.current, who, text, hash }, ...l].slice(0, 30));
  }, []);

  useEffect(() => {
    const g = loadGuest();
    if (g?.vaultReady) setGuest(g);
    setLoaded(true);
    fetch("/api/guest").then((r) => r.json()).then((d) => setSets(d.enabled ? d.sets : -1)).catch(() => setSets(null));
  }, []);

  const refresh = useCallback(async () => {
    if (!guest) return;
    try {
      const [v, h, r] = await Promise.all([
        view<Vault | null>("get_vault", { owner: guest.owner }),
        view<Hold[]>("get_holds", { owner: guest.owner, from_index: 0, limit: 20 }),
        view<RegistryEntry | null>("get_registry_entry", { receiver: guest.known_scammer }),
      ]);
      setVault(v);
      setHolds(h);
      setReported(r);
    } catch {
      // A missed poll is fine; the next one is two seconds away.
    }
  }, [guest]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  const start = async () => {
    setError("");
    setStep("Starting");
    try {
      const g = await createGuest(setStep);
      setGuest(g);
      g.txs.forEach((hash, i) => note("Setup", ["Created Grace's account", "Created her son's account", "Opened Grace's vault with her son as guardian"][i] ?? "Setup", hash));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setStep("");
    }
  };

  const startOver = async () => {
    if (!guest) return;
    setBusy("reset");
    await closeGuest(guest);
    setGuest(null);
    setVault(null);
    setHolds([]);
    setLog([]);
    setVerdicts({});
    setInterview(null);
    setBusy("");
  };

  /** Runs one signed call and records it in the log. */
  const act = async (key: string, who: "owner" | "guardian", method: string, args: object, sentence: string) => {
    if (!guest) return null;
    setBusy(key);
    setError("");
    try {
      const res = await guestCall<{ outcome?: string; hold_id?: number }>(
        who === "owner" ? guest.owner : guest.guardian,
        who === "owner" ? guest.ownerKey : guest.guardianKey,
        method,
        args,
      );
      const outcome = res.value?.outcome;
      note(who === "owner" ? "Grace" : "Her son", outcome ? `${sentence}: ${outcome === "paid" ? "paid at once" : outcome === "held" ? "held by Pause" : "blocked by the registry"}` : sentence, res.hash);
      await refresh();
      return res;
    } catch (e) {
      setError(friendly(e));
      return null;
    } finally {
      setBusy("");
    }
  };

  const pay = (key: string, receiver: string, amount: string, sentence: string, memo?: string) =>
    act(key, "owner", "send", { receiver, amount: toYocto(amount), memo: memo ?? null }, sentence);

  const answer = async (text: string) => {
    if (!interview || !guest || !text.trim()) return;
    const answers = [...interview.answers, text.trim()];
    if (answers.length < QUESTIONS[lang].length) return setInterview({ ...interview, answers, draft: "" });
    setInterview({ ...interview, answers, draft: "", sending: true });
    try {
      const signed = await signInterview(guest.ownerKey, interview.holdId, answers);
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hold_id: interview.holdId, answers, lang, ...signed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The check didn't finish.");
      setVerdicts((v) => ({ ...v, [interview.holdId]: data }));
      note("Pause agent", `Recorded a ${data.level} risk verdict${data.tx ? "" : " (not written on chain)"}`, data.tx);
      await refresh();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setInterview(null);
    }
  };

  // ------------------------------------------------------------------ render

  if (!loaded) return <main id="main" className="wrap demo-page"><div className="skeleton" /></main>;

  if (!guest) {
    return (
      <main id="main" className="wrap demo-page">
        <section className="demo-intro with-photo">
          <div>
          <h1>Stop a scam yourself, in two minutes</h1>
          <p className="lede">
            You&apos;ll play Grace, who is about to pay a stranger, and her son, who can stop it. Both are real accounts on NEAR
            testnet, made for you now. No wallet, no sign-up, no real money.
          </p>
          <ol className="demo-steps">
            <li><b>Pay your usual shop.</b> It goes straight through.</li>
            <li><b>Pay a &ldquo;trading mentor&rdquo;.</b> Pause holds it, asks six questions, and shows proof the AI ran privately.</li>
            <li><b>Be the son.</b> Stop the payment, then report the scammer so every other vault is warned.</li>
          </ol>
          <button className="btn primary big" onClick={start} disabled={!!step || sets === 0}>
            {step ? `${step}…` : "Try as a judge"}
          </button>
          {step && <p className="muted small" aria-live="polite">This takes about ten seconds: three real transactions on NEAR testnet.</p>}
          {sets === 0 && <p className="notice">All demo accounts are in use right now. Please try again in a few minutes, or connect your own testnet wallet on the <Link href="/vault">vault page</Link>.</p>}
          {sets === -1 && <p className="notice">Guest accounts aren&apos;t switched on for this deployment. You can connect a testnet wallet on the <Link href="/vault">vault page</Link>, or run <code>npm run judge</code> from the repository.</p>}
          {error && <p className="notice bad" role="alert">{error}</p>}
        </div>
          <Photo name="showing-phone" alt="A smiling woman holding her phone up to the camera" ratio="3 / 4" pos="center 20%" priority />
        </section>
      </main>
    );
  }

  const pending = holds.filter((h) => h.status === "Pending");
  const past = holds.filter((h) => h.status !== "Pending").slice(0, 4);
  const reports = reported?.reports ?? 0;

  const ownerPhone = (
    <section className="dphone" aria-label="Grace's phone">
      <header className="dphone-head">
        <div>
          <b>Grace</b>
          <span className="mono">{short(guest.owner)}</span>
        </div>
        <span className="shield">Protected by her son</span>
      </header>
      <div className="dbalance">
        <span>In her vault</span>
        <b>{vault ? fromYocto(vault.balance, 3) : "…"} <i>NEAR</i></b>
      </div>

      <div className="dactions">
        <button className="dpay" disabled={!!busy} onClick={() => pay("shop", guest.shop, "0.01", "Grace paid her usual shop 0.01 NEAR")}>
          <b>Pay your usual shop</b>
          <span>0.01 NEAR to a trusted payee</span>
          <em>{busy === "shop" ? "Sending…" : "Expect: paid at once"}</em>
        </button>
        <button className="dpay" disabled={!!busy} onClick={() => pay("stranger", guest.stranger, "0.06", "Grace sent 0.06 NEAR to a new “trading mentor”", "Bonus round deposit")}>
          <b>Pay a &ldquo;trading mentor&rdquo;</b>
          <span>0.06 NEAR to someone she has never paid</span>
          <em>{busy === "stranger" ? "Sending…" : "Expect: held"}</em>
        </button>
        <button className="dpay" disabled={!!busy} onClick={() => pay("drainer", guest.stranger.replace("fastgain-", "airdrop-claim-"), "0.08", "A wallet drainer signed a 0.08 NEAR payment with Grace's key", "Claim airdrop")}>
          <b>A payment Grace never made</b>
          <span>She clicked a fake airdrop link. The drainer sends 0.08 NEAR from her vault.</span>
          <em>{busy === "drainer" ? "Sending…" : "Expect: held, and her son is told"}</em>
        </button>
        <button className="dpay" disabled={!!busy} onClick={() => pay("known", guest.known_scammer, "0.03", "Grace tried to pay an address other people reported")}>
          <b>Pay a reported address</b>
          <span>{reports === 0 ? "Nobody has reported it yet" : `Reported by ${reports} vault${reports > 1 ? "s" : ""}`}</span>
          <em>{busy === "known" ? "Sending…" : reports >= 3 ? "Expect: blocked" : reports > 0 ? "Expect: held at High risk" : "Expect: held"}</em>
        </button>
      </div>

      {pending.map((h) => {
        const total = Math.max(1, h.release_at - h.created_at);
        const left = Math.max(0, h.release_at - now);
        const ready = left === 0 || h.guardian_approved;
        const v = verdicts[h.id];
        const talking = interview?.holdId === h.id;
        return (
          <article key={h.id} className={`dhold risk-${h.risk}`}>
            <div className="dhold-top">
              <Ring fraction={left / total} label={ready ? "Ready" : until(h.release_at, now)} tone={h.risk === "High" ? "high" : "held"} size={108} />
              <div>
                <h3>We&apos;ve paused this payment</h3>
                <p>
                  <b>{fromYocto(h.amount, 3)} NEAR</b> to <span className="mono">{short(h.receiver)}</span>. Nothing has left her account.
                </p>
                <p className="dhold-state">
                  {h.risk === "High"
                    ? h.guardian_approved ? "High risk, but her son approved it." : "High risk. Her son has been told and must approve it."
                    : h.risk === "Unknown" ? "Pause would like to ask a few questions first." : `${h.risk} risk.`}
                </p>
              </div>
            </div>

            {v && (
              <div className="dverdict">
                <p className={`dverdict-level lvl-${v.level}`}>
                  {v.level} risk{v.scam_type ? ` · ${SCAM_NAMES[v.scam_type] ?? v.scam_type}` : ""}
                </p>
                <p>{v.analysis.verdict.summary}</p>
                {v.analysis.verdict.red_flags.length > 0 && (
                  <ul>{v.analysis.verdict.red_flags.slice(0, 3).map((f, i) => <li key={i}><q>{f.quote}</q> {f.why}</li>)}</ul>
                )}
                <ProofBadge analysis={v.analysis} />
                {v.tx ? <a className="txlink" href={txUrl(v.tx)} target="_blank" rel="noreferrer">The agent&apos;s set_risk transaction</a> : v.note && <p className="muted small">{v.note}</p>}
              </div>
            )}

            {talking && interview && (
              <div className="dchat" aria-live="polite">
                {interview.answers.map((a, i) => (
                  <div key={i}>
                    <p className="bubble them">{QUESTIONS[lang][i]}</p>
                    <p className="bubble me">{a}</p>
                  </div>
                ))}
                {interview.sending ? (
                  <p className="bubble them thinking"><span className="spinner" /> Checking privately on NEAR AI Cloud…</p>
                ) : (
                  <>
                    <p className="bubble them">{QUESTIONS[lang][interview.answers.length]}</p>
                    <div className="quick">
                      {SCRIPTED[interview.answers.length].map((s, i) => (
                        <button key={s} className="chip" onClick={() => answer(s)}>
                          <small>{SCRIPT_NAMES[i]}</small>
                          {s}
                        </button>
                      ))}
                    </div>
                    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); answer(interview.draft); }}>
                      <label className="sr-only" htmlFor="ans">Your own answer</label>
                      <input id="ans" value={interview.draft} onChange={(e) => setInterview({ ...interview, draft: e.target.value })} placeholder="Or type your own answer" maxLength={300} />
                      <button className="btn small-btn" disabled={!interview.draft.trim()}>Send</button>
                    </form>
                  </>
                )}
              </div>
            )}

            {!talking && (
              <div className="hold-actions">
                {!v && h.risk !== "High" && (
                  <button className="btn small-btn primary" disabled={!!busy} onClick={() => setInterview({ holdId: h.id, answers: [], draft: "", sending: false })}>Answer Pause&apos;s questions</button>
                )}
                {ready && (h.risk !== "High" || h.guardian_approved) && (
                  <button className="btn small-btn" disabled={!!busy} onClick={() => act(`rel${h.id}`, "owner", "release", { hold_id: h.id }, "Grace released the payment after the wait")}>Pay it now</button>
                )}
                <button className="btn small-btn" disabled={!!busy} onClick={() => act(`can${h.id}`, "owner", "cancel", { hold_id: h.id }, "Grace cancelled the payment; the money went back to her vault")}>Cancel payment</button>
                <button className="btn small-btn danger" disabled={!!busy} onClick={() => act(`scam${h.id}`, "owner", "confirm_scam", { hold_id: h.id }, "Grace reported the receiver as a scam")}>This was a scam</button>
              </div>
            )}
          </article>
        );
      })}

      {past.length > 0 && (
        <ul className="dpast">
          {past.map((h) => (
            <li key={h.id}>
              <span className={`pill s-${h.status}`}>{h.status === "Released" ? "Paid" : h.status === "Vetoed" ? "Stopped by her son" : h.status}</span>
              {fromYocto(h.amount, 3)} NEAR to <span className="mono">{short(h.receiver)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const guardianPhone = (
    <section className="dphone guardian" aria-label="Her son's phone">
      <header className="dphone-head">
        <div>
          <b>Her son</b>
          <span className="mono">{short(guest.guardian)}</span>
        </div>
        <span className="shield">Guardian</span>
      </header>
      {pending.length === 0 ? (
        <div className="dempty">
          <Ring fraction={1} label="All quiet" tone="done" size={96} />
          <p>Nothing needs you. When Grace sends a payment Pause holds, it appears here.</p>
          <p className="muted small">A guardian can stop a payment or let it through. A guardian can never take the money or send it anywhere else.</p>
        </div>
      ) : (
        pending.map((h) => (
          <article key={h.id} className={`dhold risk-${h.risk}`}>
            <h3>Mum is sending {fromYocto(h.amount, 3)} NEAR</h3>
            <p>
              To <span className="mono">{short(h.receiver)}</span>, an account she has never paid.
              {h.memo && <> Her note: <q>{h.memo}</q>.</>}
            </p>
            <p className="dhold-state">
              {h.risk === "Unknown" ? "Pause is still checking." : `Pause says: ${h.risk} risk${h.scam_type ? `, looks like ${(SCAM_NAMES[h.scam_type] ?? h.scam_type).toLowerCase()}` : ""}.`}
              {h.guardian_approved ? " You approved it." : ` Pays out in ${until(h.release_at, now)} unless you act.`}
            </p>
            <p className="muted small">Call her first. Then choose.</p>
            <div className="hold-actions">
              <button className="btn small-btn danger" disabled={!!busy} onClick={() => act(`veto${h.id}`, "guardian", "veto", { hold_id: h.id }, "Her son stopped the payment; the money stayed in her vault")}>Stop it</button>
              <button className="btn small-btn" disabled={!!busy} onClick={() => act(`ext${h.id}`, "guardian", "extend_hold", { hold_id: h.id, secs: 120 }, "Her son added two minutes to the hold")}>Give it more time</button>
              {!h.guardian_approved && <button className="btn small-btn" disabled={!!busy} onClick={() => act(`app${h.id}`, "guardian", "approve_early", { hold_id: h.id }, "Her son approved the payment")}>It&apos;s fine, approve</button>}
              <button className="btn small-btn danger" disabled={!!busy} onClick={() => act(`gscam${h.id}`, "guardian", "confirm_scam", { hold_id: h.id }, "Her son reported the receiver as a scam")}>Report as a scam</button>
            </div>
          </article>
        ))
      )}
    </section>
  );

  return (
    <main id="main" className="wrap demo-page">
      <div className="guestbar" role="status">
        <span>Testnet demo accounts. No real money.</span>
        <label>
          <span className="sr-only">Interview language</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} disabled={!!interview}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <button className="linkbtn" onClick={startOver} disabled={!!busy}>{busy === "reset" ? "Closing accounts…" : "Start over"}</button>
      </div>

      {error && <p className="notice bad" role="alert">{error}</p>}

      <div className="dtabs" role="tablist">
        <button role="tab" aria-selected={tab === "owner"} className={tab === "owner" ? "on" : ""} onClick={() => setTab("owner")}>Grace</button>
        <button role="tab" aria-selected={tab === "guardian"} className={tab === "guardian" ? "on" : ""} onClick={() => setTab("guardian")}>
          Her son{pending.length > 0 && <span className="tab-count">{pending.length}</span>}
        </button>
      </div>
      <div className={`dphones show-${tab}`}>
        {ownerPhone}
        {guardianPhone}
      </div>

      <section className="dlog">
        <h2>What happened on NEAR</h2>
        <p className="muted small">Every line is a real transaction on testnet. Holds last {GUEST.holdSecs / 60} minutes here so you don&apos;t have to wait a day.</p>
        {log.length === 0 ? (
          <p className="empty-line muted">Press a payment above. Each transaction will be listed here with a link to the explorer.</p>
        ) : (
          <ol>
            {log.map((l) => (
              <li key={l.id}>
                <span className="dlog-who">{l.who}</span>
                <span>{l.text}</span>
                {l.hash && <a href={txUrl(l.hash)} target="_blank" rel="noreferrer">View transaction</a>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
