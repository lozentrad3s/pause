import Image from "next/image";
import Link from "next/link";
import Photo from "@/components/Photo";
import LiveProof from "@/components/LiveProof";
import AskButton from "@/components/AskButton";
import results from "@/lib/groups-results.json";

const TG = "https://t.me/Pausenearai_bot?startgroup=pause";

export default function Home() {
  const passed = results.rows.filter((r) => r.ok).length;
  const ran = new Date(results.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <main id="main" className="landing">
      {/* Opening: the group, and the agent that joins it */}
      <section className="night lp-hero">
        <div className="wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <h1>
              Good plans turn into group chats. Pause makes sure they turn into <span className="serif">paid</span>.
            </h1>
            <p className="lede">
              Add Pause to your group. It plans the budget, collects everyone&apos;s share, pays only the vendors you approve, and stops scammers before
              they touch the money.
            </p>
            <div className="hero-cta">
              <Link className="btn primary lp-cta" href="/groups">Try it now, no wallet needed</Link>
              <a className="btn ghost-night lp-cta" href={TG} target="_blank" rel="noreferrer">Add to Telegram</a>
            </div>
            <p className="small lp-hero-note">Free. Every demo payment is a real transaction on NEAR.</p>
          </div>

          <div className="lp-hero-visual">
            <div className="lp-hero-photo">
              <Image src="/img/group-trip.jpg" alt="Seven friends laughing together in a selfie" fill priority sizes="(max-width: 760px) 92vw, 460px" />
            </div>
            <div className="lp-hero-chat" aria-label="Pause in the group chat">
              <p className="lp-bubble member"><b>Ada</b>Who&apos;s collecting the money for the trip?</p>
              <p className="lp-bubble pause"><b>Pause</b>I&apos;ve got it. 5 of you, 2 NEAR each. Raised 8 of 10 so far.</p>
              <p className="lp-bubble pause"><b>Pause</b>Paid the villa deposit. The owner confirmed: &ldquo;See you Friday.&rdquo;</p>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 1: plan */}
      <section className="lp-chapter">
        <div className="wrap lp-chapter-grid">
          <Photo name="travel-planner.jpg" alt="A travel plan notebook, a phone and a map on a beach table" ratio="4 / 5" pos="center 40%" className="lp-photo">
            <div className="glass lp-glass">
              <span className="lp-glass-who">Pause</span>
              <p>For 12 friends in Lagos at about 15k each: a beach day at Tarkwa Bay, a rooftop in Lekki, or bowling in Ikeja. Want me to list them for a vote?</p>
            </div>
          </Photo>
          <div className="lp-chapter-copy">
            <p className="lp-quote">&ldquo;So where are we even going?&rdquo;</p>
            <h2>Pause does the planning nobody volunteers for.</h2>
            <p>
              Tell it what you&apos;re planning in your own words: the event, the city, how many people. Pause suggests a budget, places to go and what to
              book first. When you&apos;re happy, it turns the plan into a short list of vendors the group can vote on.
            </p>
            <p className="lp-limit">It asks instead of guessing. &ldquo;Pay the DJ whatever he asks&rdquo; gets a question, not a number.</p>
            <AskButton q="Plan a birthday for 15 friends in Lagos, about 10k each" label="Ask Pause to plan something" variant="light" />
          </div>
        </div>
      </section>

      {/* Chapter 2: collect */}
      <section className="lp-chapter alt">
        <div className="wrap lp-chapter-grid flip">
          <Photo name="couple-planning.jpg" alt="A couple planning together with a notebook and a calendar" ratio="4 / 5" pos="center 30%" className="lp-photo">
            <div className="glass lp-glass lp-pot">
              <div className="lp-pot-top"><span>Class reunion</span><span className="figure">8 / 10 NEAR</span></div>
              <div className="lp-pot-bar" aria-hidden><span style={{ width: "80%" }} /></div>
              <p><b>Paid:</b> Ada, Tunde, Musa, Grace. <b>Still to pay:</b> Chi.</p>
            </div>
          </Photo>
          <div className="lp-chapter-copy">
            <p className="lp-quote">&ldquo;Has everyone paid? I&apos;m not chasing anyone again.&rdquo;</p>
            <h2>One pot, everyone can see it, nobody has to chase.</h2>
            <p>
              Everyone pays their share into one pot, like a digital ajo or esusu box, saving toward the target together. The pot shows who has paid
              and who hasn&apos;t, to the whole group, all the time.
            </p>
            <p className="lp-limit">Pause reminds late payers privately, once a day. Never a public callout.</p>
          </div>
        </div>
      </section>

      {/* Chapter 3: pay */}
      <section className="lp-chapter">
        <div className="wrap lp-chapter-grid">
          <Photo name="family-coast.jpg" alt="Five friends on a cliff above a turquoise bay, pointing at the view" ratio="4 / 5" pos="center 60%" className="lp-photo">
            <div className="glass lp-glass">
              <span className="lp-glass-who">Pause</span>
              <p>Boat hire approved by 3 of 5. Paying in 2 minutes unless someone taps Object.</p>
              <p className="lp-glass-done">Paid. The boat owner confirmed: &ldquo;Ready at 10:00.&rdquo;</p>
            </div>
          </Photo>
          <div className="lp-chapter-copy">
            <p className="lp-quote">&ldquo;Who&apos;s paying the boat? Did the hall get the deposit?&rdquo;</p>
            <h2>The group approves. Pause pays in seconds.</h2>
            <p>
              When enough members approve a vendor, for example 3 of 5, a short countdown starts. Anyone can tap Object if something looks wrong. Then
              Pause pays, posts the receipt in the group, and the vendor confirms.
            </p>
            <p className="lp-limit">Pause can&apos;t pay anyone the group didn&apos;t approve, or more than they approved. If the event is cancelled, everyone gets their fair share back.</p>
          </div>
        </div>
      </section>

      {/* Chapter 4: protect */}
      <section className="lp-chapter night">
        <div className="wrap lp-chapter-grid flip">
          <Photo name="grandad-phone" alt="An older man looking at his phone" ratio="4 / 5" className="lp-photo">
            <div className="glass lp-glass lp-held">
              <span className="pill r-High">Paused</span>
              <p className="figure lp-held-amt">30 NEAR</p>
              <p>to an account reported as a scam. Nothing has left. His daughter has been told.</p>
            </div>
          </Photo>
          <div className="lp-chapter-copy">
            <p className="lp-quote">&ldquo;Send it now, before it&apos;s too late. Don&apos;t tell anyone.&rdquo;</p>
            <h2>A payment to a scammer gets paused in seconds.</h2>
            <p>
              Scammers count on hurry and secrecy. Pause takes both away. When one family reports a scam account, every pot and every Pause wallet
              is warned. Three reports and it can never be paid again.
            </p>
            <p>
              It works for one person too: payments to strangers wait a little, Pause asks a few kind questions, and a family member is told. Paste
              any chat and Pause checks it for romance or investment scam signs.
            </p>
            <div className="hero-cta">
              <Link className="btn ghost-night" href="/check">Check a message</Link>
              <Link className="btn ghost-night" href="/vault">Protect my wallet</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust, said once, plainly */}
      <section className="lp-trust-band">
        <div className="wrap lp-trust-grid">
          <h2>An agent that can&apos;t run off with the <span className="serif">money</span>.</h2>
          <dl className="lp-trust">
            <div><dt>It only pays who you approved.</dt><dd>The rules live in a contract on NEAR, not in the AI. Pause&apos;s own key can suggest a payment and pay an approved one. NEAR refuses anything else.</dd></div>
            <div><dt>No one person controls the money.</dt><dd>Not the organiser, not Pause. Spending needs the number of approvals your group chose.</dd></div>
            <div><dt>Every payment waits a moment you can stop.</dt><dd>One tap on Object sends it back to a vote.</dd></div>
            <div><dt>Everything happens in the open.</dt><dd>Votes, payments and receipts are posted in your group and recorded on NEAR, where anyone can check them.</dd></div>
          </dl>
        </div>
      </section>

      {/* Proof and judging */}
      <section className="lp-proof-band">
        <div className="wrap">
          <div className="lp-proof-grid">
            <div>
              <h2>Running on NEAR right now.</h2>
              <p className="lede">Read live from the Pause contract, and checked with real transactions.</p>
              <LiveProof />
            </div>
            <div className="card lp-results">
              <div className="lp-results-head">
                <h3>{passed} of {results.rows.length} safety checks passed</h3>
                <span className="muted small">NEAR testnet, {ran}</span>
              </div>
              <ul>
                {results.rows.map((r) => (
                  <li key={r.id}>
                    <svg className={r.ok ? "ok" : "bad"} width="16" height="16" viewBox="0 0 16 16" aria-label={r.ok ? "passed" : "failed"}>
                      {r.ok ? <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
                    </svg>
                    <span>{r.scenario}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lp-judge">
            <h2>Try the whole thing in two minutes.</h2>
            <ol>
              <li><b>Start the reunion pot.</b> You organise it. Four classmates are played by our server, and two have already paid.</li>
              <li><b>Plan it, then approve the hall.</b> Tap &ldquo;Use the reunion plan&rdquo;. Your vote plus two classmates starts a 2-minute countdown.</li>
              <li><b>Watch Pause pay, then try a scammer.</b> The hall gets paid and confirms. &ldquo;Add the drinks plug&rdquo; gets flagged and refused.</li>
            </ol>
            <div className="hero-cta">
              <Link className="btn primary lp-cta" href="/groups">Start the reunion pot</Link>
              <a className="btn lp-cta" href="https://t.me/Pausenearai_bot" target="_blank" rel="noreferrer">Chat with Pause on Telegram</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer lp-footer">
        <div className="wrap footer-grid">
          <div>
            <p><b>Pause</b>, the AI agent that plans, secures and pays for you. Built at NEAR HACKATHON on NEAR and NEAR AI Cloud.</p>
            <p className="muted small">Coming soon: ask Pause by tagging it on X, WhatsApp groups, and paying vendors in naira and other local currencies. Testnet only for now.</p>
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
