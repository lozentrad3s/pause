// Records the real product: video/out/pause-ai-demo.mp4
// The site must be running with its keys (npm run dev or next start), and the
// guest sponsor must have funds. Every transaction on screen is a real one on
// NEAR testnet. Usage: node video/make-demo.mjs [base url]
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browser, duration, FFMPEG, mux, OUT, sleep, speak } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:3000";
const VOICE = "en-GB-SoniaNeural";
const FRAMES = join(OUT, "_frames");
mkdirSync(FRAMES, { recursive: true });
for (const f of readdirSync(FRAMES)) unlinkSync(join(FRAMES, f));

const b = await browser({ port: 9401 });
const frames = [];
b.on("Page.screencastFrame", (p) => {
  const file = join(FRAMES, `${String(frames.length).padStart(6, "0")}.jpg`);
  writeFileSync(file, Buffer.from(p.data, "base64"));
  frames.push({ file, at: p.metadata.timestamp });
  b.send("Page.screencastFrameAck", { sessionId: p.sessionId });
});

// Makes the page readable at 1080p and adds the caption bar and click marker.
const prep = () => b.js(`(() => {
  document.documentElement.style.zoom = "1.3";
  if (document.getElementById("cap")) return;
  const s = document.createElement("style");
  s.textContent = "#cap{position:fixed;left:0;right:0;bottom:22px;display:flex;justify-content:center;z-index:99999;pointer-events:none}#cap span{max-width:1150px;padding:10px 20px;border-radius:14px;background:rgba(11,10,31,.9);color:#fff;font:500 22px/1.3 Inter,system-ui,sans-serif;text-align:center}#cap span:empty{display:none}#tap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:4px solid #e8930c;background:rgba(232,147,12,.25);z-index:99998;pointer-events:none;opacity:0;transition:opacity .25s ease, transform .35s ease;transform:scale(1.5)}#tap.on{opacity:1;transform:scale(1)}nextjs-portal{display:none}";
  document.head.appendChild(s);
  const c = document.createElement("div"); c.id = "cap"; c.innerHTML = "<span></span>"; document.body.appendChild(c);
  const t = document.createElement("div"); t.id = "tap"; document.body.appendChild(t);
})()`);
const go = async (path) => {
  await b.send("Page.navigate", { url: BASE + path });
  await sleep(1800);
  await prep();
};
const waitFor = async (expr, ms = 90000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await b.js(expr);
    if (v) return v;
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${expr.slice(0, 80)}`);
};
const find = (text, sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.includes(${JSON.stringify(text)}) && !x.disabled)`;
/** Scrolls to a control, shows the tap marker on it, and clicks it. */
const tap = async (text, sel = "button") => {
  await waitFor(`!!(${find(text, sel)})`);
  await b.js(`(${find(text, sel)}).scrollIntoView({ block: "center", behavior: "smooth" })`);
  await sleep(700);
  await b.js(`(() => { const r = (${find(text, sel)}).getBoundingClientRect(); const t = document.getElementById("tap"); t.style.left = (r.left + r.width / 2) + "px"; t.style.top = (r.top + r.height / 2) + "px"; t.classList.add("on"); })()`);
  await sleep(550);
  await b.js(`(${find(text, sel)}).click(); document.getElementById("tap").classList.remove("on")`);
};
const show = (sel) => b.js(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center", behavior: "smooth" })`);

// Narration: each line is spoken, captioned, and logged with its start time.
let t0 = 0;
const clips = [];
const now = () => Date.now() / 1000 - t0;
const say = async (text, voice = VOICE, caption = text) => {
  const file = speak(text, voice);
  const len = duration(file);
  clips.push({ file, start: now() });
  await b.js(`document.querySelector("#cap span").textContent = ${JSON.stringify(caption)}`);
  const done = sleep(len * 1000 + 350);
  return done.then(() => b.js(`document.querySelector("#cap span") && (document.querySelector("#cap span").textContent = "")`));
};
const firstSentences = (text, max = 150) => {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const p of parts) {
    if (out && (out + p).length > max) break;
    out += p;
  }
  return out.trim();
};
/** Sets the header language switch the way a person would. */
const setLang = (id) => b.js(`(() => { const s = document.querySelector(".lang-pick select"); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, ${JSON.stringify(id)}); s.dispatchEvent(new Event("change", { bubbles: true })); })()`);

// Voice the fixed lines before the camera rolls, so making a clip never stalls the take.
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
  for (const m of src.matchAll(/say\("([^"]+)"/g)) speak(m[1], VOICE);
  speak("A fake bank call, answered in French.", VOICE);
  speak("A new number text, answered in Spanish.", VOICE);
}

// ------------------------------------------------------------------ the take
await go("/");
await b.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1 });
t0 = Date.now() / 1000;
await sleep(400);
await say("This is Pause AI, live on NEAR testnet. Every step you are about to see is a real transaction.");

