import { TradeDecision } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import { StatRow } from "@/components/ui/StatRow";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { Badge } from "@/components/ui/Badge";
import { formatPct, getPctColor, getRiskModeBg, getRiskModeLabel } from "@/lib/utils";

type Props = { data: TradeDecision["market_context"] };

export function MarketContextPanel({ data }: Props) {
  return (
    <PanelCard title="Market Context" icon="🌍">
      <StatRow
        label="SPY Trend"
        value={<TrendBadge trend={data.spy_trend} label={`SPY ${data.spy_trend}`} />}
      />
      <StatRow
        label="QQQ Trend"
        value={<TrendBadge trend={data.qqq_trend} label={`QQQ ${data.qqq_trend}`} />}
      />
      <StatRow
        label="Sector Trend"
        value={<TrendBadge trend={data.sector_trend} />}
      />
      <StatRow
        label="VIX Change"
        value={formatPct(data.vix_change_pct)}
        valueClass={getPctColor(-data.vix_change_pct)}
      />
      <StatRow
        label="Risk Mode"
        value={
          <Badge className={getRiskModeBg(data.risk_mode)}>
            {getRiskModeLabel(data.risk_mode)}
          </Badge>
        }
      />
    </PanelCard>
  );
}
