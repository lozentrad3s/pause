# Pause

**A scam firewall for your family's money, built on NEAR.**

Every team here built a firewall so AI agents can't be scammed. We built one for your mother.

Romance and crypto scammers meet people on WhatsApp, Instagram, Facebook, TikTok and X, build trust for weeks, then ask for money in a hurry. Pause gives the victim three chances to stop it:

1. **Check any chat.** Paste or forward a conversation. Fixed rules plus a private AI on NEAR AI Cloud find the warning signs, name the scam stage, and quote the exact messages.
2. **Warned before paying.** Wallet addresses from a risky chat are remembered.
3. **Paused if they pay anyway.** The Pause contract holds risky payments, an agent interviews the owner on Telegram, and family guardians can step in. The agent's NEAR key can't move money.

Contract: [`pause.pause-demo.testnet`](https://testnet.nearblocks.io/address/pause.pause-demo.testnet) · Telegram agent: [@Pausenearai_bot](https://t.me/Pausenearai_bot) · Tracks: AI Security & Defense, Privacy & Private AI, Real-World Money, Social Money

## The problem

Americans reported **$20.9B** lost to online scams in 2025, **$11.3B** of it involving crypto, and **$7.7B** from people aged 60 and over (FBI IC3 2025). Banks check the payment; scammers work on the person. The money is sent by the real owner from their real phone, so nothing looks wrong. What is wrong is the situation: urgency, isolation, and love or authority used as pressure.

## Try it in 3 minutes, no wallet or keys needed

```bash
git clone https://github.com/lozentrad3s/pause && cd pause/web
npm install
npm run dev
```

Open http://localhost:3000.

1. **The phone simulator** starts when you scroll to it.
   → You see "Daniel" text "Grace" over 16 days. Pause's risk meter rises with each warning sign (moved to Telegram, avoids video, secrecy, a customs fee). When he asks for 30 NEAR a warning sheet slides up, and when she pays anyway the payment is **held** and her son alerted.
   Switch the story to **Real friend**: no alerts, paid instantly. Switch the app between WhatsApp, Instagram, Facebook, TikTok and X.
2. **http://localhost:3000/check** → press **Romance scam** under "Try an example", then **Check this chat**.
   → You get a score, the scam stage, quoted red flags and next steps. Without a `NEARAI_API_KEY` it uses the fixed rules; with one it asks the private model.
3. **Inside the contract** section on the home page → pick **S5 Repeat scammer** and press **Run scenario**.
   → You see the registry check fail and the payment blocked in one transaction.
4. **http://localhost:3000/vault?view=amina.pause-demo.testnet** and **/guardian?view=son.pause-demo.testnet**
   → Live, read-only views of real testnet vaults: a High-risk payment waiting on a guardian, and history.
5. **http://localhost:3000/registry** → the shared scam registry and counters, read live from the contract.

## Try it live on testnet

1. Get a testnet wallet (MyNearWallet, Meteor, HERE or Intear) and some faucet NEAR.
2. Open `/vault`, press **Connect wallet**, then **Open my vault** with a guardian and a 2-minute hold.
3. Send 0.2 NEAR to any new account.
   → It shows **Held** with a countdown. The agent scores it and, on Telegram, asks you six short questions.
4. Message [@Pausenearai_bot](https://t.me/Pausenearai_bot) `/link your-account.testnet` first to get the interview. Forward it messages from any chat to get a scam check.

## Run the tests

```bash
cd contract
cargo test          # 26 unit tests
```

→ `test result: ok. 26 passed`. They cover instant vs held payments, the registry block, the agent being unable to send, guardians unable to redirect, High-risk release needing a guardian, weakening changes waiting their delay, and failed transfers restoring the balance.

## How it works

```
Chat app ──forward/paste──▶ Pause check (rules + NEAR AI TEE) ──▶ warning + flagged addresses
                                                                        │
Owner sends ──▶ Pause contract: registry? ─ blocked                      │
                               trusted & under limit? ─ paid instantly   │
                               otherwise ─ HOLD ──▶ agent: rule score + flagged? + Telegram interview
                                                         │
                                                 set_risk (scoped key) ──▶ High: hold extended, guardians alerted
                                                         │
                              owner cancels · guardian vetoes · "this was a scam" → shared registry
```

| Part | Where | What it does |
| --- | --- | --- |
| Contract | [`contract/`](contract/) | Rust, near-sdk 5. Vaults, holds, guardians, shared scam registry, delayed weakening of settings. |
| Agent | [`agent/`](agent/) | TypeScript, grammY, near-api-js. Telegram chat checks, hold watcher, owner interview, `set_risk`, guardian alerts. |
| Web | [`web/`](web/) | Next.js. Landing page with phone simulator, `/check`, `/vault`, `/guardian`, `/registry`, NEAR Wallet Selector. |
| Analyzer | [`web/lib/analyzer.ts`](web/lib/analyzer.ts) | Shared by web and agent: chat parser (WhatsApp/Telegram exports), 11 fixed signals, NEAR AI Cloud verdict. |

### The five rules the contract enforces

1. Small payments to trusted payees are instant.
2. Everything else is held for a window the owner can cancel at any time.
3. Guardians (max 3) can extend, approve early, veto or confirm a scam, but money only ever goes to the named receiver or back into the vault.
4. Weakening protection (removing guardians, raising limits, trusting someone new) waits the settings delay (7 days in production, 5 minutes in the demo) and alerts guardians.
5. A confirmed scam receiver goes into a shared registry; every vault blocks it.

## NEAR features used

- Rust smart contract (near-sdk 5.30, cargo-near), NEP-297 events
- **Function-call access key** for the agent: only `set_risk` and `extend_hold` on the Pause contract, 0.25 NEAR gas allowance
- **NEAR AI Cloud** private inference (TEE-verifiable `deepseek-ai/DeepSeek-V4.1-Flash-1017`) for chat checks and interviews
- NEAR Wallet Selector (MyNearWallet, Meteor, HERE, Intear)
- Sub-accounts for each demo role

## What the agent's key can and cannot do

**Can:** record a risk verdict, extend a hold.
**Cannot:** send money, change settings, call any other contract, attach a deposit. We tested this on testnet: calling `send` with the key fails with *"Transaction method name send isn't allowed by the access key"*, and a transfer fails with *"Transaction requires a full permission access key"*. The agent also can't lower a High verdict; only a guardian can clear it.

## Privacy

Chats are analysed in memory on NEAR AI Cloud's TEE-backed models and never stored. On-chain the agent records only a SHA-256 hash of its reasons, so an owner can later prove what the agent said without exposing it. The registry holds receiver addresses, never victim identities.

## Run everything yourself

```bash
cp .env.example .env        # fill in the values below
cd contract && cargo near build non-reproducible-wasm --no-abi
cd ../agent && npm install && npm start     # Telegram agent
cd ../web && npm install && npm run dev     # web app
```

| Variable | Used by | Meaning |
| --- | --- | --- |
| `PAUSE_CONTRACT` | agent, web | Contract account |
| `AGENT_ACCOUNT`, `AGENT_PRIVATE_KEY` | agent | Account and its function-call key |
| `NEARAI_API_KEY`, `NEARAI_MODEL` | agent, web | NEAR AI Cloud key and a TEE-verifiable model id |
| `TELEGRAM_BOT_TOKEN` | agent | From @BotFather |

On Windows, `cargo near build` needs `--no-abi`, and `contract/.cargo/config.toml` sets `AWS_LC_SYS_PREBUILT_NASM=1` so tests build without NASM.

## Limits and honest notes

- Testnet only. Demo amounts are a tenth of the scenario amounts because the faucet gives 10 NEAR.
- The simulations use scripted chats and answers. They show the system works as designed, not real-world accuracy. Pause can be wrong; it always tells people to talk to someone they trust.
- Pause sees a chat only when the user shares it. Reading chats automatically (for example an Android notification listener that runs on the device) is on the roadmap, as are NEAR Intents and Chain Signatures to protect BTC and ETH payments.
- The Telegram account link doesn't yet verify ownership with a one-time code.

## Built during the hackathon

All code was written during NEAR HACKATHON (1–14 November 2026). Libraries: near-sdk, cargo-near, near-api-js, NEAR Wallet Selector, grammY, Next.js, React. AI coding assistants were used.

## License

MIT
