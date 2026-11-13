"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/lib/wallet";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:8787";
const RECIPIENT = "pause-telegram";

export default function LinkPage() {
  return (
    <Suspense fallback={<main className="wrap app-page narrow"><p className="muted">Loading…</p></main>}>
      <LinkInner />
    </Suspense>
  );
}

function LinkInner() {
  const code = (useSearchParams().get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const wallet = useWallet();
  const [state, setState] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const link = async () => {
    setState("signing");
    setMsg("");
    try {
      const nonce = crypto.getRandomValues(new Uint8Array(32));
      const message = `Link my Telegram chat to Pause.\nCode: ${code}`;
      const signed = await wallet.signMessage(message, RECIPIENT, nonce);
      const r = await fetch(`${BOT_URL}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature, nonce: btoa(String.fromCharCode(...nonce)) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Pause couldn't confirm that. Please try again.");
      setMsg(d.accountId);
      setState("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  };

  if (!code) {
    return (
      <main className="wrap app-page narrow">
        <h1>Connect Telegram</h1>
        <p className="lede">Send <code>/link</code> to @Pausenearai_bot in a private chat. It will give you a code and a link back to this page.</p>
      </main>
    );
  }

  return (
    <main className="wrap app-page narrow">
      <h1>Connect your account to Pause on Telegram</h1>
      <p className="lede">
        Your wallet will sign the code <b>{code}</b>. It proves the account is yours. It isn&apos;t a payment and costs nothing.
      </p>
      <div className="card link-card">
        {state === "done" ? (
          <>
            <h2>Connected</h2>
            <p><b>{msg}</b> is now linked. Pause has sent you a confirmation on Telegram. You can close this page.</p>
          </>
        ) : !wallet.accountId ? (
          <>
            <p>First, connect the NEAR wallet you use with Pause.</p>
            <button className="btn primary" onClick={wallet.signIn} disabled={!wallet.ready}>Connect wallet</button>
          </>
        ) : (
          <>
            <p>Signing in as <b>{wallet.accountId}</b>.</p>
            <button className="btn primary" onClick={link} disabled={state === "signing"}>{state === "signing" ? "Waiting for your wallet…" : "Approve and connect"}</button>
          </>
        )}
        {state === "error" && <p className="error" role="alert">{msg}</p>}
      </div>
    </main>
  );
}
