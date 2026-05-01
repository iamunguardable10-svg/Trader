"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AccountInfo, AutoExecuteState,
  fetchAccount, fetchAutoExecute, setAutoExecute, triggerKillSwitch,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function TradingControls() {
  const [account,     setAccount    ] = useState<AccountInfo | null>(null);
  const [autoExec,    setAutoExec   ] = useState<AutoExecuteState | null>(null);
  const [scoreInput,  setScoreInput ] = useState<string>("");
  const [editingScore, setEditingScore] = useState(false);
  const [killing,     setKilling    ] = useState(false);
  const [toggling,    setToggling   ] = useState(false);

  const load = useCallback(async () => {
    if (!API_URL) return;
    const [acc, ae] = await Promise.allSettled([fetchAccount(), fetchAutoExecute()]);
    if (acc.status === "fulfilled") setAccount(acc.value);
    if (ae.status  === "fulfilled") setAutoExec(ae.value);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleToggle() {
    if (!autoExec) return;
    setToggling(true);
    try {
      const next = await setAutoExecute(!autoExec.enabled, autoExec.min_score);
      setAutoExec(next);
    } finally {
      setToggling(false);
    }
  }

  async function handleScoreChange() {
    const val = parseInt(scoreInput, 10);
    if (isNaN(val) || val < 1 || val > 100) return;
    const next = await setAutoExecute(autoExec?.enabled ?? false, val).catch(() => null);
    if (next) { setAutoExec(next); setEditingScore(false); }
  }

  async function handleKillSwitch() {
    if (!confirm("Close ALL open positions immediately and disable auto-execute?")) return;
    setKilling(true);
    try {
      const res = await triggerKillSwitch();
      await load();
      alert(`Kill switch executed — ${res.closed} position(s) closed.`);
    } finally {
      setKilling(false);
    }
  }

  if (!API_URL) return null;

  const isAlpaca = autoExec?.broker === "AlpacaBroker";
  const isOn     = autoExec?.enabled ?? false;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 mb-5 flex flex-wrap items-center gap-3">

      {/* Broker / account badge */}
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${isAlpaca ? "bg-emerald-400" : "bg-zinc-500"}`} />
        <span className="text-xs font-semibold text-zinc-400">
          {isAlpaca
            ? (account?.paper ? "Alpaca Paper" : "Alpaca Live")
            : "Paper (in-memory)"}
        </span>
        {account && (
          <span className="text-xs text-zinc-600 font-mono">
            ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })} equity
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-zinc-800 shrink-0 hidden sm:block" />

      {/* Auto-execute toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Auto-Execute</span>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
            isOn ? "bg-emerald-500" : "bg-zinc-700"
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isOn ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
        <span className={`text-xs font-semibold ${isOn ? "text-emerald-400" : "text-zinc-600"}`}>
          {isOn ? "ON" : "OFF"}
        </span>
      </div>

      {/* Min score threshold */}
      {autoExec && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-600">min score</span>
          {editingScore ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number" min="1" max="100"
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleScoreChange(); if (e.key === "Escape") setEditingScore(false); }}
                className="w-12 rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-100 text-center focus:outline-none"
              />
              <button onClick={handleScoreChange} className="text-xs text-emerald-400 hover:text-emerald-300">✓</button>
              <button onClick={() => setEditingScore(false)} className="text-xs text-zinc-600 hover:text-zinc-400">✕</button>
            </div>
          ) : (
            <button
              onClick={() => { setScoreInput(String(autoExec.min_score)); setEditingScore(true); }}
              className="text-xs font-mono font-bold text-zinc-300 hover:text-zinc-100 underline-offset-2 hover:underline"
            >
              {autoExec.min_score}
            </button>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Kill switch */}
      <button
        onClick={handleKillSwitch}
        disabled={killing}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors disabled:opacity-40"
      >
        {killing ? "Closing…" : "⬛ Kill Switch"}
      </button>
    </div>
  );
}
