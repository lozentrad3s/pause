"use client";

import { useEffect, useState } from "react";
import { EXPLORER, fromYocto, until, SCAM_NAMES, type Hold } from "@/lib/near";

export interface HoldAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "danger" | "plain";
  disabled?: boolean;
}

const STATUS_LABEL: Record<Hold["status"], string> = {
  Pending: "Held",
  Released: "Paid",
  Cancelled: "Cancelled",
  Vetoed: "Stopped by guardian",
  Blocked: "Blocked",
};

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function HoldCard({ hold, actions = [], showOwner = false }: { hold: Hold; actions?: HoldAction[]; showOwner?: boolean }) {
  const now = useNow();
  const pending = hold.status === "Pending";
  const ready = pending && (now >= hold.release_at || hold.guardian_approved);
  const total = Math.max(1, hold.release_at - hold.created_at);
  const progress = pending ? Math.min(100, ((now - hold.created_at) / total) * 100) : 100;

  return (
    <article className={`hold st-${hold.status} rk-${hold.risk}`}>
      <div className="hold-top">
        <div>
          <div className="hold-amt">{fromYocto(hold.amount)} <span>NEAR</span></div>
          <div className="hold-to">
            {showOwner && <><b>{hold.owner}</b> → </>}
            to <a href={`${EXPLORER}/address/${hold.receiver}`} target="_blank" rel="noreferrer">{hold.receiver}</a>
          </div>
        </div>
        <div className="hold-badges">
          <span className={`pill s-${hold.status}`}>{STATUS_LABEL[hold.status]}</span>
          {hold.risk !== "Unknown" && <span className={`pill r-${hold.risk}`}>{hold.risk} risk</span>}
        </div>
      </div>

      {hold.scam_type && <p className="hold-type">⚠ {SCAM_NAMES[hold.scam_type] ?? hold.scam_type}</p>}
      {hold.memo && <p className="hold-memo">“{hold.memo}”</p>}

      {pending && (
        <div className="hold-timer">
          <div className="hold-bar"><span style={{ width: `${progress}%` }} /></div>
          <span className="muted small">
            {hold.guardian_approved
              ? "✓ Guardian approved: can be paid now"
              : ready
                ? hold.risk === "High"
                  ? "Window ended. High risk needs a guardian's approval"
                  : "Window ended. Ready to pay"
                : hold.risk === "Unknown"
                  ? `The Pause agent is checking… releases in ${until(hold.release_at, now)}`
                  : `Releases in ${until(hold.release_at, now)}`}
          </span>
        </div>
      )}

      {actions.length > 0 && pending && (
        <div className="hold-actions">
          {actions.map((a) => (
            <button key={a.label} className={`btn small-btn ${a.tone === "primary" ? "primary" : a.tone === "danger" ? "danger" : ""}`} onClick={a.onClick} disabled={a.disabled}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
