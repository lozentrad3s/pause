"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import HoldCard from "@/components/HoldCard";
import { useWallet } from "@/lib/wallet";
import { view, type Hold } from "@/lib/near";

const DEMO_GUARDIAN = "son.pause-demo.testnet";

export default function GuardianPage() {
  return (
    <Suspense fallback={<main className="wrap app-page"><p className="muted">Loading…</p></main>}>
      <GuardianInner />
    </Suspense>
  );
}

function GuardianInner() {
  const params = useSearchParams();
  const { accountId, signIn, call, ready } = useWallet();
  const viewing = params.get("view") || accountId;
  const readOnly = !accountId || viewing !== accountId;
  const [wards, setWards] = useState<string[] | undefined>(undefined);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!viewing) return;
    const [w, h] = await Promise.all([
      view<string[]>("get_wards", { guardian: viewing }),
      view<Hold[]>("get_guardian_holds", { guardian: viewing, only_pending: false }),
    ]).catch(() => [[], []] as [string[], Hold[]]);
    setWards(w);
    setHolds(h);
  }, [viewing]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (label: string, method: string, args: object) => {
    setBusy(true);
    setToast("");
    try {
      await call(method, args);
      setToast(`${label}: done`);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message.slice(0, 160) : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!viewing) {
    return (
      <main className="wrap app-page">
        <section className="empty-hero">
          <span className="empty-icon" aria-hidden>👪</span>
          <h1>Look out for the people you love.</h1>
          <p className="lede">When someone names you as their guardian, risky payments from their vault show up here. Call them first, then approve, extend or stop the payment. You can never move their money anywhere but back to them.</p>
          <div className="hero-cta">
            <button className="btn primary" onClick={signIn} disabled={!ready}>Connect wallet</button>
            <Link className="btn" href={`/guardian?view=${DEMO_GUARDIAN}`}>See the son&apos;s view (demo)</Link>
          </div>
        </section>
      </main>
    );
  }

  const pending = holds.filter((h) => h.status === "Pending");
  const urgent = pending.filter((h) => h.risk === "High");

  return (
    <main className="wrap app-page">
      {readOnly && (
        <div className="banner">
          Viewing <b>{viewing}</b> read-only.{" "}
          {accountId ? <Link href="/guardian">Back to my view</Link> : <button className="linkbtn" onClick={signIn}>Connect your wallet</button>} to act as a guardian.
        </div>
      )}
      <section className="guardian-head">
        <div>
          <p className="eyebrow">Guardian</p>
          <h1>{urgent.length ? `${urgent.length} payment${urgent.length > 1 ? "s" : ""} need${urgent.length > 1 ? "" : "s"} you` : "All quiet"}</h1>
          <p className="lede">
            {wards === undefined ? "Loading…" : wards.length ? <>You protect <b>{wards.join(", ")}</b>.</> : "Nobody has named you as a guardian yet."}
          </p>
        </div>
        <div className="tip">
          <b>Before you tap anything</b>
          <span>Call them on a number you already know. Ask who the money is for and whether anyone told them to keep it secret.</span>
        </div>
      </section>

      {toast && <p className="toast" role="status">{toast}</p>}

      <section className="app-section">
        <div className="section-head"><h2>Waiting on you</h2><span className="count">{pending.length}</span></div>
        {pending.length === 0 && <p className="muted empty-line">No payments on hold.</p>}
        <div className="hold-list">
          {pending.map((h) => (
            <HoldCard key={h.id} hold={h} showOwner actions={readOnly ? [] : [
              { label: "Stop it", tone: "danger", onClick: () => act("Stopped", "veto", { hold_id: h.id }), disabled: busy },
              { label: "Hold 24h longer", onClick: () => act("Extended", "extend_hold", { hold_id: h.id, secs: 86400 }), disabled: busy },
              { label: "It's a scam", onClick: () => act("Reported", "confirm_scam", { hold_id: h.id }), disabled: busy },
              { label: "Approve", tone: "primary", onClick: () => act("Approved", "approve_early", { hold_id: h.id }), disabled: busy || h.guardian_approved },
            ]} />
          ))}
        </div>
      </section>

      {holds.length > pending.length && (
        <section className="app-section">
          <div className="section-head"><h2>Recent</h2></div>
          <div className="hold-list">{holds.filter((h) => h.status !== "Pending").slice(0, 10).map((h) => <HoldCard key={h.id} hold={h} showOwner />)}</div>
        </section>
      )}
    </main>
  );
}
