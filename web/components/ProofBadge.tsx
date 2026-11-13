"use client";

import { useState } from "react";
import type { Analysis } from "@/lib/analyzer";

const short = (s: string | null, n = 10) => (s ? (s.length > n * 2 + 3 ? `${s.slice(0, n)}…${s.slice(-n)}` : s) : "none");

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className={ok ? "ok" : "no"}>
      <span className="proof-mark" aria-hidden>{ok ? "✓" : "!"}</span>
      <div>
        <b>{label}</b>
        <span>{detail}</span>
      </div>
    </li>
  );
}

/**
 * Shows where a verdict came from. For AI verdicts it unfolds into the three
 * checks Pause ran on NEAR AI Cloud's TEE signature, with the raw values, so
 * "checked privately" is something a person can inspect rather than a claim.
 */
export default function ProofBadge({ analysis }: { analysis: Pick<Analysis, "source" | "model" | "proof"> }) {
  const [open, setOpen] = useState(false);
  const p = analysis.proof;

  if (analysis.source !== "ai" || !p) {
    return (
      <div className="proof proof-rules">
        
        <span>
          <b>Checked with fixed rules.</b> No AI key is set on this server, so no model was used and there is no TEE proof to show.
        </span>
      </div>
    );
  }

  return (
    <div className={`proof ${p.verified ? "proof-ok" : "proof-warn"}`}>
      <button className="proof-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        
        <span>
          <b>{p.verified ? "Checked privately" : "Checked on NEAR AI Cloud"}</b>
          <span className="proof-sub">{p.verified ? "TEE signature verified" : "signature not fully verified"} · {p.model.split("/").pop()}</span>
        </span>
        <span className="proof-toggle">{open ? "Hide proof" : "Show proof"}</span>
      </button>
      {open && (
        <div className="proof-body">
          <p>
            Your text was read by a model running inside a sealed enclave (a TEE) on NEAR AI Cloud. The enclave signs every
            answer with a key that never leaves it. Pause checked that signature:
          </p>
          <ul className="proof-checks">
            <Row ok={p.hashes_match} label="The signed answer is the one you see" detail="The enclave signed the SHA-256 of exactly what Pause sent and exactly what came back." />
            <Row ok={p.signature_valid} label="The signature is genuine" detail={`It recovers to the signing address ${short(p.signing_address, 8)}.`} />
            <Row ok={p.signer_attested} label="That key belongs to the enclave" detail="The address is listed in the model's hardware attestation report, fetched with a fresh nonce." />
          </ul>
          <dl className="proof-data">
            <dt>Model</dt><dd>{p.model}</dd>
            <dt>Request hash</dt><dd>{p.request_hash}</dd>
            <dt>Response hash</dt><dd>{p.response_hash}</dd>
            <dt>Signature</dt><dd>{p.signature ?? "none"}</dd>
            <dt>Signing address</dt><dd>{p.signing_address ?? "none"}</dd>
            <dt>Checked</dt><dd>{new Date(p.checked_at).toLocaleString()}</dd>
          </dl>
          {p.note && <p className="proof-note">{p.note}</p>}
          <p className="proof-links">
            Pause does not re-verify the Intel and NVIDIA hardware evidence itself. You can:{" "}
            <a href={`/api/attestation?model=${encodeURIComponent(p.model)}`} target="_blank" rel="noreferrer">download the attestation report</a>,{" "}
            <a href="https://proof.t16z.com/" target="_blank" rel="noreferrer">check the Intel quote</a>, or{" "}
            <a href="https://cloud.near.ai/verify" target="_blank" rel="noreferrer">use NEAR AI&apos;s verifier</a>.
          </p>
        </div>
      )}
    </div>
  );
}
