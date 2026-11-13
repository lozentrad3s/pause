"use client";

// Signing for the group pages: a connected NEAR wallet, or a guest organizer
// account whose key was made in this browser and never leaves it.

import type { Line, Pot, Report } from "./treasurer";
import { guestCall } from "./guest";
import { view } from "./near";

export type { Line, Pot, Report };

export interface GroupGuest {
  account: string;
  key: string;
  pots: number[];
}

const STORE = "pause-group-guest-v1";

export function loadGroupGuest(): GroupGuest | null {
  try {
    // Kept in this browser (localStorage), so a pot survives refreshes and new tabs.
    const raw = localStorage.getItem(STORE) ?? sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as GroupGuest) : null;
  } catch {
    return null;
  }
}

export function saveGroupGuest(g: GroupGuest | null) {
  try {
    if (g) localStorage.setItem(STORE, JSON.stringify(g));
    else localStorage.removeItem(STORE);
  } catch {
    // Storage can be refused in private windows; the session still works until reload.
  }
}

export const getPot = (id: number) => view<Pot | null>("get_pot", { pot_id: id });
export const getLines = (id: number) => view<Line[]>("get_lines", { pot_id: id });
export const getReport = (id: number) => view<Report>("get_report", { pot_id: id });

export async function api<T = Record<string, unknown>>(body: object): Promise<T> {
  const r = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Something went wrong");
  return d as T;
}

export type Signer = { account: string; call: (method: string, args?: object, deposit?: string) => Promise<{ hash: string | null; value?: unknown }> };

/** Picks the wallet if connected, else the guest organizer. */
export function makeSigner(wallet: { accountId: string | null; call: (m: string, a?: object, d?: string) => Promise<{ hash: string | null }> }, guest: GroupGuest | null): Signer | null {
  if (wallet.accountId) return { account: wallet.accountId, call: (m, a = {}, d = "0") => wallet.call(m, a, d) };
  if (guest) return { account: guest.account, call: (m, a = {}, d = "0") => guestCall(guest.account, guest.key, m, a, d) };
  return null;
}

export const YOCTO = 10n ** 24n;
export function toYocto(near: string): string {
  const [w, f = ""] = near.trim().split(".");
  if (!/^\d*$/.test(w) || !/^\d*$/.test(f)) throw new Error("Enter a number");
  return (BigInt(w || "0") * YOCTO + BigInt((f + "0".repeat(24)).slice(0, 24))).toString();
}
export function fmt(y: string | bigint): string {
  const v = BigInt(y);
  const whole = v / YOCTO;
  const frac = (v % YOCTO).toString().padStart(24, "0").slice(0, 3).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
export const short = (a: string) => a.split(".")[0];
export const display = (a: string) => short(a).replace(/-[0-9a-f]{8}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const NEAR_ACCOUNT = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9_-]+)*\.(testnet|near)$/;

export interface Invitee {
  label: string; // what the organizer typed: a name, email or phone number
  contact?: string; // email or phone, for the share buttons
  account?: string; // NEAR account, once known
  key?: string; // secret key for a new account, only for the invite link
}

/** Splits "Ada ada@mail.com, +2348012345678, tunde.testnet" into invitees. */
export function parseInvitees(text: string): Invitee[] {
  return text
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 11)
    .map((x) => {
      const low = x.toLowerCase();
      if (NEAR_ACCOUNT.test(low)) return { label: low, account: low };
      const email = x.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
      const phone = x.match(/\+?\d[\d\s-]{6,}\d/)?.[0]?.replace(/[\s-]/g, "");
      const name = x.replace(email ?? "", "").replace(phone ?? "", "").trim();
      return { label: name || email || phone || x, contact: email || phone };
    });
}

export function inviteLink(base: string, inv: Invitee, pot: number): string {
  return `${base}/join#a=${encodeURIComponent(inv.account!)}&k=${encodeURIComponent(inv.key!)}&p=${pot}`;
}
