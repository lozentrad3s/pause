// Proof that a verdict came from a model running inside a TEE on NEAR AI Cloud.
//
// What Pause checks itself, on every verdict:
//   1. request_hash and response_hash: SHA-256 of the exact bytes we sent and
//      the exact bytes we got back.
//   2. NEAR AI Cloud's signature endpoint returns "<model>:<request>:<response>"
//      signed by a key that lives inside the model's TEE. We recover the signer
//      from that signature (EIP-191) and compare it with the address returned.
//   3. The same address must be the signing address in the model's attestation
//      report, which is fetched with a fresh nonce.
//
// What Pause does not check: the Intel TDX quote and NVIDIA GPU evidence inside
// that report. They are returned by /api/attestation so anyone can verify them
// with Intel's and NVIDIA's own tools. The UI says so.

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

export const NEARAI_BASE = "https://cloud-api.near.ai/v1";

export interface Proof {
  model: string;
  chat_id: string;
  request_hash: string;
  response_hash: string;
  /** "<model>:<request_hash>:<response_hash>" as signed inside the TEE. */
  signed_text: string | null;
  signature: string | null;
  signing_address: string | null;
  /** The signed text matches the hashes Pause computed itself. */
  hashes_match: boolean;
  /** The signature recovers to signing_address. */
  signature_valid: boolean;
  /** signing_address is listed in the model's TEE attestation report. */
  signer_attested: boolean;
  /** All three checks above passed. */
  verified: boolean;
  checked_at: string;
  note?: string;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => {
  const h = s.replace(/^0x/, "");
  return Uint8Array.from(h.match(/.{2}/g) ?? [], (x) => parseInt(x, 16));
};

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource)));
}

/** Recovers the Ethereum-style address that signed `text` (EIP-191 personal_sign). */
export function recoverSigner(text: string, signature: string): string | null {
  try {
    const sig = unhex(signature);
    if (sig.length !== 65) return null;
    const msg = new TextEncoder().encode(text);
    const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msg.length}`);
    const digest = keccak_256(Uint8Array.from([...prefix, ...msg]));
    const recovery = sig[64] >= 27 ? sig[64] - 27 : sig[64];
    const recovered = Uint8Array.from([recovery, ...sig.slice(0, 64)]);
    const compressed = secp256k1.recoverPublicKey(recovered, digest, { prehash: false });
    const uncompressed = secp256k1.Point.fromBytes(compressed).toBytes(false);
    return "0x" + hex(keccak_256(uncompressed.slice(1)).slice(-20));
  } catch {
    return null;
  }
}

// The attestation report is about 120 KB and changes rarely, so the signing
// addresses for a model are cached for a few minutes.
const attested = new Map<string, { at: number; addresses: string[] }>();

export async function attestedSigners(model: string, apiKey: string): Promise<string[]> {
  const hit = attested.get(model);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.addresses;
  const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const res = await fetch(
    `${NEARAI_BASE}/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${nonce}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`attestation ${res.status}`);
  const report = await res.json();
  const list: { signing_address?: string; request_nonce?: string }[] = report?.model_attestations ?? [];
  // Only count attestations that echo the nonce we just made, so a stale
  // report can't be replayed.
  const addresses = list
    .filter((m) => m.request_nonce === nonce && m.signing_address)
    .map((m) => m.signing_address!.toLowerCase());
  attested.set(model, { at: Date.now(), addresses });
  return addresses;
}

/** Fetches the TEE signature for a completion and checks it. Never throws. */
export async function buildProof(input: {
  apiKey: string;
  model: string;
  chatId: string;
  requestBody: string;
  responseBody: Uint8Array;
}): Promise<Proof> {
  const proof: Proof = {
    model: input.model,
    chat_id: input.chatId,
    request_hash: await sha256Hex(input.requestBody),
    response_hash: await sha256Hex(input.responseBody),
    signed_text: null,
    signature: null,
    signing_address: null,
    hashes_match: false,
    signature_valid: false,
    signer_attested: false,
    verified: false,
    checked_at: new Date().toISOString(),
  };
  try {
    // The signature can take a moment to appear after the completion.
    let sig: { text?: string; signature?: string; signing_address?: string; error_code?: string } | null = null;
    for (let attempt = 0; attempt < 4 && !sig?.signature; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 700));
      const res = await fetch(`${NEARAI_BASE}/signature/${encodeURIComponent(input.chatId)}?signing_algo=ecdsa`, {
        headers: { Authorization: `Bearer ${input.apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(6_000),
      });
      if (res.ok) sig = await res.json();
    }
    if (!sig?.signature || !sig.text || !sig.signing_address) {
      proof.note = "NEAR AI Cloud returned no signature for this answer.";
      return proof;
    }
    proof.signed_text = sig.text;
    proof.signature = sig.signature;
    proof.signing_address = sig.signing_address.toLowerCase();
    proof.hashes_match = sig.text === `${input.model}:${proof.request_hash}:${proof.response_hash}`;
    proof.signature_valid = recoverSigner(sig.text, sig.signature) === proof.signing_address;
    proof.signer_attested = (await attestedSigners(input.model, input.apiKey)).includes(proof.signing_address);
    proof.verified = proof.hashes_match && proof.signature_valid && proof.signer_attested;
  } catch (e) {
    proof.note = `Could not complete the check: ${(e as Error).message}`;
  }
  return proof;
}
