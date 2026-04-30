"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TICKERS = ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AMD","INTC","QCOM","NFLX","PLTR","CRWD","NET","COIN","SHOP","UBER","PYPL","SQ","CRM"];

export default function SimulationPage() {
  const [ticker, setTicker] = useState("NVDA");
  const router = useRouter();

  function launch() {
    router.push(`/stock/${ticker}#simulation`);
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-md mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-zinc-100">Simulation Lab</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Select a ticker to simulate buying/shorting and track live P&amp;L with stop loss.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-2">
            Select Ticker
          </label>
          <div className="flex flex-wrap gap-2">
            {TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => setTicker(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  ticker === t
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-500 space-y-1.5">
          <p className="text-zinc-300 font-medium">How it works:</p>
          <p>1. The algorithm logs LONG/SHORT signals every few minutes for 25 tickers.</p>
          <p>2. Open the &quot;⚗ Simulate&quot; tab on any stock page to see signals on the chart.</p>
          <p>3. Click &quot;Buy (Paper)&quot; or &quot;Short (Paper)&quot; to open a simulated position.</p>
          <p>4. Set a custom stop loss or use the algorithm-suggested one.</p>
          <p>5. Live P&amp;L updates every 15 seconds. Close the trade manually at any time.</p>
        </div>

        <button
          onClick={launch}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-3 transition-colors"
        >
          Open {ticker} → Simulate Tab
        </button>
      </div>
    </div>
  );
}
