import { NextResponse } from "next/server";
import { pauseReply, type Turn } from "@/lib/chat";
import { clientIp, limited } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Chat with Pause on the website. Nothing is stored on the server. */
export async function POST(req: Request) {
  if (limited(`chat:${clientIp(req)}`, 20)) return NextResponse.json({ error: "You're sending messages quickly. Give it a minute." }, { status: 429 });
  let body: { messages?: Turn[]; pot?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "Say something first." }, { status: 400 });
  const pot = typeof body.pot === "number" && body.pot >= 0 ? body.pot : null;
  const reply = await pauseReply(messages, { potId: pot, where: "web" });
  return NextResponse.json({ reply });
}
