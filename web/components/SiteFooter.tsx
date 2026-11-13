import Image from "next/image";
import Link from "next/link";

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "For groups", links: [["Start a pot", "/groups"], ["Try the reunion demo", "/groups"], ["Add to Telegram", "https://t.me/Pausenearai_bot?startgroup=pause"]] },
  { title: "For you", links: [["Check a message", "/check"], ["My vault", "/vault"], ["Guardian", "/guardian"], ["Protection map", "/registry"]] },
  { title: "Proof", links: [["System status", "/status"], ["Contract on NEAR", "https://testnet.nearblocks.io/address/pause.pause-demo.testnet"], ["Source code", "https://github.com/lozentrad3s/pause"]] },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link href="/" className="logo" aria-label="Pause home">
              <Image src="/img/logo-mark.png" alt="" width={34} height={34} />
              <span>Pause <b>AI</b></span>
            </Link>
            <p>The AI agent that plans, secures and pays for your group. It pays only the vendors you approve, and stops payments to scammers.</p>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h3>{c.title}</h3>
              <ul>
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("http") ? <a href={href} target="_blank" rel="noreferrer">{label}</a> : <Link href={href}>{label}</Link>}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="site-footer-base">
          <span>Built at NEAR HACKATHON on NEAR and NEAR AI Cloud. Testnet only for now.</span>
          <span>Coming soon: Pause on X, WhatsApp groups, payouts in naira.</span>
        </div>
      </div>
    </footer>
  );
}
