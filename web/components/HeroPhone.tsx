"use client";

// The hero: a real photograph of someone holding a phone, with a working
// Pause screen placed inside it. Visitors can act as the guardian and watch
// the held payment change state. Nothing here touches the chain; the live
// version is on /demo.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Ring from "@/components/Ring";

type State = "held" | "stopped" | "approved";

const TOTAL = 24 * 60 * 60;

export default function HeroPhone() {
  const [state, setState] = useState<State>("held");
  const [left, setLeft] = useState(17 * 3600 + 12 * 60);

  useEffect(() => {
    if (state !== "held") return;
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [state]);

  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;

  return (
    <div className="hero-phone">
      <figure className="hero-phone-photo">
        <Image src="/img/hands-phone.webp" alt="Two hands holding a phone that shows a payment Pause has held" fill priority sizes="(max-width: 960px) 80vw, 480px" style={{ objectFit: "cover" }} />
        <div className={`hp-screen ${state}`}>
          {state === "held" && (
            <>
              <Ring fraction={left / TOTAL} label={`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`} tone="held" size={96} />
              <p className="hp-title">Payment paused</p>
              <p className="hp-sub">0.06 NEAR to a new receiver. Nothing has left Mum&apos;s account.</p>
              <button className="hp-btn stop" onClick={() => setState("stopped")}>Stop it</button>
              <button className="hp-btn" onClick={() => setState("approved")}>It&apos;s fine, approve</button>
            </>
          )}
          {state !== "held" && (
            <>
              <span className={`hp-done ${state}`} aria-hidden>
                <svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <p className="hp-title">{state === "stopped" ? "Stopped" : "Approved"}</p>
              <p className="hp-sub">{state === "stopped" ? "The money is back in Mum's vault. You can report the receiver so other families are warned." : "The payment went to the receiver Mum named. It could not go anywhere else."}</p>
              <Link className="hp-btn stop" href="/demo">Do it for real</Link>
              <button className="hp-btn" onClick={() => { setLeft(17 * 3600 + 12 * 60); setState("held"); }}>Show me again</button>
            </>
          )}
        </div>
      </figure>
      <p className="hp-chip hp-chip-a glass">Your son has been told</p>
      <p className="hp-chip hp-chip-b glass">Checked privately, with signed proof</p>
    </div>
  );
}
