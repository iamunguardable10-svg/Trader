"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchOpenPositions, closePaperTrade, PaperPosition, fetchTradeHistory } from "@/lib/api";
import { TradeHistoryEntry } from "@/types/trade";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function PnlCell({ value, pct }: { value: number; pct: number }) {
  const pos = value >= 0;
  return (
    <div className={`text-right ${pos ? "text-emerald-400" : "text-red-400"}`}>
      <p className="text-sm font-bold font-mono">{pos ? "+" : ""}${value.toFixed(2)}</p>
      <p className="text-xs opacity-75">{pos ? "+" : ""}{pct.toFixed(2)}%</p>
    </div>
  );
}

export function PortfolioPanel() {
  const [positions,    setPositions   ] = useState<PaperPosition[]>([]);
  const [history,      setHistory     ] = useState<TradeHistoryEntry[]>([]);
  const [closingId,    setClosingId   ] = useState<string | null>(null);
  const [tab,          setTab         ] = useState<"open" | "closed">("open");

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try {
      const [pos, hist] = await Promise.all([
        fetchOpenPositions(),
        fetchTradeHistory(),
      ]);
      setPositions(pos);
      setHistory(hist.filter((t) => t.status === "closed"));
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleClose(id: string) {
    setClosingId(id);
    try {
      await closePaperTrade(id, "manual");
      await refresh();
    } catch { /* ignore */ }
    finally { setClosingId(null); }
  }

  // Summary stats from closed trades
  const wins     = history.filter((t) => (t.pnl ?? 0) > 0).length;
  const totalPnl = history.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winRate  = history.length > 0 ? Math.round(wins / history.length * 100) : null;

  // Live unrealised P&L across all open positions
  const unrealised = positions.reduce((s, p) => s + (p.live_pnl ?? 0), 0);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Portfolio</h2>
          {positions.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {positions.length} open
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {winRate !== null && (
            <span className="text-zinc-500">
              Win rate <span className="text-zinc-200 font-medium">{winRate}%</span>
            </span>
          )}
          <span className={`font-mono font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} realised
          </span>
          {positions.length > 0 && (
            <span className={`font-mono font-bold ${unrealised >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {unrealised >= 0 ? "+" : ""}${unrealised.toFixed(2)} open
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {(["open", "closed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "open" ? `Open (${positions.length})` : `Closed (${history.length})`}
          </button>
        ))}
      </div>

      {/* Open positions */}
      {tab === "open" && (
        positions.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-600 text-center">
            No open positions — go to a stock page → Simulate tab to open one.
          </p>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {positions.map((p) => {
              const price  = p.current_price ?? p.entry_price;
              const pnl    = p.live_pnl    ?? 0;
              const pnlPct = p.live_pnl_pct ?? 0;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    p.direction === "LONG" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {p.direction}
                  </span>

                  <Link href={`/stock/${p.ticker}`} className="text-sm font-bold text-zinc-100 hover:text-emerald-400 transition-colors min-w-[3rem]">
                    {p.ticker}
                  </Link>

                  <div className="flex-1 text-xs text-zinc-500 hidden sm:block space-y-0.5">
                    <p>Entry <span className="text-zinc-300 font-mono">${p.entry_price.toFixed(2)}</span></p>
                    <p>Now <span className="text-zinc-300 font-mono">${price.toFixed(2)}</span> · {p.position_size} shares</p>
                  </div>

                  <div className="text-xs text-zinc-600 hidden md:block space-y-0.5 text-right">
                    <p className="text-red-400">SL ${p.stop_loss.toFixed(2)}</p>
                    <p className="text-emerald-400">TP ${p.take_profit.toFixed(2)}</p>
                  </div>

                  <PnlCell value={pnl} pct={pnlPct} />

                  <button
                    onClick={() => handleClose(p.id)}
                    disabled={closingId === p.id}
                    className="ml-2 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    {closingId === p.id ? "…" : "Close"}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Closed trades */}
      {tab === "closed" && (
        history.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-600 text-center">No closed trades yet.</p>
        ) : (
          <div className="divide-y divide-zinc-800/50 max-h-64 overflow-y-auto">
            {[...history].reverse().map((t, i) => {
              const pnl    = t.pnl    ?? 0;
              const pnlPct = t.pnl_pct ?? 0;
              const pos    = pnl >= 0;
              return (
                <div key={t.id ?? i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    t.decision === "LONG" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {t.decision}
                  </span>
                  <Link href={`/stock/${t.ticker}`} className="text-sm font-bold text-zinc-100 hover:text-emerald-400 transition-colors min-w-[3rem]">
                    {t.ticker}
                  </Link>
                  <div className="flex-1 text-xs text-zinc-600">
                    <span className="text-zinc-500">{t.exit_reason ?? "manual"}</span>
                    {t.entry_price && <span className="ml-2 font-mono">${t.entry_price.toFixed(2)} → ${(t.exit_price ?? 0).toFixed(2)}</span>}
                  </div>
                  <div className={`text-right text-sm font-bold font-mono ${pos ? "text-emerald-400" : "text-red-400"}`}>
                    {pos ? "+" : ""}${pnl.toFixed(2)}
                    <p className="text-xs font-normal opacity-75">{pos ? "+" : ""}{pnlPct.toFixed(2)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
