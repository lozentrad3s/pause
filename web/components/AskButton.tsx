"use client";

/** Opens the Ask Pause chat with a question already sent. */
export default function AskButton({ q, label = "Ask Pause", variant = "night" }: { q: string; label?: string; variant?: "night" | "light" }) {
  return (
    <button className={`btn ${variant === "night" ? "ghost-night" : ""}`} onClick={() => window.dispatchEvent(new CustomEvent("pause-chat", { detail: q }))}>
      {label}
    </button>
  );
}
