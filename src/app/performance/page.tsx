"use client";

import { useState, useEffect, useCallback } from "react";
import { PerformanceData, TradeHistoryEntry } from "@/types/trade";
import { fetchPerformance, fetchTradeHistory, fetchLiveReadiness, LiveReadiness, LiveCriterion } from "@/lib/api";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { TradeHistoryPanel } from "@/components/dashboard/TradeHistoryPanel";
import { mockPerformance, mockTradeHistory } from "@/data/mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function StatusDot({ status }: { status: LiveCriterion["status"] }) {
  const colors = { pass: "bg-emerald-500", fail: "bg-red-500", pending: "bg-zinc-600" };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
}

function LiveReadinessCard({ data }: { data: LiveReadiness }) {
  const entries = Object.values(data.criteria);
  const passed  = entries.filter(c => c.status === "pass").length;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Live-Go Readiness</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {data.total_trades} completed trades · {passed}/{entries.length} criteria met
          </p>
        </div>
        <span className={`rounded-lg px-3 py-1 text-xs font-bold ${
          data.ready
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
        }`}>
          {data.ready ? "READY TO GO LIVE" : "NOT READY YET"}
        </span>
      </div>

      <div className="space-y-2">
        {entries.map((c, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <StatusDot status={c.status} />
              {c.label}
            </div>
            <div className="flex items-center gap-3 text-right">
              <span className={
                c.status === "pass" ? "text-emerald-400" :
                c.status === "fail" ? "text-red-400" : "text-zinc-500"
              }>
                {c.actual}
              </span>
              <span className="text-zinc-600 w-20 text-right">
                {c.status === "fail" ? `need ${c.required}` : `/ ${c.required}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [performance,   setPerformance  ] = useState<PerformanceData>(mockPerformance);
  const [history,       setHistory      ] = useState<TradeHistoryEntry[]>(mockTradeHistory);
  const [liveReadiness, setLiveReadiness] = useState<LiveReadiness | null>(null);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    const [perf, hist, live] = await Promise.allSettled([
      fetchPerformance(),
      fetchTradeHistory(),
      fetchLiveReadiness(),
    ]);
    if (perf.status === "fulfilled") setPerformance(perf.value);
    if (hist.status === "fulfilled") setHistory(hist.value);
    if (live.status === "fulfilled") setLiveReadiness(live.value);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("backend-online", refresh);
    return () => window.removeEventListener("backend-online", refresh);
  }, [refresh]);

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-4">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-zinc-100">Performance</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Paper trading statistics and trade history</p>
      </div>
      {liveReadiness && <LiveReadinessCard data={liveReadiness} />}
      <PerformancePanel data={performance} />
      <TradeHistoryPanel history={history} />
    </div>
  );
}
