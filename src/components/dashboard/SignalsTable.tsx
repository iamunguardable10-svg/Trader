"use client";

import { useState } from "react";
import Link from "next/link";
import { TradeDecision, SignalSource } from "@/types/trade";
import { getDecisionColor, getFinalScoreColor, formatDate } from "@/lib/utils";

function SourceBadge({ source }: { source?: SignalSource }) {
  if (!source || source === "news") return null;
  if (source === "technical") return (
    <span className="rounded bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 text-xs text-blue-400 font-medium">⚡ Tech</span>
  );
  if (source === "macro") return (
    <span className="rounded bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-xs text-amber-400 font-medium">🌐 Macro</span>
  );
  return null;
}

type Filter = "ALL" | "LONG" | "SHORT" | "NO_TRADE" | "WATCHLIST";
type SortKey = "score" | "time" | "confidence";

type Props = {
  signals: TradeDecision[];
  watchlistTickers: string[];
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 w-8">{pct}%</span>
    </div>
  );
}

const ICON: Record<string, string> = { LONG: "▲", SHORT: "▼", NO_TRADE: "◼" };

export function SignalsTable({ signals, watchlistTickers }: Props) {
  const [filter,   setFilter  ] = useState<Filter>("ALL");
  const [sortKey,  setSortKey ] = useState<SortKey>("time");
  const [sortDesc, setSortDesc] = useState(true);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "ALL",       label: "All" },
    { key: "LONG",      label: "▲ Long" },
    { key: "SHORT",     label: "▼ Short" },
    { key: "NO_TRADE",  label: "◼ No Trade" },
    { key: "WATCHLIST", label: "★ Watchlist" },
  ];

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((v) => !v);
    else { setSortKey(key); setSortDesc(true); }
  }

  const filtered = signals
    .filter((s) => {
      if (filter === "ALL")       return true;
      if (filter === "WATCHLIST") return watchlistTickers.includes(s.ticker ?? "");
      return s.decision === filter;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === "score")      diff = Math.abs(b.final_score) - Math.abs(a.final_score);
      if (sortKey === "confidence") diff = b.confidence - a.confidence;
      if (sortKey === "time") {
        const ta = new Date(a.logged_at ?? a.news.published_at).getTime();
        const tb = new Date(b.logged_at ?? b.news.published_at).getTime();
        diff = tb - ta;
      }
      return sortDesc ? diff : -diff;
    });

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 text-xs transition-colors ${active ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"}`}
      >
        {label}
        {active && <span className="text-zinc-500">{sortDesc ? "↓" : "↑"}</span>}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800 flex-wrap gap-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const count = key === "ALL" ? signals.length
              : key === "WATCHLIST" ? signals.filter((s) => watchlistTickers.includes(s.ticker ?? "")).length
              : signals.filter((s) => s.decision === key).length;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === key ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label} {count > 0 && <span className="opacity-50">({count})</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          Sort: <SortBtn label="Score" k="score" /> · <SortBtn label="Time" k="time" /> · <SortBtn label="Confidence" k="confidence" />
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-zinc-800/50">
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-zinc-600">No signals match this filter</p>
        )}
        {filtered.map((s, i) => {
          const time = s.logged_at ? formatDate(s.logged_at) : formatDate(s.news.published_at);
          return (
            <Link key={s.id ?? i} href={`/stock/${s.ticker ?? ""}`} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors">
              <div className={`mt-0.5 text-sm font-bold w-6 shrink-0 ${getDecisionColor(s.decision)}`}>{ICON[s.decision]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-zinc-100 text-sm">{s.ticker ?? "—"}</span>
                  <span className={`text-xs font-bold ${getFinalScoreColor(s.final_score)}`}>
                    {s.final_score > 0 ? "+" : ""}{s.final_score.toFixed(1)}
                  </span>
                  {s.trade_allowed && <span className="text-xs text-emerald-500">✓</span>}
                  <SourceBadge source={s.signal_source} />
                </div>
                <p className="text-xs text-zinc-400 truncate">{s.news.headline}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{time}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              {["TICKER", "SCORE", "DIRECTION", "NEWS", "TIME", "CONFIDENCE"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-zinc-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">
                  No signals match this filter
                </td>
              </tr>
            )}
            {filtered.map((s, i) => {
              const time = s.logged_at ? formatDate(s.logged_at) : formatDate(s.news.published_at);
              return (
                <tr key={s.id ?? i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/stock/${s.ticker ?? ""}`} className="group">
                      <span className="font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">{s.ticker ?? "—"}</span>
                      {s.trade_allowed && (
                        <span className="ml-2 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-500">✓</span>
                      )}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 font-bold ${getFinalScoreColor(s.final_score)}`}>
                    {s.final_score > 0 ? "+" : ""}{s.final_score.toFixed(1)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${getDecisionColor(s.decision)}`}>
                    {ICON[s.decision]} {s.decision}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={s.signal_source} />
                      <Link href={`/stock/${s.ticker ?? ""}`} className="text-zinc-400 hover:text-zinc-200 transition-colors truncate block">
                        {s.news.headline}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{time}</td>
                  <td className="px-4 py-3"><ConfidenceBar value={s.confidence} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
