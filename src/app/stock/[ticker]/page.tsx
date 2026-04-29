"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchChartData, fetchSignalsForTicker, OHLCVBar } from "@/lib/api";
import { TradeDecision } from "@/types/trade";
import {
  getDecisionColor, getDecisionBg, getDecisionBorder,
  getFinalScoreColor, formatDate, formatVolume,
} from "@/lib/utils";
import { DecisionHeroCard } from "@/components/dashboard/DecisionHeroCard";
import { BlockingReasonsCard } from "@/components/dashboard/BlockingReasonsCard";
import { ScoreBreakdown } from "@/components/dashboard/ScoreBreakdown";
import { NewsCard } from "@/components/dashboard/NewsCard";
import { TradePlanPanel } from "@/components/dashboard/TradePlanPanel";
import { ExitPlanPanel } from "@/components/dashboard/ExitPlanPanel";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Period   = "1d" | "5d" | "1mo" | "3mo";
type Interval = "5m" | "15m" | "1h" | "1d";
type Tab      = "overview" | "analysis" | "news" | "tradeplan" | "backtest";

const PERIOD_CFG: Record<Period, { interval: Interval; label: string }> = {
  "1d":  { interval: "5m",  label: "1D" },
  "5d":  { interval: "15m", label: "5D" },
  "1mo": { interval: "1h",  label: "1M" },
  "3mo": { interval: "1d",  label: "3M" },
};

const DECISION_ICON: Record<string, string> = { LONG: "▲", SHORT: "▼", NO_TRADE: "◼" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as OHLCVBar;
  const up = d.close >= d.open;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="text-zinc-400 font-medium">{label}</p>
      <p className={`font-bold text-base ${up ? "text-emerald-400" : "text-red-400"}`}>${d.close.toFixed(2)}</p>
      <div className="text-zinc-500 space-y-0.5">
        <p>Open: ${d.open.toFixed(2)} · High: ${d.high.toFixed(2)}</p>
        <p>Low: ${d.low.toFixed(2)} · Close: ${d.close.toFixed(2)}</p>
        <p>Volume: {d.volume.toLocaleString()}</p>
      </div>
    </div>
  );
}

