import Link from "next/link";
import LiveProof from "@/components/LiveProof";
import AskButton from "@/components/AskButton";
import results from "@/lib/groups-results.json";

const USES = ["Class reunion", "Wedding", "Group trip", "Birthday", "Office party", "Church harvest", "Ajo / esusu savings", "Support for parents"];

const JOBS = [
  {
    t: "Plans",
    d: "Tell Pause what you're planning in plain words. It suggests a budget, hangout spots and what to book first, then turns the plan into a list the group can vote on.",
    eg: "“Birthday for 15 in Lekki, about 10k each”",
  },
  {
    t: "Collects",
    d: "Everyone pays their share into one pot, like a digital ajo box. Everyone sees who has paid and who hasn't. Pause sends polite private reminders, never public shaming.",
    eg: "“Raised 14 of 20. Still to pay: Tunde, Musa.”",
  },
  {
    t: "Pays",
    d: "When enough members approve a vendor, Pause pays them in seconds after a short wait anyone can stop. Every payment is posted in the group with a receipt.",
    eg: "“Paid the hall deposit. Received, says the hall.”",
  },
  {
    t: "Protects",
    d: "Pause can't pay anyone the group didn't approve, or more than they approved. Accounts reported as scammers are blocked before a single coin moves.",
    eg: "“I didn't pay drinks-plug: reported as a scam.”",
  },
];

const STEPS = [
  ["Start a pot", "Name it, set the target and each person's share, and choose how many people must approve a payment (for example 3 of 5)."],
  ["Everyone pays in", "Members pay their share. The pot shows who has paid. Pause reminds the rest privately."],
  ["Plan with Pause", "Write the plan in your own words. Pause suggests the budget and lists each vendor for a vote."],
  ["The group approves", "When enough people approve, a short countdown starts. Anyone can tap Object if something looks wrong."],
  ["Pause pays", "The vendor is paid in seconds and confirms delivery. Money left over, or a cancelled event, goes back to everyone fairly."],
];

const TRUST = [
  ["It can't pay anyone you didn't approve", "The rules live in a contract on NEAR. Pause's own key can only suggest a payment and pay an approved one. NEAR itself refuses anything else."],
  ["Every payment waits a moment you can stop", "After the group approves, there's a short countdown. One tap on Object sends it back to a vote."],
  ["Everything happens in the open", "Every payment, vote and receipt is posted in your group and recorded on NEAR, where anyone can check it."],
  ["No one person controls the money", "Not the organiser, not the treasurer, not Pause. Spending needs the number of approvals your group chose."],
];

