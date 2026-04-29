"use client";

import { useState } from "react";
import { TradeDecision } from "@/types/trade";
import { mockDecision, mockDecisionLong, mockPerformance, mockTradeHistory } from "@/data/mockData";
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
import { formatDate } from "@/lib/utils";

const DEMO_DECISIONS: Record<string, TradeDecision> = {
  no_trade: mockDecision,
  long:     mockDecisionLong,
};

export default function DashboardPage() {
  const [activeDemo, setActiveDemo] = useState<"no_trade" | "long">("no_trade");
  const decision = DEMO_DECISIONS[activeDemo];

  return (
    <div className="min-h-screen bg-[#08080a]">
      <Header
        mode={decision.mode}
        lastUpdated={formatDate(decision.news.published_at)}
        backendOnline={false}
      />

      <main className="mx-auto max-w-screen-2xl px-4 py-6 md:px-6">
        {/* Demo switcher — remove when connecting to real API */}
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
            Connect backend via <code className="text-zinc-500">NEXT_PUBLIC_API_URL</code>
          </span>
        </div>

        {/* ── Row 1: Decision hero + blocking reasons ── */}
        <div className={`mb-4 grid gap-4 ${!decision.trade_allowed ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          <DecisionHeroCard data={decision} />
          {!decision.trade_allowed && (
            <BlockingReasonsCard reasons={decision.blocking_reasons} />
          )}
        </div>

        {/* ── Row 2: Score breakdown (full width) ── */}
        <div className="mb-4">
          <ScoreBreakdown scores={decision.scores} />
        </div>

        {/* ── Row 3: News + Market data ── */}
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NewsCard news={decision.news} />
          <MarketDataPanel data={decision.market_data} />
        </div>

        {/* ── Row 4: Technical + Market context ── */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TechnicalDataPanel data={decision.technical_data} />
          <MarketContextPanel data={decision.market_context} />
        </div>

        {/* ── Row 5: Trade plan + Exit plan (null-safe) ── */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TradePlanPanel plan={decision.trade_plan} />
          <ExitPlanPanel  plan={decision.exit_plan} />
        </div>

        {/* ── Row 6: Trade history ── */}
        <div className="mb-4">
          <TradeHistoryPanel history={mockTradeHistory} />
        </div>

        {/* ── Row 7: Performance ── */}
        <div className="mb-4">
          <PerformancePanel data={mockPerformance} />
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-700">
        Signal Dashboard · Paper Trading Mode · No financial advice
      </footer>
    </div>
  );
}
