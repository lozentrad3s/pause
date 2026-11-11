// A small JSON file is enough for the hackathon: Telegram chat ↔ NEAR account
// links, addresses flagged from checked chats, and holds already handled.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
}

let state: State = { links: {}, flags: {}, handled: [] };
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
};
