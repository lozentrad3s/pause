// Pause Groups in Telegram: the bot joins a group, follows its pot, posts every
// move, and does the treasurer's chores. Members sign every decision on a web
// page opened from the bot, because Telegram itself can't sign NEAR
// transactions. Keep the bot's privacy mode on (the BotFather default): it then
// sees only commands and replies to its own messages, never the group's chatter.

import { Bot, InlineKeyboard, type Context } from "grammy";
import {
  answerFromChain,
  fmt,
  getLines,
  getPot,
  getReport,
  payDue,
  proposePlan,
  short,
  txUrl,
  type Line,
  type Pot,
} from "../../web/lib/treasurer";
import { store } from "./store";

const WEB = process.env.PAUSE_WEB_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const name = (a: string) => esc(short(a).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
const potUrl = (pot: number, q = "") => `${WEB}/groups/${pot}${q ? `?${q}` : ""}`;
// Telegram refuses buttons that link to localhost; fall back to plain links.
const linkable = !/localhost|127\.0\.0\.1/.test(WEB);

let bot: Bot;
const send = (chatId: number, html: string, kb?: InlineKeyboard) =>
  bot.api
    .sendMessage(chatId, html, { parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...(kb && linkable ? { reply_markup: kb } : {}) })
    .catch((e) => console.error("group send", e.message));

function buttons(pairs: [string, string][]): { kb?: InlineKeyboard; text: string } {
  if (linkable) {
    const kb = new InlineKeyboard();
    pairs.forEach(([label, url]) => kb.url(label, url));
    return { kb, text: "" };
  }
  return { text: "\n" + pairs.map(([label, url]) => `${label}: ${url}`).join("\n") };
}

function latestPot(ctx: Context): number | null {
  const ids = store.potsOf(ctx.chat!.id);
  return ids.length ? ids[ids.length - 1] : null;
}

async function needPot(ctx: Context): Promise<number | null> {
  const id = latestPot(ctx);
  if (id === null) await ctx.reply("This group isn't following a pot yet. Send /newpot to make one, or /connect <pot number> if you already have one.");
  return id;
}

// ------------------------------------------------------------------ messages

interface Snap {
  status: string;
  contrib: Record<string, string>;
  lines: Record<string, { status: string; paid: string; note: string | null; refused: string | null }>;
}

function snapOf(pot: Pot, lines: Line[]): Snap {
  return {
    status: pot.status,
    contrib: Object.fromEntries(pot.contributions),
    lines: Object.fromEntries(lines.map((l) => [String(l.id), { status: l.status, paid: l.paid, note: l.vendor_note, refused: l.refused }])),
  };
}

const lastHash = new Map<number, string>(); // line id -> payment tx we sent

async function postChanges(chatId: number, potId: number) {
  const [pot, lines] = await Promise.all([getPot(potId), getLines(potId)]);
  if (!pot) return;
  const now = snapOf(pot, lines);
  const raw = store.snap(potId);
  store.setSnap(potId, JSON.stringify(now));
  if (!raw) return; // first look: remember, don't replay history
  const before = JSON.parse(raw) as Snap;
  const report = await getReport(potId);
  const unpaid = report.unpaid_members.map(name).join(", ");

  for (const [who, v] of Object.entries(now.contrib)) {
    const was = BigInt(before.contrib[who] ?? "0");
    if (BigInt(v) > was) {
      await send(chatId, `💰 <b>${name(who)}</b> paid ${fmt(BigInt(v) - was)} NEAR. Raised <b>${fmt(pot.raised)} of ${fmt(pot.goal)} NEAR</b>.${unpaid ? ` Still to pay: ${unpaid}.` : " Everyone has paid."}`);
    }
  }

  for (const l of lines) {
    const b = before.lines[String(l.id)];
    const tag = `<b>${esc(l.label)}</b>, ${fmt(l.amount)} NEAR to <code>${esc(l.vendor)}</code>`;
    if (!b) {
      const btn = buttons([["Approve", potUrl(potId, `line=${l.id}&act=approve`)], ["Reject", potUrl(potId, `line=${l.id}&act=reject`)]]);
      await send(
        chatId,
        `📝 New budget line: ${tag}. Proposed by ${name(l.proposed_by)}.${l.flagged ? `\n⚠️ <b>Pause flagged this:</b> ${esc(l.flagged)}` : ""}\nNeeds ${pot.approvals_needed} of ${pot.members.length} members to approve.${btn.text}`,
        btn.kb,
      );
      continue;
    }
    if (b.status === "Proposed" && l.status === "Approved") {
      const btn = buttons([["Object", potUrl(potId, `line=${l.id}&act=object`)]]);
      const mins = Math.max(1, Math.round(pot.hold_secs / 60));
      await send(chatId, `✅ ${tag}, approved by ${l.approvals.length} of ${pot.members.length}. Pays in about ${mins} minute${mins > 1 ? "s" : ""} unless someone taps Object.${btn.text}`, btn.kb);
    }
    if (b.status === "Approved" && l.status === "Proposed") {
      await send(chatId, `✋ Someone objected to ${tag}. It goes back to a fresh vote.`);
    }
    if (b.status === "Proposed" && l.status === "Rejected" && !l.refused) {
      await send(chatId, `❌ The group rejected ${tag}.`);
    }
    if (BigInt(l.paid) > BigInt(b.paid)) {
      const left = BigInt(l.amount) - BigInt(l.paid);
      const hash = lastHash.get(l.id);
      await send(
        chatId,
        `💸 Paid <b>${esc(l.label)}</b>, ${fmt(BigInt(l.paid) - BigInt(b.paid))} NEAR.${left > 0n ? ` ${fmt(left)} NEAR left on this line.` : ""}${hash ? `\n<a href="${txUrl(hash)}">See it on NEAR</a>` : ""}`,
      );
    }
    if (!b.refused && l.refused) {
      await send(chatId, `🛑 I didn't pay <code>${esc(l.vendor)}</code>: ${esc(l.refused)}. Please vote on a different vendor.`);
    }
    if (!b.note && l.vendor_note) {
      await send(chatId, `📦 <b>${name(l.vendor)}</b> confirmed: ${esc(l.vendor_note)}`);
    }
  }

  if (before.status !== now.status && (now.status === "Cancelled" || now.status === "Closed")) {
    const btn = buttons([["Claim my refund", potUrl(potId, "act=refund")]]);
    await send(chatId, `🏁 The pot is ${now.status === "Cancelled" ? "cancelled" : "closed"}. ${fmt(BigInt(pot.raised) - BigInt(pot.spent))} NEAR goes back to contributors, split by what each paid in.${btn.text}`, btn.kb);
  }
}

async function remind(potId: number) {
  const report = await getReport(potId);
  const pot = await getPot(potId);
  if (!pot || !["Raising", "Spending"].includes(pot.status)) return;
  for (const account of report.unpaid_members) {
    if (store.remindedToday(potId, account)) continue;
    for (const chatId of store.chatsOf(account)) {
      const btn = buttons([["Pay my share", potUrl(potId, "act=contribute")]]);
      await send(chatId, `👋 A gentle reminder: your share for <b>${esc(pot.name)}</b> is ${pot.contribution_each ? `${fmt(pot.contribution_each)} NEAR` : "still open"}. The group has raised ${fmt(pot.raised)} of ${fmt(pot.goal)} NEAR.${btn.text}`, btn.kb);
    }
    store.markReminded(potId, account);
  }
}

// ------------------------------------------------------------------ commands

export function registerGroups(b: Bot) {
  bot = b;

  b.command("newpot", (ctx) => {
    const url = `${WEB}/groups/new?chat=${ctx.chat.id}`;
    const btn = buttons([["Create the pot", url]]);
    return ctx.reply(
      `Let's set up the pot. On the page you'll choose a name, the goal, each person's share, the members and how many must approve each payment. Then send <code>/connect &lt;pot number&gt;</code> here.${btn.text}`,
      { parse_mode: "HTML", ...(btn.kb ? { reply_markup: btn.kb } : {}) },
    );
  });

  b.command("connect", async (ctx) => {
    const id = Number(ctx.match.trim());
    if (!Number.isInteger(id) || id < 0) return ctx.reply("Send it like this: /connect 3");
    const pot = await getPot(id).catch(() => null);
    if (!pot) return ctx.reply(`I can't find pot ${id} on NEAR.`);
    store.followPot(ctx.chat.id, id);
    store.setSnap(id, "");
    await postChanges(ctx.chat.id, id);
    const r = await getReport(id);
    return ctx.reply(
      `🤝 Following <b>${esc(pot.name)}</b>. ${pot.approvals_needed} of ${pot.members.length} members must approve every payment, and each approved payment waits ${Math.round(pot.hold_secs / 60)} min so anyone can object. Raised ${fmt(r.raised)} of ${fmt(r.goal)} NEAR.\n\nI can only pay vendors you approve, never more than you approved. Try /plan, /status, /vendors or /ask.`,
      { parse_mode: "HTML" },
    );
  });

  b.command("plan", async (ctx) => {
    const id = await needPot(ctx);
    if (id === null) return;
    const text = ctx.match.trim();
    if (text.length < 10) return ctx.reply("Write the plan after /plan, for example:\n/plan Hall: hall-owner.testnet 6 NEAR, half now. Food: mama-nkechi.testnet 4 NEAR.");
    await ctx.replyWithChatAction("typing");
    try {
      const { plan, proposed, errors } = await proposePlan(id, text);
      const out = [`🧮 I read the plan${plan.source === "ai" ? " privately on NEAR AI Cloud" : ""}. Proposed ${proposed.length} line${proposed.length === 1 ? "" : "s"}; each needs your votes. I can't approve anything.`];
      if (plan.questions.length) out.push("", "<b>I need the group to decide:</b>", ...plan.questions.map((q) => `• ${esc(q)}`));
      if (plan.warnings.length) out.push("", "<b>Please check:</b>", ...plan.warnings.map((w) => `⚠️ ${esc(w)}`));
      if (errors.length) out.push("", ...errors.map((e) => `Couldn't propose ${esc(e)}`));
      await ctx.reply(out.join("\n"), { parse_mode: "HTML" });
      await postChanges(ctx.chat.id, id);
    } catch (e) {
      await ctx.reply(`I couldn't propose the plan: ${(e as Error).message}`);
    }
  });

  b.command("contribute", async (ctx) => {
    const id = await needPot(ctx);
    if (id === null) return;
    const btn = buttons([["Pay my share", potUrl(id, "act=contribute")]]);
    return ctx.reply(`Your share goes into the pot on NEAR. Only approved vendors can be paid from it.${btn.text}`, btn.kb ? { reply_markup: btn.kb } : {});
  });

  b.command("status", async (ctx) => {
    const id = await needPot(ctx);
    if (id === null) return;
    const [pot, r] = await Promise.all([getPot(id), getReport(id)]);
    if (!pot) return;
    return ctx.reply(
      [
        `📊 <b>${esc(pot.name)}</b> · ${pot.status}`,
        `Raised ${fmt(r.raised)} of ${fmt(r.goal)} NEAR`,
        `Approved, waiting to pay: ${fmt(r.approved)} NEAR`,
        `Paid: ${fmt(r.paid)} NEAR`,
        `Left in the pot: ${fmt(r.remaining)} NEAR (${fmt(r.uncommitted)} not promised to anyone yet)`,
        r.unpaid_members.length ? `Still to pay: ${r.unpaid_members.map(name).join(", ")}` : "Everyone has paid in.",
        `\n${potUrl(id)}`,
      ].join("\n"),
      { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    );
  });

  b.command("vendors", async (ctx) => {
    const id = await needPot(ctx);
    if (id === null) return;
    const lines = await getLines(id);
    if (!lines.length) return ctx.reply("No budget lines yet. Try /plan.");
    const icon: Record<string, string> = { Proposed: "📝", Approved: "✅", Paid: "💸", Rejected: "❌" };
    return ctx.reply(
      lines.map((l) => `${icon[l.status]} <b>${esc(l.label)}</b> · ${fmt(l.paid)}/${fmt(l.amount)} NEAR · <code>${esc(l.vendor)}</code> · ${l.status}${l.vendor_note ? `\n   📦 ${esc(l.vendor_note)}` : ""}`).join("\n"),
      { parse_mode: "HTML" },
    );
  });

  b.command("ask", async (ctx) => {
    const id = await needPot(ctx);
    if (id === null) return;
    const q = ctx.match.trim();
    if (!q) return ctx.reply("Ask after /ask, for example: /ask How much is left?");
    await ctx.replyWithChatAction("typing");
    return ctx.reply(`🔎 ${await answerFromChain(id, q)}\n<i>From the contract on NEAR.</i>`, { parse_mode: "HTML" });
  });
}

// --------------------------------------------------------- treasurer's loop

let busy = false;
let lastRemind = 0;

/** Pays what's due, then posts whatever changed, for every pot a group follows. */
export async function tickGroups() {
  if (busy) return;
  busy = true;
  try {
    const followed = store.followed();
    const pots = [...new Set(followed.map((f) => f.potId))];
    for (const potId of pots) {
      try {
        for (const p of await payDue(potId)) if (p.hash) lastHash.set(p.line, p.hash);
      } catch (e) {
        console.error("payDue", potId, (e as Error).message);
      }
    }
    for (const { chatId, potId } of followed) {
      await postChanges(chatId, potId).catch((e) => console.error("post", potId, (e as Error).message));
    }
    if (Date.now() - lastRemind > 60 * 60_000) {
      lastRemind = Date.now();
      for (const potId of pots) await remind(potId).catch(() => {});
    }
  } finally {
    busy = false;
  }
}
