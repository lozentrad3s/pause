"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPot, saveGroupGuest, loadGroupGuest, display } from "@/lib/groups-client";

/** Opens an invite link: /join#a=<account>&k=<key>&p=<pot>. The key stays in this browser. */
export default function JoinPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Opening your invite…");

  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const account = h.get("a");
    const key = h.get("k");
    const pot = Number(h.get("p"));
    if (!account || !key?.startsWith("ed25519:") || !Number.isInteger(pot)) {
      setMsg("This invite link looks incomplete. Ask the organiser to send it again.");
      return;
    }
    // Remove the key from the address bar and history straight away.
    history.replaceState(null, "", "/join");
    getPot(pot)
      .then((p) => {
        if (!p) return setMsg("That pot doesn't exist any more.");
        if (!p.members.includes(account)) return setMsg("This invite isn't part of that pot.");
        const old = loadGroupGuest();
        saveGroupGuest({ account, key, pots: [...new Set([...(old?.account === account ? old.pots : []), pot])] });
        setMsg(`Welcome, ${display(account)}. Taking you to ${p.name}…`);
        setTimeout(() => router.replace(`/groups/${pot}`), 900);
      })
      .catch(() => setMsg("NEAR didn't answer. Please open the link again in a moment."));
  }, [router]);

  return (
    <main id="main" className="wrap app-page narrow">
      <h1>You&apos;re invited</h1>
      <p className="lede">{msg}</p>
    </main>
  );
}
