"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AppNav() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const t = search.trim().toUpperCase();
    if (t) { router.push(`/stock/${t}`); setSearch(""); }
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5 shrink-0">
      <div className="flex items-center gap-1">
        <span className="text-xs text-zinc-600 mr-2 uppercase tracking-widest">Mode</span>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          ● Paper
        </span>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-xs">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          placeholder="Search ticker…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </form>

      <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
        M
      </div>
    </header>
  );
}
