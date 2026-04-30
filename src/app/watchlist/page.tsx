"use client";

import { useState } from "react";
import Link from "next/link";
import { addToWatchlist, removeFromWatchlist } from "@/lib/api";
import { useData } from "@/contexts/DataContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function WatchlistPage() {
  const { watchlistEntries, refresh } = useData();
  const [input, setInput] = useState("");

  async function handleAdd() {
    const t = input.trim().toUpperCase();
    if (!t || !API_URL) return;
    await addToWatchlist(t).catch(() => {});
    setInput("");
    refresh();
  }

  async function handleRemove(ticker: string) {
    if (!API_URL) return;
    await removeFromWatchlist(ticker).catch(() => {});
    refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-md mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-zinc-100">Watchlist</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Manage and monitor your tracked tickers</p>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add ticker…" maxLength={6}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button onClick={handleAdd} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors">
          Add
        </button>
      </div>

      {watchlistEntries.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-500">{API_URL ? "No tickers yet — add one above" : "Connect backend to manage watchlist"}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                {["Ticker", "Price", "Day Change", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {watchlistEntries.map((e) => {
                const pos = (e.day_change_pct ?? 0) >= 0;
                return (
                  <tr key={e.ticker} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="px-4 py-3">
                      <Link href={`/stock/${e.ticker}`} className="font-bold text-zinc-100 hover:text-emerald-400 transition-colors">
                        {e.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {e.price !== null ? `$${e.price.toFixed(2)}` : "—"}
                    </td>
                    <td className={`px-4 py-3 font-medium ${pos ? "text-emerald-400" : "text-red-400"}`}>
                      {e.day_change_pct !== null ? `${pos ? "+" : ""}${e.day_change_pct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleRemove(e.ticker)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
