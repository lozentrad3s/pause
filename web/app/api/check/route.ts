import { NextResponse } from "next/server";
import { analyzeChat } from "@/lib/analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple per-IP limit so a public demo can't burn the AI credits.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 8;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many checks. Try again in a minute." }, { status: 429 });

  let body: { chat?: string; platform?: string; contact?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with a chat field." }, { status: 400 });
  }
  const chat = (body.chat ?? "").slice(0, 20000);
  if (chat.trim().length < 10) return NextResponse.json({ error: "Paste a few messages first." }, { status: 400 });

  // The chat is analysed in memory and never stored.
  const result = await analyzeChat(chat, {
    apiKey: process.env.DRY_RUN === "true" && !process.env.NEARAI_API_KEY ? undefined : process.env.NEARAI_API_KEY,
    model: process.env.NEARAI_MODEL,
    platform: body.platform,
    contact: body.contact,
  });
  return NextResponse.json(result);
}
