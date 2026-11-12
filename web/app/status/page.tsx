"use client";

import Photo from "@/components/Photo";
import { useEffect, useState } from "react";

interface Status {
  ok: boolean;
  checked_at: string;
  checks: { id: string; label: string; ok: boolean; detail: string }[];
}

export default function StatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then((s) => { setStatus(s); setFailed(false); })
        .catch(() => setFailed(true));
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  return (
    <main id="main" className="wrap app-page narrow">
      <header className="page-head slim">
        <div>
          <h1>Status</h1>
          <p className="lede">Everything a visitor depends on, checked live against NEAR testnet every twenty seconds.</p>
        </div>
        <Photo name="grandad-phone" alt="An older man smiling as he uses his phone in an armchair" ratio="4 / 3" priority />
      </header>
      {!status && !failed && <div className="skeleton" />}
      {failed && !status && <p className="notice bad">The status check itself didn&apos;t answer. Reload in a moment.</p>}
      {status && (
        <>
          <p className={`status-banner ${status.ok ? "ok" : "warn"}`}>{status.ok ? "All systems working" : "Some parts need attention"}</p>
          <ul className="status-list">
            {status.checks.map((c) => (
              <li key={c.id} className={c.ok ? "ok" : "no"}>
                <span className="status-dot" aria-hidden />
                <div>
                  <b>{c.label}</b>
                  <span>{c.detail}</span>
                </div>
                <em>{c.ok ? "Working" : "Not ready"}</em>
              </li>
            ))}
          </ul>
          <p className="muted small">Last checked {new Date(status.checked_at).toLocaleTimeString()}.</p>
        </>
      )}
    </main>
  );
}
