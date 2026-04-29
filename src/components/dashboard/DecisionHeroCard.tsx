"use client";

import { TradeDecision } from "@/types/trade";
import {
  getDecisionBg,
  getDecisionBorder,
  getDecisionColor,
  getDecisionGlow,
  getFinalScoreColor,
  getStrengthBg,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

type Props = { data: TradeDecision };

const DECISION_LABEL: Record<string, string> = {
  LONG:     "LONG",
  SHORT:    "SHORT",
  NO_TRADE: "NO TRADE",
};

const DECISION_ICON: Record<string, string> = {
  LONG:     "▲",
  SHORT:    "▼",
  NO_TRADE: "◼",
};

export function DecisionHeroCard({ data }: Props) {
  const { decision, strength, final_score, confidence, ticker, company, sector, trade_allowed } = data;

  const scoreNormalized = Math.max(-100, Math.min(100, final_score));
  const scorePct = ((scoreNormalized + 100) / 200) * 100;

  return (
    <div
      className={`rounded-xl border p-5 ${getDecisionBg(decision)} ${getDecisionBorder(decision)} ${getDecisionGlow(decision)}`}
    >
      {/* Ticker + company */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-100">
              {ticker ?? "—"}
            </span>
            {sector && (
              <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {sector}
              </span>
            )}
          </div>
          {company && <p className="mt-0.5 text-xs text-zinc-500">{company}</p>}
        </div>

        {/* Trade allowed indicator */}
        <Badge
          className={
            trade_allowed
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }
        >
          {trade_allowed ? "✓ Trade Allowed" : "✗ Trade Blocked"}
        </Badge>
      </div>

      {/* Decision + strength */}
      <div className="mb-5 flex items-center gap-3">
        <span className={`text-4xl font-black tracking-tight ${getDecisionColor(decision)}`}>
          <span className="mr-2 text-2xl">{DECISION_ICON[decision]}</span>
          {DECISION_LABEL[decision]}
        </span>
        <Badge className={getStrengthBg(strength)}>
          {strength.charAt(0).toUpperCase() + strength.slice(1)}
        </Badge>
      </div>

      {/* Score bar */}
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
        <span>-100</span>
        <span className={`font-semibold ${getFinalScoreColor(final_score)}`}>
          Score: {final_score > 0 ? "+" : ""}{final_score.toFixed(1)}
        </span>
        <span>+100</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        {/* center line */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-600" />
        {/* fill */}
        <div
          className={`absolute top-0 h-full rounded-full transition-all ${
            final_score >= 0 ? "bg-emerald-500 left-1/2" : "bg-red-500 right-1/2"
          }`}
          style={{ width: `${Math.abs(scoreNormalized) / 2}%` }}
        />
      </div>

      {/* Confidence */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-800/50 p-2.5">
          <p className="text-xs text-zinc-500">Confidence</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-700">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-zinc-200">
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-2.5">
          <p className="text-xs text-zinc-500">Final Score</p>
          <p className={`mt-0.5 text-lg font-bold ${getFinalScoreColor(final_score)}`}>
            {final_score > 0 ? "+" : ""}{final_score.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Explanation */}
      {data.explanation && (
        <p className="mt-3 text-xs text-zinc-500 border-t border-zinc-700/50 pt-3">
          {data.explanation}
        </p>
      )}
    </div>
  );
}
