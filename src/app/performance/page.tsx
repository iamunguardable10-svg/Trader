"use client";

import { useState, useEffect, useCallback } from "react";
import { PerformanceData, TradeHistoryEntry } from "@/types/trade";
import { fetchPerformance, fetchTradeHistory } from "@/lib/api";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { TradeHistoryPanel } from "@/components/dashboard/TradeHistoryPanel";
import { mockPerformance, mockTradeHistory } from "@/data/mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function PerformancePage() {
  const [performance, setPerformance] = useState<PerformanceData>(mockPerformance);
  const [history,     setHistory    ] = useState<TradeHistoryEntry[]>(mockTradeHistory);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    const [perf, hist] = await Promise.allSettled([fetchPerformance(), fetchTradeHistory()]);
    if (perf.status === "fulfilled") setPerformance(perf.value);
    if (hist.status === "fulfilled") setHistory(hist.value);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-4">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-zinc-100">Performance</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Paper trading statistics and trade history</p>
      </div>
      <PerformancePanel data={performance} />
      <TradeHistoryPanel history={history} />
    </div>
  );
}
