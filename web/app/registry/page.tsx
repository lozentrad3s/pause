"use client";

import Photo from "@/components/Photo";
import { useEffect, useState } from "react";
import { accountUrl, SCAM_NAMES, view, type RegistryEntry, type Stats } from "@/lib/near";

const BLOCK_AT = 3;

export default function RegistryPage() {
  const [entries, setEntries] = useState<RegistryEntry[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = () =>
      Promise.all([view<RegistryEntry[]>("get_registry", { limit: 100 }), view<Stats>("get_stats")])
        .then(([e, s]) => {
          setEntries([...e].sort((a, b) => b.reports - a.reports || b.first_reported_at - a.first_reported_at));
          setStats(s);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const blocked = entries?.filter((e) => e.reports >= BLOCK_AT).length;
  const warned = entries?.filter((e) => e.reports < BLOCK_AT).length;

  return (
    <main id="main" className="wrap app-page">
      <header className="page-head">
      <div>
      <h1>Protection map</h1>
      <p className="lede">
        When one family stops a scam, every other family is warned about that receiver. When three different vaults report
        it, it is blocked for everyone. No victim&apos;s name, message or amount is ever stored here.
      </p>
      </div>
      <Photo name="friends-tablet" alt="A group of older friends laughing around a tablet" ratio="4 / 3" priority />
      </header>

      <div className="stat-row">
        <div><b>{stats?.scams_confirmed ?? "–"}</b><span>scam reports from families</span></div>
        <div><b>{blocked ?? "–"}</b><span>receivers blocked for everyone</span></div>
        <div><b>{warned ?? "–"}</b><span>receivers under warning</span></div>
        <div><b>{stats?.blocked_by_registry ?? "–"}</b><span>payments blocked outright</span></div>
      </div>

      <div className="grade-key">
        <div><span className="pill r-Medium">Warned</span> 1 or 2 reports. Payments to this receiver are held at High risk and a guardian must approve.</div>
        <div><span className="pill s-Blocked">Blocked</span> {BLOCK_AT} or more reports. Payments are refused in one transaction.</div>
      </div>

      <div className="table-card">
        <table className="data">
          <thead><tr><th>Receiver</th><th>Status</th><th>Reports</th><th>Looks like</th><th>First reported</th></tr></thead>
          <tbody>
            {entries === null && !failed && <tr><td colSpan={5} className="muted">Reading the registry from NEAR…</td></tr>}
            {failed && entries === null && <tr><td colSpan={5} className="muted">NEAR testnet didn&apos;t answer. This page retries every few seconds.</td></tr>}
            {entries?.length === 0 && <tr><td colSpan={5} className="muted">No reports yet. The first family to stop a scam will appear here.</td></tr>}
            {entries?.map((e) => (
              <tr key={e.receiver}>
                <td><a href={accountUrl(e.receiver)} target="_blank" rel="noreferrer"><code>{e.receiver}</code></a></td>
                <td>{e.reports >= BLOCK_AT ? <span className="pill s-Blocked">Blocked</span> : <span className="pill r-Medium">Warned</span>}</td>
                <td>
                  <span className="report-dots" aria-label={`${e.reports} of ${BLOCK_AT} reports`}>
                    {Array.from({ length: BLOCK_AT }, (_, i) => <i key={i} className={i < e.reports ? "on" : ""} />)}
                  </span>
                  {e.reports}
                </td>
                <td>{e.scam_type ? SCAM_NAMES[e.scam_type] ?? e.scam_type : "Not classified"}</td>
                <td>{new Date(e.first_reported_at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Read live from the Pause contract on NEAR testnet. A vault can report a receiver only for a payment of its own that it
        cancelled or stopped, and counts once per receiver, so one person can&apos;t blacklist an honest shop.
      </p>
    </main>
  );
}
