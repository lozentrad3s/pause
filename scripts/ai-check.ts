// npm run ai-check : one live call to NEAR AI Cloud, showing the verdict and
// each step of the TEE signature check. Needs NEARAI_API_KEY in .env.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiVerdict, guessContact, parseChat, ruleCheck } from "../web/lib/analyzer";
import { CASES } from "../web/lib/cases";

const env = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
if (existsSync(env)) process.loadEnvFile(env);
if (!process.env.NEARAI_API_KEY) {
  console.log("NEARAI_API_KEY is not set. Add it to .env to run the live AI check. The app works without it, using the fixed rules.");
  process.exit(0);
}

const lang = process.argv[2] || "en";
const c = CASES.find((x) => x.id === (process.argv[3] || "C1"))!;
const msgs = parseChat(c.text);
const rules = ruleCheck(msgs, guessContact(msgs));
const out = await aiVerdict(msgs, rules, { apiKey: process.env.NEARAI_API_KEY, model: process.env.NEARAI_MODEL || undefined, platform: c.kind, lang, signal: AbortSignal.timeout(40_000) });
if (!out) throw new Error("No verdict returned");
const { verdict, proof } = out;
console.log(`Case ${c.id}: ${c.title}`);
console.log(`Verdict: ${verdict.level} (${verdict.score}/100), ${verdict.scam_type}`);
console.log(`Summary (${lang}): ${verdict.summary}`);
console.log(`Model: ${proof.model}`);
console.log(`${proof.hashes_match ? "PASS" : "FAIL"}  The signed text matches the request and response hashes`);
console.log(`${proof.signature_valid ? "PASS" : "FAIL"}  The signature recovers to ${proof.signing_address}`);
console.log(`${proof.signer_attested ? "PASS" : "FAIL"}  That address is in the model's TEE attestation report`);
if (proof.note) console.log(`Note: ${proof.note}`);
process.exit(proof.verified ? 0 : 1);
