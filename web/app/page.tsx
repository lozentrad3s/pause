import Link from "next/link";
import PhoneDemo from "@/components/PhoneDemo";
import Ring from "@/components/Ring";

const JUDGE = [
  { t: "Press “Try as a judge”", d: "You get two real testnet accounts, Grace and her son, with a vault already open. No wallet, about ten seconds.", href: "/demo", cta: "Open the demo" },
  { t: "Send a risky payment", d: "Pause holds it, asks six questions in your language, and shows the signed proof that the AI ran privately.", href: "/demo", cta: "Send one" },
  { t: "Stop it as the son", d: "Stop or report the payment from the second phone. Every step links to its transaction on the explorer.", href: "/registry", cta: "See the protection map" },
];

const WAYS = [
  { t: "Call Pause", d: "Tap one button and say what happened, in your own language. Pause answers out loud: is it a scam, how to tell, what to do next.", href: "/call", cta: "Talk to Pause" },
  { t: "Check a message", d: "Paste a chat, a text, an email or a token pitch. Pause quotes the warning signs, from fake bank calls to meme-coin presales.", href: "/check", cta: "Check one now" },
  { t: "Protect the money", d: "A vault on NEAR that pays trusted people at once, holds anything risky, and gives up to three family guardians a say.", href: "/vault", cta: "Open a vault" },
];

const ONLY = [
  ["The questions are private, and provable", "The interview runs inside a sealed enclave on NEAR AI Cloud. Each verdict carries the enclave's signature, which Pause checks and shows you."],
  ["The AI can't touch the money", "The agent signs with a NEAR key that allows two actions: record a verdict, and extend a hold. Stolen, it can only slow a payment down."],
  ["A scammer can't talk you out of it", "Removing a guardian or raising a limit waits out a delay and alerts the family first. Tightening protection is instant."],
  ["One family's report protects the next", "A reported receiver is a warning for every vault. Three reports from different vaults and it is blocked for everyone."],
];

const LOSSES = [
  ["Involving crypto", "$11.3B"],
  ["People aged 60 and over", "$7.7B"],
  ["Investment scams, the largest category", "$8.6B"],
];

// What exists now and what doesn't, said plainly. Kept in step with the README.
const TODAY: [string, string, "yes" | "part" | "no"][] = [
  ["Check a message or a call by text", "Fixed rules always answer. With the private model, in ten languages.", "yes"],
  ["Talk to Pause out loud", "In a browser or as a Telegram voice message. It is not a telephone number.", "part"],
  ["Hold a risky payment", "Live on NEAR testnet, with a countdown and one-tap cancel.", "yes"],
  ["Family guardians", "Up to three. They can stop, approve, give more time or report.", "yes"],
  ["Shared scam registry", "One report warns every vault. Three reports from different vaults block.", "yes"],
  ["Proof the AI ran privately", "The enclave's signature is checked on every answer. The hardware quote inside the report is linked, not yet checked by Pause.", "part"],
  ["Real money", "Testnet only. No mainnet, no bank transfers or cards.", "no"],
  ["Bitcoin and Ethereum payments", "Planned through NEAR Chain Signatures. Not built.", "no"],
];

const FAQ: [string, string][] = [
  ["What if Pause gets it wrong?", "It will sometimes. A wrong hold costs time, never money: the payment waits in your own vault, and you or a guardian can let it through. Pause always tells you to talk to someone you trust."],
  ["Who can move my money?", "Only you. A guardian can stop a payment, approve it early or give it more time, but the money can only go to the person you named or back into your vault. The AI agent can record a verdict and extend a hold. It cannot send, release or redirect anything, and NEAR enforces that, not our code."],
  ["The caller told me to switch it off. Can they make me?", "Not quickly. Removing a guardian, raising a limit or trusting a new receiver waits out a delay, and your guardians are told the moment you ask. Making protection stricter is instant."],
  ["Is what I tell Pause private?", "The questions run on a model inside a sealed enclave on NEAR AI Cloud. Pause checks the enclave's signature on every answer and shows you the result. The text you paste is analysed in memory and not stored. On chain there is only a hash of the reasons; the registry holds receiver accounts, never your name, messages or amounts."],
  ["What happens if nobody answers in time?", "A payment judged Low or Medium risk can be released by you once the hold window ends. A payment judged High risk stays held until a guardian approves it, however long the caller tells you to wait."],
  ["Can someone use the registry to blacklist an honest shop?", "A vault can only report a receiver through a payment of its own that was held, cancelled or stopped, and each vault counts once. One report is a warning, not a block. It takes three different vaults to block a receiver."],
  ["Do I need to understand crypto?", "To ask whether something is a scam, no: open Call Pause or Check a message and say what happened. The vault does need a NEAR account today. The demo makes two for you so you can see it work without one."],
  ["Is this real money?", "No. Everything here runs on NEAR testnet with test tokens. Pause is a hackathon project, not a finished product."],
];

