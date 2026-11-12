// Guest mode: a judge gets two real testnet accounts (an owner and their
// guardian) without a wallet. The key pairs are made in this browser and kept
// in sessionStorage; the server only ever sees the public keys. Every action
// is a real transaction signed here and sent straight to NEAR testnet.

import { CONTRACT, RPCS, toYocto } from "./near";

export interface GuestSet {
  owner: string;
  guardian: string;
  ownerKey: string; // secret keys, this browser only
  guardianKey: string;
  shop: string;
  stranger: string;
  known_scammer: string;
  sponsor: string;
  agent: string;
  txs: string[];
  vaultReady: boolean;
}

export const GUEST = {
  vaultDeposit: "0.2",
  instantLimit: "0.05",
  dailyCap: "0.2",
  holdSecs: 120,
};

const STORE = "pause-guest-v1";

export function loadGuest(): GuestSet | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as GuestSet) : null;
  } catch {
    return null;
  }
}

export function saveGuest(g: GuestSet | null) {
  try {
    if (g) sessionStorage.setItem(STORE, JSON.stringify(g));
    else sessionStorage.removeItem(STORE);
  } catch {
    // Private windows can refuse storage; the demo still works until reload.
  }
}

/** The exact text the owner's key signs, so only the owner can answer for a hold. */
export async function interviewMessage(holdId: number, answers: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(answers));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `pause-interview:${holdId}:${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const near = () => import("near-api-js");

/** Asks the server for two funded accounts, then opens the owner's vault. */
export async function createGuest(onStep: (label: string) => void): Promise<GuestSet> {
  const { KeyPair } = await near();
  const ownerPair = KeyPair.fromRandom("ed25519");
  const guardianPair = KeyPair.fromRandom("ed25519");
  onStep("Creating two testnet accounts");
  const res = await fetch("/api/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerKey: ownerPair.getPublicKey().toString(), guardianKey: guardianPair.getPublicKey().toString() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't create the demo accounts.");
  const guest: GuestSet = { ...data, ownerKey: ownerPair.toString(), guardianKey: guardianPair.toString(), vaultReady: false };
  saveGuest(guest);

  onStep("Opening a vault with a guardian");
  const vault = await guestCall(guest.owner, guest.ownerKey, "create_vault", {
    guardians: [guest.guardian],
    agent: guest.agent,
    instant_limit: toYocto(GUEST.instantLimit),
    daily_instant_cap: toYocto(GUEST.dailyCap),
    hold_secs: GUEST.holdSecs,
    trusted_payees: [guest.shop],
  }, toYocto(GUEST.vaultDeposit));
  guest.txs = [...guest.txs, vault.hash].filter(Boolean) as string[];
  guest.vaultReady = true;
  saveGuest(guest);
  return guest;
}

export interface CallResult<T = unknown> {
  hash: string | null;
  value: T | null;
}

/** Signs and sends one call to the Pause contract with a guest key. */
export async function guestCall<T = unknown>(
  accountId: string,
  secretKey: string,
  method: string,
  args: object = {},
  deposit = "0",
): Promise<CallResult<T>> {
  const { Account, JsonRpcProvider, KeyPairSigner } = await near();
  const account = new Account(accountId, new JsonRpcProvider({ url: RPCS[0] }), KeyPairSigner.fromSecretKey(secretKey as `ed25519:${string}`));
  let outcome;
  try {
    outcome = await account.callFunctionRaw({ contractId: CONTRACT, methodName: method, args: args as Record<string, unknown>, deposit: BigInt(deposit), gas: 60_000_000_000_000n });
  } catch (e) {
    throw new Error(friendly(e));
  }
  const status = (outcome as { status?: { SuccessValue?: string } }).status;
  let value: T | null = null;
  if (status?.SuccessValue) {
    try {
      value = JSON.parse(atob(status.SuccessValue)) as T;
    } catch {
      value = null;
    }
  }
  return { hash: (outcome as { transaction?: { hash?: string } }).transaction?.hash ?? null, value };
}

/** Signs the interview answers with the owner's guest key. */
export async function signInterview(secretKey: string, holdId: number, answers: string[]) {
  const { KeyPair } = await near();
  const pair = KeyPair.fromString(secretKey as `ed25519:${string}`);
  const { signature } = pair.sign(new TextEncoder().encode(await interviewMessage(holdId, answers)));
  return { public_key: pair.getPublicKey().toString(), signature: btoa(String.fromCharCode(...signature)) };
}

/** Closes both guest accounts and returns what is left to the sponsor. */
export async function closeGuest(g: GuestSet) {
  const { Account, JsonRpcProvider, KeyPairSigner } = await near();
  const provider = new JsonRpcProvider({ url: RPCS[0] });

  // The vault has no withdraw, so what is left in it goes back the only way
  // money can leave: instant payments to the trusted shop, which is the
  // sponsor. Each is capped by the vault's instant limit and daily cap.
  if (g.vaultReady && g.shop === g.sponsor) {
    try {
      for (let i = 0; i < 4; i++) {
        const vault = (await provider.callFunction({ contractId: CONTRACT, method: "get_vault", args: { owner: g.owner } })) as { balance?: string } | null;
        const left = BigInt(vault?.balance ?? "0");
        const limit = BigInt(toYocto(GUEST.instantLimit));
        const amount = left < limit ? left : limit;
        if (amount < BigInt(toYocto("0.005"))) break;
        const sent = await guestCall<{ outcome?: string }>(g.owner, g.ownerKey, "send", { receiver: g.shop, amount: amount.toString(), memo: null });
        if (sent.value?.outcome !== "paid") break;
      }
    } catch {
      // The daily cap was reached or testnet is slow; the rest stays in the vault.
    }
  }

  for (const [id, key] of [[g.owner, g.ownerKey], [g.guardian, g.guardianKey]] as const) {
    try {
      await new Account(id, provider, KeyPairSigner.fromSecretKey(key as `ed25519:${string}`)).deleteAccount(g.sponsor);
    } catch {
      // Already gone, or testnet is slow. Nothing the judge needs to see.
    }
  }
  saveGuest(null);
}

/** Turns a contract panic or RPC error into one plain sentence. */
export function friendly(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const panic = raw.match(/Smart contract panicked: ([^"\\]+)/)?.[1] ?? raw.match(/ExecutionError":"([^"]+)/)?.[1];
  if (panic) return panic.replace(/^Smart contract panicked: /, "");
  if (/NotEnoughBalance|LackBalance/i.test(raw)) return "This demo account has run out of testnet NEAR. Press Start over for a fresh one.";
  if (/timeout|Timeout|fetch failed|Failed to fetch/i.test(raw)) return "NEAR testnet is slow right now. Please try that again.";
  return raw.length > 160 ? "That didn't go through. Please try again." : raw;
}
