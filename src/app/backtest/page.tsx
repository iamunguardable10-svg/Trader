"use client";

import { useState, useEffect } from "react";
import { fetchBacktest, BacktestResponse, BacktestResult } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function BacktestPage() {
  const [data,    setData   ] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter ] = useState<"ALL" | "LONG" | "SHORT">("ALL");

  async function load() {
    if (!API_URL) return;
    setLoading(true);
    try { setData(await fetchBacktest(200)); } catch { /* keep */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const rows = (data?.results ?? []).filter(r => filter === "ALL" || r.direction === filter);
  const s    = data?.summary;

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Backtest</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Alle LONG/SHORT Signale gegen historische Kursdaten</p>
        </div>
        <button
          onClick={load}
          disabled={loading || !API_URL}
          className="rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors"
        >
          {loading ? "Laden…" : "Aktualisieren"}
        </button>
      </div>

      {!API_URL && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          Backend nicht verbunden.
        </div>
      )}

      {/* Summary */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Win Rate (45 min)"
            value={s.win_rate_45m !== null ? `${s.win_rate_45m}%` : "—"}
            sub={`${s.wins} Wins / ${s.losses} Losses`}
          />
          <StatCard
            label="Ø Return (45 min)"
            value={s.avg_return_45m !== null ? `${s.avg_return_45m > 0 ? "+" : ""}${s.avg_return_45m}%` : "—"}
          />
          <StatCard label="Signale total" value={String(data.signals)} sub="LONG + SHORT" />
          <StatCard label="Ausgewertet" value={String(data.evaluated)} sub="mit Kursdaten" />
        </div>
      )}

      {/* No data hint */}
      {data && data.signals === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-500">Noch keine LONG/SHORT Signale — der Algorithmus muss zuerst Trades generieren.</p>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <>
          <div className="flex gap-2">
            {(["ALL", "LONG", "SHORT"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {["Ticker", "Dir.", "Score", "Entry", "+15 min", "+30 min", "+45 min", "Korrekt?"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const correct = r.correct_45m;
                  return (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                      <td className="px-4 py-3 font-bold text-zinc-100">{r.ticker}</td>
                      <td className={`px-4 py-3 font-bold ${r.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>{r.direction}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{r.score?.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">${r.entry_price?.toFixed(2)}</td>
                      {[r.ret_15m, r.ret_30m, r.ret_45m].map((ret, j) => (
                        <td key={j} className={`px-4 py-3 font-mono font-medium ${ret === null ? "text-zinc-700" : ret > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {ret === null ? "—" : `${ret > 0 ? "+" : ""}${ret}%`}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        {correct === null
                          ? <span className="text-zinc-700">—</span>
                          : correct
                            ? <span className="text-emerald-400 font-bold">✓</span>
                            : <span className="text-red-400 font-bold">✗</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