await go("/demo");
let line = say("One button makes two real accounts: Grace, and her son, who is her guardian.");
await sleep(1500);
await tap("Try as a judge");
await line;
line = say("The keys are made in this browser. The server never sees them.");
await waitFor(`!!document.querySelector(".dphones")`, 120000);
await line;

line = say("First, Grace pays her usual shop. It goes straight through.");
await tap("Pay your usual shop", ".dpay");
await waitFor(`[...document.querySelectorAll(".dlog li")].some(l => l.textContent.includes("paid at once"))`);
await line;

line = say("Now the scam. Grace clicks a fake airdrop link, and a wallet drainer signs a payment with her key.");
await tap("A payment Grace never made", ".dpay");
await waitFor(`!!document.querySelector(".dhold")`);
await show(".dhold");
await line;
await say("Pause holds it. Nothing has left her vault.");

line = say("Then it asks six questions. Grace says she never made this payment.");
await tap("Answer Pause");
for (let q = 0; q < 6; q++) {
  await waitFor(`document.querySelectorAll(".quick .chip").length >= 3`, 20000);
  await sleep(650);
  await b.js(`document.querySelectorAll(".quick .chip")[2].click()`);
}
await line;
await waitFor(`!!document.querySelector(".dverdict-level")`, 120000);
await show(".dverdict");
line = say("A private model, inside a sealed enclave on NEAR AI Cloud, rates it High risk. The verdict is written on chain by a key that can do nothing else.");
await sleep(5200);
await tap("Show proof", ".proof-head");
await sleep(600);
await show(".proof");
await line;
await say("This is the proof the AI ran privately: the enclave's signature, checked on this page.");

line = say("On his phone, her son stops it with one tap.");
await tap("Stop it");
await waitFor(`[...document.querySelectorAll(".dlog li")].some(l => /stopped the payment/i.test(l.textContent))`);
await line;
await show(".dlog");
await say("The money never left. Every step links to its transaction.");

await go("/call");
await say("And for people who would rather talk, Call Pause answers out loud, in their language.");
for (const [lang, voice, chip, intro] of [
  ["fr", "fr-FR-DeniseNeural", "Bank fraud team", "A fake bank call, answered in French."],
  ["es", "es-ES-ElviraNeural", "Hi Mum, new number", "A new number text, answered in Spanish."],
]) {
  await setLang(lang);
  line = say(intro);
  await tap(chip, ".examples .chip");
  await waitFor(`!!document.querySelector(".call-summary")`, 90000);
  await show(".call-card");
  await line;
  const spoken = firstSentences(await b.js(`document.querySelector(".call-summary").textContent`));
  await say(spoken, voice);
  await b.js(`document.querySelector(".call-answer .btn.primary")?.click()`);
  await sleep(500);
}
await setLang("en");
await go("/");
await say("Pause AI. Built on NEAR. The code, and a one command test run, are on GitHub.", VOICE, "Pause AI · github.com/lozentrad3s/pause");
await sleep(600);
const end = now();
await b.send("Page.stopScreencast");

// Off camera: give the vault balance back to the sponsor and close the accounts.
try {
  await go("/demo");
  await tap("Start over", ".linkbtn");
  await waitFor(`!!document.querySelector(".demo-intro")`, 150000);
  console.log("guest accounts closed");
} catch (e) {
  console.log("could not close the guest accounts:", e.message);
}
b.close();

// ---------------------------------------------------------------- assemble
const first = frames[0].at;
const list = frames.map((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].at : first + end;
  return `file '${f.file.replace(/\\/g, "/")}'\nduration ${Math.max(0.001, next - f.at).toFixed(4)}`;
});
list.push(`file '${frames[frames.length - 1].file.replace(/\\/g, "/")}'`);
const listFile = join(OUT, "_frames.txt");
writeFileSync(listFile, list.join("\n"), "utf8");
const silent = join(OUT, "_demo-picture.mp4");
const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", "fps=30,scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", silent], { encoding: "utf8" });
if (r.status !== 0) throw new Error(r.stderr?.slice(-600));
// Clip times were measured from the wall clock; shift them onto the first frame.
const shift = t0 - first;
const out = join(OUT, "pause-ai-demo.mp4");
mux(silent, clips.map((c) => ({ file: c.file, start: Math.max(0, c.start + shift) })), end, out);
console.log(`done: ${out} (${end.toFixed(1)}s, ${frames.length} frames)`);
