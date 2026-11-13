// A small JSON file is enough for the hackathon: Telegram chat ↔ NEAR account
// links, addresses flagged from checked chats, and holds already handled.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lang } from "../../web/lib/i18n";

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../data/state.json");

export interface Flag {
  level: string;
  scamType: string;
  summary: string;
  chatId: number;
  at: number;
}

interface State {
  links: Record<string, string>; // chatId -> NEAR account
  flags: Record<string, Flag>; // receiver address -> why it was flagged
  handled: number[]; // hold ids already processed
  langs: Record<string, Lang>; // chatId -> language Pause answers in
  pots: Record<string, number[]>; // group chatId -> pot ids it follows
  snaps: Record<string, string>; // pot id -> last seen state, to post only what changed
  reminded: Record<string, string>; // "potId:account" -> date of the last private reminder
}

let state: State = { links: {}, flags: {}, handled: [], langs: {}, pots: {}, snaps: {}, reminded: {} };
if (existsSync(FILE)) state = { ...state, ...JSON.parse(readFileSync(FILE, "utf8")) };

function save() {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export const store = {
  link(chatId: number, account: string) {
    state.links[String(chatId)] = account;
    save();
  },
  accountOf: (chatId: number) => state.links[String(chatId)],
  setLang(chatId: number, lang: Lang) {
    state.langs[String(chatId)] = lang;
    save();
  },
  langOf: (chatId: number): Lang => state.langs[String(chatId)] ?? "en",
  chatsOf: (account: string) => Object.entries(state.links).filter(([, a]) => a === account).map(([c]) => Number(c)),
  linkedAccounts: () => [...new Set(Object.values(state.links))],
  flag(address: string, f: Flag) {
    state.flags[address.toLowerCase()] = f;
    save();
  },
  flagOf: (address: string) => state.flags[address.toLowerCase()],
  isHandled: (id: number) => state.handled.includes(id),
  markHandled(id: number) {
    state.handled.push(id);
    state.handled = state.handled.slice(-500);
    save();
  },
  followPot(chatId: number, potId: number) {
    const ids = state.pots[String(chatId)] ?? [];
    if (!ids.includes(potId)) state.pots[String(chatId)] = [...ids, potId];
    save();
  },
  potsOf: (chatId: number) => state.pots[String(chatId)] ?? [],
  followed: () => Object.entries(state.pots).flatMap(([c, ids]) => ids.map((id) => ({ chatId: Number(c), potId: id }))),
  snap: (potId: number) => state.snaps[String(potId)],
  setSnap(potId: number, s: string) {
    state.snaps[String(potId)] = s;
    save();
  },
  remindedToday(potId: number, account: string) {
    return state.reminded[`${potId}:${account}`] === new Date().toISOString().slice(0, 10);
  },
  markReminded(potId: number, account: string) {
    state.reminded[`${potId}:${account}`] = new Date().toISOString().slice(0, 10);
    save();
  },
};
