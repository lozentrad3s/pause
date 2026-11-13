"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { api, display, fmt, inviteLink, loadGroupGuest, makeSigner, parseInvitees, saveGroupGuest, toYocto, type Invitee, type Pot } from "@/lib/groups-client";
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
  const [people, setPeople] = useState("");
  const [k, setK] = useState("2");
  const [goal, setGoal] = useState("1");
  const [each, setEach] = useState("0.1");
  const [hold, setHold] = useState("120");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [made, setMade] = useState<{ id: number; invites: Invitee[] } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!caps?.treasurer) return setError("The treasurer isn't set up on this deployment.");
    const invitees = parseInvitees(people);
    if (!invitees.length) return setError("Add at least one person: a name with an email or phone number, or a NEAR account.");
    try {
      const { KeyPair } = await import("near-api-js");
      // The organizer: the connected wallet, or a new account kept in this browser.
      let signer = makeSigner(wallet, loadGroupGuest());
      if (!signer) {
        setBusy("Making your account");
        const pair = KeyPair.fromRandom("ed25519");
        const g = await api<{ organizer: string }>({ action: "guest", key: pair.getPublicKey().toString() });
        const guest = { account: g.organizer, key: pair.toString(), pots: [] as number[] };
        saveGroupGuest(guest);
        signer = makeSigner(wallet, guest)!;
      }
      // People invited by name, email or phone get an account and a private link.
      const fresh = invitees.filter((i) => !i.account);
      if (fresh.length) {
        setBusy(`Making accounts for ${fresh.length} ${fresh.length === 1 ? "person" : "people"}`);
        const pairs = fresh.map(() => KeyPair.fromRandom("ed25519"));
        const r = await api<{ accounts: string[] }>({ action: "invite", keys: pairs.map((p) => p.getPublicKey().toString()) });
        fresh.forEach((inv, i) => {
          inv.account = r.accounts[i];
          inv.key = pairs[i].toString();
        });
      }
      setBusy("Creating the pot on NEAR");
      const me = signer.account;
      const members = [me, ...invitees.map((i) => i.account!).filter((a) => a !== me)];
      const res = await signer.call("create_pot", {
        name: name.trim(),
        members,
        approvals_needed: Math.min(Number(k) || 1, members.length),
        agent: caps.treasurer,
        goal: toYocto(goal),
        contribution_each: each ? toYocto(each) : null,
        deadline: Math.floor(Date.now() / 1000) + 30 * 86400,
        hold_secs: Number(hold),
      }, toYocto("0.02"));
      let id = typeof res.value === "number" ? res.value : null;
      if (id === null) {
        const pots = await view<Pot[]>("get_pots_of", { member: me });
        id = Math.max(...pots.map((p) => p.id));
      }
      const g = loadGroupGuest();
      if (g) saveGroupGuest({ ...g, pots: [...new Set([...(g.pots ?? []), id])] });
      setMade({ id, invites: invitees.filter((i) => i.key) });
      if (!invitees.some((i) => i.key) && !chat) router.push(`/groups/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (made) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <div className="card door-card">
        <h2>{name || "Your pot"} is ready</h2>
        {made.invites.length > 0 && (
          <>
            <p>Send each person their own link. It opens the pot as them, with a little testnet NEAR to pay their share. Anyone with a link can act as that person, so send it only to them.</p>
            <ul className="invite-list">
              {made.invites.map((inv) => {
                const link = inviteLink(base, inv, made.id);
                const text = `Join "${name}" on Pause, our group pot. Your link: ${link}`;
                const isEmail = !!inv.contact?.includes("@");
                const phone = !isEmail && inv.contact ? inv.contact.replace(/^\+/, "") : "";
                return (
                  <li key={inv.account}>
                    <b>{inv.label}</b>
                    <div className="invite-actions">
                      <a className="btn small-btn" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                      {phone && <a className="btn small-btn" href={`sms:${inv.contact}?body=${encodeURIComponent(text)}`}>Text</a>}
                      {isEmail && <a className="btn small-btn" href={`mailto:${inv.contact}?subject=${encodeURIComponent(`Join ${name} on Pause`)}&body=${encodeURIComponent(text)}`}>Email</a>}
                      <button type="button" className="btn small-btn" onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {chat && <p>Send this in your Telegram group: <code>/connect {made.id}</code></p>}
        <Link className="btn primary" href={`/groups/${made.id}`}>Open the pot</Link>
      </div>
    );
  }

  return (
    <form className="card door-card create-form-lite" onSubmit={submit}>
      <h2>Start a real pot</h2>
      <p className="small muted">No wallet needed. Pause makes an account for you and for everyone you invite.</p>
      <label>What is it for?<input required maxLength={64} placeholder="Ada's birthday dinner" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>
        Who&apos;s in?
        <textarea rows={3} placeholder={"Tunde +2348012345678\nAda ada@gmail.com\nmusa.testnet"} value={people} onChange={(e) => setPeople(e.target.value)} />
        <span className="small muted">One per line: a name with a phone number or email, or a NEAR account.</span>
      </label>
      <div className="form-row">
        <label>Target (NEAR)<input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
        <label>Each pays<input inputMode="decimal" value={each} onChange={(e) => setEach(e.target.value)} /></label>
        <label>Approvals<input inputMode="numeric" value={k} onChange={(e) => setK(e.target.value)} /></label>
      </div>
      <label>Wait before paying
        <select value={hold} onChange={(e) => setHold(e.target.value)}>
          <option value="120">2 minutes</option>
          <option value="3600">1 hour</option>
          <option value="86400">24 hours</option>
        </select>
      </label>
      <p className="small muted">Pause proposes and pays vendors. It never votes, and the contract stops it paying anyone the group didn&apos;t approve.</p>
      <button className="btn primary" disabled={!!busy}>{busy ? `${busy}…` : "Create the pot"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

