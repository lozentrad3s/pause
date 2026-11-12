"use client";

// One language choice for the whole site, set from the header. It decides the
// language Pause's AI answers in, the language it listens for, and the voice
// it speaks with. Page text itself is in English.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { isLang, LANGS, type Lang } from "./i18n";

const KEY = "pause-lang";
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, set] = useState<Lang>("en");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      saved = null;
    }
    if (isLang(saved)) return set(saved);
    // First visit: follow the browser.
    const browser = navigator.language;
    const match = LANGS.find((l) => l.speech === browser) ?? LANGS.find((l) => l.id !== "en-GB" && browser.startsWith(l.id.slice(0, 2)));
    if (match) set(match.id);
  }, []);

  const setLang = useCallback((l: Lang) => {
    set(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // Private windows can refuse storage; the choice still holds for this visit.
    }
  }, []);

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
