// Shared helpers for the two videos: voice clips, durations, a headless
// browser driven over the DevTools protocol, and audio mixing.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FFMPEG = createRequire(import.meta.url)("ffmpeg-static");
export const OUT = join(HERE, "out");
export const AUDIO = join(HERE, "audio");
mkdirSync(OUT, { recursive: true });
mkdirSync(AUDIO, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EDGES = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
export const BROWSER = process.env.BROWSER_PATH || EDGES.find((p) => existsSync(p));

const RATE = "+7%";

/** Speaks `text` with a Microsoft Edge neural voice and returns the mp3 path. Cached by content. */
export function speak(text, voice) {
  const file = join(AUDIO, `${createHash("sha1").update(`${RATE}|${voice}|${text}`).digest("hex").slice(0, 16)}.mp3`);
  if (!existsSync(file)) {
    const r = spawnSync("python", ["-I", "-m", "edge_tts", "--voice", voice, `--rate=${RATE}`, "--text", text, "--write-media", file], { encoding: "utf8" });
    if (r.status !== 0 || !existsSync(file)) throw new Error(`voice failed for "${text.slice(0, 40)}": ${r.stderr?.slice(-300)}`);
  }
  return file;
}

/** Length of a media file in seconds. */
export function duration(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr || "");
  if (!m) throw new Error(`no duration for ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Splits narration into subtitle lines timed by their share of the clip. */
export function subtitles(text, start, length) {
  const parts = text.match(/[^.!?。！？]+[.!?。！？]+["”»]?|[^.!?。！？]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const total = parts.reduce((n, p) => n + p.length, 0);
  let at = start;
  return parts.map((p) => {
    const d = (p.length / total) * length;
    const line = { text: p, start: at, end: at + d };
    at += d;
    return line;
  });
}

/** Starts a headless browser and returns helpers to drive one page. */
export async function browser({ width = 1920, height = 1080, port = 9400, flags = [] } = {}) {
  if (!BROWSER) throw new Error("No Edge or Chrome found. Set BROWSER_PATH.");
  const proc = spawn(BROWSER, ["--headless=new", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--hide-scrollbars", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "pause-film-"))}`, `--window-size=${width},${height}`, ...flags, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {}
  }
  if (!target) throw new Error("the browser did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d.result ?? d.error);
      pending.delete(d.id);
    } else if (d.method && listeners.has(d.method)) listeners.get(d.method)(d.params);
  };
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  return { send, js, on: (method, fn) => listeners.set(method, fn), close: () => { ws.close(); proc.kill(); } };
}

/** Lays voice clips on a silent track at their start times and muxes them under the picture. */
export function mux(picture, clips, total, out) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", picture];
  clips.forEach((c) => args.push("-i", c.file));
  const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.start * 1000)}:all=1,volume=1.0[a${i}]`);
  const mix = `${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)}[a]`;
  args.push("-filter_complex", [...delays, mix].join(";"), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out);
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`mux failed: ${r.stderr?.slice(-600)}`);
}

export function note(file, lines) {
  writeFileSync(file, lines.join("\n"), "utf8");
}
