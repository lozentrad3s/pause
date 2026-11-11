// Read-only contract calls over JSON-RPC, plus amount and time helpers.

export const NETWORK = "testnet";
export const CONTRACT = process.env.NEXT_PUBLIC_PAUSE_CONTRACT || "pause.pause-demo.testnet";
export const AGENT = process.env.NEXT_PUBLIC_AGENT_ACCOUNT || "agent.pause-demo.testnet";
const RPC = "https://rpc.testnet.near.org";
export const EXPLORER = "https://testnet.nearblocks.io";

export type HoldStatus = "Pending" | "Released" | "Cancelled" | "Vetoed" | "Blocked";
export type Risk = "Unknown" | "Low" | "Medium" | "High";

export interface Hold {
  id: number;
  owner: string;
  receiver: string;
  amount: string;
  memo: string | null;
  created_at: number;
  release_at: number;
  status: HoldStatus;
  risk: Risk;
  scam_type: string | null;
  reasons_hash: string | null;
  guardian_approved: boolean;
}

export interface Vault {
  owner: string;
  balance: string;
  guardians: string[];
  agent: string | null;
  instant_limit: string;
  daily_instant_cap: string;
  spent_today: string;
  hold_secs: number;
  trusted_payees: string[];
  pending_change: { change: Record<string, unknown>; proposed_at: number; effective_at: number } | null;
}

export interface RegistryEntry {
  receiver: string;
  scam_type: string | null;
  reports: number;
  first_reported_at: number;
}

export interface Stats {
  instant_payments: number;
  holds_created: number;
  blocked_by_registry: number;
  scams_confirmed: number;
}

export async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "pause",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: CONTRACT,
        method_name: method,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  const data = await res.json();
  if (data.error || data.result?.error) throw new Error(data.error?.data ?? data.result.error);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(data.result.result)));
}

// ----------------------------------------------------------------- amounts

const YOCTO = 10n ** 24n;

export function toYocto(near: string): string {
  const [whole, frac = ""] = near.trim().split(".");
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac)) throw new Error("Enter a number");
  return (BigInt(whole || "0") * YOCTO + BigInt((frac + "0".repeat(24)).slice(0, 24))).toString();
}

export function fromYocto(yocto: string, digits = 2): string {
  const v = BigInt(yocto);
  const whole = v / YOCTO;
  const frac = (v % YOCTO).toString().padStart(24, "0").slice(0, digits).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

// -------------------------------------------------------------------- time

export function until(unixSecs: number, now = Date.now() / 1000): string {
  const s = Math.max(0, Math.round(unixSecs - now));
  if (s === 0) return "now";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function duration(secs: number): string {
  if (secs >= 86400) return `${Math.round(secs / 86400)} day${secs >= 172800 ? "s" : ""}`;
  if (secs >= 3600) return `${Math.round(secs / 3600)} hours`;
  if (secs >= 60) return `${Math.round(secs / 60)} minutes`;
  return `${secs} seconds`;
}

export const SCAM_NAMES: Record<string, string> = {
  romance: "Romance scam",
  investment: "Investment scam",
  romance_investment: "Romance + crypto scam",
  impersonation: "Impersonation",
  government_impersonation: "Government impersonation",
  family_emergency: "Family emergency",
  fake_withdrawal_fee: "Fake withdrawal fee",
  job: "Job or task scam",
  other: "Suspected scam",
};
