import { Decision, DirectionalBias, RiskMode, Strength, Trend } from "@/types/trade";

export function getDecisionColor(decision: Decision): string {
  switch (decision) {
    case "LONG":     return "text-emerald-400";
    case "SHORT":    return "text-red-400";
    case "NO_TRADE": return "text-zinc-400";
  }
}

export function getDecisionBorder(decision: Decision): string {
  switch (decision) {
    case "LONG":     return "border-emerald-500/40";
    case "SHORT":    return "border-red-500/40";
    case "NO_TRADE": return "border-zinc-600/40";
  }
}

export function getDecisionBg(decision: Decision): string {
  switch (decision) {
    case "LONG":     return "bg-emerald-500/10";
    case "SHORT":    return "bg-red-500/10";
    case "NO_TRADE": return "bg-zinc-700/20";
  }
}

export function getDecisionGlow(decision: Decision): string {
  switch (decision) {
    case "LONG":     return "shadow-[0_0_30px_rgba(16,185,129,0.15)]";
    case "SHORT":    return "shadow-[0_0_30px_rgba(239,68,68,0.15)]";
    case "NO_TRADE": return "shadow-none";
  }
}

export function getTrendBg(trend: Trend | DirectionalBias): string {
  switch (trend) {
    case "bullish": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "bearish": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "neutral": return "bg-zinc-700/30 text-zinc-400 border-zinc-600/20";
  }
}

export function getTrendColor(trend: Trend | DirectionalBias): string {
  switch (trend) {
    case "bullish": return "text-emerald-400";
    case "bearish": return "text-red-400";
    case "neutral": return "text-zinc-400";
  }
}

export function getRiskModeLabel(mode: RiskMode): string {
  switch (mode) {
    case "risk_on":  return "Risk On";
    case "risk_off": return "Risk Off";
    case "neutral":  return "Neutral";
  }
}

export function getRiskModeBg(mode: RiskMode): string {
  switch (mode) {
    case "risk_on":  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "risk_off": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "neutral":  return "bg-zinc-700/30 text-zinc-400 border-zinc-600/20";
  }
}

export function getStrengthBg(strength: Strength): string {
  switch (strength) {
    case "strong":  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "medium":  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "blocked": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "none":    return "bg-zinc-700/30 text-zinc-400 border-zinc-600/20";
  }
}

export function getScoreBarColor(score: number, isPenalty = false): string {
  if (isPenalty) return "#f97316";
  if (score > 0) return "#10b981";
  if (score < 0) return "#ef4444";
  return "#71717a";
}

export function getPctColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-zinc-400";
}

export function getScoreColor(score: number): string {
  if (score > 15) return "text-emerald-400";
  if (score > 0)  return "text-emerald-300";
  if (score < -15) return "text-red-400";
  if (score < 0)   return "text-red-300";
  return "text-zinc-400";
}

export function getFinalScoreColor(score: number): string {
  if (score >= 30)  return "text-emerald-400";
  if (score >= 10)  return "text-emerald-300";
  if (score <= -30) return "text-red-400";
  if (score <= -10) return "text-red-300";
  return "text-zinc-300";
}

export function formatPct(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
