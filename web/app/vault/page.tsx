"use client";

import Photo from "@/components/Photo";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import HoldCard, { useNow } from "@/components/HoldCard";
import { useWallet } from "@/lib/wallet";
import { AGENT, CONTRACT, duration, fromYocto, toYocto, until, view, type Hold, type Vault } from "@/lib/near";

const DEMO_OWNER = "amina.pause-demo.testnet";

export default function VaultPage() {
  return (
    <Suspense fallback={<main id="main" className="wrap app-page"><p className="muted">Loading…</p></main>}>
      <VaultInner />
    </Suspense>
  );
}

function VaultInner() {
  const params = useSearchParams();
  const { accountId, signIn, call, ready } = useWallet();
  const viewing = params.get("view") || accountId;
  const readOnly = !accountId || viewing !== accountId;

  const [vault, setVault] = useState<Vault | null | undefined>(undefined);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!viewing) return;
    try {
      const [v, h] = await Promise.all([view<Vault | null>("get_vault", { owner: viewing }), view<Hold[]>("get_holds", { owner: viewing, limit: 30 })]);
      setVault(v);
      setHolds(h);
    } catch {
      setVault(null);
    }
  }, [viewing]);

  useEffect(() => {
    setVault(undefined);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (label: string, method: string, args: object = {}, deposit = "0") => {
    setBusy(label);
    setToast("");
    try {
      await call(method, args, deposit);
      setToast(`${label}: done`);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message.slice(0, 160) : "Something went wrong");
    } finally {
      setBusy("");
    }
  };

  if (!viewing) {
    return (
      <main id="main" className="wrap app-page">
        <section className="empty-hero with-photo">
          <div>
          <span className="empty-icon" aria-hidden><svg width="22" height="22" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1.5" fill="currentColor" /><rect x="14" y="4" width="4" height="16" rx="1.5" fill="currentColor" /></svg></span>
          <h1>Your money, with a pause button.</h1>
          <p className="lede">Connect a NEAR testnet wallet to open your vault. Payments to people you trust go through instantly. Everything else waits for a quick check.</p>
          <div className="hero-cta">
            <button className="btn primary" onClick={signIn} disabled={!ready}>Connect wallet</button>
            <Link className="btn" href={`/vault?view=${DEMO_OWNER}`}>See Amina&apos;s vault (demo)</Link>
          </div>
        </div>
          <Photo name="city-phone" alt="A woman in a green jacket checking her phone outside an office" ratio="1 / 1" pos="center" priority />
        </section>
      </main>
    );
  }

  if (vault === undefined) return <main id="main" className="wrap app-page"><div className="skeleton" /><div className="skeleton short" /></main>;

  if (vault === null) {
    return readOnly ? (
      <main id="main" className="wrap app-page"><h1>No vault for {viewing}</h1><Link className="btn" href={`/vault?view=${DEMO_OWNER}`}>See the demo vault</Link></main>
    ) : (
      <CreateVault onCreate={(args, deposit) => act("Vault opened", "create_vault", args, deposit)} busy={!!busy} toast={toast} />
    );
  }

  const pending = holds.filter((h) => h.status === "Pending");
  const past = holds.filter((h) => h.status !== "Pending");

  return (
    <main id="main" className="wrap app-page">
      {readOnly && (
        <div className="banner">
          Viewing <b>{viewing}</b> read-only.{" "}
          {accountId ? <Link href="/vault">Back to my vault</Link> : <button className="linkbtn" onClick={signIn}>Connect your wallet</button>} to open your own.
        </div>
      )}

      <section className="vault-head">
        <div className="balance-card">
          <p className="balance-label">Balance</p>
          <div className="balance">{fromYocto(vault.balance)} <span>NEAR</span></div>
          <div className="balance-meta">
            <span>Instant up to <b>{fromYocto(vault.instant_limit)} NEAR</b></span>
            <span>Daily cap <b>{fromYocto(vault.daily_instant_cap)} NEAR</b> ({fromYocto(vault.spent_today)} used)</span>
            <span>Holds last <b>{duration(vault.hold_secs)}</b></span>
          </div>
          {!readOnly && <DepositForm onDeposit={(amt) => act("Deposit", "deposit", {}, toYocto(amt))} busy={busy === "Deposit"} />}
        </div>
        <SendForm vault={vault} readOnly={readOnly} onConnect={signIn} busy={busy === "Payment sent"} onSend={(receiver, amount, memo) => act("Payment sent", "send", { receiver, amount: toYocto(amount), memo: memo || null })} />
      </section>

      {toast && <p className="toast" role="status">{toast}</p>}

      <section className="app-section">
        <div className="section-head">
          <h2>Waiting for a check</h2>
          <span className="count">{pending.length}</span>
        </div>
        {pending.length === 0 && <p className="muted empty-line">Nothing on hold. Payments to new receivers will wait here.</p>}
        <div className="hold-list">
          {pending.map((h) => (
            <HoldCard
              key={h.id}
              hold={h}
              actions={readOnly ? [] : [
                { label: "Pay now", tone: "primary", onClick: () => act("Released", "release", { hold_id: h.id }), disabled: !!busy || !(Date.now() / 1000 >= h.release_at || h.guardian_approved) },
                { label: "Cancel payment", onClick: () => act("Cancelled", "cancel", { hold_id: h.id }), disabled: !!busy },
                { label: "This was a scam", tone: "danger", onClick: () => act("Reported", "confirm_scam", { hold_id: h.id }), disabled: !!busy },
              ]}
            />
          ))}
        </div>
      </section>

      <section className="app-section settings-grid">
        <Guardians vault={vault} readOnly={readOnly} busy={!!busy} onAdd={(g) => act("Guardian added", "add_guardian", { guardian: g })} />
        <Trusted vault={vault} readOnly={readOnly} busy={!!busy}
          onPropose={(p) => act("Change proposed", "propose_change", { change: { add_trusted_payees: [p] } })}
          onApply={() => act("Change applied", "apply_change")}
          onCancelChange={() => act("Change cancelled", "cancel_change")}
          onRemove={(p) => act("Removed", "remove_trusted_payee", { payee: p })} />
      </section>

      {past.length > 0 && (
        <section className="app-section">
          <div className="section-head"><h2>History</h2></div>
          <div className="hold-list">{past.map((h) => <HoldCard key={h.id} hold={h} />)}</div>
        </section>
      )}

      <p className="muted small foot-note">
        Contract <code>{CONTRACT}</code> · Agent <code>{vault.agent ?? "none"}</code> · Testnet only
      </p>
    </main>
  );
}

