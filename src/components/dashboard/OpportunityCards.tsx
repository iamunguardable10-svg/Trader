"use client";

import Link from "next/link";
import { TradeDecision } from "@/types/trade";
import { getDecisionColor, getFinalScoreColor } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from "recharts";

function MiniSparkline({ score }: { score: number }) {
  // Simulate a mini trend line based on the score
  const up = score > 0;
  const pts = Array.from({ length: 8 }, (_, i) => ({
    v: 50 + Math.sin(i * 0.8) * 10 + (up ? i * 3 : -i * 3) + (Math.random() - 0.5) * 5,
  }));
  return (
    <div className="w-full h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <Line type="monotone" dataKey="v" stroke={up ? "#10b981" : "#f87171"} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  earnings_beat_strong:    "Earnings Beat",
  earnings_miss_strong:    "Earnings Miss",
  earnings_guidance_raise: "Guidance Raise",
  earnings_guidance_cut:   "Guidance Cut",
  analyst_upgrade:         "Analyst Upgrade",
  analyst_downgrade:       "Analyst Downgrade",
  product_launch:          "Product Launch",
  takeover_offer:          "Takeover",
  share_buyback_large:     "Buyback",
  price_cut:               "Price Cut",
  major_lawsuit:           "Lawsuit",
  regulatory_approval:     "Approval",
  regulatory_investigation:"Investigation",
  unknown:                 "News",
};

type Props = { signals: TradeDecision[] };

export function OpportunityCards({ signals }: Props) {
  // Best signal per ticker: prefer trade_allowed, then highest absolute score
  const byTicker = new Map<string, TradeDecision>();
  for (const s of signals) {
    if (s.decision === "NO_TRADE" || !s.ticker) continue;
    const prev = byTicker.get(s.ticker);
    if (!prev) { byTicker.set(s.ticker, s); continue; }
    // Prefer trade_allowed; tie-break by absolute score
    const better =
      (s.trade_allowed && !prev.trade_allowed) ||
      (s.trade_allowed === prev.trade_allowed && Math.abs(s.final_score) > Math.abs(prev.final_score));
    if (better) byTicker.set(s.ticker, s);
  }
  const top = [...byTicker.values()]
    .sort((a, b) => {
      // trade_allowed first, then by absolute score
      if (a.trade_allowed !== b.trade_allowed) return a.trade_allowed ? -1 : 1;
      return Math.abs(b.final_score) - Math.abs(a.final_score);
    })
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Top Opportunities Today
        </h2>
        <Link href="/signals" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          View all signals →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {top.map((s, i) => {
          const up = s.final_score > 0;
          const eventLabel = EVENT_LABELS[s.news.event_type] ?? s.news.event_type;
          const confidencePct = Math.round(s.confidence * 100);

          return (
            <Link
              key={s.id ?? i}
              href={`/stock/${s.ticker}`}
              className={`rounded-xl border p-3 transition-all hover:scale-[1.02] hover:shadow-lg relative
                ${!s.trade_allowed
                  ? "border-zinc-700 bg-zinc-900/40 opacity-70"
                  : up
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                    : "border-red-500/30 bg-red-500/5 hover:border-red-500/50"}`}
            >
              {!s.trade_allowed && (
                <span className="absolute top-2 right-2 rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">
                  blocked
                </span>
              )}
              <div className="mb-1">
                <p className="text-base font-black text-zinc-100">{s.ticker}</p>
                <p className="text-xs text-zinc-500 truncate">{s.company ?? ""}</p>
              </div>

              <div className={`text-xl font-black ${getFinalScoreColor(s.final_score)}`}>
                {s.final_score > 0 ? "+" : ""}{s.final_score.toFixed(1)}
              </div>

              <div className={`text-xs font-semibold ${getDecisionColor(s.decision)} mb-1`}>
                {s.decision === "LONG" ? "▲" : "▼"} {s.decision}
              </div>

              <MiniSparkline score={s.final_score} />

              <div className="mt-1 flex flex-wrap gap-1">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                  {eventLabel}
                </span>
                {s.trade_allowed && confidencePct >= 80 && (
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
                    High Confidence
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
