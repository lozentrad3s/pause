// Records the Pause Groups pitch and demo: video/out/pause-groups-demo.mp4
// Every step on screen is the real product and a real NEAR testnet transaction.
// The two-minute hold window is cut out of the picture (narration says so).
// Usage: node video/make-groups.mjs [base url]   (default: the live site)
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browser, duration, FFMPEG, mux, OUT, sleep, speak } from "./lib.mjs";

const BASE = process.argv[2] || "https://pauseai-near.vercel.app";
const VOICE = "en-GB-RyanNeural";
const FRAMES = join(OUT, "_gframes");
mkdirSync(FRAMES, { recursive: true });
for (const f of readdirSync(FRAMES)) unlinkSync(join(FRAMES, f));

const b = await browser({ port: 9411 });
let cutOffset = 0; // seconds of wall time removed from the film so far
let recording = false;
const frames = [];
b.on("Page.screencastFrame", (p) => {
  b.send("Page.screencastFrameAck", { sessionId: p.sessionId });
  if (!recording) return;
  const file = join(FRAMES, `${String(frames.length).padStart(6, "0")}.jpg`);
  writeFileSync(file, Buffer.from(p.data, "base64"));
  frames.push({ file, at: p.metadata.timestamp - cutOffset });
});

const prep = () => b.js(`(() => {
  document.documentElement.style.zoom = "1.25";
  if (document.getElementById("cap")) return;
  const s = document.createElement("style");
  s.textContent = "#cap{position:fixed;left:0;right:0;bottom:22px;display:flex;justify-content:center;z-index:99999;pointer-events:none}#cap span{max-width:1150px;padding:10px 20px;border-radius:14px;background:rgba(11,10,31,.9);color:#fff;font:500 22px/1.3 Inter,system-ui,sans-serif;text-align:center}#cap span:empty{display:none}#tap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:4px solid #6a45ff;background:rgba(106,69,255,.22);z-index:99998;pointer-events:none;opacity:0;transition:opacity .25s ease, transform .35s ease;transform:scale(1.5)}#tap.on{opacity:1;transform:scale(1)}nextjs-portal{display:none}";
  document.head.appendChild(s);
  const c = document.createElement("div"); c.id = "cap"; c.innerHTML = "<span></span>"; document.body.appendChild(c);
  const t = document.createElement("div"); t.id = "tap"; document.body.appendChild(t);
})()`);
const go = async (path) => {
  await b.send("Page.navigate", { url: BASE + path });
  await sleep(1500);
  await prep();
};
const waitFor = async (expr, ms = 120000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await b.js(expr);
    if (v) return v;
    await sleep(400);
  }
  throw new Error(`timed out waiting for ${expr.slice(0, 90)}`);
};
const pointAndClick = async (elExpr) => {
  await waitFor(`!!(${elExpr})`);
  await b.js(`(${elExpr}).scrollIntoView({ block: "nearest", behavior: "smooth" })`);
  await sleep(500);
  await b.js(`(() => { const r = (${elExpr}).getBoundingClientRect(); const t = document.getElementById("tap"); t.style.left = (r.left + r.width / 2) + "px"; t.style.top = (r.top + r.height / 2) + "px"; t.classList.add("on"); })()`);
  await sleep(550);
  await b.js(`(${elExpr}).click(); document.getElementById("tap").classList.remove("on")`);
};
const btn = (text, scope = "document") => `[...${scope}.querySelectorAll("button")].find(x => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled)`;
const tap = (text) => pointAndClick(btn(text));
const lineCard = (label) => `[...document.querySelectorAll(".line")].find(l => l.textContent.includes(${JSON.stringify(label)}))`;
const scrollTo = (sel, block = "start") => b.js(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: ${JSON.stringify(block)}, behavior: "smooth" })`);
const typeInto = (sel, text) => b.js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);

let t0 = 0;
const clips = [];
const now = () => Date.now() / 1000 - t0 - cutOffset;
const say = async (text) => {
  const file = speak(text, VOICE);
  const len = duration(file);
  clips.push({ file, start: now() });
  await b.js(`document.querySelector("#cap span") && (document.querySelector("#cap span").textContent = ${JSON.stringify(text)})`);
  await sleep(len * 1000 + 300);
  await b.js(`document.querySelector("#cap span") && (document.querySelector("#cap span").textContent = "")`);
};
/** Removes a stretch of waiting from the film. */
const cut = async (fn) => {
  recording = false;
  const a = Date.now() / 1000;
  await fn();
  cutOffset += Date.now() / 1000 - a;
  recording = true;
};

// Voice every line first, so the take never stalls on speech.
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  for (const m of readFileSync(fileURLToPath(import.meta.url), "utf8").matchAll(/say\("([^"]+)"\)/g)) speak(m[1], VOICE);
}

// ------------------------------------------------------------------ the take
await go("/");
await b.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1 });
recording = true;
t0 = Date.now() / 1000;
await sleep(1200);
await say("Every group that raises money has one tired person chasing payments, and one fear: what if the money disappears?");
await say("Pause is the AI agent that plans, secures and pays for your group, on NEAR.");

await go("/groups");
await say("This is live, with real NEAR testnet transactions. One tap makes me the organiser of a class reunion.");
await tap("Start the reunion pot");
await cut(() => waitFor(`location.pathname.startsWith("/groups/") && !!document.querySelector(".room-head")`, 150000));
await sleep(2500);
await prep();
await say("Two classmates have paid. Pause privately reminds the rest.");
await tap("Remind the others");
await cut(() => waitFor(`!document.querySelector(".pot-summary") || document.querySelectorAll(".members li.paid").length >= 5`, 120000));
await sleep(1500);

await say("I give Pause the plan in plain words. On NEAR AI Cloud's private models, it lists each vendor for a vote. It can propose, never approve.");
await tap("Use the reunion plan");
await sleep(600);
await tap("Plan");
await cut(() => waitFor(`document.querySelectorAll(".line").length >= 3`, 120000));
await sleep(2000);

await say("I approve the hall. Two classmates agree, and a two minute window opens for anyone to object.");
await pointAndClick(`[...(${lineCard("hall")}).querySelectorAll("button")].find(x => x.textContent.trim() === "Approve")`);
await cut(() => waitFor(`(${lineCard("hall")})?.classList.contains("ls-Approved")`, 120000));
await sleep(1500);

await say("Someone slips in a cheaper drinks vendor. Pause flags it: other users reported this account as a scam.");
await tap("Add the drinks plug");
await cut(() => waitFor(`!!(${lineCard("Cheap drinks")})`, 90000));
await sleep(1500);
await pointAndClick(`[...(${lineCard("Cheap drinks")}).querySelectorAll("button")].find(x => x.textContent.trim() === "Approve")`);
await cut(() => waitFor(`(${lineCard("Cheap drinks")})?.classList.contains("ls-Approved")`, 120000));
await sleep(1200);

await cut(() => waitFor(`(${lineCard("hall")})?.classList.contains("ls-Paid") && (${lineCard("Cheap drinks")})?.classList.contains("ls-Rejected")`, 400000));
await scrollTo(".feed-card", "start");
await sleep(1500);
await say("Two minutes later, Pause pays the hall, with the receipt on NEAR.");
await tap("Vendor confirms");
await cut(() => waitFor(`(${lineCard("hall")})?.textContent.includes("Received")`, 90000));
await say("The hall confirms. The drinks vendor was approved, but the contract refused to pay a reported scammer.");
await scrollTo(".lines-card", "start");
await sleep(1800);

await say("And anyone can ask Pause about the pot.");
await typeInto('input[aria-label="Ask"]', "Who has paid, and how much is left?");
await tap("Ask");
await waitFor(`[...document.querySelectorAll(".fmsg.bot .fbubble")].slice(-1)[0]?.textContent.length > 40 && !document.querySelector(".fbubble.typing")`, 60000);
await scrollTo(".feed-card", "start");
await sleep(3000);

await say("It answers in your language too. Here's the same question in French.");
await typeInto('input[aria-label="Ask"]', "Qui a payé, et combien reste-t-il dans la cagnotte ?");
await tap("Ask");
await cut(() => waitFor(`[...document.querySelectorAll(".fmsg.bot .fbubble")].slice(-1)[0]?.textContent.length > 40 && !document.querySelector(".fbubble.typing")`, 60000));
await scrollTo(".feed-card", "start");
await sleep(3500);

await say("NEAR enforces the rules: Pause's own key can only propose, and pay what members approved.");
await go("/");
await sleep(800);
await say("Try it live, or add Pause to your Telegram group.");
await sleep(1200);
recording = false;
const end = now();
await b.send("Page.stopScreencast");
b.close();

// ---------------------------------------------------------------- assemble
const first = frames[0].at;
const list = frames.map((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].at : first + end;
  return `file '${f.file.replace(/\\/g, "/")}'\nduration ${Math.max(0.001, next - f.at).toFixed(4)}`;
});
list.push(`file '${frames[frames.length - 1].file.replace(/\\/g, "/")}'`);
const listFile = join(OUT, "_gframes.txt");
writeFileSync(listFile, list.join("\n"), "utf8");
const silent = join(OUT, "_groups-picture.mp4");
const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", "fps=30,scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", silent], { encoding: "utf8" });
if (r.status !== 0) throw new Error(r.stderr?.slice(-600));
const shift = t0 - first;
const out = join(OUT, "pause-groups-demo.mp4");
mux(silent, clips.map((c) => ({ file: c.file, start: Math.max(0, c.start + shift) })), end, out);
console.log(`done: ${out} (${end.toFixed(1)}s, ${frames.length} frames)`);