export default function Home() {
  const passed = results.rows.filter((r) => r.ok).length;
  return (
    <main id="main" className="landing">
      <section className="night lp-hero">
        <div className="wrap lp-hero-grid">
          <div>
            <p className="eyebrow">Live on NEAR · Telegram and web</p>
            <h1>The AI agent that plans, secures and <span className="serif">pays</span> for your group.</h1>
            <p className="lede">
              Add Pause to your group chat. It helps you plan the event, collects everyone&apos;s share, pays the vendors you approve, and stops scammers
              before they can run with your money.
            </p>
            <div className="hero-cta">
              <Link className="btn primary" href="/groups">Try it now, no wallet needed</Link>
              <a className="btn ghost-night" href="https://t.me/Pausenearai_bot?startgroup=pause" target="_blank" rel="noreferrer">Add to Telegram</a>
            </div>
            <p className="small muted lp-hero-note">Free to try. Every demo payment is a real transaction on NEAR testnet.</p>
          </div>

          <div className="lp-chat" aria-label="Example group chat">
            <div className="feed-top"><span className="feed-avatar" aria-hidden>🎓</span><div><b>Class of 2016 Reunion</b><span className="muted small"> · 5 members</span></div></div>
            <div className="lp-chat-body">
              <div className="fmsg member"><span className="fwho">Ada</span><div className="fbubble">Who&apos;s collecting the reunion money this time? 😅</div></div>
              <div className="fmsg member"><span className="fwho">Tunde</span><div className="fbubble">@Pausenearai_bot plan it for us. Hall, food and drinks, Saturday.</div></div>
              <div className="fmsg bot"><span className="fwho">Pause</span><div className="fbubble">🧮 Budget for 5: hall 6, food 4, drinks 2 NEAR. I&apos;ve listed each vendor for a vote. 3 of you must approve.</div></div>
              <div className="fmsg bot"><span className="fwho">Pause</span><div className="fbubble">💰 Musa paid 2 NEAR. Raised <b>8 of 10</b>. Still to pay: Chi.</div></div>
              <div className="fmsg bot"><span className="fwho">Pause</span><div className="fbubble">💸 Paid the hall, 6 NEAR. 📦 Hall: &ldquo;Received, see you Saturday 10:00.&rdquo;</div></div>
              <div className="fmsg bot"><span className="fwho">Pause</span><div className="fbubble">🛑 I didn&apos;t pay <code>drinks-plug</code>: other Pause users reported it as a scam.</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">One agent, four jobs</p>
            <h2>Everything a good treasurer does, without the <span className="serif">stress</span></h2>
            <p className="lede">Every group that raises money has one tired person chasing payments, and one nervous question: what if the money disappears? Pause takes both away.</p>
          </div>
          <div className="lp-jobs">
            {JOBS.map((j) => (
              <div key={j.t} className="card lp-job">
                <h3>{j.t}</h3>
                <p>{j.d}</p>
                <p className="lp-eg">{j.eg}</p>
              </div>
            ))}
          </div>
          <ul className="use-chips lp-uses" aria-label="What groups use Pause for">
            {USES.map((u) => <li key={u}>{u}</li>)}
          </ul>
        </div>
      </section>

      <section className="night band">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">How a group pot works</p>
            <h2>From &ldquo;who&apos;s collecting?&rdquo; to <span className="serif">paid</span>, in five steps</h2>
          </div>
          <ol className="lp-steps">
            {STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="lp-step-n">{i + 1}</span>
                <div><h3>{t}</h3><p>{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="hero-cta">
            <Link className="btn primary" href="/groups">Run a reunion pot now</Link>
            <AskButton q="How does a group pot work?" />
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap lp-split">
          <div>
            <p className="eyebrow">For you, too</p>
            <h2>Scam payments get <span className="serif">paused</span> in seconds</h2>
            <p className="lede">
              The same safety works for one person. Payments to new or reported accounts wait a little, Pause asks a few kind questions, and a family member is
              told if something looks wrong. Paste any chat and Pause checks it for romance or investment scam signs.
            </p>
            <div className="hero-cta">
              <Link className="btn" href="/check">Check a message</Link>
              <Link className="btn" href="/vault">My vault</Link>
            </div>
          </div>
          <div className="card lp-hold">
            <p className="small muted">Payment to a new account</p>
            <p className="figure lp-hold-amt">30 NEAR</p>
            <p className="lp-hold-state"><span className="pill r-High">Held</span> Waiting 24 hours. Your son has been told.</p>
            <p className="small muted">Nothing has left your account. You can cancel any time.</p>
          </div>
        </div>
      </section>

      <section className="band lp-trust-band">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">Why you can trust it</p>
            <h2>An agent that can&apos;t run off with the <span className="serif">money</span></h2>
          </div>
          <div className="lp-trust">
            {TRUST.map(([t, d]) => (
              <div key={t} className="card lp-trust-item"><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="band night">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">Live proof</p>
            <h2>Running on NEAR right <span className="serif">now</span></h2>
            <p className="lede">These numbers are read live from the Pause contract on NEAR testnet.</p>
          </div>
          <LiveProof />
          <div className="lp-results">
            <div className="lp-results-head">
              <h3>Safety checks: {passed} of {results.rows.length} passed</h3>
              <span className="muted small">Real transactions on NEAR testnet, {new Date(results.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <ul>
              {results.rows.map((r) => (
                <li key={r.id}>
                  <span className={r.ok ? "ok" : "bad"} aria-label={r.ok ? "passed" : "failed"}>{r.ok ? "✓" : "✕"}</span>
                  <span><b>{r.scenario}</b><span className="muted"> · {r.expected}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="section-intro">
            <p className="eyebrow">For judges</p>
            <h2>Try everything in two <span className="serif">minutes</span></h2>
          </div>
          <ol className="lp-judge">
            <li className="card"><b>1. Open Groups and press &ldquo;Start the reunion pot&rdquo;.</b><span>You become the organiser. Four classmates are played by our server. Two have already paid.</span></li>
            <li className="card"><b>2. Tap &ldquo;Use the reunion plan&rdquo;, then Plan. Approve the hall.</b><span>Pause lists three vendors. Your vote plus two classmates approves the hall and starts a 2-minute countdown.</span></li>
            <li className="card"><b>3. Watch Pause pay, then try to pay a scammer.</b><span>The hall is paid and confirms. Tap &ldquo;Add the drinks plug&rdquo;: Pause flags it and refuses to pay. Ask Pause anything in the chat.</span></li>
          </ol>
          <div className="hero-cta"><Link className="btn primary" href="/groups">Start now</Link><a className="btn" href="https://t.me/Pausenearai_bot" target="_blank" rel="noreferrer">Chat with the Telegram bot</a></div>
        </div>
      </section>

      <section className="band-tight">
        <div className="wrap lp-soon">
          <div><b>Coming soon</b><span className="muted"> · Tag @PauseAI on X for answers · WhatsApp groups · Pay vendors in naira and other local currencies</span></div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <p><b>Pause</b>. The AI agent that plans, secures and pays for you. Built at NEAR HACKATHON on NEAR and NEAR AI Cloud.</p>
            <p className="muted small">Testnet only for now. Pause can be wrong; when in doubt, talk to someone you trust.</p>
          </div>
          <div className="hero-cta" style={{ marginTop: 0 }}>
            <Link className="btn small-btn" href="/status">Status</Link>
            <a className="btn small-btn" href="https://github.com/lozentrad3s/pause">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
