import { NextResponse } from "next/server";
import { clientIp, limited, sponsorAccount, txHash } from "@/lib/server";
import { answerFromChain, payDue, proposeOne, proposePlan, treasurer } from "@/lib/treasurer";
import { BLOCKED_VENDOR, DEMO_MEMBERS, DEMO_PLAN, demoConfirm, demoContribute, demoReady, demoVote } from "@/lib/groups-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const ORGANIZER_FUNDS = 300_000_000_000_000_000_000_000n; // 0.3 NEAR
const MEMBER_FUNDS = 150_000_000_000_000_000_000_000n; // 0.15 NEAR

/** What this deployment can do, so the page shows only buttons that work. */
export async function GET() {
  return NextResponse.json({
    treasurer: treasurer()?.accountId ?? null,
    demo: demoReady(),
    guest: !!sponsorAccount(),
    members: Object.keys(DEMO_MEMBERS),
    blocked_vendor: BLOCKED_VENDOR,
    plan: DEMO_PLAN,
    ai: !!process.env.NEARAI_API_KEY,
  });
}

type Body = { action?: string; pot?: number; line?: number; text?: string; q?: string; key?: string; approve?: boolean; vendor?: string; label?: string; amount?: string };

export async function POST(req: Request) {
  if (limited(`groups:${clientIp(req)}`, 40)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const pot = Number(b.pot);
  try {
    switch (b.action) {
      // A judge's organizer account; the key pair is made in the browser.
      case "guest": {
        const sponsor = sponsorAccount();
        if (!sponsor) return NextResponse.json({ error: "Guest accounts aren't switched on here. Connect a testnet wallet instead." }, { status: 503 });
        if (limited(`groups-guest:${clientIp(req)}`, 3, 10 * 60_000)) return NextResponse.json({ error: "You've started a few groups already. Carry on with the one you have." }, { status: 429 });
        if (!KEY.test(b.key ?? "")) return NextResponse.json({ error: "key must be an ed25519 public key" }, { status: 400 });
        const tag = Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, "0")).join("");
        const organizer = `organizer-${tag}.${sponsor.accountId}`;
        const out = await sponsor.createSubAccount({ accountOrPrefix: organizer, publicKey: b.key!, nearToTransfer: ORGANIZER_FUNDS });
        return NextResponse.json({ organizer, members: Object.keys(DEMO_MEMBERS), agent: treasurer()?.accountId, tx: txHash(out) });
      }
      // Accounts for people invited by name, email or phone. The browser makes
      // the key pairs; only public keys come here. Each gets a little testnet
      // NEAR so they can pay their share.
      case "invite": {
        const sponsor = sponsorAccount();
        if (!sponsor) return NextResponse.json({ error: "Invites aren't switched on here." }, { status: 503 });
        const keys = Array.isArray((b as { keys?: unknown }).keys) ? ((b as { keys: string[] }).keys) : [];
        if (!keys.length || keys.length > 8 || !keys.every((k) => KEY.test(k))) return NextResponse.json({ error: "Send 1 to 8 public keys." }, { status: 400 });
        if (limited(`groups-invite:${clientIp(req)}`, 4, 10 * 60_000)) return NextResponse.json({ error: "You've sent a lot of invites. Try again in a few minutes." }, { status: 429 });
        const accounts: string[] = [];
        for (const k of keys) {
          const tag = Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, "0")).join("");
          const id = `member-${tag}.${sponsor.accountId}`;
          await sponsor.createSubAccount({ accountOrPrefix: id, publicKey: k, nearToTransfer: MEMBER_FUNDS });
          accounts.push(id);
        }
        return NextResponse.json({ accounts });
      }
      case "plan":
        if (!b.text || b.text.length < 10) return NextResponse.json({ error: "Write the plan first." }, { status: 400 });
        return NextResponse.json(await proposePlan(pot, b.text.slice(0, 4000)));
      case "propose":
        return NextResponse.json(await proposeOne(pot, String(b.vendor), String(b.label).slice(0, 64), String(b.amount)));
      case "pay":
        return NextResponse.json({ payments: await payDue(pot) });
      case "ask":
        return NextResponse.json({ answer: await answerFromChain(pot, String(b.q ?? "").slice(0, 300)) });
      case "remind":
        return NextResponse.json({ acts: await demoContribute(pot) });
      case "seed":
        return NextResponse.json({ acts: await demoContribute(pot, Object.keys(DEMO_MEMBERS).slice(0, 2)) });
      case "vote":
        return NextResponse.json({ acts: await demoVote(pot, Number(b.line), b.approve !== false) });
      case "confirm":
        return NextResponse.json({ act: await demoConfirm(pot, Number(b.line)) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "NEAR testnet didn't answer. Try again." }, { status: 502 });
  }
}
