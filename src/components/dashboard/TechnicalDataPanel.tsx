import { TradeDecision } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import { StatRow } from "@/components/ui/StatRow";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { formatPrice } from "@/lib/utils";

type Props = { data: TradeDecision["technical_data"] };

function RsiBar({ rsi }: { rsi: number }) {
  const rsiColor =
    rsi >= 70 ? "bg-red-500" : rsi <= 30 ? "bg-emerald-500" : "bg-blue-500";
  const rsiLabel =
    rsi >= 70 ? "Overbought" : rsi <= 30 ? "Oversold" : "Neutral";
  const rsiLabelColor =
    rsi >= 70 ? "text-red-400" : rsi <= 30 ? "text-emerald-400" : "text-zinc-400";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-500">RSI</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${rsiLabelColor}`}>{rsiLabel}</span>
          <span className="text-xs font-semibold text-zinc-200">{rsi}</span>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-700">
        {/* zones */}
        <div className="absolute left-0 top-0 h-full w-[30%] bg-emerald-500/20 rounded-l-full" />
        <div className="absolute right-0 top-0 h-full w-[30%] bg-red-500/20 rounded-r-full" />
        {/* needle */}
        <div
          className={`absolute top-0.5 h-1 w-1 rounded-full ${rsiColor} shadow-sm`}
          style={{ left: `calc(${rsi}% - 4px)` }}
        />
      </div>
      <div className="flex justify-between mt-0.5 text-xs text-zinc-600">
        <span>0</span>
        <span>30</span>
        <span>70</span>
        <span>100</span>
      </div>
    </div>
  );
}

export function TechnicalDataPanel({ data }: Props) {
  return (
    <PanelCard title="Technical Data" icon="📉">
      <StatRow label="EMA 9"  value={formatPrice(data.ema_9)} />
      <StatRow label="EMA 21" value={formatPrice(data.ema_21)} />
      <StatRow
        label="EMA Trend"
        value={<TrendBadge trend={data.ema_trend} />}
      />
      <StatRow
        label="Price Above VWAP"
        value={
          <span className={data.price_above_vwap ? "text-emerald-400" : "text-red-400"}>
            {data.price_above_vwap ? "✓ Yes" : "✗ No"}
          </span>
        }
      />

      {/* RSI with visual bar */}
      <div className="mt-3">
        <RsiBar rsi={data.rsi} />
      </div>
    </PanelCard>
  );
}
