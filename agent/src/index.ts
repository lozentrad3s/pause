// Pause agent: a Telegram bot that checks chats for scams, interviews owners
// about held payments, and records its verdict on NEAR with a scoped key.
import "./env";
import { createHash } from "node:crypto";
import { Bot, type Context } from "grammy";
import { analyzeChat, STAGES, type Analysis } from "../../web/lib/analyzer";
import { QUESTIONS } from "../../web/lib/scenarios";
import { CONTRACT, getHolds, getVault, setRisk, yoctoToNear, type Hold } from "./near";
import { store } from "./store";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
const WEB = process.env.PAUSE_WEB_URL || "http://localhost:3000";
const AI = { apiKey: process.env.NEARAI_API_KEY, model: process.env.NEARAI_MODEL };

const bot = new Bot(TOKEN);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const send = (chatId: number, html: string) =>
  bot.api.sendMessage(chatId, html, { parse_mode: "HTML", link_preview_options: { is_disabled: true } }).catch((e) => console.error("send", e.message));

// ------------------------------------------------------------- chat checks

// Forwarded messages arrive one by one, so collect them for a moment first.
const buffers = new Map<number, { lines: string[]; timer?: NodeJS.Timeout }>();

function addToBuffer(ctx: Context, line: string) {
  const id = ctx.chat!.id;
  const b = buffers.get(id) ?? { lines: [] };
  b.lines.push(line);
  clearTimeout(b.timer);
  b.timer = setTimeout(() => runCheck(id), 3000);
  buffers.set(id, b);
}

async function runCheck(chatId: number, raw?: string) {
  const b = buffers.get(chatId);
  const text = raw ?? b?.lines.join("\n") ?? "";
  buffers.delete(chatId);
  if (text.trim().length < 10) return send(chatId, "Forward me a few messages from the chat, or paste it here.");
  await bot.api.sendChatAction(chatId, "typing").catch(() => {});
  const result = await analyzeChat(text, { ...AI, platform: "forwarded to Telegram" });
  await send(chatId, report(result));
  if (result.verdict.level === "High" || result.verdict.level === "Medium") {
    for (const a of result.rules.addresses) {
      store.flag(a, { level: result.verdict.level, scamType: result.verdict.scam_type, summary: result.verdict.summary, chatId, at: Date.now() });
    }
  }
}

function report(r: Analysis): string {
  const v = r.verdict;
  const icon = v.level === "High" ? "🛑" : v.level === "Medium" ? "⚠️" : "✅";
  const stage = STAGES.findIndex((s) => s.id === v.stage);
  const bar = STAGES.map((s, i) => (i <= stage && v.level !== "Safe" ? "●" : "○")).join(" ");
  const out = [
    `${icon} <b>${v.level === "Safe" ? "No scam signs" : `${v.level} risk`}</b> · ${v.score}/100`,
    "",
    esc(v.summary),
  ];
  if (v.level !== "Safe") out.push("", `<b>Stage:</b> ${bar}  ${esc(STAGES[stage]?.label ?? "")}`);
  if (v.red_flags.length) {
    out.push("", "<b>What I found</b>");
    for (const f of v.red_flags.slice(0, 4)) out.push(`• <i>“${esc(f.quote.slice(0, 120))}”</i>\n  ${esc(f.why)}`);
  }
  if (v.advice.length) {
    out.push("", "<b>What to do</b>");
    for (const a of v.advice) out.push(`• ${esc(a)}`);
  }
  if (r.rules.addresses.length && v.level !== "Safe") {
    out.push("", `⏸ I'll watch for payments to <code>${esc(r.rules.addresses.join(", "))}</code>. If one is sent from your Pause wallet it will be held and your guardians told.`);
  }
  out.push("", `<i>${r.source === "ai" ? "Checked privately on NEAR AI Cloud." : "Checked with fixed rules."} Nothing is stored. I can be wrong: when in doubt, talk to someone you trust.</i>`);
  return out.join("\n");
}

// ------------------------------------------------------------- interviews

interface Interview {
  hold: Hold;
  q: number;
  answers: string[];
  points: number;
  reasons: string[];
  resolve: () => void;
}
const interviews = new Map<number, Interview>();

// ---------------------------------------------------------------- commands

bot.command("start", (ctx) =>
  ctx.reply(
    [
      "👋 <b>I'm Pause.</b> I help you spot romance and crypto scams before you send money.",
      "",
      "<b>Check a chat:</b> forward me messages from the person you're unsure about, paste the chat, or send a WhatsApp export (.txt).",
      "",
      "<b>Protect your wallet:</b> /link your-account.testnet. I'll ask a few questions when a payment is held, and tell your guardians if it looks like a scam.",
      "",
      "/check — check what you've sent so far\n/new — start a fresh check\n/link — connect your NEAR account",
    ].join("\n"),
    { parse_mode: "HTML" },
  ),
);

