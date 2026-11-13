"use client";

import { useEffect, useState } from "react";
import { view, type Stats } from "@/lib/near";

interface PotLite { id: number; spent: string; raised: string; status: string }
interface LineLite { refused: string | null }

const fmt = (y: bigint) => {
  const n = Number(y / 10n ** 21n) / 1000;
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

/** Live numbers read from the Pause contract on NEAR testnet. */
export default function LiveProof() {
  const [d, setD] = useState<{ pots: number; raised: bigint; paid: bigint; refused: number; stats: Stats } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stats = await view<Stats>("get_stats");
        const pots: PotLite[] = [];
        for (let start = 0; start < 300; start += 10) {
          const batch = await Promise.all(Array.from({ length: 10 }, (_, i) => view<PotLite | null>("get_pot", { pot_id: start + i }).catch(() => null)));
          const found = batch.filter(Boolean) as PotLite[];
          pots.push(...found);
          if (found.length < 10) break;
        }
        const lines = (await Promise.all(pots.map((p) => view<LineLite[]>("get_lines", { pot_id: p.id }).catch(() => [])))).flat();
        setD({
          pots: pots.length,
          raised: pots.reduce((a, p) => a + BigInt(p.raised), 0n),
          paid: pots.reduce((a, p) => a + BigInt(p.spent), 0n),
          refused: lines.filter((l) => l.refused).length,
          stats,
        });
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  const tiles = [
    { v: d ? String(d.pots) : "–", l: "group pots created" },
    { v: d ? `${fmt(d.raised)} NEAR` : "–", l: "saved by groups" },
    { v: d ? `${fmt(d.paid)} NEAR` : "–", l: "paid to approved vendors" },
    { v: d ? String(d.refused + d.stats.blocked_by_registry) : "–", l: "payments to scammers stopped" },
  ];

  return (
    <div className="lp-proof">
      {tiles.map((t) => (
        <div key={t.l}><b className="figure">{t.v}</b><span>{t.l}</span></div>
      ))}
      {failed && <p className="small muted">NEAR testnet is slow right now. Refresh in a moment.</p>}
    </div>
  );
}
