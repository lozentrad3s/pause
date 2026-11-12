import { NextResponse } from "next/server";
import { AGENT, CONTRACT, rpc, view, type Stats } from "@/lib/near";
import { ALLOWED_AGENT_METHODS, sponsorAccount } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KeyList {
  keys: { access_key: { permission: "FullAccess" | { FunctionCall: { receiver_id: string; method_names: string[] } } } }[];
}

/** Live health of every part a judge depends on. Used by /status and the header dot. */
export async function GET() {
  const checks: { id: string; label: string; ok: boolean; detail: string }[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) => checks.push({ id, label, ok, detail });

  let stats: Stats | null = null;
  try {
    stats = await view<Stats>("get_stats");
    add("contract", "Pause contract on NEAR testnet", true, CONTRACT);
  } catch {
    add("contract", "Pause contract on NEAR testnet", false, "Not reachable right now");
  }

  try {
    const config = await view<{ block_reports?: number }>("get_config");
    add("registry", "Graded scam registry", config.block_reports === 3, config.block_reports === 3 ? "1 report warns, 3 block" : "Older contract version is deployed");
  } catch {
    add("registry", "Graded scam registry", false, "Not reachable right now");
  }

  try {
    const list = await rpc<KeyList>("query", { request_type: "view_access_key_list", finality: "final", account_id: AGENT });
    const scoped = list.keys.some((k) => {
      const p = k.access_key.permission;
      return p !== "FullAccess" && p.FunctionCall.receiver_id === CONTRACT && p.FunctionCall.method_names.every((m) => ALLOWED_AGENT_METHODS.includes(m));
    });
    add("agent_key", "Agent key limited to set_risk and extend_hold", scoped, AGENT);
  } catch {
    add("agent_key", "Agent key limited to set_risk and extend_hold", false, "Not reachable right now");
  }

  add("agent_signer", "Agent can record verdicts from this server", !!process.env.AGENT_PRIVATE_KEY, process.env.AGENT_PRIVATE_KEY ? "Scoped key loaded" : "No agent key configured");
  add("ai", "Private AI on NEAR AI Cloud", !!process.env.NEARAI_API_KEY, process.env.NEARAI_API_KEY ? "Key configured; verdicts carry a TEE signature" : "No key: the fixed rules answer on their own");

  let sets = 0;
  const sponsor = sponsorAccount();
  if (sponsor) {
    try {
      sets = Number((await sponsor.getBalance()) / 483_000_000_000_000_000_000_000n);
    } catch {
      sets = 0;
    }
  }
  add("guest", "Guest accounts for judges", sets > 0, sponsor ? `${sets} sets can be funded` : "Not switched on for this deployment");

  return NextResponse.json({ ok: checks.every((c) => c.ok), checked_at: new Date().toISOString(), stats, checks });
}
