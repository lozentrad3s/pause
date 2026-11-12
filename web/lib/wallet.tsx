"use client";

// Wallet connection through NEAR Connect (@hot-labs/near-connect), which
// replaces the deprecated NEAR Wallet Selector. Judges don't need a wallet:
// the /demo page signs with guest keys made in the browser (see guest.ts).

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { NearConnector } from "@hot-labs/near-connect";
import { CONTRACT, NETWORK } from "./near";

export interface TxResult {
  hash: string | null;
}

interface WalletCtx {
  ready: boolean;
  accountId: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  /** Signs a call to the Pause contract. Deposit and gas are in yocto / gas units. */
  call: (method: string, args?: object, deposit?: string, gas?: string) => Promise<TxResult>;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const connector = useRef<NearConnector | null>(null);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { NearConnector } = await import("@hot-labs/near-connect");
      if (cancelled) return;
      const c = new NearConnector({ network: NETWORK });
      c.on("wallet:signIn", (t) => setAccountId(t.accounts[0]?.accountId ?? null));
      c.on("wallet:signOut", () => setAccountId(null));
      connector.current = c;
      // Restore an earlier session, if the wallet kept one.
      try {
        const existing = await c.getConnectedWallet();
        if (!cancelled && existing?.accounts?.[0]) setAccountId(existing.accounts[0].accountId);
      } catch {
        // Not connected yet.
      }
      if (!cancelled) setReady(true);
    })().catch((e) => console.error("NEAR Connect", e));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(() => {
    connector.current?.connect().catch(() => {
      // The person closed the wallet list. Nothing to do.
    });
  }, []);

  const signOut = useCallback(async () => {
    await connector.current?.disconnect().catch(() => {});
    setAccountId(null);
  }, []);

  const call = useCallback(async (method: string, args: object = {}, deposit = "0", gas = "60000000000000") => {
    if (!connector.current) throw new Error("The wallet is still loading. Try again in a moment.");
    const wallet = await connector.current.wallet();
    const outcome = await wallet.signAndSendTransaction({
      receiverId: CONTRACT,
      actions: [{ type: "FunctionCall", params: { methodName: method, args, gas, deposit } }],
    });
    return { hash: (outcome as { transaction?: { hash?: string } })?.transaction?.hash ?? null };
  }, []);

  return <Ctx.Provider value={{ ready, accountId, signIn, signOut, call }}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used inside WalletProvider");
  return c;
}
