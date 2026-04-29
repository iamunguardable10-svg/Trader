"use client";

import { useState, useEffect, useCallback } from "react";
import { PerformanceData, TradeDecision, TradeHistoryEntry } from "@/types/trade";
import { mockDecision, mockDecisionLong, mockPerformance, mockTradeHistory } from "@/data/mockData";
import { checkHealth, fetchLatestDecision, fetchTradeHistory, fetchPerformance } from "@/lib/api";
import { Header } from "@/components/dashboard/Header";
import { WatchlistStrip } from "@/components/dashboard/WatchlistStrip";
import { SignalsPanel } from "@/components/dashboard/SignalsPanel";
import { TradeHistoryPanel } from "@/components/dashboard/TradeHistoryPanel";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { formatDate } from "@/lib/utils";

const API_URL       = process.env.NEXT_PUBLIC_API_URL;
const POLL_INTERVAL = 30_000;
const MOCK_SIGNALS: TradeDecision[] = [mockDecisionLong, mockDecision];

export default function DashboardPage() {
  const [latestDecision, setLatestDecision] = useState<TradeDecision>(mockDecision);
  const [history,        setHistory       ] = useState<TradeHistoryEntry[]>(mockTradeHistory);
  const [performance,    setPerformance   ] = useState<PerformanceData>(mockPerformance);
  const [backendOnline,  setBackendOnline ] = useState(false);
  const [lastRefreshed,  setLastRefreshed ] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!API_URL) return;
    const online = await checkHealth();
    setBackendOnline(online);
    if (!online) return;
    const [decResult, histResult, perfResult] = await Promise.allSettled([
      fetchLatestDecision(), fetchTradeHistory(), fetchPerformance(),
    ]);
    if (decResult.status === "fulfilled" && decResult.value) {
      setLatestDecision(decResult.value);
      setLastRefreshed(new Date());
    }
    if (histResult.status === "fulfilled") setHistory(histResult.value);
    if (perfResult.status === "fulfilled") setPerformance(perfResult.value);
  }, []);

  useEffect(() => {
    fetchAll();
    if (!API_URL) return;
    const id = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAll]);

  const headerDate = lastRefreshed
    ? formatDate(lastRefreshed.toISOString())
    : formatDate(latestDecision.news.published_at);

  return (
    <div className="min-h-screen bg-[#08080a] flex flex-col">
      <Header mode={latestDecision.mode} lastUpdated={headerDate} backendOnline={backendOnline} />

      <div className="flex-1 mx-auto w-full max-w-screen-xl px-4 py-6 md:px-6">
        {/* Horizontal watchlist strip */}
        <WatchlistStrip />

        {/* All signals */}
        <SignalsPanel fallbackSignals={API_URL ? [] : MOCK_SIGNALS} />

        {/* Account-level panels */}
        <div className="mt-6 space-y-4">
          <TradeHistoryPanel history={history} />
          <PerformancePanel  data={performance} />
        </div>
      </div>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-700">
        Signal Dashboard · Paper Trading Mode · No financial advice
      </footer>
    </div>
  );
}
