import { TradeDecision } from "@/types/trade";
import { PanelCard } from "@/components/ui/PanelCard";
import { StatRow } from "@/components/ui/StatRow";
import { formatMinutes } from "@/lib/utils";

type Props = { plan: TradeDecision["exit_plan"] };

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <StatRow
      label={label}
      value={
        <span className={value ? "text-emerald-400" : "text-zinc-500"}>
          {value ? "✓ Yes" : "✗ No"}
        </span>
      }
    />
  );
}

export function ExitPlanPanel({ plan }: Props) {
  if (!plan) {
    return (
      <PanelCard title="Exit Plan" icon="🚪">
        <div className="flex flex-col items-center justify-center py-6 text-zinc-600">
          <span className="text-2xl mb-2">—</span>
          <p className="text-xs">No exit plan (trade not allowed)</p>
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard title="Exit Plan" icon="🚪">
      <StatRow
        label="Max Hold Time"
        value={formatMinutes(plan.max_hold_minutes)}
        valueClass="text-amber-400 font-medium"
      />
      <StatRow
        label="Stop Loss Type"
        value={plan.stop_loss_type.replace(/_/g, " ")}
      />
      <StatRow
        label="Take Profit Type"
        value={plan.take_profit_type.replace(/_/g, " ")}
      />
      <StatRow
        label="TP R-Multiple"
        value={`${plan.take_profit_r_multiple.toFixed(1)}R`}
        valueClass="text-emerald-400"
      />
      <BoolRow label="Trailing Stop"          value={plan.trailing_stop_enabled} />
      {plan.trailing_stop_enabled && (
        <>
          <StatRow label="Trail after"         value={`${plan.trailing_stop_after_r.toFixed(1)}R`} />
          <StatRow label="Trail ATR Multiplier" value={`${plan.trailing_stop_atr_multiplier.toFixed(1)}x`} />
        </>
      )}
      <BoolRow label="Exit on Opposite News"  value={plan.exit_on_opposite_news} />
      <BoolRow label="Exit if Score Reverses" value={plan.exit_if_score_reverses} />
    </PanelCard>
  );
}
