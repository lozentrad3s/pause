import Link from "next/link";
import PhoneDemo from "@/components/PhoneDemo";
import Simulation from "@/components/Simulation";

const STATS = [
  { v: "$20.9B", l: "lost to online scams by Americans in 2025, up 26%" },
  { v: "$11.3B", l: "of it involved crypto" },
  { v: "$7.7B", l: "taken from people aged 60 and over" },
];

const DOORS = [
  {
    n: "01",
    t: "Check any chat",
    d: "Forward messages to the Pause bot on Telegram, or paste a chat exported from WhatsApp, Instagram, Facebook, TikTok or X. A private AI explains what it sees.",
    cta: { href: "/check", label: "Check a chat" },
  },
  {
    n: "02",
    t: "Warned before you pay",
    d: "Pause knows the five stages of a romance scam. It tells you which stage you're in, quotes the exact messages, and remembers any wallet address the scammer gave.",
  },
  {
    n: "03",
    t: "Paused if you pay anyway",
    d: "Scammers are persuasive. If money goes to a flagged or new receiver, the Pause contract on NEAR holds it, asks you a few questions, and tells your family.",
  },
];

const RULES = [
  ["Normal life stays instant", "Small payments to people you've paid before go straight through."],
  ["Risky payments wait", "New receivers or large amounts are held. You can cancel any time."],
  ["Family gets a say", "Up to three guardians are alerted on high risk. They can stop a payment but can never take the money."],
  ["Switching it off is slow", "Removing guardians or raising limits takes 7 days and alerts your family. A scammer can't rush it."],
  ["One victim protects everyone", "A confirmed scam address is blocked for every Pause wallet, instantly."],
];

export default function Home() {
  return (
    <main>

      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">Romance scam protection · built on NEAR</p>
          <h1>Love shouldn&apos;t cost you <span className="grad">your savings.</span></h1>
          <p className="lede">
            Scammers meet people on WhatsApp, Instagram and TikTok, build trust for weeks, then ask for money in a hurry.
            Pause reads the warning signs early, warns you privately, and holds the payment if you send it anyway.
          </p>
          <div className="hero-cta">
            <Link className="btn primary" href="/check">Check a chat, free</Link>
            <a className="btn" href="#demo">Watch it stop a scam</a>
          </div>
          <div className="trust-row"><span>Private AI on NEAR AI Cloud</span><span>Agent can&apos;t move money</span><span>Family guardians</span><span>Live on NEAR testnet</span></div>
          <p className="hero-note muted small">Every team here built a firewall so AI agents can&apos;t be scammed. We built one for your mother.</p>
        </div>
      </section>

      <section id="demo" className="wrap section section-tight">
        <PhoneDemo />
      </section>

      <section className="wrap stats-band">
        {STATS.map((s) => (
          <div key={s.v}>
            <b>{s.v}</b>
            <span>{s.l}</span>
          </div>
        ))}
        <p className="muted small source">Source: FBI IC3 2025 report. Reported US losses only.</p>
      </section>

      <section id="how" className="wrap section">
        <p className="eyebrow">Works where scams start</p>
        <h2>Three chances to stop a scam</h2>
        <div className="doors">
          {DOORS.map((d) => (
            <div key={d.n} className="door">
              <span className="door-n">{d.n}</span>
              <h3>{d.t}</h3>
              <p>{d.d}</p>
              {d.cta && <Link className="linkbtn" href={d.cta.href}>{d.cta.label} →</Link>}
            </div>
          ))}
        </div>
      </section>

      <section id="contract" className="wrap section">
        <p className="eyebrow">Inside the contract</p>
        <h2>Ten scams, run against the Pause contract</h2>
        <p className="lede">Each payment passes the shared scam registry, your limits, fixed risk rules, a private AI interview and your family. Pick one and press run.</p>
        <Simulation />
      </section>

      <section className="wrap section">
        <h2>Five rules</h2>
        <ol className="rules">
          {RULES.map(([t, d], i) => (
            <li key={t}>
              <span className="rule-n">{i + 1}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="safety" className="wrap section">
        <h2>The AI can&apos;t touch the money</h2>
        <p className="lede">
          The agent signs with a NEAR function-call key that only allows two methods on the Pause contract. If the key is
          stolen, the worst an attacker can do is slow a payment down.
        </p>
        <div className="cando">
          <div>
            <h3>The agent can</h3>
            <ul>
              <li>Record a risk verdict</li>
              <li>Extend a hold</li>
            </ul>
          </div>
          <div>
            <h3>The agent cannot</h3>
            <ul>
              <li>Send money</li>
              <li>Change settings</li>
              <li>Call any other contract</li>
              <li>Attach a deposit</li>
            </ul>
          </div>
        </div>
        <p className="muted">
          Chats are checked on NEAR AI Cloud&apos;s private (TEE) inference and never stored. On-chain, the agent keeps
          only a hash of its reasons.
        </p>
      </section>

      <footer className="wrap footer">
        <p>Built at NEAR HACKATHON with Rust on NEAR and NEAR AI Cloud. Testnet only.</p>
        <p className="muted small">Simulations use scripted chats. They show the design works, not real-world accuracy. Pause can be wrong; when in doubt, talk to someone you trust.</p>
      </footer>
    </main>
  );
}
