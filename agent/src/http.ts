// The agent's small web endpoint:
//   GET  /health  -> {ok: true}, for the host's health check
//   POST /link    -> links a Telegram chat to a NEAR account, but only after the
//                    account signs the one-time code with its own key (NEP-413).
// Without this, anyone could /link someone else's account and read its alerts.

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { JsonRpcProvider, PublicKey } from "near-api-js";

const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC || "https://test.rpc.fastnear.com" });
export const LINK_RECIPIENT = "pause-telegram";
export const linkMessage = (code: string) => `Link my Telegram chat to Pause.\nCode: ${code}`;

const pending = new Map<string, { chatId: number; expires: number }>();

/** A short one-time code for a chat, valid for 15 minutes. */
export function newLinkCode(chatId: number): string {
  const code = randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X");
  pending.set(code, { chatId, expires: Date.now() + 15 * 60_000 });
  return code;
}

// ------------------------------------------------------------ NEP-413 check

function borshString(s: string): Buffer {
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}

/** sha256 of the NEP-413 payload: tag 2^31+413, then message, nonce, recipient, callbackUrl. */
function payloadHash(message: string, nonce: Buffer, recipient: string, callbackUrl?: string): Uint8Array {
  const tag = Buffer.alloc(4);
  tag.writeUInt32LE(2147484061);
  const cb = callbackUrl ? Buffer.concat([Buffer.from([1]), borshString(callbackUrl)]) : Buffer.from([0]);
  return createHash("sha256").update(Buffer.concat([tag, borshString(message), nonce, borshString(recipient), cb])).digest();
}

function decodeSignature(sig: string): Uint8Array {
  const s = sig.replace(/^ed25519:/, "");
  const b64 = Buffer.from(s, "base64");
  return b64.length === 64 ? b64 : Buffer.from(s, "base64url");
}

async function isFullAccessKey(accountId: string, publicKey: string): Promise<boolean> {
  try {
    const key = (await provider.query({ request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey })) as unknown as { permission: unknown };
    return key.permission === "FullAccess";
  } catch {
    return false;
  }
}

export interface LinkRequest {
  code: string;
  accountId: string;
  publicKey: string;
  signature: string;
  nonce: string; // base64, 32 bytes
  callbackUrl?: string;
}

export async function verifyLink(r: LinkRequest): Promise<{ chatId: number; accountId: string } | { error: string }> {
  const p = pending.get(r.code);
  if (!p || p.expires < Date.now()) return { error: "This code has expired. Send /link to Pause again for a new one." };
  if (!/^[a-z0-9_.-]{2,64}$/.test(r.accountId)) return { error: "That isn't a NEAR account." };
  const nonce = Buffer.from(r.nonce, "base64");
  if (nonce.length !== 32) return { error: "Bad signature request." };
  let ok = false;
  try {
    const pk = PublicKey.fromString(r.publicKey);
    const sig = decodeSignature(r.signature);
    const msg = linkMessage(r.code);
    ok = pk.verify(payloadHash(msg, nonce, LINK_RECIPIENT), sig) || (!!r.callbackUrl && pk.verify(payloadHash(msg, nonce, LINK_RECIPIENT, r.callbackUrl), sig));
  } catch {
    ok = false;
  }
  if (!ok) return { error: "The signature doesn't match. Please try again from the link Pause sent you." };
  if (!(await isFullAccessKey(r.accountId, r.publicKey))) return { error: "That key doesn't control this account." };
  pending.delete(r.code);
  return { chatId: p.chatId, accountId: r.accountId };
}

// ------------------------------------------------------------------- server

export function startHttp(onLinked: (chatId: number, accountId: string) => Promise<void>) {
  const port = Number(process.env.PORT || 8787);
  const allowed = new Set([process.env.PAUSE_WEB_URL || "", "http://localhost:3000", "https://pauseai-near.vercel.app"].filter(Boolean));
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin ?? "";
    if (allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    const json = (code: number, body: object) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) return json(200, { ok: true, service: "pause-agent" });
    if (req.method === "POST" && req.url === "/link") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 8000) return json(413, { error: "Too large" });
      }
      try {
        const out = await verifyLink(JSON.parse(raw) as LinkRequest);
        if ("error" in out) return json(400, out);
        await onLinked(out.chatId, out.accountId);
        return json(200, { ok: true, accountId: out.accountId });
      } catch {
        return json(400, { error: "Send the details the link page provides." });
      }
    }
    json(404, { error: "Not found" });
  });
  server.listen(port, () => console.log(`Agent endpoint on :${port}`));
}