// Semicircle score gauge using SVG
function ScoreGauge({ score }: { score: number }) {
  const norm = Math.max(-100, Math.min(100, score));
  const pct  = (norm + 100) / 200;
  const angle = pct * 180 - 90;
  const rad   = (angle * Math.PI) / 180;
  const r = 54;
  const cx = 70, cy = 70;
  const needleX = cx + r * Math.cos(rad);
  const needleY = cy + r * Math.sin(rad);

  const color = score >= 30 ? "#10b981" : score >= 0 ? "#a3e635" : score >= -30 ? "#fb923c" : "#f87171";

  // Arc path helper
  function arc(startDeg: number, endDeg: number, c: string) {
    const s = ((startDeg - 90) * Math.PI) / 180;
    const e = ((endDeg   - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    return <path d={`M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`} stroke={c} strokeWidth={8} fill="none" strokeLinecap="round" />;
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={80} viewBox="0 0 140 80">
        {/* Track */}
        <path d={`M${cx - r},${cy} A${r},${r} 0 0,1 ${cx + r},${cy}`} stroke="#27272a" strokeWidth={8} fill="none" />
        {/* Colored arc */}
        {arc(-90, angle, color)}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth={2} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4} fill={color} />
      </svg>
      <p className={`-mt-2 text-3xl font-black ${getFinalScoreColor(score)}`}>
        {score > 0 ? "+" : ""}{score.toFixed(1)}
      </p>
      <p className="text-xs text-zinc-500">/100</p>
    </div>
  );
}

export default function StockPage() {
  const params = useParams();
  const ticker = ((params?.ticker as string) ?? "").toUpperCase();

  const [bars,         setBars        ] = useState<OHLCVBar[]>([]);
  const [signals,      setSignals     ] = useState<TradeDecision[]>([]);
  const [selected,     setSelected    ] = useState<TradeDecision | null>(null);
  const [period,       setPeriod      ] = useState<Period>("1d");
  const [tab,          setTab         ] = useState<Tab>("overview");
  const [simulate,     setSimulate    ] = useState(false);
  const [chartLoading, setChartLoading] = useState(true);

  const loadChart = useCallback(async (p: Period) => {
    if (!API_URL || !ticker) return;
    setChartLoading(true);
    try {
      const { interval } = PERIOD_CFG[p];
      setBars(await fetchChartData(ticker, p, interval));
    } catch { setBars([]); }
    finally   { setChartLoading(false); }
  }, [ticker]);

  const loadSignals = useCallback(async () => {
    if (!API_URL || !ticker) return;
    try {
      const data = await fetchSignalsForTicker(ticker);
      setSignals(data);
      if (data.length > 0) setSelected((prev) => prev ?? data[0]);
    } catch { /* keep empty */ }
  }, [ticker]);

  useEffect(() => { loadChart(period); }, [loadChart, period]);
  useEffect(() => {
    loadSignals();
    const id = setInterval(loadSignals, 30_000);
    return () => clearInterval(id);
  }, [loadSignals]);

  const lastBar    = bars[bars.length - 1];
  const firstClose = bars[0]?.close ?? null;
  const lastClose  = lastBar?.close ?? null;
  const change     = firstClose && lastClose ? lastClose - firstClose : null;
  const changePct  = firstClose && change !== null ? (change / firstClose) * 100 : null;
  const isUp       = change === null ? true : change >= 0;
  const strokeColor= isUp ? "#10b981" : "#f87171";
  const gradId     = isUp ? "sg" : "sr";

  const signalMarkers = simulate
    ? signals.map((s) => {
        const raw = new Date(s.logged_at ?? s.news.published_at);
        const label = period === "1d"
          ? raw.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          : raw.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { label, signal: s };
      })
    : [];

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",  label: "Overview"   },
    { key: "analysis",  label: "Analysis"   },
    { key: "news",      label: "News"       },
    { key: "tradeplan", label: "Trade Plan" },
    { key: "backtest",  label: "Backtest"   },
  ];

  // Key stats from latest signal
  const md = selected?.market_data;
  const td = selected?.technical_data;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb + header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">Dashboard</Link>
          <span className="text-zinc-700">›</span>
          <span className="text-xs text-zinc-400">{ticker}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {/* TODO: add to watchlist */}}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            ★ Add to Watchlist
          </button>
          <button
            onClick={() => setSimulate((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              simulate
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {simulate ? "● Simulation On" : "⚗ Simulation"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0 h-full">

          {/* ── Main column ── */}
          <div className="border-r border-zinc-800 p-6 space-y-5">
            {/* Ticker header */}
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="text-3xl font-black text-zinc-100">{ticker}</h1>
                {selected?.company && (
                  <span className="text-sm text-zinc-500">{selected.company}</span>
                )}
              </div>
              {lastClose !== null && (
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-2xl font-bold font-mono text-zinc-100">
                    ${lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {changePct !== null && (
                    <span className={`text-sm font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                      {isUp ? "+" : ""}{change!.toFixed(2)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-zinc-800">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    tab === key
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Period selector + chart */}
            <div>
              <div className="flex items-center gap-1 mb-3">
                {(Object.keys(PERIOD_CFG) as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                      period === p ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {PERIOD_CFG[p].label}
                  </button>
                ))}
              </div>

              <div className="h-64 relative">
                {chartLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-zinc-600">Loading…</span>
                  </div>
                ) : bars.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bars} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={strokeColor} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="time" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis domain={["auto", "auto"]} tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={48} />
                      {firstClose && <ReferenceLine y={firstClose} stroke="#52525b" strokeDasharray="4 4" strokeWidth={1} />}
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="close" stroke={strokeColor} strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, fill: strokeColor }} />
                      {signalMarkers.map(({ label, signal }, i) => (
                        <ReferenceLine key={i} x={label}
                          stroke={signal.decision === "LONG" ? "#10b981" : signal.decision === "SHORT" ? "#f87171" : "#71717a"}
                          strokeDasharray="3 3"
                          label={{ value: DECISION_ICON[signal.decision], position: "top", fontSize: 12, fill: signal.decision === "LONG" ? "#10b981" : signal.decision === "SHORT" ? "#f87171" : "#71717a" }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs text-zinc-600">
                      {API_URL ? `No chart data for ${ticker}` : "Connect backend for real charts"}
                    </p>
                  </div>
                )}
              </div>

              {simulate && signalMarkers.length > 0 && (
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-emerald-400">▲ LONG</span>
                  <span className="text-red-400">▼ SHORT</span>
                  <span className="text-zinc-600">◼ NO TRADE</span>
                  <span className="ml-auto text-zinc-600">{signalMarkers.length} signals on chart</span>
                </div>
              )}
            </div>

            {/* Tab content */}
            {tab === "overview" && selected && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DecisionHeroCard data={selected} />
                {!selected.trade_allowed && <BlockingReasonsCard reasons={selected.blocking_reasons} />}
              </div>
            )}
            {tab === "analysis" && selected && (
              <ScoreBreakdown scores={selected.scores} />
            )}
            {tab === "news" && selected && (
              <NewsCard news={selected.news} />
            )}
            {tab === "tradeplan" && selected && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TradePlanPanel plan={selected.trade_plan} />
                <ExitPlanPanel  plan={selected.exit_plan} />
              </div>
            )}
            {tab === "backtest" && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
                <p className="text-sm text-zinc-400 font-medium mb-1">Simulation Mode</p>
                <p className="text-xs text-zinc-600">Toggle &quot;Simulation&quot; above to overlay all logged signals on the price chart.</p>
                {signals.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3 text-left max-w-sm mx-auto">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                      <p className="text-xs text-zinc-600">Total Signals</p>
                      <p className="text-lg font-bold text-zinc-200">{signals.length}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                      <p className="text-xs text-zinc-600">LONG</p>
                      <p className="text-lg font-bold text-emerald-400">{signals.filter((s) => s.decision === "LONG").length}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                      <p className="text-xs text-zinc-600">SHORT</p>
                      <p className="text-lg font-bold text-red-400">{signals.filter((s) => s.decision === "SHORT").length}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right column: Key Stats + Score Summary + Signal History ── */}
          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Key Stats */}
            {md && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Key Stats</h3>
                <div className="space-y-2">
                  {[
                    { label: "Price",        value: `$${md.price.toFixed(2)}` },
                    { label: "Volume",       value: formatVolume(md.avg_daily_volume) },
                    { label: "Rel. Volume",  value: `${md.relative_volume.toFixed(2)}x` },
                    { label: "ATR (14)",     value: md.atr.toFixed(2) },
                    { label: "VWAP",         value: `$${md.vwap.toFixed(2)}` },
                    { label: "Day Range",    value: `${md.gap_pct > 0 ? "+" : ""}${md.gap_pct.toFixed(1)}% gap` },
                    ...(td ? [
                      { label: "RSI",        value: td.rsi.toFixed(0) },
                      { label: "EMA Trend",  value: td.ema_trend.charAt(0).toUpperCase() + td.ema_trend.slice(1) },
                    ] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">{label}</span>
                      <span className="text-zinc-200 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score Summary */}
            {selected && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Score Summary</h3>
                <ScoreGauge score={selected.final_score} />
                <div className="mt-3 text-center space-y-1">
                  <p className={`text-sm font-bold ${getDecisionColor(selected.decision)}`}>
                    {selected.decision} · {selected.strength.charAt(0).toUpperCase() + selected.strength.slice(1)}
                  </p>
                  <p className="text-xs text-zinc-500">{Math.round(selected.confidence * 100)}% confidence</p>
                </div>
              </div>
            )}

            {/* Signal History */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">
                Signal History · {signals.length}
              </h3>
              {signals.length === 0 ? (
                <p className="text-xs text-zinc-700 px-1">No signals yet for {ticker}</p>
              ) : (
                <div className="space-y-1.5">
                  {signals.map((s, i) => {
                    const isSelected = selected === s || (!!s.id && s.id === selected?.id);
                    const time = s.logged_at ? formatDate(s.logged_at) : formatDate(s.news.published_at);
                    return (
                      <button
                        key={s.id ?? i}
                        onClick={() => setSelected(s)}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-all
                          ${isSelected
                            ? `${getDecisionBg(s.decision)} ${getDecisionBorder(s.decision)}`
                            : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/40"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${getDecisionColor(s.decision)}`}>
                            {DECISION_ICON[s.decision]} {s.decision}
                          </span>
                          <span className={`text-xs font-bold ${getFinalScoreColor(s.final_score)}`}>
                            {s.final_score > 0 ? "+" : ""}{s.final_score.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-0.5">{time}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
