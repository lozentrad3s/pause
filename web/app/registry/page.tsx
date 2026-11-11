"use client";

import { useEffect, useState } from "react";
import { EXPLORER, SCAM_NAMES, view, type RegistryEntry, type Stats } from "@/lib/near";

export default function RegistryPage() {
  const [entries, setEntries] = useState<RegistryEntry[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () =>
      Promise.all([view<RegistryEntry[]>("get_registry", { limit: 100 }), view<Stats>("get_stats")])
        .then(([e, s]) => { setEntries(e); setStats(s); })
        .catch(() => setEntries([]));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="wrap app-page">
      <p className="eyebrow">One victim protects everyone</p>
      <h1>Shared scam registry</h1>
      <p className="lede">When an owner or guardian confirms a scam, the receiver lands here and every Pause wallet blocks it instantly. No victim details are stored.</p>

      <div className="stat-row">
        <div><b>{stats?.blocked_by_registry ?? "–"}</b><span>payments blocked</span></div>
        <div><b>{stats?.scams_confirmed ?? "–"}</b><span>scams confirmed</span></div>
        <div><b>{stats?.holds_created ?? "–"}</b><span>payments held for a check</span></div>
        <div><b>{stats?.instant_payments ?? "–"}</b><span>everyday payments, no delay</span></div>
      </div>

      <div className="table-card">
        <table className="data">
          <thead><tr><th>Receiver</th><th>Scam type</th><th>Reports</th><th>First reported</th></tr></thead>
          <tbody>
            {entries === null && <tr><td colSpan={4} className="muted">Loading from NEAR…</td></tr>}
            {entries?.length === 0 && <tr><td colSpan={4} className="muted">No confirmed scams yet.</td></tr>}
            {entries?.map((e) => (
              <tr key={e.receiver}>
                <td><a href={`${EXPLORER}/address/${e.receiver}`} target="_blank" rel="noreferrer"><code>{e.receiver}</code></a></td>
                <td>{e.scam_type ? SCAM_NAMES[e.scam_type] ?? e.scam_type : "Not classified"}</td>
                <td>{e.reports}</td>
                <td>{new Date(e.first_reported_at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Read live from the Pause contract on NEAR testnet. Wrong entry? The admin can remove false reports.</p>
    </main>
  );
}
