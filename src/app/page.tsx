"use client";

import { useState, useEffect, useCallback } from "react";
import { PerformanceData, TradeDecision, TradeHistoryEntry } from "@/types/trade";
import {
  mockDecision,
  mockDecisionLong,
  mockPerformance,
  mockTradeHistory,
} from "@/data/mockData";
import {
  checkHealth,
  fetchLatestDecision,
  fetchTradeHistory,
  fetchPerformance,
} from "@/lib/api";
import { Header } from "@/components/dashboard/Header";
import { DecisionHeroCard } from "@/components/dashboard/DecisionHeroCard";
import { BlockingReasonsCard } from "@/components/dashboard/BlockingReasonsCard";
import { ScoreBreakdown } from "@/components/dashboard/ScoreBreakdown";
import { NewsCard } from "@/components/dashboard/NewsCard";
import { MarketDataPanel } from "@/components/dashboard/MarketDataPanel";
import { TechnicalDataPanel } from "@/components/dashboard/TechnicalDataPanel";
import { MarketContextPanel } from "@/components/dashboard/MarketContextPanel";
import { TradePlanPanel } from "@/components/dashboard/TradePlanPanel";
import { ExitPlanPanel } from "@/components/dashboard/ExitPlanPanel";
import { TradeHistoryPanel } from "@/components/dashboard/TradeHistoryPanel";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { WatchlistPanel } from "@/components/dashboard/WatchlistPanel";
import { PriceChartPanel } from "@/components/dashboard/PriceChartPanel";
import { formatDate } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const POLL_INTERVAL_MS = 30_000;

const DEMO_DECISIONS: Record<"no_trade" | "long", TradeDecision> = {
  no_trade: mockDecision,
  long: mockDecisionLong,
};

export default function DashboardPage() {
  const [decision, setDecision] = useState<TradeDecision>(mockDecision);
  const [history, setHistory] = useState<TradeHistoryEntry[]>(mockTradeHistory);
  const [performance, setPerformance] = useState<PerformanceData>(mockPerformance);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [activeDemo, setActiveDemo] = useState<"no_trade" | "long">("no_trade");

  const fetchAll = useCallback(async () => {
    if (!API_URL) return;

    const online = await checkHealth();
    setBackendOnline(online);
    if (!online) return;

    const [decResult, histResult, perfResult] = await Promise.allSettled([
      fetchLatestDecision(),
      fetchTradeHistory(),
      fetchPerformance(),
    ]);

    if (decResult.status === "fulfilled" && decResult.value !== null) {
      setDecision(decResult.value);
      setLastRefreshed(new Date());
    }
    if (histResult.status === "fulfilled") setHistory(histResult.value);
    if (perfResult.status === "fulfilled") setPerformance(perfResult.value);
  }, []);

  useEffect(() => {
    fetchAll();
    if (!API_URL) return;
    const id = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  const displayDecision = API_URL ? decision : DEMO_DECISIONS[activeDemo];
  const displayHistory = history;
  const displayPerformance = performance;

  const headerLastUpdated = lastRefreshed
    ? formatDate(lastRefreshed.toISOString())
    : formatDate(displayDecision.news.published_at);

  return (
    <div className="min-h-screen bg-[#08080a]">
      <Header
        mode={displayDecision.mode}
        lastUpdated={headerLastUpdated}
        backendOnline={backendOnline}
      />

      <main className="mx-auto max-w-screen-2xl px-4 py-6 md:px-6">
        {!API_URL && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <span className="text-xs text-zinc-500 mr-2">Demo signal:</span>
            {(["no_trade", "long"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setActiveDemo(k)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeDemo === k
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {k === "no_trade" ? "NO_TRADE (blocked)" : "LONG (active)"}
              </button>
            ))}
            <span className="ml-auto text-xs text-zinc-600">
              Set <code className="text-zinc-500">NEXT_PUBLIC_API_URL</code> to connect backend
            </span>
          </div>
        )}

        {/* ── Row 1: Decision hero + blocking reasons ── */}
        <div
          className={`mb-4 grid gap-4 ${
            !displayDecision.trade_allowed ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          <DecisionHeroCard data={displayDecision} />
          {!displayDecision.trade_allowed && (
            <BlockingReasonsCard reasons={displayDecision.blocking_reasons} />
          )}
        </div>

        {/* ── Row 2: Score breakdown (full width) ── */}
        <div className="mb-4">
          <ScoreBreakdown scores={displayDecision.scores} />
        </div>

        {/* ── Row 3: News + Market data ── */}
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NewsCard news={displayDecision.news} />
          <MarketDataPanel data={displayDecision.market_data} />
        </div>

        {/* ── Row 4: Technical + Market context ── */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TechnicalDataPanel data={displayDecision.technical_data} />
          <MarketContextPanel data={displayDecision.market_context} />
        </div>

        {/* ── Row 5: Trade plan + Exit plan ── */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TradePlanPanel plan={displayDecision.trade_plan} />
          <ExitPlanPanel plan={displayDecision.exit_plan} />
        </div>

        {/* ── Row 6: Price chart + Watchlist ── */}
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PriceChartPanel ticker={displayDecision.ticker} />
          </div>
          <WatchlistPanel />
        </div>

        {/* ── Row 7: Trade history ── */}
        <div className="mb-4">
          <TradeHistoryPanel history={displayHistory} />
        </div>

        {/* ── Row 7: Performance ── */}
        <div className="mb-4">
          <PerformancePanel data={displayPerformance} />
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-700">
        Signal Dashboard · Paper Trading Mode · No financial advice
      </footer>
    </div>
  );
}
