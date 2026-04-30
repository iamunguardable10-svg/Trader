"use client";

import { useState } from "react";
import { devScore, DevScoreResult } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const SCORE_KEYS = [
  "news_score","surprise_score","momentum_score","volume_score",
  "technical_score","market_score","sector_score",
  "overextension_penalty","uncertainty_penalty","final_score",
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  const isNeg = value < 0;
  const abs   = Math.abs(value);
  const pct   = Math.min(abs / 40 * 100, 100);
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-44 text-zinc-400 truncate">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isNeg ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-12 text-right font-mono font-bold ${isNeg ? "text-red-400" : value > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
        {value > 0 ? "+" : ""}{value.toFixed(1)}
      </span>
    </div>
  );
}

export default function DebugPage() {
  const [headline, setHeadline] = useState("");
  const [ticker,   setTicker  ] = useState("AAPL");
  const [body,     setBody    ] = useState("");
  const [loading,  setLoading ] = useState(false);
  const [result,   setResult  ] = useState<DevScoreResult | null>(null);
  const [error,    setError   ] = useState<string | null>(null);

  async function run() {
    if (!headline.trim() || !ticker.trim() || !API_URL) return;
    setLoading(true); setError(null);
    try {
      setResult(await devScore(headline.trim(), ticker.trim().toUpperCase(), body.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const dirColor = result?.decision === "LONG" ? "text-emerald-400" : result?.decision === "SHORT" ? "text-red-400" : "text-zinc-500";

  return (
    <div className="p-4 md:p-6 max-w-screen-lg mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-100">Score Tester</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Teste beliebige Schlagzeilen gegen den Algorithmus — ohne Dedup oder Logging</p>
      </div>

      {!API_URL && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          Backend nicht verbunden — Score Tester benötigt ein laufendes Backend.
        </div>
      )}

      {/* Input */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">Headline</label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && run()}
              placeholder="z.B. Apple beats earnings estimates, raises guidance"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="w-28">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">Ticker</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-1.5">Body (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Weitere Details zum Artikel…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>
        <button
          onClick={run}
          disabled={loading || !headline.trim() || !API_URL}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 transition-colors"
        >
          {loading ? "Analysiere…" : "Analysieren →"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Decision header */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 flex items-center gap-6">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Decision</p>
              <p className={`text-3xl font-black ${dirColor}`}>{result.decision}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{result.strength}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Final Score</p>
              <p className={`text-3xl font-black font-mono ${result.final_score > 0 ? "text-emerald-400" : result.final_score < 0 ? "text-red-400" : "text-zinc-500"}`}>
                {result.final_score > 0 ? "+" : ""}{result.final_score.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Trade erlaubt</p>
              <p className={`text-lg font-bold ${result.trade_allowed ? "text-emerald-400" : "text-red-400"}`}>
                {result.trade_allowed ? "Ja" : "Nein"}
              </p>
            </div>
            {result.news && (
              <div className="ml-auto text-right">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Event</p>
                <p className="text-sm font-medium text-zinc-200">{result.news.event_type}</p>
                <p className="text-xs text-zinc-400">{result.news.directional_bias}</p>
              </div>
            )}
          </div>

          {/* Blocking reasons */}
          {result.blocking_reasons.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-2">Blocking Reasons</p>
              {result.blocking_reasons.map((r, i) => (
                <p key={i} className="text-xs text-red-300 flex items-center gap-2"><span className="text-red-500">✕</span>{r}</p>
              ))}
            </div>
          )}

          {/* Score breakdown */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Score Breakdown</p>
            {SCORE_KEYS.map((k) => (
              <ScoreBar key={k} label={k.replace(/_/g, " ")} value={result.scores?.[k] ?? 0} />
            ))}
          </div>

          {/* LLM + Market + Technical row */}
          <div className="grid grid-cols-3 gap-4">
            {result.news && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">LLM Analyse</p>
                {[
                  ["Wichtigkeit", (result.news.importance * 100).toFixed(0) + "%"],
                  ["Konfidenz",   (result.news.confidence * 100).toFixed(0) + "%"],
                  ["Überraschung",(result.news.surprise_level * 100).toFixed(0) + "%"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-zinc-500">{k}</span>
                    <span className="text-zinc-200 font-medium">{v}</span>
                  </div>
                ))}
                <p className="text-xs text-zinc-500 pt-1 border-t border-zinc-800">{result.news.reasoning_summary}</p>
              </div>
            )}
            {result.market_data && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Marktdaten</p>
                {[
                  ["Preis",        "$" + result.market_data.price?.toFixed(2)],
                  ["Rel. Volumen", result.market_data.relative_volume?.toFixed(2) + "x"],
                  ["VWAP Dist.",   result.market_data.vwap_distance_pct?.toFixed(2) + "%"],
                  ["ATR %",        result.market_data.atr_pct?.toFixed(2) + "%"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-zinc-500">{k}</span>
                    <span className="text-zinc-200 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {result.technical_data && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Technisch</p>
                {[
                  ["RSI",       String(result.technical_data.rsi)],
                  ["EMA Trend", String(result.technical_data.ema_trend)],
                  ["Über VWAP", result.technical_data.price_above_vwap ? "Ja" : "Nein"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-zinc-500">{k}</span>
                    <span className="text-zinc-200 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