export default function Home() {
  return (
    <main id="main">
      <section className="night hero-band">
        <div className="wrap hero-grid">
          <div>
            <h1>
              Scams run on urgency. Pause takes it <span className="serif">away</span>.
            </h1>
            <p className="lede">
              A wallet that holds a risky payment, privately asks the questions scammers coach people to lie about, and lets
              family step in before the money is gone.
            </p>
            <div className="hero-cta">
              <Link className="btn primary" href="/demo">Try as a judge</Link>
              <Link className="btn ghost-night" href="/call">Call Pause</Link>
            </div>
            <p className="small muted hero-foot">No wallet or sign-up. Real transactions on NEAR testnet, no real money.</p>
          </div>

          <div className="hero-card" aria-label="An example of a held payment">
            <Ring fraction={0.72} label="17 h 12 min" tone="held" size={148} />
            <h2>We&apos;ve paused this payment for 24 hours</h2>
            <p>Nothing has left your account. Your son has been told, and you can cancel at any time.</p>
            <dl>
              <div><dt>To</dt><dd>a new receiver</dd></div>
              <div><dt>Pause found</dt><dd>secrecy, a deadline, a promised profit</dd></div>
              <div><dt>Checked</dt><dd>privately, with signed proof</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="band-tight judge-band">
        <div className="wrap">
          <h2 className="h-small">Judge it in two minutes</h2>
          <ol className="judge-steps">
            {JUDGE.map((s, i) => (
              <li key={s.t}>
                <span className="judge-n">{i + 1}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                <Link className="linkbtn" href={s.href}>{s.cta}</Link>
              </li>
            ))}
          </ol>
          <p className="muted small">
            Prefer a terminal? <code>npm install &amp;&amp; npm run judge</code> runs the scam scripts, the contract scenarios and read-only testnet
            checks with no keys, and ends with a pass and fail count.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="problem-grid">
            <div>
              <h2>
                Scams don&apos;t hack the phone. They hack the <span className="serif">person</span>.
              </h2>
              <p className="lede">
                The money is sent by the real owner, from their real phone, so the bank sees nothing wrong. What&apos;s wrong is
                the situation: someone has convinced them to act fast and tell nobody. A firewall for AI agents doesn&apos;t help
                your mother. This one is for her.
              </p>
            </div>
            <div className="card loss-card">
              <p className="small muted">Lost to online scams by Americans in 2025</p>
              <p className="figure loss-big">$20.9B</p>
              <ul className="loss-rows">
                {LOSSES.map(([l, v]) => (
                  <li key={l}><span>{l}</span><span className="figure">{v}</span></li>
                ))}
              </ul>
              <p className="small muted source">Source: FBI IC3 2025 report. Reported US losses only.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="band night">
        <div className="wrap">
          <div className="section-intro">
            <h2>
              Three ways to ask, before it&apos;s too <span className="serif">late</span>
            </h2>
          </div>
          <div className="steps">
            {WAYS.map((s) => (
              <div key={s.t} className="step">
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                <Link className="linkbtn" href={s.href}>{s.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="section-intro">
            <h2>
              What only Pause <span className="serif">does</span>
            </h2>
            <p className="lede">Holding a payment and telling the family is a good idea several teams have had. These four things are what make it hold up against a patient scammer.</p>
          </div>
          <ol className="rules">
            {ONLY.map(([t, d]) => (
              <li key={t} className="card">
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="cando">
            <div className="can">
              <h3>The agent&apos;s key can</h3>
              <ul>
                <li>Record a risk verdict</li>
                <li>Extend a hold</li>
              </ul>
            </div>
            <div className="cannot">
              <h3>The agent&apos;s key cannot</h3>
              <ul>
                <li>Send or release money</li>
                <li>Change any setting</li>
                <li>Call any other contract</li>
                <li>Lower a High risk verdict</li>
              </ul>
            </div>
          </div>
          <p className="muted small">
            You can check this yourself: the <Link href="/status">status page</Link> reads the agent&apos;s key from NEAR and shows what it is allowed to call.
          </p>
        </div>
      </section>

      <section id="story" className="band story-band">
        <div className="wrap">
          <div className="section-intro">
            <h2>
              How a scam unfolds over sixteen <span className="serif">days</span>
            </h2>
            <p className="lede">
              This one is a scripted story, not a live transaction: the same messages a victim receives, with Pause scoring
              them as they arrive. For the real thing, use the <Link href="/demo">live demo</Link>.
            </p>
          </div>
          <PhoneDemo />
        </div>
      </section>

      <section id="today" className="band">
        <div className="wrap">
          <div className="section-intro">
            <h2>
              What works today, and what <span className="serif">doesn&apos;t</span>
            </h2>
            <p className="lede">Every line marked as working can be checked in the demo or on the <Link href="/status">status page</Link>.</p>
          </div>
          <ul className="today">
            {TODAY.map(([t, d, state]) => (
              <li key={t}>
                <span className={`today-state ${state}`}>{state === "yes" ? "Works today" : state === "part" ? "Partly" : "Not built"}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="questions" className="band story-band">
        <div className="wrap faq-wrap">
          <h2>
            Fair <span className="serif">questions</span>
          </h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="band night close-band">
        <div className="wrap">
          <h2>
            See a scam stopped, in two <span className="serif">minutes</span>
          </h2>
          <div className="hero-cta">
            <Link className="btn primary big" href="/demo">Try as a judge</Link>
            <Link className="btn ghost-night big" href="/call">Call Pause</Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <p><b>Pause</b>. Built at NEAR HACKATHON with Rust on NEAR, NEAR AI Cloud and NEAR Connect.</p>
            <p className="muted small">Testnet only. Pause can be wrong; when in doubt, talk to someone you trust.</p>
          </div>
          <div className="hero-cta" style={{ marginTop: 0 }}>
            <a className="btn small-btn" href="#today">What works today</a>
            <a className="btn small-btn" href="#questions">Questions</a>
            <Link className="btn small-btn" href="/status">Status</Link>
            <a className="btn small-btn" href="https://github.com/lozentrad3s/pause">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
