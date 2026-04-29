"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelCard } from "@/components/ui/PanelCard";
import {
  WatchlistEntry,
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const REFRESH_MS = 30_000;

function Changebadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-zinc-600 text-xs">—</span>;
  const pos = pct >= 0;
  return (
    <span className={`text-xs font-medium ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

export function WatchlistPanel() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try {
      setEntries(await fetchWatchlist());
    } catch {
      // silently keep stale data
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleAdd() {
    const ticker = input.trim().toUpperCase();
    if (!ticker || !API_URL) return;
    try {
      await addToWatchlist(ticker);
      setInput("");
      setError(null);
      refresh();
    } catch {
      setError(`Could not add ${ticker}`);
    }
  }

  async function handleRemove(ticker: string) {
    if (!API_URL) return;
    try {
      await removeFromWatchlist(ticker);
      refresh();
    } catch {
      // ignore
    }
  }

  if (!API_URL) return null;

  return (
    <PanelCard
      title="Watchlist"
      icon="👁"
      titleRight={
        <span className="text-xs text-zinc-600">{entries.length} tickers</span>
      }
    >
      {/* Add ticker input */}
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add ticker…"
          maxLength={6}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleAdd}
          className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-600 transition-colors"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {/* Ticker list */}
      {entries.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">No tickers — add one above</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div
              key={e.ticker}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 group"
            >
              <span className="text-sm font-bold text-zinc-100 w-16">{e.ticker}</span>

              <span className="text-sm font-mono text-zinc-200">
                {e.price !== null ? `$${e.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
              </span>

              <Changebadge pct={e.day_change_pct} />

              <button
                onClick={() => handleRemove(e.ticker)}
                className="text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs ml-2"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
