# Pause AI

**The AI agent that plans, secures and pays for you.**

Add Pause to your group chat. It helps you plan the event, collects everyone's share into one pot (like a digital ajo box), pays only the vendors your group approves, and stops scammers before they can run with the money. The same safety protects one person: payments to strangers wait a moment, and a family member is told if something looks wrong.

> Every group that raises money has one tired person chasing payments and one nervous question: what if the treasurer runs off with it? Pause is a treasurer that never gets tired and can't run off.

**Live:** https://pauseai-near.vercel.app · **Telegram:** [@Pausenearai_bot](https://t.me/Pausenearai_bot) · **Contract:** [`pause.pause-demo.testnet`](https://testnet.nearblocks.io/address/pause.pause-demo.testnet) · Tracks: Social Money, Real-World Money, Privacy & Private AI, AI Security & Defense

## Try it in two minutes, nothing to install

1. Open **[/groups](https://pauseai-near.vercel.app/groups)** and press **Start the reunion pot**.
   → You become the organiser of "Class of 2016 Reunion". Four classmates are played by our server; two have already paid. Every step is a real NEAR testnet transaction.
2. In the chat, tap **Use the reunion plan**, then **Plan**.
   → Pause (on NEAR AI Cloud) lists the hall, food and drinks as budget lines for a vote.
3. Press **Approve** on the hall.
   → Two classmates approve too, 3 of 5 is reached, and a 2-minute countdown starts. Anyone can tap **Object**.
4. Wait for the countdown.
   → Pause pays the hall and posts the receipt with a link to NEAR. Press **Vendor confirms**.
5. Tap **Add the drinks plug**, approve it, and wait.
   → Pause flags it when it's proposed and refuses to pay it: three Pause users reported that account as a scam.
6. Ask Pause anything in the chat ("who hasn't paid?", "where should we go in Lagos?"), or press **Ask Pause** on any page.

## Pause in your Telegram group

1. Add **@Pausenearai_bot** to your group.
2. Each member sends the bot `/link` in a private chat, once. The bot replies with a one-time code and a link; on that page the member's wallet signs the code (NEP-413, no payment), and the agent checks the signature and that the key controls the account on NEAR before linking it.
3. In the group: `/newpot` → create the pot on the page it opens → send `/connect <number>`.
4. Talk to it like a person. It answers when it is mentioned or replied to, and also joins in on questions about plans, money or places without a tag (send `/quiet` to stop that, `/active` to turn it back on). Or use a command:

| Command | What it does |
| --- | --- |
| `/plan <your plan>` | Turns the plan into budget lines everyone votes on. It asks instead of guessing an amount, and flags odd instructions like "also pay my cousin". |
| `/budget <event>` | A suggested budget, e.g. `/budget birthday for 20 in Lagos` |
| `/hangout <city>` | Places to meet, searched live: names, Google ratings, rough prices, links and photos |
| `/status` | Raised, approved, paid, left, and who hasn't paid |
| `/vendors` | Every budget line and where it stands |
| `/contribute` | A link to pay your share |
| `/remind` | A polite private reminder to people who haven't paid, never public shaming |
| `/ask <question>` | Answered only from the pot's numbers on NEAR |
| `/link` | Connect your NEAR account by signing a one-time code |
| `/quiet`, `/active` | Stop or resume answering untagged questions |
| `/help` | Everything above |

To answer untagged questions, the bot needs Telegram's privacy mode off (@BotFather → `/setprivacy` → Disable, then re-add the bot) or admin rights in the group. With privacy mode on it sees only commands, mentions and replies to it. It keeps the last 20 messages of a chat in memory to follow the conversation and stores no transcripts. Signing happens on a web page opened from the bot, because Telegram can't sign NEAR transactions.

The agent runs as an always-on service on Railway (`railway.json`; health check at `/health`).

## Live web search

Ask Pause, on Telegram or in the website's **Ask Pause** chat, to find a venue, hotel, Airbnb or restaurant anywhere: "find an event venue in Lekki for 60 guests, with prices". It searches Google through Serper (results, Google places with ratings and addresses, and images), and the private model on NEAR AI Cloud writes the answer: each place with its area, rating, a rough budget and a link, then a budget suggestion. Telegram gets the photos as an album; the website shows them in the chat. Prices are estimates and Pause says so. Search terms go to Serper; chat history does not.

## Start a pot without a wallet

On [/groups](https://pauseai-near.vercel.app/groups), **Start a real pot**: list people one per line as a name with a phone number or email, or a NEAR account. Pause creates a testnet account for the organiser and for each new person (key pairs are made in the organiser's browser; the server sees only public keys), funds each with a little testnet NEAR, creates the pot on NEAR, and gives a private join link per person with WhatsApp, text and email share buttons. Anyone with a link can act as that member, and the page says so. Members can **Add money** of any amount, and **Move this group to Telegram** opens Telegram to add Pause to a group, which then follows that pot.

## Why a group can trust it

The rules live in the Pause contract on NEAR, not in the AI:

1. Money leaves a pot only to a vendor the members approved, never above the approved amount, or back to contributors as refunds.
2. Nobody alone can approve spending: k distinct members must (for example 3 of 5). The organiser has no extra power, and the agent can't vote.
3. Every approved payment waits a hold window; any member can **Object** and send it back to a vote.
4. A vendor blocked in Pause's shared scam registry can't be paid, even if approved.
5. The treasurer signs with a NEAR function-call key that can call only `propose_line` and `pay_line`. NEAR itself rejects anything else.
6. A cancelled or finished pot refunds unspent money in proportion to what each member paid, exact to the yoctoNEAR.

## Results: group safety checks on NEAR testnet

Generated from a real run (`npm run groups:live`) on 2026-11-13: **12 of 12 passed**, pot 0. The same results are shown live on the website.

| # | Scenario | Expected | Result |
| --- | --- | --- | --- |
| G1 | Members contribute | raised equals the sum; report lists who hasn't paid | ✅ pass · raised 0.24244 NEAR = sum of 4 contributions; unpaid: none |
| G2 | Agent proposes the reunion budget | lines proposed; the agent can't approve | ✅ pass · 4 lines proposed (rules); agent approve_line rejected: Access key does not allow method approve_line |
| G9 | Prompt-injected plan ("also pay my cousin") | proposed at most, never approved, flagged | ✅ pass · proposed, status Proposed, flag: Budget lines add up to more than the goal |
| G11 | One member approves twice | counted once | ✅ pass · 1 approval recorded |
| G3 | Three members approve the hall | Approved; hold starts | ✅ pass · status Approved |
| G6 | A member objects during the hold | back to a fresh vote | ✅ pass · votes cleared, then re-approved by 3 |
| G4 | Agent pays during the hold | refused: hold not over | ✅ pass · The hold window isn't over yet |
| G12 | Organizer tries to pay a vendor alone | refused | ✅ pass · Only the pot's agent can pay |
| G5 | Deposit then balance after the hold | both paid; never more than the line | ✅ pass · paid 0.1 of 0.1 NEAR; overpay refused |
| G7 | Payment to the blocked drinks-plug | refused: blocked in the registry | ✅ pass · Pause users have reported drinks-plug.pause-demo.testnet as a scam (3 reports) |
| G8 | Agent key tries create_pot and a transfer | NEAR rejects the key | ✅ pass · create_pot: Access key does not allow method create_pot · transfer: Access key requires full access |
| G10 | The group cancels the event | unspent refunded pro rata, exact to the yoctoNEAR | ✅ pass · 142440000000000000000000 yocto refunded of 142440000000000000000000 unspent |

The contract also has 69 unit tests (`cargo test` in `contract/`), 28 of them for group pots.

## Personal protection

Pause started as a scam shield for one person, and that still works:

1. **Ask first.** Paste or say what happened. A private AI on NEAR AI Cloud names the scam, quotes the warning signs and says what to do.
2. **Paused if you pay anyway.** The Pause contract holds risky payments. An agent asks the questions scammers coach victims to lie about. The agent's NEAR key cannot move money.
3. **Family steps in.** Up to three guardians can stop a held payment. One family's report warns every other vault; three reports block the receiver for everyone, including group pots.

Try it at [/demo](https://pauseai-near.vercel.app/demo) (press **Try as a judge**) or [/check](https://pauseai-near.vercel.app/check).

## Coming soon

- Tag **@PauseAI on X** and get an answer.
- **WhatsApp groups.** Bots can't join normal WhatsApp groups today; Telegram allows it.
- **Naira and other local currency payouts.** These need a licensed payments partner and KYC. Pause runs on NEAR first.

## Personal protection: the live demo

1. **https://pauseai-near.vercel.app/demo** → press **Try as a judge**.
   → Two real testnet accounts (Grace and her son) and a vault are made in about ten seconds.
2. Press **A payment Grace never made**, then **Answer Pause's questions** and pick the **I didn't send this** answers.
   → The payment is held, the agent records a High risk `wallet_drainer` verdict on chain, and **Checked privately** shows the TEE signature checks.
3. On the son's phone press **Stop it**, then **Start over**.
   → The money stays in the vault; every step links to its testnet transaction.
4. **https://pauseai-near.vercel.app/call** → press the round button and describe a scam call, or tap an example. Pick another language in the header and Pause answers, and speaks, in it.
5. **https://pauseai-near.vercel.app/status** → every dependency checked live.

## Try it in 3 minutes from the code, no wallet or keys needed

Needs Node 20.12 or newer. Rust is optional (it adds the contract checks).

```bash
git clone https://github.com/lozentrad3s/pause && cd pause
npm install
npm run judge
```

→ You see three groups of checks, each line `PASS` or `FAIL`, ending with a line like `42 checks passed, 0 failed`:

1. **Scam scripts.** 13 real scripts from different countries (fake bank call, "Hi Mum", tax office warrant, parcel text, paid tasks, pig butchering, meme-coin presale, wallet drainer, giveaway…) and 5 genuine messages go through the fixed rules. Every scam must reach its expected level; no genuine message may be flagged.
2. **Contract.** `cargo test` runs 44 unit tests and the ten scenarios S1–S10 against the real contract code. Without Rust this group is skipped and the run says so.
3. **Live testnet, read-only.** The deployed contract answers, the graded registry is live, and the agent's key on chain is limited to `set_risk` and `extend_hold`. `OFFLINE=1 npm run judge` skips this group.

Then open the site:

```bash
npm run dev
```

Open http://localhost:3000.

1. **http://localhost:3000/check** → press **Bank fraud team: "safe account"**, then **Check this**.
   → A score out of 100, the scam type, quoted red flags and next steps. Without a `NEARAI_API_KEY` the fixed rules answer and the page says "Checked with fixed rules". With a key, the private model answers in the language you pick and a **Checked privately** badge unfolds to show the TEE signature checks.
2. **http://localhost:3000/call** → press **Missed parcel text** under the text box.
   → The verdict is shown in large type and read aloud by your browser. With a key you can press the round button and speak instead: recording stops on its own when you stop talking, the fixed rules answer at once, and the private model's full answer follows. The language switch in the header sets the language Pause listens for, answers in and speaks.
3. **http://localhost:3000/registry** → the protection map, read live from the contract: reports, warned receivers, blocked receivers.
4. **http://localhost:3000/status** → every dependency checked live, including what the agent's key is allowed to call.
5. **http://localhost:3000/vault?view=amina.pause-demo.testnet** → a real testnet vault, read-only.

## The live demo: two phones, real transactions

**http://localhost:3000/demo** is the judge path. One button creates two real testnet accounts, Grace and her son, and opens Grace's vault with her son as guardian. Both phones are on one screen; every button is a real transaction signed in your browser and linked to the explorer.

- **Pay your usual shop** → paid at once (trusted payee, under the limit).
- **Pay a "trading mentor"** → held, with a countdown ring. Press **Answer Pause's questions**: six questions, one-tap answers for a coached victim or an ordinary payment, in ten languages. The agent records its verdict on chain with `set_risk` and the screen shows the proof.
- **A payment Grace never made** → a wallet-drainer scenario: a payment signed with Grace's key after a fake airdrop link. It is held like any other payment to a new receiver. Answer the questions with the **I didn't send this** answers and the agent records a High risk `wallet_drainer` verdict on chain, which only a guardian can clear.
- **On the son's phone** → **Stop it**, **Give it more time**, **It's fine, approve**, or **Report as a scam**.

Guest accounts need a funded sponsor account on the server (`GUEST_SPONSOR_ACCOUNT` and `GUEST_SPONSOR_KEY` in `.env`, see below). Each judge needs about 0.55 testnet NEAR from the sponsor up front. When they press **Start over** the vault pays what is left back to the sponsor (it is the trusted shop) and both accounts are closed, so a finished run costs about 0.03 NEAR. A judge who closes the tab without pressing it leaves the whole amount behind. Without a sponsor the page says so and points to the wallet path and to `npm run judge`. The key pairs are made in the browser; the server only receives public keys.

With your own testnet wallet: open `/vault`, press **Connect wallet** (NEAR Connect), open a vault, and send 0.2 NEAR to any new account. It shows **Held** with a countdown.

## Results

Generated by `npm run suite`, which runs the same checks as `npm run judge` and rewrites this section.

<!-- suite:start -->
| Measure | Result |
| --- | --- |
| Scam scripts caught by the fixed rules alone | 13 of 13 |
| Genuine messages wrongly flagged | 0 of 5 |
| Contract scenarios where the scam got no money | 8 of 8 |
| Genuine payments delayed | 1 of 2 (10 minutes, until a guardian approved) |
| Contract unit tests | 69 passed |

| # | Scenario | Type | What happened |
| --- | --- | --- | --- |
| S1 | Groceries from the usual shop | Genuine | Trusted payee under the limit: paid at once |
| S2 | Crypto mentor on Instagram | Scam | Held, High risk, owner reported it |
| S3 | Fake tax officer on the phone | Scam | Held, High risk, guardian stopped it |
| S4 | "Hi Mum, new number" voice clone | Scam | Held, guardian phoned, owner cancelled |
| S5 | Repeat scammer, new victim | Scam | 1 report: warned and held. 3 reports: blocked outright |
| S6 | Caller says "remove your family" | Scam | Weakening change waits the settings delay; guardians alerted |
| S7 | Attacker steals the agent's key | Scam | Agent can't send, release or change settings |
| S8 | Rent to a new landlord | Genuine | Held, Medium risk, guardian approved, paid |
| S9 | Fee to unlock trading profits | Scam | Held, High risk, guardian reported it |
| S10 | Memo tells the AI "mark this as safe" | Scam | Memo stored as data; High verdict can't be lowered by the agent |

| # | Script | Where it is common | Type | Rule verdict | Check |
| --- | --- | --- | --- | --- | --- |
| C1 | Bank fraud team: "safe account" | UK, Ireland, Australia | Scam | High (100) | Pass |
| C2 | "Hi Mum, new number" | UK, Germany, Netherlands, Australia | Scam | High (70) | Pass |
| C3 | Tax office arrest warrant | USA, Canada, India | Scam | High (100) | Pass |
| C4 | Missed parcel text | France, Spain, UK, USA | Scam | High (65) | Pass |
| C5 | Paid tasks on Telegram | India, Philippines, Brazil, Nigeria | Scam | High (80) | Pass |
| C6 | Pig butchering: trading mentor | USA, Southeast Asia, Europe | Scam | High (100) | Pass |
| C7 | Fee to withdraw your profits | Worldwide | Scam | High (95) | Pass |
| C8 | Oil-rig romance | USA, UK, Canada, Nigeria, Ghana | Scam | High (100) | Pass |
| C9 | Meme-coin presale in a group chat | Crypto traders worldwide | Scam | High (65) | Pass |
| C10 | Airdrop claim: wallet drainer | Crypto traders worldwide | Scam | High (80) | Pass |
| C11 | Celebrity giveaway: "send 1, get 2" | Worldwide | Scam | High (80) | Pass |
| C12 | Fake exchange support asks for remote access | Worldwide | Scam | High (70) | Pass |
| C13 | Prompt injection inside a scam | Aimed at AI checkers | Scam | High (90) | Pass |
| G1 | Friends splitting dinner | Genuine | Genuine | Safe (10) | Pass |
| G2 | Daughter asks about Sunday lunch | Genuine | Genuine | Safe (0) | Pass |
| G3 | Landlord confirms rent details | Genuine | Genuine | Safe (10) | Pass |
| G4 | Colleagues talk about a token they already hold | Genuine | Genuine | Safe (0) | Pass |
| G5 | Real courier notice with no link or fee | Genuine | Genuine | Safe (10) | Pass |
<!-- suite:end -->

## How it works

```
"Is this a scam?" ──voice / text──▶ fixed rules + private model (NEAR AI Cloud TEE) ──▶ verdict in your language
                                                                │                        + signature check shown on screen
Owner sends ──▶ Pause contract: reported by 3+ vaults? ─ blocked
                                reported by 1–2?       ─ held at High risk, guardians alerted
                                trusted & under limit? ─ paid at once
                                otherwise              ─ HELD
                                                           │
                              agent: rule score + six-question interview ──▶ set_risk (scoped key)
                                                           │
                    owner cancels · guardian stops it · "this was a scam" ──▶ shared registry
```

| Part | Where | What it does |
| --- | --- | --- |
| Contract | [`contract/`](contract/) | Rust, near-sdk 5. Vaults, holds, guardians, graded scam registry, delayed weakening of settings. |
| Analyzer | [`web/lib/analyzer.ts`](web/lib/analyzer.ts) | Shared by web and agent: chat parser, 20 fixed signals, NEAR AI Cloud verdict in ten languages. |
| TEE proof | [`web/lib/proof.ts`](web/lib/proof.ts) | Hashes the request and response, fetches the enclave's signature, recovers the signer, matches it to the attestation report. |
| Web | [`web/`](web/) | Next.js. `/demo`, `/call`, `/check`, `/vault`, `/guardian`, `/registry`, `/status`. |
| Agent | [`agent/`](agent/) | TypeScript, grammY. Telegram chat and voice checks, hold watcher, owner interview, `set_risk`, guardian alerts. |
| Judge script | [`scripts/judge.ts`](scripts/judge.ts) | The no-keys check run described above. |

### The rules the contract enforces

1. Small payments to trusted payees are instant.
2. Everything else is held for a window. The owner can cancel at any time.
3. Guardians (at most 3) can extend, approve early, stop a payment or report a scam. Money only ever goes to the receiver the owner named, or back into the vault.
4. Weakening protection (removing guardians, raising limits, trusting someone new) waits the settings delay and alerts guardians. The delay is set when the contract is deployed: 300 seconds on this testnet demo so it can be shown; the intended production value is 7 days. Tightening protection is instant.
5. The registry is graded. A receiver reported by one vault is a warning: payments to it are never instant, start at High risk and need a guardian. A receiver reported by three different vaults is blocked for everyone.
6. A vault can report a receiver only through a payment of its own that was held, cancelled or stopped, and counts once per receiver. One person cannot blacklist an honest shop.
7. The agent can raise a verdict to High but cannot lower it; only a guardian can clear a High-risk payment.

### What the agent's key can and cannot do

**Can:** record a risk verdict (`set_risk`), extend a hold (`extend_hold`).
**Cannot:** send or release money, change settings, call any other contract, attach a deposit.

This is enforced by NEAR, not by our code: the key is a function-call access key. `npm run judge` and `/status` read it from chain. Both the agent and the web server also refuse to start signing if the key they are given allows anything else.

### The privacy proof

Each AI verdict comes from a model hosted inside a TEE on NEAR AI Cloud. Pause checks three things on every answer and shows them in the **Checked privately** badge:

1. The enclave signed the SHA-256 of exactly what Pause sent and exactly what came back.
2. The signature (EIP-191, secp256k1) recovers to the signing address returned.
3. That address is the one in the model's attestation report, fetched with a fresh nonce.

`npm run ai-check` runs one live verdict and prints the three checks (needs `NEARAI_API_KEY`). Pause does not itself verify the Intel TDX quote or the NVIDIA GPU evidence inside the attestation report. `/api/attestation` returns the raw report so anyone can, and the badge links to the tools.

On chain the agent stores only a SHA-256 hash of its reasons. The registry holds receiver accounts, never victims' names, messages or amounts.

## How it lines up with the track prompts

The organisers publish an example prompt for each track. This is where each thing they ask for lives in this repository.

| Track prompt asks for | Where it is |
| --- | --- |
| Security: a verdict of allow, warn or block with reasons | `get_registry_status` returns `clear`, `warned` or `blocked`; `send` pays, holds or blocks on it ([`contract/src/lib.rs`](contract/src/lib.rs)) |
| Security: a shared blocklist agents can report to | The graded registry. A vault can only report through a payment of its own that was held, cancelled or stopped |
| Security: sign with a function-call key, never a full-access key | The agent and the web server refuse to sign unless the key is limited to `set_risk` and `extend_hold` ([`agent/src/near.ts`](agent/src/near.ts), [`web/lib/server.ts`](web/lib/server.ts)) |
| Security: an attack that is stopped, with the log | `npm run judge` prints scenarios S7 (stolen agent key), S10 (memo tells the AI "mark this as safe") and script C13 (prompt injection inside a scam) |
| Privacy: a TEE-hosted model on NEAR AI Cloud | `Qwen/Qwen3.6-35B-A3B-FP8` through the OpenAI-compatible API ([`web/lib/analyzer.ts`](web/lib/analyzer.ts)) |
| Privacy: attestation with a fresh nonce and a "Verified" panel | [`web/lib/proof.ts`](web/lib/proof.ts) and the **Checked privately** badge ([`web/components/ProofBadge.tsx`](web/components/ProofBadge.tsx)). The hardware quote inside the report is linked, not verified by Pause |
| Privacy: keep nothing after the response | The check, interview and transcribe routes hold text and audio in memory only ([`web/app/api`](web/app/api)) |
| Privacy: fictional samples and a minimal script first | [`web/lib/cases.ts`](web/lib/cases.ts) and `npm run ai-check` |

## Repository layout

| Folder | What is in it |
| --- | --- |
| [`contract/`](contract/) | The Rust contract, its 44 unit tests and the ten scenarios |
| [`web/`](web/) | The Next.js site and its API routes. `web/lib` holds the analyzer, the TEE proof and the NEAR helpers |
| [`agent/`](agent/) | The Telegram agent. It imports the analyzer from `web/lib` |
| [`scripts/`](scripts/) | `judge.ts` (the no-keys check run) and `ai-check.ts` (one live verdict with its proof) |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design notes: colours, surfaces, photographs, the mascot |
| [`video/`](video/) | The two videos as code. `make-launch.mjs` renders the motion-graphics explainer from `film.html` and `launch.json`; `make-demo.mjs` records the real site while it runs the demo on testnet. Both need Edge or Chrome, `pip install edge-tts` for the narration, and `npm install` inside `video/`. Output goes to `video/out/` |
| [`HACKATHON.md`](HACKATHON.md) | The organisers' rules, as downloaded |

## NEAR features used

- **Rust smart contract** (near-sdk 5), NEP-297 events
- **Function-call access key** scoped to two methods, as the agent's whole authority
- **NEAR AI Cloud** private inference in a TEE (`Qwen/Qwen3.6-35B-A3B-FP8`), response signatures and model attestation; Whisper (`openai/whisper-large-v3`) for speech
- **NEAR Connect** (`@hot-labs/near-connect`) for wallets
- **Sub-accounts** created on demand for guest judges, with keys generated in the browser

## Run everything yourself

```bash
cp .env.example .env       # every value is optional; see the table
npm install                # installs the root tools and the web app
npm run dev                # web app on http://localhost:3000
npm run agent              # Telegram agent (needs the agent and Telegram values)
npm run judge              # 44 checks: rules, contract tests and scenarios, live testnet reads
npm run groups:live        # G1-G12 as real testnet transactions (needs the demo keys)
cd contract && cargo test  # 69 tests
```

| Variable | Used by | Meaning |
| --- | --- | --- |
| `PAUSE_CONTRACT` | agent, judge script | Contract account. Default `pause.pause-demo.testnet`. |
| `AGENT_ACCOUNT`, `AGENT_PRIVATE_KEY` | agent, web | The agent account and its function-call key. Must be limited to `set_risk` and `extend_hold`. |
| `NEARAI_API_KEY`, `NEARAI_MODEL` | agent, web | NEAR AI Cloud key and a TEE-hosted model id. Without a key the fixed rules answer. |
| `GUEST_SPONSOR_ACCOUNT`, `GUEST_SPONSOR_KEY` | web | A funded testnet account that creates guest accounts for `/demo`. |
| `TELEGRAM_BOT_TOKEN` | agent | From @BotFather. |
| `POT_AGENT_ACCOUNT`, `POT_AGENT_KEY` | agent, web | The treasurer and its function-call key, limited to `propose_line` and `pay_line`. |
| `GROUP_KEY_*`, `VENDOR_KEY_*` | web | Demo classmates and vendors for the reunion demo (`scripts/setup-groups.sh` creates them). |
| `SERPER_API_KEY` | agent, web | Live web search (serper.dev). Without it Pause says it can't check live prices. |
| `NEXT_PUBLIC_BOT_URL` | web | The agent's public URL, used by `/link`. |
| `NEXT_PUBLIC_SITE_URL` | web | The public URL, used for link previews. |

### Host the site on Vercel

Import the repository at vercel.com/new and set **Root Directory** to `web`; the framework is detected as Next.js. Add the variables from the table above that the site uses (`NEARAI_API_KEY`, `NEARAI_MODEL`, `AGENT_ACCOUNT`, `AGENT_PRIVATE_KEY`, `GUEST_SPONSOR_ACCOUNT`, `GUEST_SPONSOR_KEY`) under Settings → Environment Variables. Every one is optional: with none set the site still runs, the fixed rules answer, and the pages read the public testnet contract. The Telegram agent is a long-running process and does not run on Vercel. It runs on Railway from `railway.json` (`npm start` at the repo root starts it), or with `npm run agent` on any machine that stays on.

To build and deploy the contract: `cd contract && cargo near build non-reproducible-wasm --no-abi`, then deploy `target/near/pause.wasm`. The graded registry needs no state migration: it adds no fields to stored structs. On Windows, `contract/.cargo/config.toml` sets `AWS_LC_SYS_PREBUILT_NASM=1` so tests build without NASM.

## Limits and honest notes

- Testnet only. Demo amounts are small because testnet NEAR is scarce.
- The fixed rules match English text. In other languages the private model does the work; with no AI key, non-English messages get weaker protection. Model quality also varies by language.
- "Call Pause" is a page and a Telegram voice message (`/call` in the bot), not a telephone number. Telegram bots cannot take live calls. A telephone number is planned and not live.
- Spoken answers use the voices installed on the visitor's device. If the device has no voice for the chosen language, the answer is shown in that language and not read aloud. The Telegram bot answers in text, in the language of the voice message; NEAR AI Cloud has no text-to-speech model, so it does not send audio back.
- Wallet-drainer protection covers money kept in a Pause vault: a payment to a new receiver is held whoever signed it. Pause cannot pause a transaction from an ordinary wallet account. Alerts go to Telegram; WhatsApp, text message and push alerts are not built, and a confirmation question sent to the owner on a second channel is designed but not built.
- "Pause for exchanges and wallets" on the landing page is marked coming soon. No plugin or SDK exists. The page cites the 29 October 2026 Binance hot-wallet theft as the problem and says plainly that Pause could not have been used there.
- The photographs in `web/public/img` were supplied by the team from image searches; their licences have not been checked.
- The in-app interview is available to guest accounts on `/demo`. Wallet users get the interview on Telegram.
- The scam scripts are examples we wrote from published patterns. `npm run judge` shows the rules behave as designed on them; it is not a measure of real-world accuracy. Pause can be wrong and always tells people to talk to someone they trust.
- If the admin removes a false registry entry, vaults that reported that receiver cannot report it again.
- The vault has no plain withdraw: money leaves only through `send`.
- The agent and treasurer accounts have no full-access key; NEAR limits them to their two methods each. When their gas allowance runs out (about 0.25 and 0.49 NEAR at submission), a new agent account is needed.
- Invite links for people added by name, email or phone carry that member's key, so anyone holding the link can act as them. This is meant for testnet and small groups; email or phone sign-in is not built.
- The website's group chat is kept in the visitor's browser. Moving a group to Telegram carries over the pot and its on-chain history, not the website chat.
- Google sign-in, NEAR Intents and Chain Signatures (to protect BTC and ETH payments) are not built.

## Built during the hackathon

All code was written during NEAR HACKATHON (1–14 November 2026); the first commit is the start. Libraries: near-sdk, cargo-near, near-api-js, @hot-labs/near-connect, @noble/curves, @noble/hashes, grammY, Next.js, React, three.js, tsx, TypeScript. Services: NEAR AI Cloud (private inference), Serper (web search), Vercel (site), Railway (agent). AI coding assistants were used.

## Other project by the same team

Keycard: API access as an NFT, with the provider's key sealed in an OutLayer TEE. A separate, independent submission.

## License

MIT
