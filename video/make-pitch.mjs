// Builds the pitch video: video/out/pause-pitch.mp4 (about 2 minutes, 1080p).
// 1. Records the live website: a venue search with photos, then two languages.
// 2. Cuts and crops the Telegram screen recording (private chats removed).
// 3. Assembles scenes with titles, captions and a voice-over.
// Usage: node video/make-pitch.mjs [base url]
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browser, duration, FFMPEG, HERE, mux, OUT, sleep, speak } from "./lib.mjs";

const BASE = process.argv[2] || "https://pauseai-near.vercel.app";
const VOICE = "en-GB-RyanNeural";
const CLIPS = join(HERE, "clips");
const W = join(OUT, "_pitch");
mkdirSync(W, { recursive: true });
const ff = (args) => {
  const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { cwd: W, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr?.slice(-800));
};
const BOLD = "C\\:/Windows/Fonts/segoeuib.ttf";
const REG = "C\\:/Windows/Fonts/segoeui.ttf";
const SERIF = "C\\:/Windows/Fonts/georgiai.ttf";
const NIGHT = "0x0e091c";
copyFileSync(join(HERE, "..", "web", "public", "img", "logo-mark.png"), join(W, "logo.png"));

// ---------------------------------------------------------------- narration
const SCENES = [
  { id: "problem", say: "Every reunion, wedding, trip and savings circle runs on a group chat. And on one tired person chasing payments, while everyone hopes the money doesn't disappear." },
  { id: "market", say: "Onchain communities already plan events in Telegram every day. Groups move real money there, with no treasurer they can trust. That's the next big market." },
  { id: "intro", say: "Meet Pause: the AI agent that plans, secures and pays for your group, on NEAR." },
  { id: "telegram", say: "Here it is in a real Telegram group. Ask it to plan the reunion, and it answers with venue ideas and budgets. Ask for a savings pot, and it sets one up. It's always on." },
  { id: "search", say: "Ask it to scout a venue, and it searches the web live: real places, Google ratings, a budget, and photos." },
  { id: "languages", say: "And it speaks your group's language. French, Yoruba, whatever you write in." },
  { id: "pot", say: "Members approve each vendor. Pause pays in seconds and posts the receipt. Slip in a reported scammer, and the contract refuses to pay. On NEAR, Pause's key can only pay what members approved." },
  { id: "close", say: "Plan in Telegram or on the web. Pause: the AI agent that plans, secures and pays for you." },
];
for (const s of SCENES) {
  s.audio = speak(s.say, VOICE);
  s.len = duration(s.audio) + 0.5;
}

/** Wraps a caption to about 62 characters a line. */
function wrap(text, max = 62) {
  const out = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max) {
      out.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) out.push(line.trim());
  return out.join("\n");
}
let n = 0;
/** drawtext from a text file, so quotes and colons need no escaping. */
const text = (s, { font = BOLD, size = 44, color = "white", x = "(w-text_w)/2", y = "h-text_h-60", box = false, from = 0, spacing = 12 } = {}) => {
  const f = `t${n++}.txt`;
  writeFileSync(join(W, f), s, "utf8");
  return `drawtext=fontfile='${font}':textfile=${f}:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}:line_spacing=${spacing}${box ? ":box=1:boxcolor=0x0e091c@0.82:boxborderw=22" : ""}${from ? `:enable='gte(t,${from})'` : ""}`;
};
const caption = (s) => text(wrap(s.say), { font: REG, size: 34, box: true, y: "h-text_h-56" });

