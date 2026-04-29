"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchWatchlist, addToWatchlist, removeFromWatchlist, WatchlistEntry } from "@/lib/api";

const API_URL   = process.env.NEXT_PUBLIC_API_URL;
const REFRESH_MS = 30_000;

export function WatchlistStrip() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [input,   setInput  ] = useState("");
  const [adding,  setAdding ] = useState(false);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try { setEntries(await fetchWatchlist()); } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleAdd() {
    const t = input.trim().toUpperCase();
    if (!t || !API_URL) return;
    await addToWatchlist(t).catch(() => {});
    setInput("");
    setAdding(false);
    refresh();
  }

  async function handleRemove(e: React.MouseEvent, ticker: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!API_URL) return;
    await removeFromWatchlist(ticker).catch(() => {});
    refresh();
  }

  if (!API_URL) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
      <span className="text-xs text-zinc-600 shrink-0 uppercase tracking-widest">Watchlist</span>

      {entries.map((e) => {
        const pos = (e.day_change_pct ?? 0) >= 0;
        return (
          <Link
            key={e.ticker}
            href={`/stock/${e.ticker}`}
            className="group flex items-center gap-2 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 hover:border-zinc-600 transition-colors"
          >
            <span className="text-xs font-bold text-zinc-200">{e.ticker}</span>
            {e.price !== null && (
              <span className="text-xs font-mono text-zinc-400">
                ${e.price.toFixed(2)}
              </span>
            )}
            {e.day_change_pct !== null && (
              <span className={`text-xs font-medium ${pos ? "text-emerald-400" : "text-red-400"}`}>
                {pos ? "+" : ""}{e.day_change_pct.toFixed(2)}%
              </span>
            )}
            <button
              onClick={(ev) => handleRemove(ev, e.ticker)}
              className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs leading-none ml-0.5"
            >✕</button>
          </Link>
        );
      })}

      {/* Add ticker */}
      {adding ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            placeholder="TICKER"
            maxLength={6}
            className="w-20 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
          />
          <button onClick={handleAdd} className="text-xs text-emerald-400 hover:text-emerald-300">Add</button>
          <button onClick={() => setAdding(false)} className="text-xs text-zinc-600 hover:text-zinc-400">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 hover:border-zinc-500 transition-colors"
        >
          + Add
        </button>
      )}
    </div>
  );
}
