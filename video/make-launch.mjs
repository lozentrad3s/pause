// Renders the launch explainer: video/out/pause-ai-launch.mp4
//   node video/make-launch.mjs            full render
//   node video/make-launch.mjs --stills   one PNG per scene, for checking the design
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { browser, duration, FFMPEG, HERE, mux, OUT, speak, subtitles } from "./lib.mjs";

const FPS = 30;
const spec = JSON.parse(readFileSync(join(HERE, "launch.json"), "utf8"));
const stills = process.argv.includes("--stills");

// 1. Voice every scene and lay out the timeline from the clip lengths.
let at = 0.4;
const scenes = [];
const subs = [];
const clips = [];
for (const s of spec.scenes) {
  const file = speak(s.text, s.voice || spec.voice);
  const len = duration(file);
  const dur = len + (s.pad ?? 0.55);
  scenes.push({ id: s.id, start: at - 0.2, dur: dur + 0.2 });
  subs.push(...subtitles(s.text, at, len));
  clips.push({ file, start: at });
  at += dur;
}
scenes[0].dur += scenes[0].start;
scenes[0].start = 0;
const total = at + 0.3;
scenes[scenes.length - 1].dur = total - scenes[scenes.length - 1].start;
console.log(`timeline: ${scenes.length} scenes, ${total.toFixed(1)}s`);

// 2. Open the film and step it frame by frame.
const b = await browser();
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.TIMELINE = ${JSON.stringify({ scenes, subs, endLine: spec.endLine })};` });
await b.send("Page.navigate", { url: pathToFileURL(join(HERE, "film.html")).href });
for (let i = 0; i < 80; i++) {
  if (await b.js("window.ready ? window.ready.then(() => true) : false")) break;
  await new Promise((r) => setTimeout(r, 250));
}
await new Promise((r) => setTimeout(r, 2000)); // CSS background photographs

const shot = async (t, format = "jpeg") => {
  await b.js(`window.seek(${t.toFixed(4)})`);
  const r = await b.send("Page.captureScreenshot", format === "jpeg" ? { format, quality: 93 } : { format });
  return Buffer.from(r.data, "base64");
};

if (stills) {
  for (const s of scenes) writeFileSync(join(OUT, `still-${s.id}.png`), await shot(s.start + Math.min(s.dur - 0.6, s.dur * 0.82), "png"));
  console.log("stills written to video/out");
  b.close();
  process.exit(0);
}

const silent = join(OUT, "_launch-picture.mp4");
const ff = spawn(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), silent], { stdio: ["pipe", "inherit", "inherit"] });
const frames = Math.ceil(total * FPS);
const began = Date.now();
for (let f = 0; f < frames; f++) {
  const jpg = await shot(f / FPS);
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 150 === 0) console.log(`frame ${f}/${frames} (${((Date.now() - began) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
b.close();

// 3. Voice under picture.
const out = join(OUT, "pause-ai-launch.mp4");
mux(silent, clips, total, out);
console.log(`done: ${out} (${total.toFixed(1)}s)`);
