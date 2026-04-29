import { TradeDecision } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import { StatRow } from "@/components/ui/StatRow";
import { formatPct, formatPrice, formatVolume, getPctColor } from "@/lib/utils";

type Props = { data: TradeDecision["market_data"] };

export function MarketDataPanel({ data }: Props) {
  return (
    <PanelCard title="Market Data" icon="📈">
      <StatRow
        label="Price"
        value={formatPrice(data.price)}
        valueClass="text-zinc-100 font-semibold"
      />
      <StatRow
        label="Day Change"
        value={formatPct(data.day_change_pct)}
        valueClass={getPctColor(data.day_change_pct)}
      />
      <StatRow
        label="5m Change"
        value={formatPct(data.price_change_5m_pct)}
        valueClass={getPctColor(data.price_change_5m_pct)}
      />
      <StatRow
        label="15m Change"
        value={formatPct(data.price_change_15m_pct)}
        valueClass={getPctColor(data.price_change_15m_pct)}
      />
      <StatRow
        label="Relative Volume"
        value={`${data.relative_volume.toFixed(1)}x`}
        valueClass={data.relative_volume >= 2 ? "text-amber-400" : "text-zinc-200"}
      />
      <StatRow
        label="Avg Daily Volume"
        value={formatVolume(data.avg_daily_volume)}
      />
      <StatRow
        label="Spread"
        value={formatPct(data.spread_pct)}
      />
      <StatRow
        label="Gap"
        value={formatPct(data.gap_pct)}
        valueClass={getPctColor(data.gap_pct)}
      />
      <StatRow
        label="ATR"
        value={`${formatPrice(data.atr)}  (${formatPct(data.atr_pct)})`}
      />
      <StatRow
        label="VWAP"
        value={formatPrice(data.vwap)}
      />
      <StatRow
        label="VWAP Distance"
        value={formatPct(data.vwap_distance_pct)}
        valueClass={getPctColor(data.vwap_distance_pct)}
      />
    </PanelCard>
  );
}
