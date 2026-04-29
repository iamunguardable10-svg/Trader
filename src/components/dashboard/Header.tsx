"use client";

import { AppMode } from "@/types/trade";

type Props = {
  mode: AppMode;
  lastUpdated: string | null;
  backendOnline: boolean;
};

const MODE_STYLE: Record<AppMode, string> = {
  paper:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  live:     "bg-red-500/10 text-red-400 border-red-500/20",
  backtest: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function Header({ mode, lastUpdated, backendOnline }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-6">
        {/* Left: brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-sm">
            📡
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            Signal Dashboard
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-widest ${MODE_STYLE[mode]}`}
          >
            {mode}
          </span>
        </div>

        {/* Right: status */}
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="hidden text-xs text-zinc-500 sm:block">
              Updated {lastUpdated}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                backendOnline
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  : "bg-red-500"
              }`}
            />
            <span className="text-xs text-zinc-500">
              {backendOnline ? "Backend online" : "Backend offline"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
