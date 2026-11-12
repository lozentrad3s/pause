import { NextResponse } from "next/server";
import { clientIp, limited } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Turns a short voice recording into text with Whisper on NEAR AI Cloud, so
 * someone can simply talk to Pause. The audio is forwarded and never stored.
 */
export async function POST(req: Request) {
  const apiKey = process.env.NEARAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Voice isn't switched on for this deployment. Please type your question instead." }, { status: 503 });
  if (limited(`voice:${clientIp(req)}`, 6)) return NextResponse.json({ error: "Too many recordings. Try again in a minute." }, { status: 429 });

  let audio: File | null = null;
  let lang = "";
  try {
    const incoming = await req.formData();
    audio = incoming.get("audio") as File | null;
    lang = String(incoming.get("lang") ?? "").slice(0, 2).toLowerCase();
  } catch {
    audio = null;
  }
  if (!audio || typeof audio === "string" || audio.size === 0) return NextResponse.json({ error: "No recording arrived. Please try again." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too long. Keep it under a minute." }, { status: 413 });

  const form = new FormData();
  form.append("file", audio, audio.name || "question.webm");
  form.append("model", "openai/whisper-large-v3");
  // Telling Whisper the language skips its detection pass and stops short
  // clips being heard as the wrong language.
  if (/^[a-z]{2}$/.test(lang)) form.append("language", lang);
  try {
    const res = await fetch("https://cloud-api.near.ai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`transcription ${res.status}`);
    const data = await res.json();
    const text = String(data.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "I couldn't hear any words. Please try again, a little closer to the phone." }, { status: 422 });
    return NextResponse.json({ text });
  } catch (e) {
    console.error("transcribe", e);
    return NextResponse.json({ error: "I couldn't process that recording. Please try again, or type your question." }, { status: 502 });
  }
}
