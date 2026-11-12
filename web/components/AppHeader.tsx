"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";

const LINKS = [
  { href: "/demo", label: "Try it" },
  { href: "/call", label: "Call Pause" },
  { href: "/check", label: "Check a message" },
  { href: "/vault", label: "My vault" },
  { href: "/guardian", label: "Guardian" },
  { href: "/registry", label: "Protection map" },
];

export default function AppHeader() {
  const path = usePathname();
  const { accountId, signIn, signOut, ready } = useWallet();
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((s) => setLive(!!s.checks?.find((c: { id: string; ok: boolean }) => c.id === "contract")?.ok)).catch(() => setLive(false));
  }, []);

  const nav = LINKS.map((l) => (
    <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""} aria-current={path === l.href ? "page" : undefined}>
      {l.label}
    </Link>
  ));

  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link href="/" className="logo" aria-label="Pause home">
          <span className="logo-mark" aria-hidden>
            <i /><i />
          </span>
          Pause
        </Link>
        <nav className="topnav" aria-label="Main">{nav}</nav>
        <Link href="/status" className={`live ${live === null ? "" : live ? "ok" : "no"}`} title="System status">
          <span aria-hidden />
          {live === false ? "Testnet slow" : "Live on testnet"}
        </Link>
        {accountId ? (
          <button className="acct" onClick={signOut} title="Sign out">
            <span className="acct-dot" aria-hidden />
            <span className="acct-id">{accountId}</span>
          </button>
        ) : (
          <button className="btn small-btn on-night" onClick={signIn} disabled={!ready}>
            Connect wallet
          </button>
        )}
      </div>
      <nav className="topnav-mobile wrap" aria-label="Main mobile">{nav}</nav>
    </header>
  );
}
