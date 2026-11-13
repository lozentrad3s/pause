"use client";

/** Opens the Ask Pause chat with a question already sent. */
export default function AskButton({ q, label = "Ask Pause" }: { q: string; label?: string }) {
  return (
    <button className="btn ghost-night" onClick={() => window.dispatchEvent(new CustomEvent("pause-chat", { detail: q }))}>
      {label}
    </button>
  );
}
