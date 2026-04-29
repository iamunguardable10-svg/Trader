import { DirectionalBias, Trend } from "@/types/trade";
import { getTrendBg } from "@/lib/utils";
import { Badge } from "./Badge";

type Props = { trend: Trend | DirectionalBias; label?: string };

const ARROWS: Record<Trend | DirectionalBias, string> = {
  bullish: "↑",
  bearish: "↓",
  neutral: "→",
};

export function TrendBadge({ trend, label }: Props) {
  return (
    <Badge className={getTrendBg(trend)}>
      <span>{ARROWS[trend]}</span>
      {label ?? trend.charAt(0).toUpperCase() + trend.slice(1)}
    </Badge>
  );
}
