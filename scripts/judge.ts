// npm run judge  : every check a judge needs, no keys, no wallet.
// npm run suite  : the same run, and it rewrites the results table in README.md.
//
// Three groups of checks:
//   1. Scam scripts: each case in web/lib/cases.ts goes through the fixed rules.
//   2. Contract: the Rust unit tests and the ten scenarios run against the real
//      contract code (needs cargo; skipped with a clear note if it is missing).
//   3. Live testnet, read-only: the deployed contract answers, and the agent's
//      key on chain is limited to set_risk and extend_hold. Skip with OFFLINE=1.
//
// The run ends with "N checks passed, 0 failed" and exits non-zero on any failure.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseChat, ruleCheck, ruleVerdict, guessContact } from "../web/lib/analyzer";
import { CASES, casePasses } from "../web/lib/cases";
import { recoverSigner } from "../web/lib/proof";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE_README = process.argv.includes("--write-readme");
const OFFLINE = process.env.OFFLINE === "1";
const CONTRACT = process.env.PAUSE_CONTRACT || "pause.pause-demo.testnet";
const AGENT = process.env.AGENT_ACCOUNT || "agent.pause-demo.testnet";
const RPCS = ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];

let passed = 0;
let failed = 0;
const skipped: string[] = [];
const tty = process.stdout.isTTY;
const paint = (code: number, s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);

function check(ok: boolean, label: string, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? paint(32, "PASS") : paint(31, "FAIL")}  ${label}${detail ? paint(90, `  ${detail}`) : ""}`);
}
const heading = (s: string) => console.log(`\n${paint(1, s)}`);

// ------------------------------------------------------------ 1. scam scripts

heading("1. Scam scripts through the fixed rules (no AI, no network)");
const caseRows: string[] = [];
let scamsCaught = 0;
let scams = 0;
let falseAlarms = 0;
let genuine = 0;
for (const c of CASES) {
  const msgs = parseChat(c.text);
  const rules = ruleCheck(msgs, guessContact(msgs));
  const v = ruleVerdict(rules);
  const ok = casePasses(c, v.level);
  if (c.scam) {
    scams++;
    if (ok) scamsCaught++;
  } else {
    genuine++;
    if (!ok) falseAlarms++;
  }
  check(ok, `${c.id} ${c.title}`, `${v.level} ${v.score}/100, ${c.scam ? `needs ${c.expect}+` : `must stay ${c.expect} or lower`}`);
  caseRows.push(`| ${c.id} | ${c.title} | ${c.region} | ${c.scam ? "Scam" : "Genuine"} | ${v.level} (${v.score}) | ${ok ? "Pass" : "Fail"} |`);
}

heading("   TEE signature check (a recorded NEAR AI Cloud answer)");
// A real signature returned by NEAR AI Cloud for a real completion. The check
// recovers the signer from it, the same code path the app runs on every verdict.
const recorded = {
  text: "deepseek-ai/DeepSeek-V4.1-Flash-1017:f1c566e907b3cbf975c30c3cd44f28a8864bc0e9b411d16e0ecf989597fb4c65:15344ad0bf29c286a5dbaaf1c16f5d3092262cbb907221794fb5895dfbcbe2bb",
  signature: "0x62aa111510d4e5a655a2168348619affd42c8556e75911969ba6bef6b71aa7e2574024918b6ff584e47020aeae8eccded7b95b40efa1b8cd7cce004db3d6cd5a1b",
  signing_address: "0xfe0071895500a9755c18044948ab4f4e1a7f337e",
};
check(recoverSigner(recorded.text, recorded.signature) === recorded.signing_address, "Signature recovers to the TEE signing address");
check(recoverSigner(recorded.text.replace("f1c5", "f1c6"), recorded.signature) !== recorded.signing_address, "A changed answer no longer matches the signature");

// ---------------------------------------------------------------- 2. contract

heading("2. Contract: unit tests and the ten scenarios on the real contract code");
interface Scenario { id: string; title: string; kind: string; result: string; delay: number; how: string }
const scenarios: Scenario[] = [];
let unitTests = 0;
const cargo = spawnSync("cargo", ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
if (cargo.status !== 0) {
  skipped.push("Contract tests: cargo (Rust) is not installed. Install it from https://rustup.rs and run again.");
  console.log(paint(33, "  SKIP  cargo not found; contract checks skipped"));
} else {
  console.log(paint(90, "  running cargo test (the first run compiles for a few minutes)…"));
  const run = spawnSync("cargo", ["test", "--", "--nocapture", "--test-threads=1"], {
    cwd: resolve(ROOT, "contract"),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${run.stdout}\n${run.stderr}`;
  const summary = out.match(/test result: (\w+)\. (\d+) passed; (\d+) failed/);
  unitTests = summary ? Number(summary[2]) : 0;
  check(run.status === 0 && !!summary && summary[3] === "0", "cargo test", summary ? `${summary[2]} passed, ${summary[3]} failed` : "no summary line found");
  for (const line of out.split("\n")) {
    const m = line.trim().match(/SCENARIO\|(.+)$/);
    if (!m) continue;
    const [id, title, kind, result, delay, how] = m[1].split("|");
    scenarios.push({ id, title, kind, result, delay: Number(delay), how });
  }
  scenarios.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  for (const s of scenarios) {
    const ok = s.kind === "scam" ? s.result === "stopped" : s.result === "paid";
    check(ok, `${s.id} ${s.title}`, s.how);
  }
  check(scenarios.length === 10, "All ten scenarios reported", `${scenarios.length} of 10`);
}

