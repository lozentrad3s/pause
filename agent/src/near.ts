import { Account, JsonRpcProvider, KeyPairSigner } from "near-api-js";

const RPC = process.env.NEAR_RPC || "https://test.rpc.fastnear.com";
export const CONTRACT = process.env.PAUSE_CONTRACT || "pause.pause-demo.testnet";

const provider = new JsonRpcProvider({ url: RPC });

export interface Hold {
  id: number;
  owner: string;
  receiver: string;
  amount: string; // yoctoNEAR
  memo: string | null;
  created_at: number;
  release_at: number;
  status: "Pending" | "Released" | "Cancelled" | "Vetoed" | "Blocked";
  risk: "Unknown" | "Low" | "Medium" | "High";
  scam_type: string | null;
  guardian_approved: boolean;
}

export interface Vault {
  owner: string;
  balance: string;
  guardians: string[];
  agent: string | null;
  trusted_payees: string[];
  hold_secs: number;
}

export async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await provider.callFunction({ contractId: CONTRACT, method, args })) as T;
}

export const getHolds = (owner: string) => view<Hold[]>("get_holds", { owner, from_index: 0, limit: 10 });
export const getVault = (owner: string) => view<Vault | null>("get_vault", { owner });

// The agent signs with a function-call key that only allows set_risk and
// extend_hold on the Pause contract. It cannot move money.
let agent: Account | null = null;
function agentAccount(): Account {
  if (agent) return agent;
  const id = process.env.AGENT_ACCOUNT;
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!id || !key) throw new Error("AGENT_ACCOUNT and AGENT_PRIVATE_KEY must be set");
  agent = new Account(id, provider, KeyPairSigner.fromSecretKey(key as `ed25519:${string}`));
  return agent;
}

/**
 * Stops the agent at start-up unless its key is a function-call key limited to
 * set_risk and extend_hold on the Pause contract. A full-access key pasted
 * into .env by mistake is never used.
 */
export async function assertScopedKey() {
  const account = agentAccount();
  const publicKey = (await account.getSigner()!.getPublicKey()).toString();
  const key = (await account.getAccessKey(publicKey)) as unknown as {
    permission: "FullAccess" | { FunctionCall: { receiver_id: string; method_names: string[] } };
  };
  const fc = key.permission === "FullAccess" ? null : key.permission.FunctionCall;
  const ok = !!fc && fc.receiver_id === CONTRACT && fc.method_names.length > 0 && fc.method_names.every((m) => ["set_risk", "extend_hold"].includes(m));
  if (!ok) throw new Error("AGENT_PRIVATE_KEY must be a function-call key limited to set_risk and extend_hold. Refusing to start.");
  console.log(`Agent key ${publicKey.slice(0, 16)}… is limited to set_risk and extend_hold`);
}

export async function setRisk(holdId: number, risk: "Low" | "Medium" | "High", scamType: string | null, reasonsHash: string) {
  return agentAccount().callFunction({
    contractId: CONTRACT,
    methodName: "set_risk",
    args: { hold_id: holdId, risk, scam_type: scamType, reasons_hash: reasonsHash },
    gas: 30_000_000_000_000n,
  });
}

export const yoctoToNear = (y: string) => (Number(BigInt(y) / 10n ** 21n) / 1000).toString();
export const explorerTx = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
