"use client";

import { TradeDecision } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

type Props = { scores: TradeDecision["scores"] };

const SCORE_LABELS: Record<string, string> = {
  news_score:            "News",
  surprise_score:        "Surprise",
  momentum_score:        "Momentum",
  volume_score:          "Volume",
  technical_score:       "Technical",
  market_score:          "Market",
  sector_score:          "Sector",
  risk_penalty:          "Risk Penalty",
  overextension_penalty: "Overextension",
  uncertainty_penalty:   "Uncertainty",
};

const PENALTY_KEYS = new Set(["risk_penalty", "overextension_penalty", "uncertainty_penalty"]);

function getBarColor(key: string, value: number): string {
  if (PENALTY_KEYS.has(key) && value !== 0) return "#f97316";
  if (value > 0) return "#10b981";
  if (value < 0) return "#ef4444";
  return "#52525b";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, isPenalty } = payload[0].payload;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-zinc-200">{name}</p>
      <p className={isPenalty ? "text-orange-400" : value >= 0 ? "text-emerald-400" : "text-red-400"}>
        {value > 0 ? "+" : ""}{value.toFixed(2)}
      </p>
      {isPenalty && <p className="text-zinc-500">Penalty</p>}
    </div>
  );
}

export function ScoreBreakdown({ scores }: Props) {
  const { final_score, ...rest } = scores;

  const chartData = Object.entries(rest).map(([key, value]) => ({
    key,
    name: SCORE_LABELS[key] ?? key,
    value: typeof value === "number" ? value : 0,
    isPenalty: PENALTY_KEYS.has(key),
  }));

  const scoreNorm = Math.max(-100, Math.min(100, final_score));
  const positiveSum = chartData.filter(d => d.value > 0).reduce((s, d) => s + d.value, 0);
  const negativeSum = chartData.filter(d => d.value < 0).reduce((s, d) => s + d.value, 0);
  const penaltySum  = chartData.filter(d => d.isPenalty && d.value !== 0).reduce((s, d) => s + d.value, 0);

  return (
    <PanelCard title="Score Breakdown" icon="📊">
      {/* Final score meter */}
      <div className="mb-4 rounded-lg bg-zinc-800/50 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>-100  Bearish</span>
          <span className={`text-base font-black ${scoreNorm >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {final_score > 0 ? "+" : ""}{final_score.toFixed(1)}
          </span>
          <span>Bullish  +100</span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-zinc-700">
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-zinc-500 z-10" />
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${
              scoreNorm >= 0 ? "bg-emerald-500 left-1/2" : "bg-red-500 right-1/2"
            }`}
            style={{ width: `${Math.abs(scoreNorm) / 2}%` }}
          />
        </div>
      </div>

      {/* Sum badges */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
          <p className="text-xs text-zinc-500">Positive</p>
          <p className="text-sm font-bold text-emerald-400">+{positiveSum.toFixed(1)}</p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
          <p className="text-xs text-zinc-500">Negative</p>
          <p className="text-sm font-bold text-red-400">{negativeSum.toFixed(1)}</p>
        </div>
        <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 text-center">
          <p className="text-xs text-zinc-500">Penalties</p>
          <p className="text-sm font-bold text-orange-400">
            {penaltySum !== 0 ? penaltySum.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 80, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis
              type="number"
              domain={["auto", "auto"]}
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={78}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <ReferenceLine x={0} stroke="#52525b" strokeWidth={1} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={14}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={getBarColor(entry.key, entry.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500 inline-block" /> Positive</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-red-500 inline-block" /> Negative</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-orange-500 inline-block" /> Penalty</span>
      </div>
    </PanelCard>
  );
}
