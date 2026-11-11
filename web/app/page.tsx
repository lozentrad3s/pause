import Link from "next/link";
import PhoneDemo from "@/components/PhoneDemo";
import Simulation from "@/components/Simulation";

const LOSSES = [
  ["Involving crypto", "$11.3B"],
  ["People aged 60 and over", "$7.7B"],
  ["Investment scams, the largest category", "$8.6B"],
];

const WEAPONS = [
  { w: "Urgency", line: "“Pay in the next hour or the account is frozen.”", a: "A hold window the scammer can't shorten." },
  { w: "Isolation", line: "“Don't tell your family, they won't understand.”", a: "Guardians are told automatically." },
  { w: "Love or authority", line: "“Baby, customs is holding my equipment.”", a: "Private questions that break the script." },
];

const STEPS = [
  { n: "01", t: "Check any chat", d: "Forward messages to the Pause bot on Telegram, or paste a chat from WhatsApp, Instagram, Facebook, TikTok or X. A private AI explains what it sees.", href: "/check", cta: "Check a chat" },
  { n: "02", t: "Warned before paying", d: "Pause knows the five stages of a romance scam. It names the stage, quotes the messages, and remembers any wallet address the scammer gave." },
  { n: "03", t: "Paused if they pay anyway", d: "If money goes to a flagged or new receiver, the Pause contract on NEAR holds it, asks a few questions, and tells the family.", href: "/vault?view=amina.pause-demo.testnet", cta: "See a live vault" },
];

const RULES = [
  ["Normal life stays instant", "Small payments to people you've paid before go straight through."],
  ["Risky payments wait", "New receivers or large amounts are held. You can cancel any time."],
  ["Family gets a say", "Up to three guardians can stop a payment. They can never take it."],
  ["Switching it off is slow", "Removing guardians or raising limits takes 7 days and alerts the family."],
  ["One victim protects everyone", "A confirmed scam address is blocked for every Pause wallet, instantly."],
  ["The AI holds no money", "The agent's NEAR key can record a verdict and extend a hold. Nothing else."],
];

export default function Home() {
  return (
    <main id="main">
      <section className="night hero-band">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Live on NEAR testnet</p>
            <h1>
              Love shouldn&apos;t cost you your <span className="serif">savings</span>
            </h1>
            <p className="lede">
              Scammers meet people on WhatsApp, Instagram and TikTok, build trust for weeks, then ask for money in a hurry.
              Pause spots the signs early, warns you privately, and holds the payment if you send it anyway.
            </p>
            <div className="hero-cta">
              <Link className="btn primary" href="/check">Check a chat</Link>
              <a className="btn ghost-night" href="#demo">See how it works</a>
            </div>
            <p className="small muted hero-foot">Free. Chats are checked on private AI hardware and never stored.</p>
          </div>
          <PhoneDemo variant="hero" />
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="problem-grid">
            <div>
              <p className="eyebrow">The problem</p>
              <h2>
                Scams don&apos;t hack the phone. They hack the <span className="serif">person</span>
              </h2>
              <p className="lede">
                The money is sent by the real owner, from their real phone, so the bank sees nothing wrong. What&apos;s
                wrong is the situation: someone has convinced them to act fast and tell nobody.
              </p>
            </div>
            <div className="card loss-card">
              <p className="small muted">Lost to online scams by Americans in 2025</p>
              <p className="figure loss-big">$20.9B</p>
              <p className="small muted">up 26% on 2024</p>
              <ul className="loss-rows">
                {LOSSES.map(([l, v]) => (
                  <li key={l}><span>{l}</span><span className="figure">{v}</span></li>
                ))}
              </ul>
              <p className="small muted source">Source: FBI IC3 2025 report. Reported US losses only.</p>
            </div>
          </div>
          <div className="weapons">
            {WEAPONS.map((x) => (
              <div key={x.w} className="card weapon">
                <h3>{x.w}</h3>
                <p className="quote">{x.line}</p>
                <p className="answer">{x.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">See it on a phone</p>
            <h2>
              From the first hello to a <span className="serif">paused</span> payment
            </h2>
            <p className="lede">Pick a story and an app. Pause reads the same messages you do and scores them as they arrive.</p>
          </div>
          <PhoneDemo />
        </div>
      </section>

      <section className="night band">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">How it works</p>
            <h2>
              Three chances to stop a <span className="serif">scam</span>
            </h2>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div key={s.n} className="step">
                <span className="step-n">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                {s.href && <Link className="linkbtn" href={s.href}>{s.cta} →</Link>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contract" className="band">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">On NEAR</p>
            <h2>
              Ten scams, run against the <span className="serif">contract</span>
            </h2>
            <p className="lede">Every payment passes the shared scam registry, your limits, fixed risk rules, a private AI interview and your family.</p>
          </div>
          <div className="card">
            <Simulation />
          </div>
          <ol className="rules" style={{ marginTop: 56 }}>
            {RULES.map(([t, d], i) => (
              <li key={t} className="card">
                <span className="rule-n">0{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="safety" className="night band">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">Safety</p>
            <h2>
              The AI can&apos;t touch the <span className="serif">money</span>
            </h2>
            <p className="lede">
              The agent signs with a NEAR function-call key that allows two methods on the Pause contract. If it&apos;s stolen,
              the worst an attacker can do is slow a payment down.
            </p>
          </div>
          <div className="cando">
            <div className="can">
              <h3>The agent can</h3>
              <ul>
                <li>Record a risk verdict</li>
                <li>Extend a hold</li>
              </ul>
            </div>
            <div className="cannot">
              <h3>The agent cannot</h3>
              <ul>
                <li>Send money</li>
                <li>Change settings</li>
                <li>Call any other contract</li>
                <li>Attach a deposit</li>
              </ul>
            </div>
          </div>
          <p className="muted small">Chats run on NEAR AI Cloud&apos;s private (TEE) inference and are never stored. On-chain, the agent keeps only a hash of its reasons.</p>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <p><b>Pause</b>. Built at NEAR HACKATHON with Rust on NEAR and NEAR AI Cloud.</p>
            <p className="muted small">Testnet only. Simulations use scripted chats. Pause can be wrong; when in doubt, talk to someone you trust.</p>
          </div>
          <div className="hero-cta" style={{ marginTop: 0 }}>
            <Link className="btn small-btn" href="/check">Check a chat</Link>
            <a className="btn small-btn" href="https://github.com/lozentrad3s/pause">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