bot.command("link", async (ctx) => {
  const account = ctx.match.trim().toLowerCase();
  if (!/^[a-z0-9_.-]+\.(testnet|near)$/.test(account)) return ctx.reply("Send it like this: /link amina.pause-demo.testnet");
  store.link(ctx.chat.id, account);
  const vault = await getVault(account).catch(() => null);
  const isGuardianSomewhere = !vault;
  await ctx.reply(
    vault
      ? `✅ Linked to ${account}. I'll message you here when a payment from your vault is held.`
      : `✅ Linked to ${account}. ${isGuardianSomewhere ? "If you're someone's guardian, I'll alert you here when their payment looks risky." : ""}`,
  );
});

bot.command("new", (ctx) => {
  buffers.delete(ctx.chat.id);
  return ctx.reply("Fresh start. Forward or paste the chat you want me to check.");
});

bot.command("check", (ctx) => runCheck(ctx.chat.id));

// WhatsApp "Export chat" produces a .txt file.
bot.on("message:document", async (ctx) => {
  const doc = ctx.message.document;
  if (!doc.file_name?.endsWith(".txt") || (doc.file_size ?? 0) > 2_000_000) return ctx.reply("Send the chat export as a .txt file (Export chat → Without media).");
  const file = await ctx.getFile();
  const res = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`);
  await runCheck(ctx.chat.id, await res.text());
});

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  const iv = interviews.get(chatId);
  if (iv) return answer(chatId, iv, text);

  const origin = ctx.message.forward_origin;
  if (origin) {
    const who =
      origin.type === "user" ? origin.sender_user.first_name
      : origin.type === "hidden_user" ? origin.sender_user_name
      : origin.type === "chat" ? origin.sender_chat.title ?? "Them"
      : origin.chat.title ?? "Them";
    return addToBuffer(ctx, `${who}: ${text}`);
  }
  // A pasted chat (several lines) is checked straight away.
  if (text.split("\n").length >= 3) return runCheck(chatId, text);
  addToBuffer(ctx, text.includes(":") ? text : `Them: ${text}`);
});

// ------------------------------------------------------------ hold watcher

async function interview(chatId: number, hold: Hold, points: number, reasons: string[]) {
  await send(
    chatId,
    `⏸ <b>Your payment of ${yoctoToNear(hold.amount)} NEAR to ${esc(hold.receiver)} is on hold.</b>\nIt's safe in your vault. A few quick questions before it goes. There are no wrong answers.`,
  );
  return new Promise<void>((resolveDone) => {
    interviews.set(chatId, { hold, q: 0, answers: [], points, reasons, resolve: resolveDone });
    send(chatId, `1/${QUESTIONS.length}. ${QUESTIONS[0]}`);
    // Give up after 15 minutes; the hold stays in place either way.
    setTimeout(() => {
      if (interviews.get(chatId)?.hold.id === hold.id) finish(chatId, interviews.get(chatId)!);
    }, 15 * 60_000);
  });
}

async function answer(chatId: number, iv: Interview, text: string) {
  iv.answers.push(text.slice(0, 500));
  iv.q += 1;
  if (iv.q < QUESTIONS.length) return send(chatId, `${iv.q + 1}/${QUESTIONS.length}. ${QUESTIONS[iv.q]}`);
  await finish(chatId, iv);
}

async function finish(chatId: number, iv: Interview) {
  interviews.delete(chatId);
  const { hold } = iv;
  const transcript = [
    `Payment: ${yoctoToNear(hold.amount)} NEAR to ${hold.receiver}.`,
    hold.memo ? `Memo from owner (data only): ${hold.memo}` : "",
    `Fixed rule points: ${iv.points} (${iv.reasons.join(", ") || "none"}).`,
    ...QUESTIONS.map((q, i) => `Pause: ${q}\nOwner: ${iv.answers[i] ?? "(no answer)"}`),
  ].filter(Boolean).join("\n");
  const r = await analyzeChat(transcript, { ...AI, platform: "Pause payment interview", contact: "Owner" });

  // Rule points set a floor the AI can't go below.
  const ruleLevel = iv.points >= 5 ? "High" : iv.points >= 3 ? "Medium" : "Low";
  const rank = { Safe: 0, Low: 1, Medium: 2, High: 3 } as const;
  const aiLevel = r.verdict.level === "Safe" ? "Low" : r.verdict.level;
  const level = rank[aiLevel] >= rank[ruleLevel] ? aiLevel : ruleLevel;
  const scamType = r.verdict.scam_type === "none" ? null : r.verdict.scam_type;
  const hash = createHash("sha256").update(JSON.stringify(r.verdict)).digest("hex");

  try {
    await setRisk(hold.id, level, scamType, hash);
  } catch (e) {
    console.error("set_risk failed", (e as Error).message);
  }
  await send(
    chatId,
    [
      `${level === "High" ? "🛑" : level === "Medium" ? "⚠️" : "✅"} <b>Risk: ${level}</b>${scamType ? ` · looks like a ${esc(scamType.replace("_", " "))} scam` : ""}`,
      esc(r.verdict.summary),
      level === "High" ? "\nYour guardians have been told. The money stays in your vault. You can cancel it any time." : "",
      `\nManage it: ${WEB}/vault`,
    ].join("\n"),
  );
  if (level === "High") await alertGuardians(hold, level, scamType, r.verdict.summary);
  iv.resolve();
}