function DepositForm({ onDeposit, busy }: { onDeposit: (amt: string) => void; busy: boolean }) {
  const [amt, setAmt] = useState("1");
  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); onDeposit(amt); }}>
      <input aria-label="Deposit amount in NEAR" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
      <button className="btn small-btn" disabled={busy}>{busy ? "…" : "Add NEAR"}</button>
    </form>
  );
}

function SendForm({ vault, onSend, busy, readOnly, onConnect }: { vault: Vault; onSend: (r: string, a: string, m: string) => void; busy: boolean; readOnly: boolean; onConnect: () => void }) {
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  let hint = "";
  try {
    if (receiver && amount) {
      const trusted = vault.trusted_payees.includes(receiver.trim());
      const under = BigInt(toYocto(amount)) <= BigInt(vault.instant_limit);
      hint = trusted && under ? "✓ Trusted and under your limit: this pays instantly." : `⏸ This will wait ${duration(vault.hold_secs)} for a check${trusted ? " (over your instant limit)" : " (new receiver)"}.`;
    }
  } catch {
    hint = "";
  }
  return (
    <form className="send-card" onSubmit={(e) => { e.preventDefault(); if (readOnly) onConnect(); else onSend(receiver.trim(), amount, memo); }}>
      <h3 className="send-title">Send money</h3>
      <label>To<input required={!readOnly} placeholder="name.testnet" value={receiver} onChange={(e) => setReceiver(e.target.value.toLowerCase())} /></label>
      <label>Amount (NEAR)<input required={!readOnly} inputMode="decimal" placeholder="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label>What is it for? <span className="muted">(optional)</span><input maxLength={140} placeholder="Rent, groceries…" value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
      {hint && <p className="send-hint">{hint}</p>}
      <button className="btn primary" disabled={busy}>{readOnly ? "Connect a wallet to send" : busy ? "Sending…" : "Send"}</button>
    </form>
  );
}

function Guardians({ vault, readOnly, busy, onAdd }: { vault: Vault; readOnly: boolean; busy: boolean; onAdd: (g: string) => void }) {
  const [g, setG] = useState("");
  return (
    <div className="panel">
      <h3>Family guardians</h3>
      <p className="muted small">Told when a payment looks risky. They can stop it, never take it.</p>
      <ul className="tag-list">
        {vault.guardians.map((x) => <li key={x}>{x}</li>)}
        {vault.guardians.length === 0 && <li className="muted">No guardians yet</li>}
      </ul>
      {!readOnly && vault.guardians.length < 3 && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); onAdd(g.trim()); setG(""); }}>
          <input placeholder="son.testnet" value={g} onChange={(e) => setG(e.target.value.toLowerCase())} aria-label="Guardian account" />
          <button className="btn small-btn" disabled={busy || !g}>Add</button>
        </form>
      )}
      <p className="muted small">Adding a guardian works instantly. Removing one takes the settings delay and alerts them.</p>
    </div>
  );
}

