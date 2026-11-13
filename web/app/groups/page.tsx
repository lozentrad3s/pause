"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { api, display, fmt, loadGroupGuest, makeSigner, saveGroupGuest, toYocto, type Pot } from "@/lib/groups-client";
import { view } from "@/lib/near";
import { guestCall } from "@/lib/guest";

interface Caps { treasurer: string | null; demo: boolean; guest: boolean; members: string[]; ai: boolean }

const USES = ["Reunion", "Wedding", "Trip", "Office party", "Church harvest", "Support for parents"];

export default function GroupsPage() {
  return (
    <Suspense fallback={<main className="wrap app-page"><p className="muted">Loading…</p></main>}>
      <Groups />
    </Suspense>
  );
}

function Groups() {
  const router = useRouter();
  const params = useSearchParams();
  const chat = params.get("chat");
  const wallet = useWallet();
  const [caps, setCaps] = useState<Caps | null>(null);
  const [mine, setMine] = useState<Pot[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then(setCaps).catch(() => setCaps(null));
  }, []);

  useEffect(() => {
    const who = wallet.accountId ?? loadGroupGuest()?.account;
    if (!who) return;
    view<Pot[]>("get_pots_of", { member: who }).then((p) => setMine([...p].reverse())).catch(() => {});
  }, [wallet.accountId]);

  const startGuest = async () => {
    setError("");
    try {
      setBusy("Creating your organizer account on testnet");
      const { KeyPair } = await import("near-api-js");
      const pair = KeyPair.fromRandom("ed25519");
      const g = await api<{ organizer: string; members: string[]; agent: string }>({ action: "guest", key: pair.getPublicKey().toString() });
      const guest = { account: g.organizer, key: pair.toString(), pots: [] as number[] };
      saveGroupGuest(guest);
      setBusy("Creating the Class of 2016 Reunion pot");
      const created = await guestCall<number>(g.organizer, guest.key, "create_pot", {
        name: "Class of 2016 Reunion",
        members: [g.organizer, ...g.members],
        approvals_needed: 3,
        agent: g.agent,
        goal: toYocto("0.25"),
        contribution_each: toYocto("0.05"),
        deadline: Math.floor(Date.now() / 1000) + 14 * 86400,
        hold_secs: 120,
      }, toYocto("0.06"));
      const potId = created.value as number;
      guest.pots = [potId];
      saveGroupGuest(guest);
      setBusy("Two classmates are paying their share");
      await api({ action: "seed", pot: potId });
      router.push(`/groups/${potId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  };

  return (
    <main id="main" className="wrap app-page groups-start">
      <section className="groups-hero">
        <h1>A treasurer that never gets tired and can&apos;t run off.</h1>
        <p className="lede">
          Add Pause to your Telegram group. Everyone pays into a pot on NEAR, the group votes on each vendor, and the AI agent pays only
          who you approved, never more than you approved. Every move is posted to the group.
        </p>
        <ul className="use-chips" aria-label="What groups use it for">
          {USES.map((u) => <li key={u}>{u}</li>)}
        </ul>
      </section>

      {chat && (
        <div className="banner">Creating a pot for your Telegram group. When it&apos;s made, send <code>/connect &lt;pot number&gt;</code> in the group.</div>
      )}

      <div className="groups-doors">
        <div className="card door-card">
          <h2>Try it now</h2>
          <p className="muted">You organise a class reunion with four classmates our server plays. Every vote and payment is a real transaction on NEAR testnet. No wallet needed.</p>
          <button className="btn primary" onClick={startGuest} disabled={!!busy || !caps?.guest || !caps?.demo}>
            {busy ? "Setting up…" : "Start the reunion pot"}
          </button>
          {busy && <p className="small muted"><span className="spinner" /> {busy}</p>}
          {caps && (!caps.guest || !caps.demo) && <p className="small muted">Guest groups aren&apos;t switched on in this deployment. Create a pot with your wallet instead.</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <CreatePot caps={caps} chat={chat} />
      </div>

      {mine.length > 0 && (
        <section className="app-section">
          <div className="section-head"><h2>Your pots</h2></div>
          <div className="pot-list">
            {mine.map((p) => (
              <Link key={p.id} href={`/groups/${p.id}`} className="card pot-row">
                <b>{p.name}</b>
                <span className="muted small">#{p.id} · {p.status} · {fmt(p.raised)} of {fmt(p.goal)} NEAR · {p.members.length} members</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="app-section card telegram-card">
        <div>
          <h2>Use it in your Telegram group</h2>
          <ol>
            <li>Add <b>@Pausenearai_bot</b> to the group.</li>
            <li>Each member sends the bot <code>/link your-account.testnet</code> in a private chat.</li>
            <li>In the group, send <code>/newpot</code>, create the pot, then <code>/connect &lt;number&gt;</code>.</li>
            <li>Send <code>/plan</code> with your plan in plain words. Vote with the buttons.</li>
          </ol>
          <p className="small muted">The bot keeps Telegram&apos;s privacy mode on: it sees only its commands and replies to it, never the group&apos;s conversation.</p>
        </div>
        <a className="btn" href="https://t.me/Pausenearai_bot?startgroup=pause" target="_blank" rel="noreferrer">Add to Telegram</a>
      </section>
    </main>
  );
}

function CreatePot({ caps, chat }: { caps: Caps | null; chat: string | null }) {
  const router = useRouter();
  const wallet = useWallet();
  const [name, setName] = useState("");
  const [members, setMembers] = useState("");
  const [k, setK] = useState("2");
  const [goal, setGoal] = useState("5");
  const [each, setEach] = useState("1");
  const [hold, setHold] = useState("3600");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const signer = makeSigner(wallet, null);
    if (!signer) return wallet.signIn();
    if (!caps?.treasurer) return setError("The treasurer isn't set up on this deployment.");
    setBusy(true);
    try {
      const list = members.split(/[\s,]+/).map((m) => m.trim().toLowerCase()).filter(Boolean);
      await signer.call("create_pot", {
        name: name.trim(),
        members: [signer.account, ...list.filter((m) => m !== signer.account)],
        approvals_needed: Number(k),
        agent: caps.treasurer,
        goal: toYocto(goal),
        contribution_each: each ? toYocto(each) : null,
        deadline: Math.floor(Date.now() / 1000) + 30 * 86400,
        hold_secs: Number(hold),
      }, toYocto("0.02"));
      const pots = await view<Pot[]>("get_pots_of", { member: signer.account });
      const id = Math.max(...pots.map((p) => p.id));
      if (chat) setMade(id);
      else router.push(`/groups/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (made !== null) {
    return (
      <div className="card door-card">
        <h2>Pot #{made} is ready</h2>
        <p>Send this in your Telegram group:</p>
        <p className="big-code"><code>/connect {made}</code></p>
        <Link className="btn primary" href={`/groups/${made}`}>Open the pot</Link>
      </div>
    );
  }

  return (
    <form className="card door-card create-form-lite" onSubmit={submit}>
      <h2>Create a real pot</h2>
      <label>Name<input required maxLength={64} placeholder="Ada's wedding" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Other members<input required placeholder="tunde.testnet, musa.testnet" value={members} onChange={(e) => setMembers(e.target.value)} /></label>
      <div className="form-row">
        <label>Goal (NEAR)<input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
        <label>Each pays<input inputMode="decimal" value={each} onChange={(e) => setEach(e.target.value)} /></label>
        <label>Approvals<input inputMode="numeric" value={k} onChange={(e) => setK(e.target.value)} /></label>
      </div>
      <label>Wait after approval
        <select value={hold} onChange={(e) => setHold(e.target.value)}>
          <option value="120">2 minutes (testing)</option>
          <option value="3600">1 hour</option>
          <option value="86400">24 hours</option>
        </select>
      </label>
      <p className="small muted">The treasurer {caps?.treasurer ? <code>{display(caps.treasurer)}</code> : ""} proposes and pays. It never votes, and the contract stops it paying anyone you didn&apos;t approve.</p>
      <button className="btn primary" disabled={busy}>{wallet.accountId ? (busy ? "Creating…" : "Create pot") : "Connect a wallet to create"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

