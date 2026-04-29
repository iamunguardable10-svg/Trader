"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchChartData, fetchSignalsForTicker, OHLCVBar,
} from "@/lib/api";
import { TradeDecision } from "@/types/trade";
import {
  getDecisionColor, getDecisionBg, getDecisionBorder,
  getFinalScoreColor, formatDate,
} from "@/lib/utils";
import { DecisionHeroCard } from "@/components/dashboard/DecisionHeroCard";
import { BlockingReasonsCard } from "@/components/dashboard/BlockingReasonsCard";
import { ScoreBreakdown } from "@/components/dashboard/ScoreBreakdown";
import { NewsCard } from "@/components/dashboard/NewsCard";
import { MarketDataPanel } from "@/components/dashboard/MarketDataPanel";
import { TechnicalDataPanel } from "@/components/dashboard/TechnicalDataPanel";
import { MarketContextPanel } from "@/components/dashboard/MarketContextPanel";
import { TradePlanPanel } from "@/components/dashboard/TradePlanPanel";
import { ExitPlanPanel } from "@/components/dashboard/ExitPlanPanel";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Period   = "1d" | "5d" | "1mo";
type Interval = "5m" | "15m" | "1h" | "1d";

const PERIOD_CFG: Record<Period, { interval: Interval; label: string }> = {
  "1d":  { interval: "5m",  label: "1D" },
  "5d":  { interval: "15m", label: "5D" },
  "1mo": { interval: "1d",  label: "1M" },
};

const DECISION_ICON: Record<string, string> = { LONG: "▲", SHORT: "▼", NO_TRADE: "◼" };

// ── chart tooltip ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as OHLCVBar;
  const isUp = d.close >= d.open;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl space-y-0.5">
      <p className="text-zinc-400">{label}</p>
      <p className={`font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>${d.close.toFixed(2)}</p>
      <p className="text-zinc-500">O {d.open.toFixed(2)} · H {d.high.toFixed(2)} · L {d.low.toFixed(2)}</p>
      <p className="text-zinc-500">Vol {d.volume.toLocaleString()}</p>
    </div>
  );
}

// ── signal row in the sidebar list ───────────────────────────────────────────
function SignalRow({
  signal, selected, onClick,
}: {
  signal: TradeDecision; selected: boolean; onClick: () => void;
}) {
  const time = signal.logged_at ? formatDate(signal.logged_at) : formatDate(signal.news.published_at);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all
        ${selected
          ? `${getDecisionBg(signal.decision)} ${getDecisionBorder(signal.decision)}`
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${getDecisionColor(signal.decision)}`}>
          {DECISION_ICON[signal.decision]} {signal.decision}
        </span>
        <span className={`text-xs font-bold ${getFinalScoreColor(signal.final_score)}`}>
          {signal.final_score > 0 ? "+" : ""}{signal.final_score.toFixed(1)}
        </span>
      </div>
      <p className="text-xs text-zinc-500 mt-0.5 truncate">{signal.news.headline}</p>
      <p className="text-xs text-zinc-700 mt-0.5">{time}</p>
    </button>
  );
}

