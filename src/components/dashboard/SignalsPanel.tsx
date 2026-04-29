"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TradeDecision } from "@/types/trade";
import { fetchDecisions, fetchWatchlist } from "@/lib/api";
import {
  getDecisionColor, getDecisionBorder, getDecisionBg,
  getFinalScoreColor, formatDate,
} from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS  = 30_000;

type Filter = "ALL" | "LONG" | "SHORT" | "NO_TRADE" | "WATCHLIST";

const ICON: Record<string, string> = { LONG: "▲", SHORT: "▼", NO_TRADE: "◼" };

function SignalCard({ signal }: { signal: TradeDecision }) {
  const time = signal.logged_at
    ? formatDate(signal.logged_at)
    : formatDate(signal.news.published_at);

  return (
    <Link
      href={`/stock/${signal.ticker ?? "UNKNOWN"}`}
      className={`block rounded-xl border px-4 py-3 transition-all hover:scale-[1.01]
        ${getDecisionBg(signal.decision)} ${getDecisionBorder(signal.decision)}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-zinc-100">{signal.ticker ?? "—"}</span>
            <span className={`text-xs font-semibold ${getDecisionColor(signal.decision)}`}>
              {ICON[signal.decision]} {signal.decision}
            </span>
            {signal.trade_allowed && (
              <span className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                Trade Allowed
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate">{signal.news.headline}</p>
        </div>

        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${getFinalScoreColor(signal.final_score)}`}>
            {signal.final_score > 0 ? "+" : ""}{signal.final_score.toFixed(1)}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">{time}</p>
        </div>
      </div>
    </Link>
  );
}

type Props = { fallbackSignals: TradeDecision[] };

export function SignalsPanel({ fallbackSignals }: Props) {
  const [signals,       setSignals      ] = useState<TradeDecision[]>(fallbackSignals);
  const [watchlist,     setWatchlist    ] = useState<string[]>([]);
  const [filter,        setFilter       ] = useState<Filter>("ALL");

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try {
      const [data, wl] = await Promise.allSettled([fetchDecisions(), fetchWatchlist()]);
      if (data.status === "fulfilled" && data.value.length > 0) setSignals(data.value);
      if (wl.status   === "fulfilled") setWatchlist(wl.value.map((e) => e.ticker));
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    refresh();
    if (!API_URL) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "ALL",      label: "All" },
    { key: "LONG",     label: "▲ Long" },
    { key: "SHORT",    label: "▼ Short" },
    { key: "NO_TRADE", label: "◼ No Trade" },
    { key: "WATCHLIST",label: "★ Watchlist" },
  ];

  const filtered = signals.filter((s) => {
    if (filter === "ALL")       return true;
    if (filter === "WATCHLIST") return watchlist.includes(s.ticker ?? "");
    return s.decision === filter;
  });

  const counts = {
    ALL:       signals.length,
    LONG:      signals.filter((s) => s.decision === "LONG").length,
    SHORT:     signals.filter((s) => s.decision === "SHORT").length,
    NO_TRADE:  signals.filter((s) => s.decision === "NO_TRADE").length,
    WATCHLIST: signals.filter((s) => watchlist.includes(s.ticker ?? "")).length,
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-1 mb-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1.5 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 min-w-fit rounded-lg py-1.5 px-2 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === key
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className="ml-1 opacity-60">({counts[key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Signals */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-500">
            {!API_URL
              ? "No signals match this filter"
              : signals.length === 0
                ? "Backend is running — first signals arrive within 5 minutes"
                : "No signals match this filter"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <SignalCard key={s.id ?? i} signal={s} />
          ))}
        </div>
      )}
    </div>
  );
}
