"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { TradeDecision } from "@/types/trade";
import { WatchlistEntry } from "@/lib/api";
import { fetchDecisions, fetchWatchlist } from "@/lib/api";
import { mockDecision, mockDecisionLong } from "@/data/mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS = 30_000;

type DataState = {
  signals:          TradeDecision[];
  watchlistEntries: WatchlistEntry[];
  watchlistTickers: string[];
  loading:          boolean;
  refresh:          () => void;
};

const DataContext = createContext<DataState>({
  signals:          [],
  watchlistEntries: [],
  watchlistTickers: [],
  loading:          false,
  refresh:          () => {},
});

export function useData() {
  return useContext(DataContext);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [signals,          setSignals         ] = useState<TradeDecision[]>(API_URL ? [] : [mockDecisionLong, mockDecision]);
  const [watchlistEntries, setWatchlistEntries] = useState<WatchlistEntry[]>([]);
  const [loading,          setLoading         ] = useState(!!API_URL);
  const initialLoad = useRef(true);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try {
      const [data, wl] = await Promise.allSettled([fetchDecisions(), fetchWatchlist()]);
      if (data.status === "fulfilled" && data.value.length > 0) setSignals(data.value);
      if (wl.status   === "fulfilled") setWatchlistEntries(wl.value);
    } finally {
      if (initialLoad.current) { setLoading(false); initialLoad.current = false; }
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    window.addEventListener("backend-online", refresh);
    return () => { clearInterval(id); window.removeEventListener("backend-online", refresh); };
  }, [refresh]);

  const watchlistTickers = watchlistEntries.map((e) => e.ticker);

  return (
    <DataContext.Provider value={{ signals, watchlistEntries, watchlistTickers, loading, refresh }}>
      {children}
    </DataContext.Provider>
  );
}