// ── main page ────────────────────────────────────────────────────────────────
export default function StockPage() {
  const params = useParams();
  const ticker = ((params?.ticker as string) ?? "").toUpperCase();

  const [bars,       setBars      ] = useState<OHLCVBar[]>([]);
  const [signals,    setSignals   ] = useState<TradeDecision[]>([]);
  const [selected,   setSelected  ] = useState<TradeDecision | null>(null);
  const [period,     setPeriod    ] = useState<Period>("1d");
  const [simulate,   setSimulate  ] = useState(false);
  const [chartLoading, setChartLoading] = useState(true);

  const loadChart = useCallback(async (p: Period) => {
    if (!API_URL || !ticker) return;
    setChartLoading(true);
    try {
      const { interval } = PERIOD_CFG[p];
      setBars(await fetchChartData(ticker, p, interval));
    } catch { setBars([]); }
    finally { setChartLoading(false); }
  }, [ticker]);

  const loadSignals = useCallback(async () => {
    if (!API_URL || !ticker) return;
    try {
      const data = await fetchSignalsForTicker(ticker);
      setSignals(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } catch { /* keep empty */ }
  }, [ticker, selected]);

  useEffect(() => {
    loadChart(period);
  }, [loadChart, period]);

  useEffect(() => {
    loadSignals();
    const id = setInterval(loadSignals, 30_000);
    return () => clearInterval(id);
  }, [loadSignals]);

  // current price info
  const lastBar    = bars[bars.length - 1];
  const firstClose = bars[0]?.close ?? null;
  const lastClose  = lastBar?.close ?? null;
  const change     = firstClose && lastClose ? lastClose - firstClose : null;
  const changePct  = firstClose && change !== null ? (change / firstClose) * 100 : null;
  const isUp       = change === null ? true : change >= 0;
  const color      = isUp ? "#10b981" : "#f87171";
  const gradId     = isUp ? "stockGreen" : "stockRed";

  // map signal times → chart x-axis labels for simulation overlay
  const signalMarkers = simulate
    ? signals
        .filter((s) => s.logged_at || s.news.published_at)
        .map((s) => {
          const raw = new Date(s.logged_at ?? s.news.published_at);
          const label = period === "1d"
            ? raw.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
            : raw.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return { label, signal: s };
        })
    : [];

  return (
    <div className="min-h-screen bg-[#08080a]">
      {/* Top nav */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Back
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-zinc-100">{ticker}</span>
          {lastClose !== null && (
            <>
              <span className="text-lg font-mono text-zinc-200">
                ${lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {changePct !== null && (
                <span className={`text-sm font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {isUp ? "+" : ""}{change!.toFixed(2)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
                </span>
              )}
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-600">Simulation mode</span>
          <button
            onClick={() => setSimulate((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${simulate ? "bg-emerald-600" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${simulate ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">

          {/* Left: chart + analysis */}
          <div className="space-y-4">
            {/* Price chart */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Price Chart
                  {simulate && (
                    <span className="ml-2 text-emerald-500">· Simulation Mode</span>
                  )}
                </h2>
                <div className="flex items-center gap-1">
                  {(Object.keys(PERIOD_CFG) as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`rounded px-2 py-0.5 text-xs transition-colors ${
                        period === p ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {PERIOD_CFG[p].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-72 relative">
                {chartLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-zinc-600">Loading chart…</span>
                  </div>
                )}
                {!chartLoading && bars.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bars} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis domain={["auto", "auto"]} tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={48} />
                      {firstClose && <ReferenceLine y={firstClose} stroke="#52525b" strokeDasharray="4 4" strokeWidth={1} />}
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, fill: color }} />
                      {/* Simulation: signal markers */}
                      {signalMarkers.map(({ label, signal }, i) => (
                        <ReferenceLine
                          key={i}
                          x={label}
                          stroke={signal.decision === "LONG" ? "#10b981" : signal.decision === "SHORT" ? "#f87171" : "#71717a"}
                          strokeDasharray="3 3"
                          label={{
                            value: DECISION_ICON[signal.decision],
                            position: "top",
                            fill: signal.decision === "LONG" ? "#10b981" : signal.decision === "SHORT" ? "#f87171" : "#71717a",
                            fontSize: 12,
                          }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {!chartLoading && bars.length === 0 && !API_URL && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs text-zinc-600">Set NEXT_PUBLIC_API_URL to load real charts</p>
                  </div>
                )}
              </div>

              {/* Simulation legend */}
              {simulate && signalMarkers.length > 0 && (
                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                  <span className="text-emerald-400">▲ LONG signal</span>
                  <span className="text-red-400">▼ SHORT signal</span>
                  <span className="text-zinc-500">◼ NO TRADE signal</span>
                  <span className="ml-auto">{signalMarkers.length} signals shown</span>
                </div>
              )}
              {simulate && signalMarkers.length === 0 && (
                <p className="mt-2 text-xs text-zinc-600">No signals logged for {ticker} yet</p>
              )}
            </div>

            {/* Selected signal analysis */}
            {selected && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-widest">
                  <div className="flex-1 h-px bg-zinc-800" />
                  Latest Analysis
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                <div className={`grid gap-4 ${!selected.trade_allowed ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                  <DecisionHeroCard data={selected} />
                  {!selected.trade_allowed && <BlockingReasonsCard reasons={selected.blocking_reasons} />}
                </div>

                <ScoreBreakdown scores={selected.scores} />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <NewsCard news={selected.news} />
                  {selected.market_data && <MarketDataPanel data={selected.market_data} />}
                </div>

                {(selected.technical_data || selected.market_context) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {selected.technical_data && <TechnicalDataPanel data={selected.technical_data} />}
                    {selected.market_context && <MarketContextPanel data={selected.market_context} />}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TradePlanPanel plan={selected.trade_plan} />
                  <ExitPlanPanel  plan={selected.exit_plan} />
                </div>
              </div>
            )}
          </div>

          {/* Right: signal history for this ticker */}
          <aside className="lg:sticky lg:top-6 lg:self-start space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Signal History · {ticker}
              </h3>
              <span className="text-xs text-zinc-600">{signals.length} total</span>
            </div>

            {signals.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
                <p className="text-xs text-zinc-600">No signals yet for {ticker}</p>
              </div>
            ) : (
              signals.map((s, i) => (
                <SignalRow
                  key={s.id ?? i}
                  signal={s}
                  selected={selected === s || (!!s.id && s.id === selected?.id)}
                  onClick={() => setSelected(s)}
                />
              ))
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
