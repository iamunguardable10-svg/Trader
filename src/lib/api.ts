import { PerformanceData, TradeDecision, TradeHistoryEntry } from "@/types/trade";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** GET / — lightweight health check */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/`, { headers: { "Content-Type": "application/json" } });
    return res.ok;
  } catch {
    return false;
  }
}

/** GET /api/latest-decision — returns null when no decisions exist yet */
export async function fetchLatestDecision(): Promise<TradeDecision | null> {
  try {
    return await apiFetch<TradeDecision>("/api/latest-decision");
  } catch (e) {
    if (e instanceof Error && e.message.includes("404")) return null;
    throw e;
  }
}

/** GET /api/decisions */
export async function fetchDecisions(): Promise<TradeDecision[]> {
  return apiFetch<TradeDecision[]>("/api/decisions");
}

/** GET /api/decisions/:id */
export async function fetchDecision(id: string): Promise<TradeDecision> {
  return apiFetch<TradeDecision>(`/api/decisions/${id}`);
}

/** GET /api/performance */
export async function fetchPerformance(): Promise<PerformanceData> {
  return apiFetch<PerformanceData>("/api/performance");
}

/** GET /api/paper-trade/history */
export async function fetchTradeHistory(): Promise<TradeHistoryEntry[]> {
  return apiFetch<TradeHistoryEntry[]>("/api/paper-trade/history");
}

/** POST /api/analyze-news */
export async function analyzeNews(payload: {
  headline: string;
  ticker: string;
  source?: string;
}): Promise<TradeDecision> {
  return apiFetch<TradeDecision>("/api/analyze-news", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** POST /api/paper-trade/open */
export async function openPaperTrade(decisionId: string): Promise<{ trade_id: string }> {
  return apiFetch("/api/paper-trade/open", {
    method: "POST",
    body: JSON.stringify({ decision_id: decisionId }),
  });
}

/** POST /api/paper-trade/close */
export async function closePaperTrade(tradeId: string, exitReason: string): Promise<TradeHistoryEntry> {
  return apiFetch("/api/paper-trade/close", {
    method: "POST",
    body: JSON.stringify({ trade_id: tradeId, exit_reason: exitReason }),
  });
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

export type WatchlistEntry = {
  ticker: string;
  price: number | null;
  day_change_pct: number | null;
  volume: number | null;
};

/** GET /api/watchlist */
export async function fetchWatchlist(): Promise<WatchlistEntry[]> {
  return apiFetch<WatchlistEntry[]>("/api/watchlist");
}

/** POST /api/watchlist/:ticker */
export async function addToWatchlist(ticker: string): Promise<{ watchlist: string[] }> {
  return apiFetch(`/api/watchlist/${ticker.toUpperCase()}`, { method: "POST" });
}

/** DELETE /api/watchlist/:ticker */
export async function removeFromWatchlist(ticker: string): Promise<{ watchlist: string[] }> {
  return apiFetch(`/api/watchlist/${ticker.toUpperCase()}`, { method: "DELETE" });
}

// ── Chart data ────────────────────────────────────────────────────────────────

export type OHLCVBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** GET /api/signals/:ticker — all logged signals for one ticker */
export async function fetchSignalsForTicker(ticker: string): Promise<TradeDecision[]> {
  return apiFetch<TradeDecision[]>(`/api/signals/${ticker.toUpperCase()}`);
}

export type KnownTicker = {
  ticker: string;
  company_name: string;
  sector: string;
  industry: string;
};

/** GET /api/tickers — all tickers the algorithm watches */
export async function fetchKnownTickers(): Promise<KnownTicker[]> {
  return apiFetch<KnownTicker[]>("/api/tickers");
}

/** GET /api/chart/:ticker */
export async function fetchChartData(
  ticker: string,
  period: "1d" | "5d" | "1mo" = "1d",
  interval: "1m" | "5m" | "15m" | "1h" | "1d" = "5m",
): Promise<OHLCVBar[]> {
  return apiFetch<OHLCVBar[]>(`/api/chart/${ticker}?period=${period}&interval=${interval}`);
}
