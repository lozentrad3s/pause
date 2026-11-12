"use client";

/**
 * The Pause mark as a countdown: two bars inside a ring that empties as the
 * hold window runs out. `fraction` is the share of the window still left.
 */
export default function Ring({ fraction, label, tone = "held", size = 132 }: { fraction: number; label: string; tone?: "held" | "high" | "done"; size?: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, fraction));
  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle className="ring-track" cx="60" cy="60" r={r} />
        <circle className="ring-arc" cx="60" cy="60" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - left)} transform="rotate(-90 60 60)" />
        <rect className="ring-bar" x="47" y="40" width="9" height="26" rx="3" />
        <rect className="ring-bar" x="64" y="40" width="9" height="26" rx="3" />
      </svg>
      <span className="ring-label">{label}</span>
    </div>
  );
}