// ------------------------------------------------------------ 3. live testnet

async function rpc(method: string, params: unknown): Promise<any> {
  let last: unknown;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "judge", method, params }),
        signal: AbortSignal.timeout(12_000),
      });
      const data = await res.json();
      if (data.error) throw new Error(JSON.stringify(data.error).slice(0, 200));
      return data.result;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
const view = async (method: string, args: object = {}) => {
  const r = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: CONTRACT,
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(r.result).toString());
};

let live: { stats?: any; registry?: any[] } = {};
if (OFFLINE) {
  skipped.push("Live testnet checks: OFFLINE=1 was set.");
} else {
  heading(`3. Live on NEAR testnet, read-only (${CONTRACT})`);
  try {
    const config = await view("get_config");
    check(typeof config.settings_delay_secs === "number", "Contract answers get_config", `settings delay ${config.settings_delay_secs}s`);
    check(config.block_reports === 3, "Graded registry is deployed", `block after ${config.block_reports ?? "?"} reports`);
    const stats = await view("get_stats");
    check(typeof stats.holds_created === "number", "Contract answers get_stats", `${stats.holds_created} holds, ${stats.scams_confirmed} reports, ${stats.blocked_by_registry} blocked`);
    const registry = await view("get_registry", { from_index: 0, limit: 50 });
    check(Array.isArray(registry), "Shared scam registry is readable", `${registry.length} receivers`);
    live = { stats, registry };

    const keys = await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: AGENT });
    const scoped = keys.keys.filter((k: any) => k.access_key.permission?.FunctionCall);
    const exact = scoped.some((k: any) => {
      const p = k.access_key.permission.FunctionCall;
      return p.receiver_id === CONTRACT && [...p.method_names].sort().join() === "extend_hold,set_risk";
    });
    check(exact, "Agent has a key limited to set_risk and extend_hold", `${AGENT}`);
    const wide = scoped.filter((k: any) => {
      const p = k.access_key.permission.FunctionCall;
      return p.receiver_id === CONTRACT && p.method_names.some((m: string) => !["set_risk", "extend_hold"].includes(m));
    });
    check(wide.length === 0, "No agent function-call key allows any other method");
  } catch (e) {
    check(false, "Reach NEAR testnet", `${(e as Error).message}. Run with OFFLINE=1 to skip the live checks.`);
  }
}

// -------------------------------------------------------------------- summary

const stoppedScams = scenarios.filter((s) => s.kind === "scam" && s.result === "stopped").length;
const scamScenarios = scenarios.filter((s) => s.kind === "scam").length;
const genuineScenarios = scenarios.filter((s) => s.kind === "genuine");
const delayed = genuineScenarios.filter((s) => s.delay > 0);

const table = [
  "| Measure | Result |",
  "| --- | --- |",
  `| Scam scripts caught by the fixed rules alone | ${scamsCaught} of ${scams} |`,
  `| Genuine messages wrongly flagged | ${falseAlarms} of ${genuine} |`,
  ...(scenarios.length
    ? [
        `| Contract scenarios where the scam got no money | ${stoppedScams} of ${scamScenarios} |`,
        `| Genuine payments delayed | ${delayed.length} of ${genuineScenarios.length}${delayed.length ? ` (${Math.round(delayed[0].delay / 60)} minutes, until a guardian approved)` : ""} |`,
        `| Contract unit tests | ${unitTests} passed |`,
      ]
    : []),
  "",
  "| # | Scenario | Type | What happened |",
  "| --- | --- | --- | --- |",
  ...scenarios.map((s) => `| ${s.id} | ${s.title} | ${s.kind === "scam" ? "Scam" : "Genuine"} | ${s.how} |`),
  "",
  "| # | Script | Where it is common | Type | Rule verdict | Check |",
  "| --- | --- | --- | --- | --- | --- |",
  ...caseRows,
].join("\n");

if (WRITE_README) {
  const file = resolve(ROOT, "README.md");
  const readme = readFileSync(file, "utf8");
  const start = "<!-- suite:start -->";
  const end = "<!-- suite:end -->";
  if (!existsSync(file) || !readme.includes(start) || !readme.includes(end)) {
    check(false, "README has suite markers");
  } else if (!scenarios.length) {
    console.log(paint(33, "\n  README not rewritten: the contract scenarios did not run."));
  } else {
    const next = readme.slice(0, readme.indexOf(start) + start.length) + "\n" + table + "\n" + readme.slice(readme.indexOf(end));
    writeFileSync(file, next);
    console.log(paint(90, "\n  README.md results table rewritten from this run."));
  }
} else {
  heading("Results");
  console.log(table.split("\n").slice(0, 7).join("\n"));
}

for (const s of skipped) console.log(paint(33, `\nSkipped: ${s}`));
console.log(`\n${paint(failed ? 31 : 32, `${passed} checks passed, ${failed} failed`)}`);
process.exit(failed ? 1 : 0);
