"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AppNav({ onMenuClick }: { onMenuClick?: () => void }) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const t = search.trim().toUpperCase();
    if (t) { router.push(`/stock/${t}`); setSearch(""); }
  }

  return (
    <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3 py-2.5 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden flex flex-col gap-1 p-1.5 -ml-1"
        aria-label="Open menu"
      >
        <span className="block w-5 h-0.5 bg-zinc-400" />
        <span className="block w-5 h-0.5 bg-zinc-400" />
        <span className="block w-5 h-0.5 bg-zinc-400" />
      </button>

      {/* Logo text — mobile only */}
      <span className="md:hidden text-sm font-bold text-zinc-100 tracking-tight">SignalEdge</span>

      <div className="hidden md:flex items-center gap-1">
        <span className="text-xs text-zinc-600 mr-2 uppercase tracking-widest">Mode</span>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          ● Paper
        </span>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-xs ml-auto md:ml-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          placeholder="Ticker suchen…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </form>

      <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
        M
      </div>
    </header>
  );
}