// ------------------------------------------------------- 1. record the web
const webFile = join(W, "web.mp4");
let marks = {};
if (!existsSync(webFile) || process.argv.includes("--rerecord")) {
  const FR = join(W, "_wframes");
  mkdirSync(FR, { recursive: true });
  for (const f of readdirSync(FR)) unlinkSync(join(FR, f));
  const b = await browser({ port: 9431 });
  let cutOffset = 0, recording = false, t0 = 0;
  const frames = [];
  b.on("Page.screencastFrame", (p) => {
    b.send("Page.screencastFrameAck", { sessionId: p.sessionId });
    if (!recording) return;
    const file = join(FR, `${String(frames.length).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(p.data, "base64"));
    frames.push({ file, at: p.metadata.timestamp - cutOffset });
  });
  const now = () => Date.now() / 1000 - t0 - cutOffset;
  const cut = async (fn) => {
    recording = false;
    const a = Date.now() / 1000;
    await fn();
    cutOffset += Date.now() / 1000 - a;
    recording = true;
  };
  const waitFor = async (expr, ms = 90000) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (await b.js(expr)) return;
      await sleep(400);
    }
    throw new Error(`timed out: ${expr.slice(0, 80)}`);
  };
  await b.send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await b.js(`(() => {
    document.documentElement.style.zoom = "1.45";
    const s = document.createElement("style");
    s.textContent = ".chat-panel{left:50%!important;right:auto!important;transform:translateX(-50%);bottom:110px!important;width:min(620px,92vw)!important;height:calc(100vh - 150px)!important;animation:none!important}#dim{position:fixed;inset:0;background:rgba(14,9,28,.72);z-index:79}nextjs-portal{display:none}.chat-photos img{aspect-ratio:16/10}";
    document.head.appendChild(s);
    const d = document.createElement("div"); d.id = "dim"; document.body.appendChild(d);
    window.sessionStorage.removeItem("pause-chat");
  })()`);
  await b.js(`document.querySelector('.chat-fab').click()`);
  await sleep(800);
  await b.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });
  recording = true;
  t0 = Date.now() / 1000;
  const replies = `[...document.querySelectorAll('.chat-list .fmsg.bot')].filter((m) => !m.querySelector('.typing')).length`;
  const ask = async (q) => {
    const count = await b.js(replies);
    await b.js(`(() => { const i = document.querySelector('.chat-form input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(q)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await sleep(1400);
    await b.js(`document.querySelector('.chat-form button').click()`);
    await sleep(1200);
    await cut(() => waitFor(`${replies} > ${count} && !document.querySelector('.fbubble.typing')`, 120000));
    await sleep(600);
    // Scroll through the answer slowly, from its top.
    await b.js(`(() => { const l = document.querySelector('.chat-list'); const m = [...l.querySelectorAll('.fmsg.bot')].pop(); l.scrollTo({ top: m.offsetTop - 80, behavior: "smooth" }); })()`);
    await sleep(2600);
    for (let i = 0; i < 4; i++) {
      await b.js(`document.querySelector('.chat-list').scrollBy({ top: 260, behavior: "smooth" })`);
      await sleep(1700);
    }
  };
  marks.searchStart = now();
  await ask("Find an event venue in Lekki, Lagos for a 60-guest class reunion, with ratings and prices");
  marks.searchEnd = now();
  marks.langStart = now();
  await ask("Aide-moi à planifier un anniversaire pour 20 amis à Abidjan, avec un budget.");
  await ask("Ṣé o lè ràn wá lọ́wọ́ láti ṣètò àpèjẹ ọjọ́ìbí ní Ìbàdàn?");
  marks.langEnd = now();
  recording = false;
  const end = now();
  await b.send("Page.stopScreencast");
  b.close();
  const first = frames[0].at;
  const list = frames.map((f, i) => `file '${f.file.replace(/\\/g, "/")}'\nduration ${Math.max(0.001, (i + 1 < frames.length ? frames[i + 1].at : first + end) - f.at).toFixed(4)}`);
  list.push(`file '${frames[frames.length - 1].file.replace(/\\/g, "/")}'`);
  writeFileSync(join(W, "_wframes.txt"), list.join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", "_wframes.txt", "-vf", "fps=30,scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "web.mp4"]);
  const shift = 0; // marks are already on the film clock
  marks = { ...marks, shift };
  writeFileSync(join(W, "marks.json"), JSON.stringify(marks));
  console.log("web recorded", JSON.stringify(marks));
} else {
  marks = JSON.parse((await import("node:fs")).readFileSync(join(W, "marks.json"), "utf8"));
}

// ------------------------------------------------------------- 2. scenes
const scene = (id) => SCENES.find((s) => s.id === id);
const enc = ["-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-an"];
const fit = (src, a, b, D) => `[0:v]trim=${a}:${b},setpts=(PTS-STARTPTS)*${(D / (b - a)).toFixed(4)}`;

// Problem and market: the friends clip, darkened, with the words on it.
const friends = readdirSync(CLIPS).find((f) => /friend|dinner|planning/i.test(f));
{
  const s = scene("problem");
  ff(["-stream_loop", "-1", "-i", join(CLIPS, friends), "-t", s.len.toFixed(2), "-vf", [
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=14,eq=brightness=-0.26:saturation=0.85",
    text("Every reunion, wedding, trip and ajo", { size: 68, y: "170" }),
    text("runs on a group chat.", { size: 68, y: "255" }),
    text("And on one tired person chasing payments.", { font: SERIF, size: 48, color: "0xddd7fe", y: "365", from: 4.2 }),
    caption(s),
  ].join(","), ...enc, "s_problem.mp4"]);
}
{
  const s = scene("market");
  ff(["-stream_loop", "-1", "-ss", "8", "-i", join(CLIPS, friends), "-t", s.len.toFixed(2), "-vf", [
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=18,eq=brightness=-0.38:saturation=0.6",
    text("Onchain communities plan events", { size: 70, y: "170" }),
    text("in Telegram every day.", { size: 70, y: "255" }),
    text("No treasurer they can trust. That's the next big market.", { font: SERIF, size: 46, color: "0xddd7fe", y: "365", from: 4.5 }),
    caption(s),
  ].join(","), ...enc, "s_market.mp4"]);
}
// Intro card with the logo.
{
  const s = scene("intro");
  ff(["-f", "lavfi", "-i", `color=c=${NIGHT}:s=1920x1080:d=${s.len.toFixed(2)}`, "-i", "logo.png", "-filter_complex", [
    "[1:v]scale=200:200[l]",
    `[0:v][l]overlay=(W-w)/2:250[b]`,
    `[b]${text("Pause", { size: 110, y: "490" })},${text("The AI agent that plans, secures and pays for your group.", { font: SERIF, size: 48, color: "0xddd7fe", y: "640" })},${text("Built on NEAR", { font: REG, size: 32, color: "0xa7a1bd", y: "730" })}`,
  ].join(";"), "-t", s.len.toFixed(2), ...enc, "s_intro.mp4"]);
}
// Telegram: three safe stretches of the screen recording, private chats cut out,
// status bar cropped off, sped up to fit, on a branded frame.
{
  const s = scene("telegram");
  const tg = readdirSync(CLIPS).find((f) => /telegram/i.test(f));
  const parts = [[97, 134], [149, 162], [174, 251]];
  const total = parts.reduce((a, [x, y]) => a + (y - x), 0);
  const k = (s.len / total).toFixed(4);
  ff(["-i", join(CLIPS, tg), "-f", "lavfi", "-i", `color=c=${NIGHT}:s=1920x1080:d=${s.len.toFixed(2)}`, "-filter_complex", [
    ...parts.map(([x, y], i) => `[0:v]trim=${x}:${y},setpts=PTS-STARTPTS[p${i}]`),
    `${parts.map((_, i) => `[p${i}]`).join("")}concat=n=${parts.length}:v=1:a=0,setpts=PTS*${k},crop=1242:1430:0:115,scale=-2:940,fps=30[tg]`,
    `[1:v][tg]overlay=W-w-170:(H-h)/2:shortest=1[b]`,
    `[b]${text("A real Telegram group", { size: 60, x: "150", y: "300" })},${text("Plans the reunion.", { font: REG, size: 40, color: "0xddd7fe", x: "150", y: "400" })},${text("Sets up a savings pot.", { font: REG, size: 40, color: "0xddd7fe", x: "150", y: "460", from: s.len * 0.55 })},${text("Always on.", { font: REG, size: 40, color: "0xddd7fe", x: "150", y: "520", from: s.len * 0.75 })},${text(wrap(s.say, 44), { font: REG, size: 30, box: true, x: "150", y: "680" })}`,
  ].join(";"), "-t", s.len.toFixed(2), ...enc, "s_telegram.mp4"]);
}
// Web search and languages, from the recording.
for (const [id, a, b] of [["search", marks.searchStart, marks.searchEnd], ["languages", marks.langStart, marks.langEnd]]) {
  const s = scene(id);
  ff(["-i", "web.mp4", "-filter_complex", `${fit("web.mp4", a, b, s.len)},fps=30,${caption(s)}`, "-t", s.len.toFixed(2), ...enc, `s_${id}.mp4`]);
}
// The pot paying the hall and refusing the scammer, from the groups demo.
{
  const s = scene("pot");
  const demo = join(OUT, "pause-groups-demo.mp4");
  ff(["-i", demo, "-filter_complex", `${fit(demo, 52, 98, s.len)},fps=30,${caption(s)}`, "-t", s.len.toFixed(2), ...enc, "s_pot.mp4"]);
}
// Close card.
{
  const s = scene("close");
  ff(["-f", "lavfi", "-i", `color=c=${NIGHT}:s=1920x1080:d=${s.len.toFixed(2)}`, "-i", "logo.png", "-filter_complex", [
    "[1:v]scale=150:150[l]",
    `[0:v][l]overlay=(W-w)/2:230[b]`,
    `[b]${text("Plan in Telegram or on the web.", { size: 70, y: "430" })},${text("pauseai-near.vercel.app", { font: REG, size: 50, color: "0xddd7fe", y: "560" })},${text("@Pausenearai_bot on Telegram", { font: REG, size: 40, color: "0xa7a1bd", y: "640" })},${text("Built at NEAR HACKATHON on NEAR and NEAR AI Cloud", { font: REG, size: 30, color: "0xa7a1bd", y: "760" })}`,
  ].join(";"), "-t", s.len.toFixed(2), ...enc, "s_close.mp4"]);
}

// ----------------------------------------------------------- 3. assemble
writeFileSync(join(W, "scenes.txt"), SCENES.map((s) => `file 's_${s.id}.mp4'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", "scenes.txt", "-c", "copy", "picture.mp4"]);
let at = 0;
const clips = SCENES.map((s) => {
  const c = { file: s.audio, start: at + 0.15 };
  at += s.len;
  return c;
});
const out = join(OUT, "pause-pitch.mp4");
mux(join(W, "picture.mp4"), clips, at, out);
console.log(`done: ${out} (${at.toFixed(1)}s)`);
