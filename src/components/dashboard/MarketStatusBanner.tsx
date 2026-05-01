"use client";

import { useData } from "@/contexts/DataContext";

const SESSION_STYLE: Record<string, { bar: string; dot: string; label: string }> = {
  regular: { bar: "border-emerald-500/20 bg-emerald-500/5",  dot: "bg-emerald-400", label: "text-emerald-400" },
  pre:     { bar: "border-blue-500/20 bg-blue-500/5",        dot: "bg-blue-400 animate-pulse", label: "text-blue-400" },
  after:   { bar: "border-zinc-600/30 bg-zinc-800/40",       dot: "bg-zinc-500",  label: "text-zinc-400" },
  closed:  { bar: "border-amber-500/20 bg-amber-500/5",      dot: "bg-amber-400", label: "text-amber-400" },
};

const REASON_LABEL: Record<string, string> = {
  "Weekend":       "Weekend — Market closed",
  "Market Holiday":"Holiday — Market closed",
  "Pre-Market":    "Pre-Market",
  "After Hours":   "After Hours",
  "Closed":        "Market closed",
};

const REASON_HINT: Record<string, string> = {
  "Weekend":       "NYSE reopens Monday at 09:30 ET.",
  "Market Holiday":"Today is a US market holiday. Signals are informational only.",
  "Pre-Market":    "Regular trading starts at 09:30 ET. Signals may still change.",
  "After Hours":   "Regular trading has ended. Prices and signals reflect after-hours.",
  "Closed":        "Market is currently closed.",
};

export function MarketStatusBanner() {
  const { marketStatus: status } = useData();

  if (!status) return null;
  if (status.is_open) return null;

  const style = SESSION_STYLE[status.session] ?? SESSION_STYLE.closed;

  return (
    <div className={`rounded-xl border px-4 py-3 mb-5 flex items-center gap-3 ${style.bar}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-semibold ${style.label}`}>
          {REASON_LABEL[status.reason] ?? status.reason}
        </span>
        <span className="text-xs text-zinc-500 ml-2">
          {REASON_HINT[status.reason]}
        </span>
      </div>
      <span className="text-xs text-zinc-600 font-mono shrink-0">{status.et_time} ET</span>
    </div>
  );
}
