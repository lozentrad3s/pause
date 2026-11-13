"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LANGS, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useWallet } from "@/lib/wallet";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/groups", label: "Groups" },
  { href: "/check", label: "Check a message" },
  { href: "/vault", label: "My vault" },
  { href: "/guardian", label: "Guardian" },
  { href: "/registry", label: "Protection map" },
];

export default function AppHeader() {
  const path = usePathname();
  const { accountId, signIn, signOut, ready } = useWallet();
  const [live, setLive] = useState<boolean | null>(null);
  const { lang, setLang } = useLang();

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
          <Image src="/img/logo-mark.png" alt="" width={38} height={38} priority />
          <span>Pause <b>AI</b></span>
        </Link>
        <nav className="topnav" aria-label="Main">{nav}</nav>
        <Link href="/status" className={`live ${live === null ? "" : live ? "ok" : "no"}`} title="System status">
          {live === false ? "Testnet slow" : "Status"}
        </Link>
        <label className="lang-pick" title="The language Pause listens for and answers in">
          <span className="sr-only">Language Pause answers in</span>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
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
