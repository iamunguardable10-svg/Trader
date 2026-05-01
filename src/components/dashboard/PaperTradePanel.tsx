"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PaperPosition,
  fetchPositionForTicker,
  openPaperTrade,
  closePaperTrade,
} from "@/lib/api";
import { TradeDecision } from "@/types/trade";

interface Props {
  ticker: string;
  signal: TradeDecision | null;
  currentPrice: number | null;
  /** Position managed externally (page polls it); if provided, skip internal fetch */
  externalPosition?: PaperPosition | null;
  onPositionChange?: () => void;
}

function PnlBadge({ value, pct }: { value: number; pct: number }) {
  const pos = value >= 0;
  return (
    <div className={`rounded-lg px-3 py-1.5 text-center ${pos ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
      <p className={`text-xl font-black font-mono ${pos ? "text-emerald-400" : "text-red-400"}`}>
        {pos ? "+" : ""}${value.toFixed(2)}
      </p>
      <p className={`text-xs font-medium ${pos ? "text-emerald-500" : "text-red-500"}`}>
        {pos ? "+" : ""}{pct.toFixed(2)}%
      </p>
    </div>
  );
}

export function PaperTradePanel({ ticker, signal, currentPrice, externalPosition, onPositionChange }: Props) {
  const [internalPosition, setInternalPosition] = useState<PaperPosition | null>(null);
  const [customSL,   setCustomSL  ] = useState<string>("");
  const [useCustomSL, setUseCustomSL] = useState(false);
  const [customSize, setCustomSize] = useState<string>("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Use external position if provided, otherwise manage internally
  const position = externalPosition !== undefined ? externalPosition : internalPosition;
  const applyPosition = externalPosition !== undefined
    ? (_: PaperPosition | null) => { /* parent owns state */ }
    : setInternalPosition;

  const refresh = useCallback(async () => {
    if (externalPosition !== undefined) return; // parent manages it
    try {
      setInternalPosition(await fetchPositionForTicker(ticker));
    } catch {
      setInternalPosition(null);
    }
  }, [ticker, externalPosition]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const plan = signal?.trade_plan;
  const suggestedSL = plan?.stop_loss ?? null;
  const suggestedTP = plan?.take_profit ?? null;
  const entryPrice  = plan?.entry_price ?? currentPrice;
  const posSize     = plan?.position_size ?? 1;

  async function handleOpen() {
    if (!signal?.id) return;
    setLoading(true); setError(null);
    try {
      const sl   = useCustomSL && customSL ? parseFloat(customSL) : undefined;
      const size = customSize ? Math.max(1, Math.round(parseFloat(customSize))) : undefined;
      const pos  = await openPaperTrade(signal.id, sl, size);
      applyPosition(pos);
      onPositionChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open trade");
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    if (!position) return;
    setLoading(true); setError(null);
    try {
      await closePaperTrade(position.id, "manual");
      applyPosition(null);
      onPositionChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close trade");
    } finally {
      setLoading(false);
    }
  }

  // ── Open position view ────────────────────────────────────────────────────
  if (position) {
    const price = currentPrice ?? position.current_price ?? position.entry_price;
    const pnl   = position.live_pnl  ?? ((price - position.entry_price) * position.position_size * (position.direction === "LONG" ? 1 : -1));
    const pnlPct= position.live_pnl_pct ?? ((price - position.entry_price) / position.entry_price * 100 * (position.direction === "LONG" ? 1 : -1));

    const slPct = Math.abs((position.stop_loss - position.entry_price) / position.entry_price * 100);
    const tpPct = Math.abs((position.take_profit - position.entry_price) / position.entry_price * 100);

    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${pnl >= 0 ? "bg-emerald-400" : "bg-red-400"}`} />
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Open Position</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${position.direction === "LONG" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            {position.direction}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-zinc-600 mb-0.5">Entry</p>
            <p className="text-sm font-mono font-bold text-zinc-200">${position.entry_price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-600 mb-0.5">Current</p>
            <p className="text-sm font-mono font-bold text-zinc-200">${price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-600 mb-0.5">Stop Loss</p>
            <p className="text-sm font-mono text-red-400">${position.stop_loss.toFixed(2)} <span className="text-xs text-zinc-600">(-{slPct.toFixed(1)}%)</span></p>
          </div>
          <div>
            <p className="text-xs text-zinc-600 mb-0.5">Take Profit</p>
            <p className="text-sm font-mono text-emerald-400">${position.take_profit.toFixed(2)} <span className="text-xs text-zinc-600">(+{tpPct.toFixed(1)}%)</span></p>
          </div>
        </div>

        <PnlBadge value={pnl} pct={pnlPct} />

        <div className="flex gap-2 text-xs text-zinc-600">
          <span>{position.position_size} shares</span>
          <span>·</span>
          <span>Opened {new Date(position.entry_time).toLocaleTimeString()}</span>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleClose}
          disabled={loading}
          className="w-full rounded-xl bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-semibold py-2.5 transition-colors"
        >
          {loading ? "Closing…" : "Close Trade"}
        </button>
      </div>
    );
  }

  // ── No open position — show open panel ───────────────────────────────────
  const canOpen = signal && (signal.decision === "LONG" || signal.decision === "SHORT") && signal.trade_allowed;

  if (!canOpen) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Paper Trading</p>
        <p className="text-xs text-zinc-600 mt-1">
          {!signal ? "No signal for this ticker yet" : "Signal is NO_TRADE — no trade allowed"}
        </p>
      </div>
    );
  }

  const isLong = signal.decision === "LONG";

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Paper Trading</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isLong ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {signal.decision}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-zinc-600 mb-0.5">Entry Price</p>
          <p className="font-mono text-zinc-200">${entryPrice?.toFixed(2) ?? "—"}</p>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Algo Size</p>
          <p className="font-mono text-zinc-200">{posSize} shares</p>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Algo Stop Loss</p>
          <p className="font-mono text-red-400">${suggestedSL?.toFixed(2) ?? "—"}</p>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Take Profit</p>
          <p className="font-mono text-emerald-400">${suggestedTP?.toFixed(2) ?? "—"}</p>
        </div>
      </div>

      {/* Position size override */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1.5">
          Position size <span className="text-zinc-600">(shares)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="1"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            placeholder={String(posSize)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {entryPrice && customSize && (
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              ≈ ${(parseFloat(customSize) * entryPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </div>

      {/* Custom stop loss */}
      <div>
        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none mb-1.5">
          <input
            type="checkbox"
            checked={useCustomSL}
            onChange={(e) => setUseCustomSL(e.target.checked)}
            className="accent-emerald-500"
          />
          Custom stop loss
        </label>
        {useCustomSL && (
          <input
            type="number"
            step="0.01"
            value={customSL}
            onChange={(e) => setCustomSL(e.target.value)}
            placeholder={suggestedSL?.toFixed(2) ?? "Stop loss price"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleOpen}
        disabled={loading}
        className={`w-full rounded-xl disabled:opacity-40 text-white text-sm font-semibold py-2.5 transition-colors ${
          isLong ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
        }`}
      >
        {loading ? "Opening…" : isLong ? "▲ Buy (Paper)" : "▼ Short (Paper)"}
      </button>
    </div>
  );
}
