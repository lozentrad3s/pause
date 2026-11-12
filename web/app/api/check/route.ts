import { NextResponse } from "next/server";
import { analyzeChat } from "@/lib/analyzer";
import { isLang } from "@/lib/i18n";
import { aiOptions, clientIp, limited } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // A per-IP limit so a public demo can't burn the AI credits.
  if (limited(`check:${clientIp(req)}`, 8)) return NextResponse.json({ error: "Too many checks. Try again in a minute." }, { status: 429 });

  let body: { chat?: string; platform?: string; contact?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with a chat field." }, { status: 400 });
  }
  const chat = (body.chat ?? "").slice(0, 20000);
  if (chat.trim().length < 10) return NextResponse.json({ error: "Paste a few messages first." }, { status: 400 });

  // The text is analysed in memory and never stored. With no NEARAI_API_KEY
  // the fixed rules answer on their own, so the app works without any keys.
  const result = await analyzeChat(chat, {
    ...aiOptions(),
    platform: body.platform,
    contact: body.contact,
    lang: isLang(body.lang) ? body.lang : "en",
  });
  return NextResponse.json(result);
}
