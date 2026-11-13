// Server-only helpers for the group demo: four demo members and three vendors
// whose keys live in the server's environment. They act only on pots that
// include them, and every action is a real testnet transaction.

import { Account, JsonRpcProvider, KeyPairSigner } from "near-api-js";
import { CONTRACT, getLines, getPot, type Line } from "./treasurer";

const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC || "https://test.rpc.fastnear.com" });
const PARENT = process.env.GROUP_DEMO_PARENT || "pause-demo.testnet";

export const DEMO_MEMBERS: Record<string, string> = {
  [`ada.${PARENT}`]: "GROUP_KEY_ADA",
  [`tunde.${PARENT}`]: "GROUP_KEY_TUNDE",
  [`musa.${PARENT}`]: "GROUP_KEY_MUSA",
  [`chi.${PARENT}`]: "GROUP_KEY_CHI",
};

export const DEMO_VENDORS: Record<string, { key: string; label: string; note: string }> = {
  [`hall-owner.${PARENT}`]: { key: "VENDOR_KEY_HALL", label: "Event hall", note: "Received. The hall is yours on Saturday from 10:00." },
  [`mama-nkechi.${PARENT}`]: { key: "VENDOR_KEY_MAMA", label: "Mama Nkechi Catering", note: "Received, delivering Saturday 10:00." },
  [`cool-drinks.${PARENT}`]: { key: "VENDOR_KEY_DRINKS", label: "Cool Drinks", note: "Received. Drinks arrive chilled at 11:00." },
};

export const BLOCKED_VENDOR = `drinks-plug.${PARENT}`;

export const DEMO_PLAN = `Event hall: hall-owner.${PARENT} 0.1 NEAR.
Food: mama-nkechi.${PARENT} 0.08 NEAR.
Drinks: cool-drinks.${PARENT} 0.04 NEAR.`;

function signer(id: string, envKey: string): Account | null {
  const k = process.env[envKey];
  return k ? new Account(id, provider, KeyPairSigner.fromSecretKey(k as `ed25519:${string}`)) : null;
}

export const demoReady = () => Object.values(DEMO_MEMBERS).every((k) => !!process.env[k]);

async function call(a: Account, method: string, args: object, deposit = "0") {
  const out = (await a.callFunctionRaw({ contractId: CONTRACT, methodName: method, args: args as Record<string, unknown>, deposit: BigInt(deposit), gas: 60_000_000_000_000n })) as {
    status?: { Failure?: unknown };
    transaction?: { hash?: string };
  };
  if (out.status && "Failure" in out.status && out.status.Failure) {
    throw new Error(JSON.stringify(out.status.Failure).match(/panicked: ([^"\\]+)/)?.[1] ?? "Refused");
  }
  return out.transaction?.hash ?? null;
}

export interface DemoAct {
  who: string;
  what: string;
  hash: string | null;
  error?: string;
}

/** Demo members in this pot who haven't paid their share pay it now. */
export async function demoContribute(potId: number, only?: string[]): Promise<DemoAct[]> {
  const pot = await getPot(potId);
  if (!pot) throw new Error("No such pot");
  const share = BigInt(pot.contribution_each ?? "50000000000000000000000");
  const paid = new Map(pot.contributions.map(([a, v]) => [a, BigInt(v)]));
  const out: DemoAct[] = [];
  for (const m of pot.members) {
    if (!DEMO_MEMBERS[m] || (only && !only.includes(m)) || (paid.get(m) ?? 0n) >= share) continue;
    const s = signer(m, DEMO_MEMBERS[m]);
    if (!s) continue;
    try {
      out.push({ who: m, what: "contributed", hash: await call(s, "contribute", { pot_id: potId }, (share - (paid.get(m) ?? 0n)).toString()) });
    } catch (e) {
      out.push({ who: m, what: "contribute", hash: null, error: (e as Error).message });
    }
  }
  return out;
}

/** Demo members vote on a line until it reaches the approvals it needs (or a rejection). */
export async function demoVote(potId: number, lineId: number, approve: boolean, max = 2): Promise<DemoAct[]> {
  const pot = await getPot(potId);
  const line = (await getLines(potId)).find((l) => l.id === lineId);
  if (!pot || !line) throw new Error("No such line");
  if (line.status !== "Proposed") return [];
  const voted = new Set([...line.approvals, ...line.rejections]);
  const out: DemoAct[] = [];
  for (const m of pot.members) {
    if (out.length >= max || !DEMO_MEMBERS[m] || voted.has(m)) continue;
    const s = signer(m, DEMO_MEMBERS[m]);
    if (!s) continue;
    try {
      out.push({ who: m, what: approve ? "approved" : "rejected", hash: await call(s, approve ? "approve_line" : "reject_line", { line_id: lineId }) });
      const after = (await getLines(potId)).find((l) => l.id === lineId) as Line;
      if (after.status !== "Proposed") break;
    } catch (e) {
      out.push({ who: m, what: "vote", hash: null, error: (e as Error).message });
    }
  }
  return out;
}

/** A demo vendor confirms delivery on a line it has been paid for. */
export async function demoConfirm(potId: number, lineId: number): Promise<DemoAct> {
  const line = (await getLines(potId)).find((l) => l.id === lineId);
  if (!line) throw new Error("No such line");
  const v = DEMO_VENDORS[line.vendor];
  if (!v) throw new Error("This vendor confirms from their own wallet on the vendor page.");
  const s = signer(line.vendor, v.key);
  if (!s) throw new Error("Vendor key not configured");
  return { who: line.vendor, what: "confirmed", hash: await call(s, "vendor_confirm", { line_id: lineId, note: v.note }) };
}
