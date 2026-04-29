import { TradeDecision } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import { StatRow } from "@/components/ui/StatRow";
import { formatPrice } from "@/lib/utils";

type Props = { plan: TradeDecision["trade_plan"] };

export function TradePlanPanel({ plan }: Props) {
  if (!plan) {
    return (
      <PanelCard title="Trade Plan" icon="📋">
        <div className="flex flex-col items-center justify-center py-6 text-zinc-600">
          <span className="text-2xl mb-2">—</span>
          <p className="text-xs">No trade plan (trade not allowed)</p>
        </div>
      </PanelCard>
    );
  }

  const rrRatio = plan.risk_reward_ratio;
  const rrColor = rrRatio >= 2 ? "text-emerald-400" : rrRatio >= 1.5 ? "text-amber-400" : "text-red-400";

  return (
    <PanelCard title="Trade Plan" icon="📋">
      <StatRow
        label="Direction"
        value={
          <span
            className={
              plan.direction === "LONG" ? "text-emerald-400 font-semibold" :
              plan.direction === "SHORT" ? "text-red-400 font-semibold" :
              "text-zinc-400"
            }
          >
            {plan.direction}
          </span>
        }
      />
      <StatRow label="Entry Price"   value={formatPrice(plan.entry_price)} valueClass="text-zinc-100 font-medium" />
      <StatRow label="Stop Loss"     value={formatPrice(plan.stop_loss)}   valueClass="text-red-400" />
      <StatRow label="Take Profit"   value={formatPrice(plan.take_profit)} valueClass="text-emerald-400" />
      <StatRow label="Position Size" value={`${plan.position_size} shares`} />
      <StatRow label="Risk Amount"   value={formatPrice(plan.risk_amount)}   valueClass="text-red-300" />
      <StatRow label="Reward Amount" value={formatPrice(plan.reward_amount)} valueClass="text-emerald-300" />
      <StatRow
        label="Risk / Reward"
        value={`1 : ${rrRatio.toFixed(2)}`}
        valueClass={rrColor + " font-semibold"}
      />

      {/* Visual R:R bar */}
      <div className="mt-3 rounded-lg bg-zinc-800/50 p-2.5">
        <div className="flex text-xs text-zinc-500 mb-1 justify-between">
          <span>Risk  ${plan.risk_amount.toFixed(0)}</span>
          <span>1 : {rrRatio.toFixed(2)} R</span>
          <span>Reward  ${plan.reward_amount.toFixed(0)}</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full">
          <div className="bg-red-500/70" style={{ width: `${100 / (1 + rrRatio)}%` }} />
          <div className="bg-emerald-500/70 flex-1" />
        </div>
      </div>
    </PanelCard>
  );
}
