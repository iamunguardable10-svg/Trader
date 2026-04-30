"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TICKERS = ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AMD","INTC","QCOM","NFLX","PLTR","CRWD","NET","COIN","SHOP","UBER","PYPL","SQ","CRM"];

export default function SimulationPage() {
  const [ticker, setTicker] = useState("NVDA");
  const router = useRouter();

  function launch() {
    router.push(`/stock/${ticker}?simulate=true`);
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-md mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-zinc-100">Simulation Lab</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Select a ticker to overlay all logged algorithm signals on its price chart.
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
          <p>1. The algorithm processes live news for all 25 tracked tickers every 5 minutes.</p>
          <p>2. Each signal (LONG/SHORT/NO_TRADE) is logged with its timestamp and score.</p>
          <p>3. In simulation mode, all logged signals are overlaid on the price chart as colored lines.</p>
          <p>4. Green ▲ lines = LONG signals, Red ▼ lines = SHORT signals.</p>
          <p>5. Compare where signals fired vs. subsequent price movement to evaluate accuracy.</p>
        </div>

        <button
          onClick={launch}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-3 transition-colors"
        >
          Open {ticker} in Simulation Mode →
        </button>
      </div>
    </div>
  );
}
