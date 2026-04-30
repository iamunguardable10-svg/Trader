"use client";

import { useData } from "@/contexts/DataContext";
import { SignalsTable } from "@/components/dashboard/SignalsTable";

export default function SignalsPage() {
  const { signals, watchlistTickers } = useData();

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-zinc-100">All Signals</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{signals.length} total signals from all tracked tickers</p>
      </div>
      <SignalsTable signals={signals} watchlistTickers={watchlistTickers} />
    </div>
  );
}
