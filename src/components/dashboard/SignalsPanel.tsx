"use client";

import { useState, useEffect, useCallback } from "react";
import { TradeDecision } from "@/types/trade";
import { fetchDecisions } from "@/lib/api";
import { getDecisionColor, getDecisionBorder, getDecisionBg, formatDate, getFinalScoreColor } from "@/lib/utils";
import { DecisionHeroCard } from "./DecisionHeroCard";
import { BlockingReasonsCard } from "./BlockingReasonsCard";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { NewsCard } from "./NewsCard";
import { MarketDataPanel } from "./MarketDataPanel";
import { TechnicalDataPanel } from "./TechnicalDataPanel";
import { MarketContextPanel } from "./MarketContextPanel";
import { TradePlanPanel } from "./TradePlanPanel";
import { ExitPlanPanel } from "./ExitPlanPanel";
import { PriceChartPanel } from "./PriceChartPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS  = 30_000;

type Filter = "ALL" | "LONG" | "SHORT" | "NO_TRADE";

const DECISION_ICONS: Record<string, string> = {
  LONG:     "▲",
  SHORT:    "▼",
  NO_TRADE: "◼",
};

// ── compact signal row ──────────────────────────────────────────────────────

function SignalRow({
  signal,
  selected,
  onClick,
}: {
  signal: TradeDecision;
  selected: boolean;
  onClick: () => void;
}) {
  const time = signal.logged_at
    ? formatDate(signal.logged_at)
    : formatDate(signal.news.published_at);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all
        ${selected
          ? `${getDecisionBg(signal.decision)} ${getDecisionBorder(signal.decision)} shadow-md`
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40"
        }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Ticker + company */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-100">
              {signal.ticker ?? "—"}
            </span>
            <span className={`text-xs font-semibold ${getDecisionColor(signal.decision)}`}>
              {DECISION_ICONS[signal.decision]} {signal.decision}
            </span>
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{signal.news.headline}</p>
        </div>

        {/* Score + time */}
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${getFinalScoreColor(signal.final_score)}`}>
            {signal.final_score > 0 ? "+" : ""}{signal.final_score.toFixed(1)}
          </p>
          <p className="text-xs text-zinc-600">{time}</p>
        </div>
      </div>
    </button>
  );
}

// ── full analysis ───────────────────────────────────────────────────────────

function SignalDetail({ signal }: { signal: TradeDecision }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-widest">
        <div className="flex-1 h-px bg-zinc-800" />
        Analysis · {signal.ticker ?? "—"}
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Row 1: hero + blocking */}
      <div className={`grid gap-4 ${!signal.trade_allowed ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <DecisionHeroCard data={signal} />
        {!signal.trade_allowed && <BlockingReasonsCard reasons={signal.blocking_reasons} />}
      </div>

      {/* Row 2: price chart + score */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PriceChartPanel ticker={signal.ticker} />
        </div>
        <ScoreBreakdown scores={signal.scores} />
      </div>

      {/* Row 3: news + market data */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NewsCard news={signal.news} />
        {signal.market_data && <MarketDataPanel data={signal.market_data} />}
      </div>

      {/* Row 4: technical + context */}
      {(signal.technical_data || signal.market_context) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {signal.technical_data && <TechnicalDataPanel data={signal.technical_data} />}
          {signal.market_context && <MarketContextPanel data={signal.market_context} />}
        </div>
      )}

      {/* Row 5: trade plan + exit plan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TradePlanPanel plan={signal.trade_plan} />
        <ExitPlanPanel  plan={signal.exit_plan} />
      </div>
    </div>
  );
}

// ── main panel ──────────────────────────────────────────────────────────────

type Props = { fallbackSignals: TradeDecision[] };

export function SignalsPanel({ fallbackSignals }: Props) {
  const [signals, setSignals]   = useState<TradeDecision[]>(fallbackSignals);
  const [selected, setSelected] = useState<TradeDecision | null>(fallbackSignals[0] ?? null);
  const [filter, setFilter]     = useState<Filter>("ALL");

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try {
      const data = await fetchDecisions();
      if (data.length > 0) {
        setSignals(data);
        setSelected((prev) => {
          if (!prev) return data[0];
          // keep current selection if it still exists, else latest
          return data.find((d) => d.id === prev.id) ?? data[0];
        });
      }
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    refresh();
    if (!API_URL) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const FILTERS: Filter[] = ["ALL", "LONG", "SHORT", "NO_TRADE"];
  const filtered = filter === "ALL" ? signals : signals.filter((s) => s.decision === filter);
  const counts: Record<Filter, number> = {
    ALL:      signals.length,
    LONG:     signals.filter((s) => s.decision === "LONG").length,
    SHORT:    signals.filter((s) => s.decision === "SHORT").length,
    NO_TRADE: signals.filter((s) => s.decision === "NO_TRADE").length,
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-1 mb-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f === "NO_TRADE" ? "NO TRADE" : f}
            {counts[f] > 0 && (
              <span className="ml-1 text-zinc-500">({counts[f]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Signal list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <p className="text-sm text-zinc-500">
            {API_URL
              ? "No signals yet — backend is fetching news every 5 minutes"
              : "No signals match this filter"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <SignalRow
              key={s.id ?? i}
              signal={s}
              selected={selected?.id === s.id || (!s.id && selected === s)}
              onClick={() => setSelected((prev) => (prev === s ? null : s))}
            />
          ))}
        </div>
      )}

      {/* Full analysis */}
      {selected && <SignalDetail signal={selected} />}
    </div>
  );
}
