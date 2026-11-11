"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet";

const LINKS = [
  { href: "/check", label: "Check a chat" },
  { href: "/vault", label: "My vault" },
  { href: "/guardian", label: "Guardian" },
  { href: "/registry", label: "Scam registry" },
];

export default function AppHeader() {
  const path = usePathname();
  const { accountId, signIn, signOut, ready } = useWallet();
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link href="/" className="logo" aria-label="Pause home">
          <span className="logo-mark" aria-hidden>
            <i /><i />
          </span>
          Pause
        </Link>
        <nav className="topnav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        {accountId ? (
          <button className="acct" onClick={signOut} title="Sign out">
            <span className="acct-dot" aria-hidden />
            <span className="acct-id">{accountId}</span>
          </button>
        ) : (
          <button className="btn small-btn primary" onClick={signIn} disabled={!ready}>
            Connect wallet
          </button>
        )}
      </div>
      <nav className="topnav-mobile wrap" aria-label="Main mobile">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
