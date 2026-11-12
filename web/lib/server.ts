// Server-only helpers for the API routes: rate limits and the two accounts the
// server may sign with. Neither can move a user's money:
//   - the agent, with a function-call key limited to set_risk and extend_hold;
//   - the guest sponsor, which only creates and funds testnet demo accounts.

import { Account, JsonRpcProvider, KeyPairSigner } from "near-api-js";
import { AGENT, CONTRACT, RPCS, rpc } from "./near";

export const provider = new JsonRpcProvider({ url: RPCS[0] });

const buckets = new Map<string, number[]>();

/** True when `key` has been used more than `max` times in the window. */
export function limited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear();
  return recent.length > max;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

export const aiOptions = () => ({ apiKey: process.env.NEARAI_API_KEY || undefined, model: process.env.NEARAI_MODEL || undefined });

interface AccessKeyView {
  permission: "FullAccess" | { FunctionCall: { receiver_id: string; method_names: string[] } };
}

export const ALLOWED_AGENT_METHODS = ["set_risk", "extend_hold"];

/** Looks up a key on chain. Returns null when the account doesn't have it. */
export async function accessKey(accountId: string, publicKey: string): Promise<AccessKeyView | null> {
  try {
    return await rpc<AccessKeyView>("query", { request_type: "view_access_key", finality: "optimistic", account_id: accountId, public_key: publicKey });
  } catch {
    return null;
  }
}

let agent: Account | null = null;

/**
 * The agent account, or null when no key is configured. Refuses to load a key
 * that can do more than set_risk and extend_hold on the Pause contract, so a
 * full-access key pasted into the environment by mistake is never used.
 */
export async function agentAccount(): Promise<Account | null> {
  if (agent) return agent;
  const key = process.env.AGENT_PRIVATE_KEY;
  const id = process.env.AGENT_ACCOUNT || AGENT;
  if (!key) return null;
  const signer = KeyPairSigner.fromSecretKey(key as `ed25519:${string}`);
  const view = await accessKey(id, (await signer.getPublicKey()).toString());
  const fc = view && view.permission !== "FullAccess" ? view.permission.FunctionCall : null;
  const scoped = !!fc && fc.receiver_id === CONTRACT && fc.method_names.length > 0 && fc.method_names.every((m) => ALLOWED_AGENT_METHODS.includes(m));
  if (!scoped) throw new Error("AGENT_PRIVATE_KEY must be a function-call key limited to set_risk and extend_hold");
  agent = new Account(id, provider, signer);
  return agent;
}

export function sponsorAccount(): Account | null {
  const id = process.env.GUEST_SPONSOR_ACCOUNT;
  const key = process.env.GUEST_SPONSOR_KEY;
  if (!id || !key) return null;
  return new Account(id, provider, KeyPairSigner.fromSecretKey(key as `ed25519:${string}`));
}

export const txHash = (outcome: unknown): string | null =>
  (outcome as { transaction?: { hash?: string } })?.transaction?.hash ?? null;
