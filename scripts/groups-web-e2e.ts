// End-to-end check of the group web flow against a running site (default
// http://localhost:3000): the same calls the browser makes, with a key pair
// made here like the browser makes one. Real transactions on NEAR testnet.
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner } from "near-api-js";

const WEB = process.env.WEB || "http://localhost:3000";
const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });
const toYocto = (n: number) => (BigInt(Math.round(n * 1e6)) * 10n ** 18n).toString();

async function api(body: object) {
  const r = await fetch(`${WEB}/api/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(`${(body as { action: string }).action}: ${d.error}`);
  return d;
}
const view = (method: string, args: object) => provider.callFunction({ contractId: "pause.pause-demo.testnet", method, args: args as Record<string, unknown> }) as Promise<any>;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const step = (s: string) => console.log(`  ✓ ${s}`);

const caps = await (await fetch(`${WEB}/api/groups`)).json();
console.log("caps", { treasurer: caps.treasurer, demo: caps.demo, guest: caps.guest, ai: caps.ai });

const pair = KeyPair.fromRandom("ed25519");
const g = await api({ action: "guest", key: pair.getPublicKey().toString() });
step(`organizer ${g.organizer}`);
const org = new Account(g.organizer, provider, KeyPairSigner.fromSecretKey(pair.toString() as `ed25519:${string}`));
const call = async (method: string, args: object, deposit = "0") => {
  const out: any = await org.callFunctionRaw({ contractId: "pause.pause-demo.testnet", methodName: method, args: args as Record<string, unknown>, deposit: BigInt(deposit), gas: 60_000_000_000_000n });
  if (out.status?.Failure) throw new Error(JSON.stringify(out.status.Failure));
  return out.status?.SuccessValue ? JSON.parse(Buffer.from(out.status.SuccessValue, "base64").toString()) : null;
};

const pot = await call("create_pot", {
  name: "Class of 2016 Reunion", members: [g.organizer, ...g.members], approvals_needed: 3, agent: g.agent,
  goal: toYocto(0.25), contribution_each: toYocto(0.05), deadline: Math.floor(Date.now() / 1000) + 86400, hold_secs: 30,
}, toYocto(0.06));
step(`pot ${pot} created`);
await api({ action: "seed", pot });
await api({ action: "remind", pot });
const p = await view("get_pot", { pot_id: pot });
step(`raised ${Number(BigInt(p.raised) / 10n ** 21n) / 1000} of 0.25 NEAR from ${p.contributions.length} members`);

const plan = await api({ action: "plan", pot, text: caps.plan });
step(`plan (${plan.plan.source}): ${plan.proposed.length} lines proposed, ${plan.plan.questions.length} questions`);
const hall = plan.proposed.find((l: any) => l.vendor.startsWith("hall-owner"));
await call("approve_line", { line_id: hall.line });
const votes = await api({ action: "vote", pot, line: hall.line, approve: true });
step(`hall approved by organizer + ${votes.acts.length} demo members`);
let line = await view("get_line", { line_id: hall.line });
if (line.status !== "Approved") throw new Error(`hall is ${line.status}`);

await api({ action: "propose", pot, vendor: caps.blocked_vendor, label: "Cheap drinks", amount: "0.03" });
const lines = await view("get_lines", { pot_id: pot });
const plug = lines.find((l: any) => l.vendor === caps.blocked_vendor);
step(`drinks-plug proposed, flagged: ${plug.flagged}`);
await call("approve_line", { line_id: plug.id });
await api({ action: "vote", pot, line: plug.id, approve: true });

console.log("  … waiting 34s for the hold window");
await sleep(34);
const pay = await api({ action: "pay", pot });
for (const x of pay.payments) step(`${x.label}: ${x.refused ? `refused (${x.refused})` : `paid ${x.amount} NEAR tx ${x.hash}`}`);
const conf = await api({ action: "confirm", pot, line: hall.line });
step(`hall confirmed tx ${conf.act.hash}`);
const ask = await api({ action: "ask", pot, q: "How much is left?" });
step(`ask: ${ask.answer}`);
console.log(`\nweb flow OK. Open ${WEB}/groups/${pot}`);