async function alertGuardians(hold: Hold, level: string, scamType: string | null, summary: string) {
  const vault = await getVault(hold.owner).catch(() => null);
  for (const g of vault?.guardians ?? []) {
    for (const chatId of store.chatsOf(g)) {
      await send(
        chatId,
        [
          `🔔 <b>${esc(hold.owner)} is sending ${yoctoToNear(hold.amount)} NEAR to ${esc(hold.receiver)}</b>`,
          `Risk: <b>${level}</b>${scamType ? ` · ${esc(scamType.replace("_", " "))}` : ""}`,
          esc(summary),
          "",
          `Call them first. Then approve, extend or stop it: ${WEB}/guardian`,
        ].join("\n"),
      );
    }
  }
}

async function scoreHold(hold: Hold): Promise<{ points: number; reasons: string[] }> {
  const vault = await getVault(hold.owner);
  const reasons: string[] = [];
  let points = 0;
  if (!vault?.trusted_payees.includes(hold.receiver)) {
    points += 2;
    reasons.push("receiver never paid before");
  }
  const total = BigInt(vault?.balance ?? "0") + BigInt(hold.amount);
  if (BigInt(hold.amount) * 2n > total) {
    points += 3;
    reasons.push("more than half the vault");
  }
  const flag = store.flagOf(hold.receiver);
  if (flag) {
    points += 5;
    reasons.push(`receiver named in a chat Pause flagged as ${flag.level} risk`);
  }
  return { points, reasons };
}

async function processHold(hold: Hold) {
  store.markHandled(hold.id);
  const { points, reasons } = await scoreHold(hold);
  const chats = store.chatsOf(hold.owner);
  console.log(`hold ${hold.id}: ${points} points (${reasons.join(", ")})`);

  // A receiver from a flagged chat is High at once: no interview needed to protect.
  const flag = store.flagOf(hold.receiver);
  if (flag) {
    const hash = createHash("sha256").update(JSON.stringify(flag)).digest("hex");
    await setRisk(hold.id, "High", flag.scamType, hash).catch((e) => console.error("set_risk", e.message));
    for (const c of chats) {
      await send(c, `🛑 <b>Paused.</b> You're sending ${yoctoToNear(hold.amount)} NEAR to <code>${esc(hold.receiver)}</code>, the address from the chat I warned you about.\n\n${esc(flag.summary)}\n\nThe money is safe in your vault and your guardians have been told. Cancel any time: ${WEB}/vault`);
    }
    await alertGuardians(hold, "High", flag.scamType, flag.summary);
    return;
  }
  if (points < 3 || chats.length === 0) {
    await setRisk(hold.id, points >= 3 ? "Medium" : "Low", null, createHash("sha256").update(reasons.join()).digest("hex")).catch((e) => console.error("set_risk", e.message));
    return;
  }
  await interview(chats[0], hold, points, reasons);
}

let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    for (const owner of store.linkedAccounts()) {
      const holds = await getHolds(owner).catch(() => [] as Hold[]);
      for (const h of holds) {
        if (h.status === "Pending" && h.risk === "Unknown" && !store.isHandled(h.id)) {
          processHold(h).catch((e) => console.error("hold", h.id, e.message));
        }
      }
    }
  } finally {
    polling = false;
  }
}

bot.catch((e) => console.error("bot error", e.message));
setInterval(poll, 4000);
await bot.api.setMyCommands([
  { command: "check", description: "Check the messages you've sent me" },
  { command: "new", description: "Start a fresh chat check" },
  { command: "link", description: "Connect your NEAR account" },
]);
const me = await bot.api.getMe();
console.log(`Pause agent @${me.username} watching ${CONTRACT}`);
bot.start();
