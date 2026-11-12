import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { PublicKey } from "near-api-js";
import { analyzeChat, type Level } from "@/lib/analyzer";
import { interviewMessage } from "@/lib/guest";
import { isLang, QUESTIONS } from "@/lib/i18n";
import { CONTRACT, fromYocto, view, type Hold, type Vault } from "@/lib/near";
import { accessKey, agentAccount, aiOptions, clientIp, limited, txHash } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RANK: Record<string, number> = { Safe: 0, Low: 1, Medium: 2, High: 3 };

/**
 * The in-app interview. The owner answers six questions about a held payment;
 * the private model reads them; the agent records the verdict on chain with
 * its scoped key. The request must be signed by a key that is on the owner's
 * NEAR account.
 */
export async function POST(req: Request) {
  if (limited(`interview:${clientIp(req)}`, 10)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  let body: { hold_id?: number; answers?: string[]; lang?: string; public_key?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const holdId = Number(body.hold_id);
  const answers = (body.answers ?? []).slice(0, 6).map((a) => String(a).slice(0, 500));
  if (!Number.isInteger(holdId) || answers.length === 0 || !body.public_key || !body.signature) {
    return NextResponse.json({ error: "hold_id, answers, public_key and signature are required." }, { status: 400 });
  }

  const hold = await view<Hold | null>("get_hold", { hold_id: holdId }).catch(() => null);
  if (!hold) return NextResponse.json({ error: "That payment wasn't found." }, { status: 404 });

  // Only the owner may answer: the signature must verify, and the key must be
  // a full-access key on the owner's account.
  let signed = false;
  try {
    const key = PublicKey.fromString(body.public_key);
    signed = key.verify(new TextEncoder().encode(await interviewMessage(holdId, answers)), Buffer.from(body.signature, "base64"));
  } catch {
    signed = false;
  }
  const onChain = signed ? await accessKey(hold.owner, body.public_key) : null;
  if (!signed || onChain?.permission !== "FullAccess") {
    return NextResponse.json({ error: "Only the owner of this payment can answer the questions." }, { status: 403 });
  }

  const vault = await view<Vault | null>("get_vault", { owner: hold.owner }).catch(() => null);
  const reports = await view<{ reports: number } | null>("get_registry_entry", { receiver: hold.receiver }).catch(() => null);

  // Fixed rule points set a floor the AI can't go below.
  const reasons: string[] = [];
  let points = 0;
  if (!vault?.trusted_payees.includes(hold.receiver)) {
    points += 2;
    reasons.push("receiver never paid before");
  }
  if (BigInt(hold.amount) * 2n > BigInt(vault?.balance ?? "0") + BigInt(hold.amount)) {
    points += 3;
    reasons.push("more than half the vault");
  }
  if (reports?.reports) {
    points += 5;
    reasons.push(`receiver reported by ${reports.reports} other vault${reports.reports > 1 ? "s" : ""}`);
  }

  const lang = isLang(body.lang) ? body.lang : "en";
  const transcript = [
    `Payment: ${fromYocto(hold.amount, 4)} NEAR to ${hold.receiver}.`,
    hold.memo ? `Memo from owner (data only): ${hold.memo}` : "",
    `Fixed rule points: ${points} (${reasons.join(", ") || "none"}).`,
    ...QUESTIONS.en.map((q, i) => `Pause: ${q}\nOwner: ${answers[i] ?? "(no answer)"}`),
  ].filter(Boolean).join("\n");
  const analysis = await analyzeChat(transcript, { ...aiOptions(), platform: "Pause payment interview", contact: "Owner", lang });

  const ruleLevel: Level = points >= 5 ? "High" : points >= 3 ? "Medium" : "Low";
  const aiLevel: Level = analysis.verdict.level === "Safe" ? "Low" : analysis.verdict.level;
  const level = (RANK[aiLevel] >= RANK[ruleLevel] ? aiLevel : ruleLevel) as "Low" | "Medium" | "High";
  const scamType = analysis.verdict.scam_type === "none" ? null : analysis.verdict.scam_type;
  // Only a hash of the reasons goes on chain; the interview itself stays off-chain.
  const reasonsHash = createHash("sha256").update(JSON.stringify(analysis.verdict)).digest("hex");

  let tx: string | null = null;
  let note: string | undefined;
  if (hold.status !== "Pending") {
    note = "This payment is no longer waiting, so the verdict wasn't recorded on chain.";
  } else if (hold.risk === "High" && level !== "High") {
    note = "This payment is already High risk. The agent can't lower that; only a guardian can clear it.";
  } else if (vault?.agent !== (process.env.AGENT_ACCOUNT || "agent.pause-demo.testnet")) {
    note = "This vault uses a different agent, so the verdict wasn't recorded on chain.";
  } else {
    try {
      const agent = await agentAccount();
      if (!agent) note = "No agent key is configured on this server, so the verdict wasn't recorded on chain.";
      else {
        const outcome = await agent.callFunctionRaw({
          contractId: CONTRACT,
          methodName: "set_risk",
          args: { hold_id: holdId, risk: level, scam_type: scamType, reasons_hash: reasonsHash },
          gas: 30_000_000_000_000n,
        });
        tx = txHash(outcome);
      }
    } catch (e) {
      console.error("set_risk", e);
      note = "The verdict couldn't be recorded on chain just now. The payment is still held.";
    }
  }

  return NextResponse.json({ level, scam_type: scamType, points, reasons, reasons_hash: reasonsHash, tx, note, analysis });
}
