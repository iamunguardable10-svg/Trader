"use client";

import { useState, useEffect, useCallback } from "react";
import { TradeDecision } from "@/types/trade";
import { mockDecision, mockDecisionLong } from "@/data/mockData";
import { fetchDecisions, fetchWatchlist } from "@/lib/api";
import { OpportunityCards } from "@/components/dashboard/OpportunityCards";
import { SignalsTable } from "@/components/dashboard/SignalsTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS  = 30_000;

const MOCK_SIGNALS: TradeDecision[] = [mockDecisionLong, mockDecision];

export default function DashboardPage() {
  const [signals,          setSignals         ] = useState<TradeDecision[]>(API_URL ? [] : MOCK_SIGNALS);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try {
      const [data, wl] = await Promise.allSettled([fetchDecisions(), fetchWatchlist()]);
      if (data.status === "fulfilled" && data.value.length > 0) setSignals(data.value);
      if (wl.status   === "fulfilled") setWatchlistTickers(wl.value.map((e) => e.ticker));
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    refresh();
    if (!API_URL) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Top section title */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-zinc-100">Dashboard</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {signals.length > 0
            ? `${signals.length} signals · Updated live`
            : API_URL
              ? "Waiting for first signals…"
              : "Demo mode — connect backend for live signals"}
        </p>
      </div>

      {/* Top opportunities */}
      <OpportunityCards signals={signals} />

      {/* All signals table */}
      <SignalsTable signals={signals} watchlistTickers={watchlistTickers} />
    </div>
  );
}