function Trusted({ vault, readOnly, busy, onPropose, onApply, onCancelChange, onRemove }: {
  vault: Vault; readOnly: boolean; busy: boolean;
  onPropose: (p: string) => void; onApply: () => void; onCancelChange: () => void; onRemove: (p: string) => void;
}) {
  const now = useNow();
  const [p, setP] = useState("");
  const pc = vault.pending_change;
  return (
    <div className="panel">
      <h3>People you trust</h3>
      <p className="muted small">Small payments to these go straight through.</p>
      <ul className="tag-list">
        {vault.trusted_payees.map((x) => (
          <li key={x}>{x}{!readOnly && <button className="x" aria-label={`Remove ${x}`} onClick={() => onRemove(x)} disabled={busy}>×</button>}</li>
        ))}
        {vault.trusted_payees.length === 0 && <li className="muted">No one yet</li>}
      </ul>
      {pc ? (
        <div className="pending-change">
          <b>Change waiting</b>
          <span className="muted small">{JSON.stringify(pc.change).replace(/[{}"]/g, "").replace(/:/g, ": ").replace(/,/g, ", ")}</span>
          {now >= pc.effective_at ? (
            !readOnly && <button className="btn small-btn primary" onClick={onApply} disabled={busy}>Apply now</button>
          ) : (
            <span className="small">Takes effect in <b>{until(pc.effective_at, now)}</b>. Your guardians were told.</span>
          )}
          {!readOnly && <button className="linkbtn small" onClick={onCancelChange} disabled={busy}>Cancel change</button>}
        </div>
      ) : (
        !readOnly && (
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); onPropose(p.trim()); setP(""); }}>
            <input placeholder="grocer.testnet" value={p} onChange={(e) => setP(e.target.value.toLowerCase())} aria-label="Trusted payee" />
            <button className="btn small-btn" disabled={busy || !p}>Trust</button>
          </form>
        )
      )}
      <p className="muted small">Trusting someone new weakens protection, so it waits. A scammer can&apos;t rush it.</p>
    </div>
  );
}

function CreateVault({ onCreate, busy, toast }: { onCreate: (args: object, deposit: string) => void; busy: boolean; toast: string }) {
  const [deposit, setDeposit] = useState("2");
  const [guardian, setGuardian] = useState("");
  const [trusted, setTrusted] = useState("");
  const [limit, setLimit] = useState("0.5");
  const [cap, setCap] = useState("1");
  const [hold, setHold] = useState("120");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(
      {
        guardians: guardian ? [guardian.trim()] : [],
        agent: AGENT,
        instant_limit: toYocto(limit),
        daily_instant_cap: toYocto(cap),
        hold_secs: Number(hold),
        trusted_payees: trusted.split(",").map((s) => s.trim()).filter(Boolean),
      },
      toYocto(deposit),
    );
  };
  return (
    <main id="main" className="wrap app-page narrow">
      <h1>Open your Pause vault</h1>
      <p className="lede">Takes a minute. You can add more guardians and trusted people later.</p>
      <form className="create-form" onSubmit={submit}>
        <label>Starting deposit (NEAR)<input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} /><span className="muted small">A tiny part covers storage on NEAR.</span></label>
        <label>A family guardian<input placeholder="son.testnet" value={guardian} onChange={(e) => setGuardian(e.target.value.toLowerCase())} /><span className="muted small">Someone who&apos;d pick up the phone if you were being scammed.</span></label>
        <label>People you already pay<input placeholder="grocer.testnet, landlord.testnet" value={trusted} onChange={(e) => setTrusted(e.target.value.toLowerCase())} /></label>
        <div className="form-row">
          <label>Instant limit<input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
          <label>Daily cap<input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} /></label>
          <label>Hold for
            <select value={hold} onChange={(e) => setHold(e.target.value)}>
              <option value="120">2 minutes (demo)</option>
              <option value="3600">1 hour</option>
              <option value="86400">24 hours</option>
            </select>
          </label>
        </div>
        <p className="muted small">The Pause agent (<code>{AGENT}</code>) can only record a risk verdict and extend a hold. It can never move your money.</p>
        <button className="btn primary" disabled={busy}>{busy ? "Opening…" : "Open my vault"}</button>
        {toast && <p className="toast">{toast}</p>}
      </form>
    </main>
  );
}
