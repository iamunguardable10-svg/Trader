"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelCard } from "@/components/ui/PanelCard";
import { OHLCVBar, fetchChartData } from "@/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type Period = "1d" | "5d" | "1mo";
type Interval = "5m" | "15m" | "1h" | "1d";

const PERIOD_CONFIG: Record<Period, { interval: Interval; label: string }> = {
  "1d":  { interval: "5m",  label: "1D" },
  "5d":  { interval: "15m", label: "5D" },
  "1mo": { interval: "1d",  label: "1M" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as OHLCVBar;
  const isUp = d.close >= d.open;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl space-y-0.5">
      <p className="text-zinc-400">{label}</p>
      <p className={`font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
        ${d.close.toFixed(2)}
      </p>
      <p className="text-zinc-500">
        O {d.open.toFixed(2)} · H {d.high.toFixed(2)} · L {d.low.toFixed(2)}
      </p>
      <p className="text-zinc-500">Vol {d.volume.toLocaleString()}</p>
    </div>
  );
}

type Props = { ticker: string | null };

export function PriceChartPanel({ ticker }: Props) {
  const [period, setPeriod] = useState<Period>("1d");
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (t: string, p: Period) => {
    setLoading(true);
    try {
      const { interval } = PERIOD_CONFIG[p];
      setBars(await fetchChartData(t, p, interval));
    } catch {
      setBars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticker) load(ticker, period);
  }, [ticker, period, load]);

  const firstClose = bars[0]?.close ?? null;
  const lastClose  = bars[bars.length - 1]?.close ?? null;
  const change     = firstClose && lastClose ? lastClose - firstClose : null;
  const changePct  = firstClose && change !== null ? (change / firstClose) * 100 : null;
  const isUp       = change !== null ? change >= 0 : true;
  const strokeColor = isUp ? "#10b981" : "#f87171";
  const gradientId  = isUp ? "chartGreenGrad" : "chartRedGrad";

  return (
    <PanelCard
      title={ticker ? `Price Chart · ${ticker}` : "Price Chart"}
      icon="📈"
      titleRight={
        <div className="flex items-center gap-1">
          {(Object.keys(PERIOD_CONFIG) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                period === p
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {PERIOD_CONFIG[p].label}
            </button>
          ))}
        </div>
      }
    >
      {/* Price + change summary */}
      {lastClose !== null && (
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-zinc-100">
            ${lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {changePct !== null && (
            <span className={`text-sm font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {isUp ? "+" : ""}{change!.toFixed(2)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="h-56 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-zinc-600">Loading…</span>
          </div>
        )}
        {!loading && bars.length === 0 && ticker && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-zinc-600">No data for {ticker}</span>
          </div>
        )}
        {!loading && bars.length === 0 && !ticker && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-zinc-600">Waiting for first signal…</span>
          </div>
        )}
        {bars.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bars} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="time"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                width={48}
              />
              {firstClose && (
                <ReferenceLine
                  y={firstClose}
                  stroke="#52525b"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: strokeColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </PanelCard>
  );
}
