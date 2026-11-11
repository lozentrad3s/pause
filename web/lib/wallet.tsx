"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import "@near-wallet-selector/modal-ui/styles.css";
import { CONTRACT, NETWORK } from "./near";

interface WalletCtx {
  ready: boolean;
  accountId: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  /** Signs a call to the Pause contract. Deposit and gas are in yocto / gas units. */
  call: (method: string, args?: object, deposit?: string, gas?: string) => Promise<unknown>;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const [{ setupWalletSelector }, { setupModal }, mnw, meteor, here, intear] = await Promise.all([
        import("@near-wallet-selector/core"),
        import("@near-wallet-selector/modal-ui"),
        import("@near-wallet-selector/my-near-wallet"),
        import("@near-wallet-selector/meteor-wallet"),
        import("@near-wallet-selector/here-wallet"),
        import("@near-wallet-selector/intear-wallet"),
      ]);
      const sel = await setupWalletSelector({
        network: NETWORK,
        modules: [mnw.setupMyNearWallet(), meteor.setupMeteorWallet(), here.setupHereWallet(), intear.setupIntearWallet()],
      });
      const m = setupModal(sel, { contractId: CONTRACT, description: "Connect the wallet that owns or guards a Pause vault." });
      const sync = () => setAccountId(sel.store.getState().accounts.find((a) => a.active)?.accountId ?? null);
      sync();
      const sub = sel.store.observable.subscribe(sync);
      unsub = () => sub.unsubscribe();
      setSelector(sel);
      setModal(m);
    })().catch((e) => console.error("wallet selector", e));
    return () => unsub?.();
  }, []);

  const signIn = useCallback(() => modal?.show(), [modal]);

  const signOut = useCallback(async () => {
    if (!selector) return;
    const w = await selector.wallet();
    await w.signOut();
    setAccountId(null);
  }, [selector]);

  const call = useCallback(
    async (method: string, args: object = {}, deposit = "0", gas = "60000000000000") => {
      if (!selector) throw new Error("Wallet not ready");
      const [w, { actionCreators }] = await Promise.all([selector.wallet(), import("@near-wallet-selector/core")]);
      return w.signAndSendTransaction({
        receiverId: CONTRACT,
        actions: [actionCreators.functionCall(method, args, BigInt(gas), BigInt(deposit))],
      });
    },
    [selector],
  );

  return <Ctx.Provider value={{ ready: !!selector, accountId, signIn, signOut, call }}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used inside WalletProvider");
  return c;
}
