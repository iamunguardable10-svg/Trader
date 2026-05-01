"use client";

import { useState, useEffect } from "react";
import { fetchMarketStatus, MarketStatus } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const SESSION_STYLE: Record<string, { bar: string; dot: string; label: string }> = {
  regular: { bar: "border-emerald-500/20 bg-emerald-500/5",  dot: "bg-emerald-400", label: "text-emerald-400" },
  pre:     { bar: "border-blue-500/20 bg-blue-500/5",        dot: "bg-blue-400 animate-pulse", label: "text-blue-400" },
  after:   { bar: "border-zinc-600/30 bg-zinc-800/40",       dot: "bg-zinc-500",  label: "text-zinc-400" },
  closed:  { bar: "border-amber-500/20 bg-amber-500/5",      dot: "bg-amber-400", label: "text-amber-400" },
};

export function MarketStatusBanner() {
  const [status, setStatus] = useState<MarketStatus | null>(null);

  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;

    async function load() {
      try {
        const s = await fetchMarketStatus();
        if (!cancelled) setStatus(s);
      } catch { /* ignore */ }
    }

    load();
    // Refresh every 60 s — market open/close doesn't change faster
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!status) return null;
  // Don't show a banner while market is open — it's the default state
  if (status.is_open) return null;

  const style = SESSION_STYLE[status.session] ?? SESSION_STYLE.closed;

  const REASON_LABEL: Record<string, string> = {
    "Weekend":       "Wochenende — Markt geschlossen",
    "Market Holiday":"Feiertag — Markt geschlossen",
    "Pre-Market":    "Pre-Market",
    "After Hours":   "After Hours",
    "Closed":        "Markt geschlossen",
  };

  const hint: Record<string, string> = {
    "Weekend":       "Der NYSE öffnet wieder Montag um 09:30 ET.",
    "Market Holiday":"Heute ist ein US-Börsenfeierertag. Signale sind rein informativ.",
    "Pre-Market":    "Handel startet um 09:30 ET. Signale können sich noch ändern.",
    "After Hours":   "Der reguläre Handel ist beendet. Kurse und Signale sind After-Hours.",
    "Closed":        "Markt ist aktuell geschlossen.",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 mb-5 flex items-center gap-3 ${style.bar}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-semibold ${style.label}`}>
          {REASON_LABEL[status.reason] ?? status.reason}
        </span>
        <span className="text-xs text-zinc-600 ml-2">
          {hint[status.reason]}
        </span>
      </div>
      <span className="text-xs text-zinc-600 font-mono shrink-0">{status.et_time} ET</span>
    </div>
  );
}
