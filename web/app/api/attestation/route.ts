import { NextResponse } from "next/server";
import { DEFAULT_MODEL } from "@/lib/analyzer";
import { NEARAI_BASE } from "@/lib/proof";
import { clientIp, limited } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns NEAR AI Cloud's attestation report for the model Pause uses, fetched
 * with a nonce the caller can choose. It contains the Intel TDX quote and the
 * NVIDIA GPU evidence, so anyone can verify the hardware themselves instead of
 * trusting Pause's summary.
 */
export async function GET(req: Request) {
  const apiKey = process.env.NEARAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No NEAR AI Cloud key is configured on this deployment." }, { status: 503 });
  if (limited(`attest:${clientIp(req)}`, 6)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  const url = new URL(req.url);
  const model = url.searchParams.get("model") || process.env.NEARAI_MODEL || DEFAULT_MODEL;
  const given = url.searchParams.get("nonce") ?? "";
  const nonce = /^[0-9a-f]{64}$/.test(given) ? given : Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    const res = await fetch(`${NEARAI_BASE}/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${nonce}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`attestation ${res.status}`);
    const report = await res.json();
    return NextResponse.json({
      model,
      nonce,
      how_to_verify: [
        "Check each model_attestations[].request_nonce equals the nonce above.",
        "Submit nvidia_payload to NVIDIA NRAS: https://docs.api.nvidia.com/attestation/reference/attestmultigpu_1",
        "Verify intel_quote with dcap-qvl (https://github.com/Phala-Network/dcap-qvl) or https://proof.t16z.com/",
        "The quote's report data binds signing_address, the key that signs every answer.",
        "Full reference verifier: https://github.com/nearai/nearai-cloud-verifier",
      ],
      model_attestations: report.model_attestations ?? [],
      gateway_attestation: report.gateway_attestation ?? null,
    });
  } catch (e) {
    console.error("attestation", e);
    return NextResponse.json({ error: "NEAR AI Cloud didn't return an attestation just now. Please try again." }, { status: 502 });
  }
}
