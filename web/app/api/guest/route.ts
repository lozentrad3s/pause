import { NextResponse } from "next/server";
import { AGENT, CONTRACT } from "@/lib/near";
import { clientIp, limited, sponsorAccount, txHash } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// What each judge gets, in yoctoNEAR. Kept small so the sponsor lasts.
const OWNER_FUNDS = 400_000_000_000_000_000_000_000n; // 0.4 NEAR
// Enough for the gas NEAR reserves up front on each guardian call.
const GUARDIAN_FUNDS = 150_000_000_000_000_000_000_000n; // 0.15 NEAR
const PER_GUEST = OWNER_FUNDS + GUARDIAN_FUNDS;

const KEY = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;

/** How many guest sets the sponsor can still fund. */
export async function GET() {
  const sponsor = sponsorAccount();
  if (!sponsor) return NextResponse.json({ enabled: false, sets: 0 });
  try {
    const balance = await sponsor.getBalance();
    return NextResponse.json({ enabled: true, sets: Number(balance / (PER_GUEST + PER_GUEST / 20n)) });
  } catch {
    return NextResponse.json({ enabled: true, sets: 0 });
  }
}

/**
 * Creates two testnet accounts for a judge: an owner and a guardian. The
 * browser makes both key pairs and sends only the public keys, so the private
 * keys never reach this server.
 */
export async function POST(req: Request) {
  const sponsor = sponsorAccount();
  if (!sponsor) {
    return NextResponse.json({ error: "Guest accounts aren't switched on for this deployment. Connect a testnet wallet instead, or run npm run judge." }, { status: 503 });
  }
  if (limited(`guest:${clientIp(req)}`, 3, 10 * 60_000)) {
    return NextResponse.json({ error: "You've started a few demos already. Give it ten minutes, or carry on with the accounts you have." }, { status: 429 });
  }

  let body: { ownerKey?: string; guardianKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with ownerKey and guardianKey." }, { status: 400 });
  }
  if (!KEY.test(body.ownerKey ?? "") || !KEY.test(body.guardianKey ?? "")) {
    return NextResponse.json({ error: "ownerKey and guardianKey must be ed25519 public keys." }, { status: 400 });
  }

  try {
    if ((await sponsor.getBalance()) < PER_GUEST + PER_GUEST / 10n) {
      return NextResponse.json({ error: "All demo accounts are in use right now. Please try again shortly, or watch the video." }, { status: 503 });
    }
    const tag = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
    const owner = `grace-${tag}.${sponsor.accountId}`;
    const guardian = `son-${tag}.${sponsor.accountId}`;
    const a = await sponsor.createSubAccount({ accountOrPrefix: owner, publicKey: body.ownerKey!, nearToTransfer: OWNER_FUNDS });
    const b = await sponsor.createSubAccount({ accountOrPrefix: guardian, publicKey: body.guardianKey!, nearToTransfer: GUARDIAN_FUNDS });
    return NextResponse.json({
      owner,
      guardian,
      sponsor: sponsor.accountId,
      shop: process.env.GUEST_SHOP_ACCOUNT || sponsor.accountId,
      // A receiver nobody has reported, unique to this judge, so one judge
      // reporting it doesn't change what the next judge sees.
      stranger: `fastgain-${tag}.testnet`,
      known_scammer: process.env.GUEST_KNOWN_SCAMMER || "fastgain-x.pause-demo.testnet",
      agent: AGENT,
      contract: CONTRACT,
      txs: [txHash(a), txHash(b)].filter(Boolean),
    });
  } catch (e) {
    console.error("guest", e);
    return NextResponse.json({ error: "NEAR testnet didn't answer in time. Please press the button again." }, { status: 502 });
  }
}
