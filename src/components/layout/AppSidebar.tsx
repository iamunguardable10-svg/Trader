"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchChartData, addToWatchlist, WatchlistEntry } from "@/lib/api";
import { useData } from "@/contexts/DataContext";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const pts = data.map((v, i) => ({ v, i }));
  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <Line type="monotone" dataKey="v" stroke={up ? "#10b981" : "#f87171"} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function WatchlistRow({ entry }: { entry: WatchlistEntry & { closes?: number[] } }) {
  const up  = (entry.day_change_pct ?? 0) >= 0;
  return (
    <Link
      href={`/stock/${entry.ticker}`}
      className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-zinc-100">{entry.ticker}</p>
        <p className={`text-xs font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? "+" : ""}{(entry.day_change_pct ?? 0).toFixed(2)}%
        </p>
      </div>
      {entry.closes && entry.closes.length > 2 && (
        <Sparkline data={entry.closes} up={up} />
      )}
      <div className="text-right ml-2">
        <p className="text-xs font-mono text-zinc-300">
          {entry.price !== null ? `$${entry.price.toFixed(2)}` : "—"}
        </p>
      </div>
    </Link>
  );
}

export function AppSidebar({ backendOnline, onClose }: { backendOnline?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { watchlistEntries, refresh: refreshData } = useData();
  const [entries, setEntries] = useState<(WatchlistEntry & { closes?: number[] })[]>([]);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding]    = useState(false);

  // Enrich watchlist entries with sparkline data
  const enrichSparklines = useCallback(async (wl: WatchlistEntry[]) => {
    if (!API_URL || wl.length === 0) return;
    const enriched = await Promise.all(
      wl.map(async (e) => {
        try {
          const bars = await fetchChartData(e.ticker, "1d", "15m");
          return { ...e, closes: bars.map((b) => b.close) };
        } catch {
          return e;
        }
      })
    );
    setEntries(enriched);
  }, []);

  useEffect(() => {
    enrichSparklines(watchlistEntries);
  }, [watchlistEntries, enrichSparklines]);

  async function handleAdd() {
    const t = addInput.trim().toUpperCase();
    if (!t || !API_URL) return;
    await addToWatchlist(t).catch(() => {});
    setAddInput(""); setAdding(false);
    refreshData();
  }

  const navItems = [
    { href: "/",            label: "Dashboard",      icon: "⊞" },
    { href: "/signals",     label: "Signals",        icon: "⚡" },
    { href: "/watchlist",   label: "Watchlist",      icon: "★" },
    { href: "/simulation",  label: "Simulation Lab", icon: "⚗" },
    { href: "/performance", label: "Performance",    icon: "📊" },
    { href: "/backtest",    label: "Backtest",       icon: "⏱" },
    { href: "/debug",       label: "Score Tester",   icon: "🔬" },
  ];

  return (
    <aside className="flex flex-col h-full w-56 border-r border-zinc-800 bg-zinc-950 shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold">S</div>
          <span className="text-sm font-bold text-zinc-100 tracking-tight">SignalEdge</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        )}
      </div>

      {/* Nav */}
      <nav className="px-2 py-3 space-y-0.5 border-b border-zinc-800">
        {navItems.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <span className="text-sm">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Watchlist */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Watchlist</span>
          {API_URL && (
            <button onClick={() => setAdding(true)} className="text-xs text-zinc-600 hover:text-zinc-400">+ Add</button>
          )}
        </div>

        {adding && (
          <div className="flex items-center gap-1 px-2 mb-2">
            <input
              autoFocus value={addInput}
              onChange={(e) => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="TICKER" maxLength={6}
              className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
            />
            <button onClick={handleAdd} className="text-xs text-emerald-400">✓</button>
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-600">✕</button>
          </div>
        )}

        {entries.length === 0 && !adding && (
          <p className="text-xs text-zinc-700 px-2">
            {API_URL ? "No tickers — click + Add" : "Connect backend to see watchlist"}
          </p>
        )}

        {entries.map((e) => <WatchlistRow key={e.ticker} entry={e} />)}
      </div>

      {/* Footer: mode + status */}
      <div className="px-4 py-3 border-t border-zinc-800 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-400">Paper Trading</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-xs text-zinc-500">{backendOnline ? "Backend Online" : "Backend Offline"}</span>
        </div>
      </div>
    </aside>
  );
}
