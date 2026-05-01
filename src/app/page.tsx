"use client";

import { useData } from "@/contexts/DataContext";
import { OpportunityCards } from "@/components/dashboard/OpportunityCards";
import { SignalsTable } from "@/components/dashboard/SignalsTable";
import { PortfolioPanel } from "@/components/dashboard/PortfolioPanel";
import { MarketStatusBanner } from "@/components/dashboard/MarketStatusBanner";
import { TradingControls } from "@/components/dashboard/TradingControls";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function DashboardPage() {
  const { signals, watchlistTickers, loading } = useData();

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-zinc-100">Dashboard</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {loading
            ? "Loading…"
            : signals.length > 0
              ? `${signals.length} signals · Updated live`
              : API_URL
                ? "Waiting for first signals…"
                : "Demo mode — connect backend for live signals"}
        </p>
      </div>

      <MarketStatusBanner />
      <TradingControls />
      <PortfolioPanel />
      <OpportunityCards signals={signals} />
      <SignalsTable signals={signals} watchlistTickers={watchlistTickers} />
    </div>
  );
}
