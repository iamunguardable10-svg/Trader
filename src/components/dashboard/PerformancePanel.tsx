"use client";

import { PerformanceData } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

type Props = { data: PerformanceData };

function StatBox({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color ?? "text-zinc-100"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EquityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="font-semibold text-emerald-400">${payload[0].value.toLocaleString()}</p>
    </div>
  );
}

export function PerformancePanel({ data }: Props) {
  const winRatePct = Math.round(data.win_rate * 100);
  const winRateColor =
    winRatePct >= 60 ? "text-emerald-400" :
    winRatePct >= 45 ? "text-amber-400" : "text-red-400";

  const pnlColor = data.total_pnl >= 0 ? "text-emerald-400" : "text-red-400";
  const pfColor  = data.profit_factor >= 1.5 ? "text-emerald-400" : data.profit_factor >= 1 ? "text-amber-400" : "text-red-400";

  const startEquity = data.equity_curve[0]?.equity ?? 10000;
  const endEquity   = data.equity_curve[data.equity_curve.length - 1]?.equity ?? startEquity;
  const totalReturnPct = ((endEquity - startEquity) / startEquity) * 100;

  return (
    <PanelCard title="Performance Overview" icon="🏆">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-5">
        <StatBox
          label="Total Trades"
          value={String(data.total_trades)}
          sub={`${data.winning_trades}W / ${data.losing_trades}L`}
        />
        <StatBox
          label="Win Rate"
          value={`${winRatePct}%`}
          color={winRateColor}
        />
        <StatBox
          label="Total PnL"
          value={`${data.total_pnl >= 0 ? "+" : ""}$${Math.abs(data.total_pnl).toLocaleString()}`}
          sub={`${totalReturnPct > 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%`}
          color={pnlColor}
        />
        <StatBox
          label="Profit Factor"
          value={data.profit_factor.toFixed(2)}
          color={pfColor}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-5">
        <StatBox
          label="Avg Win"
          value={`+$${data.avg_win.toFixed(0)}`}
          color="text-emerald-400"
        />
        <StatBox
          label="Avg Loss"
          value={`-$${Math.abs(data.avg_loss).toFixed(0)}`}
          color="text-red-400"
        />
        <StatBox
          label="Max Drawdown"
          value={`$${data.max_drawdown.toFixed(0)}`}
          sub={`${data.max_drawdown_pct.toFixed(1)}%`}
          color="text-red-400"
        />
        <StatBox
          label="Sharpe Ratio"
          value={data.sharpe_ratio != null ? data.sharpe_ratio.toFixed(2) : "—"}
          color={
            data.sharpe_ratio == null ? "text-zinc-500" :
            data.sharpe_ratio >= 1.5 ? "text-emerald-400" :
            data.sharpe_ratio >= 1   ? "text-amber-400" : "text-red-400"
          }
        />
      </div>

      {/* Equity curve */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Equity Curve</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.equity_curve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip content={<EquityTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#equityGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#10b981" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PanelCard>
  );
}
