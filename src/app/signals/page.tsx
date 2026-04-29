"use client";

import { useState, useEffect, useCallback } from "react";
import { TradeDecision } from "@/types/trade";
import { fetchDecisions, fetchWatchlist } from "@/lib/api";
import { SignalsTable } from "@/components/dashboard/SignalsTable";
import { mockDecision, mockDecisionLong } from "@/data/mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS  = 30_000;

export default function SignalsPage() {
  const [signals,          setSignals         ] = useState<TradeDecision[]>(API_URL ? [] : [mockDecisionLong, mockDecision]);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    const [data, wl] = await Promise.allSettled([fetchDecisions(), fetchWatchlist()]);
    if (data.status === "fulfilled" && data.value.length > 0) setSignals(data.value);
    if (wl.status   === "fulfilled") setWatchlistTickers(wl.value.map((e) => e.ticker));
  }, []);

  useEffect(() => {
    refresh();
    if (!API_URL) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-zinc-100">All Signals</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{signals.length} total signals from all tracked tickers</p>
      </div>
      <SignalsTable signals={signals} watchlistTickers={watchlistTickers} />
    </div>
  );
}
