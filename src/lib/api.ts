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

export type MarketStatus = {
  is_open: boolean;
  reason: string;   // "Open" | "Pre-Market" | "After Hours" | "Weekend" | "Market Holiday"
  session: string;  // "regular" | "pre" | "after" | "closed"
  et_time: string;  // "09:45"
};

/** GET /api/market/status */
export async function fetchMarketStatus(): Promise<MarketStatus> {
  return apiFetch<MarketStatus>("/api/market/status");
}

export type AccountInfo = {
  equity:       number;
  buying_power: number;
  cash:         number;
  paper:        boolean;
  status:       string;
  connected:    boolean;
  error?:       string;
};

/** GET /api/account */
export async function fetchAccount(): Promise<AccountInfo> {
  return apiFetch<AccountInfo>("/api/account");
}

export type AutoExecuteState = {
  enabled:   boolean;
  min_score: number;
  broker:    string;
};

/** GET /api/auto-execute */
export async function fetchAutoExecute(): Promise<AutoExecuteState> {
  return apiFetch<AutoExecuteState>("/api/auto-execute");
}

/** POST /api/auto-execute */
export async function setAutoExecute(enabled: boolean, minScore?: number): Promise<AutoExecuteState> {
  return apiFetch<AutoExecuteState>("/api/auto-execute", {
    method: "POST",
    body: JSON.stringify({ enabled, min_score: minScore ?? null }),
  });
}

/** POST /api/kill-switch */
export async function triggerKillSwitch(): Promise<{ closed: number; auto_execute_disabled: boolean }> {
  return apiFetch("/api/kill-switch", { method: "POST" });
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

export type PaperPosition = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  entry_time: string;
  entry_price: number;
  position_size: number;
  stop_loss: number;
  take_profit: number;
  status: "OPEN";
  decision_id: string | null;
  current_price?: number;
  live_pnl?: number;
  live_pnl_pct?: number;
};

/** GET /api/paper-trade/open — all open positions */
export async function fetchOpenPositions(): Promise<PaperPosition[]> {
  return apiFetch<PaperPosition[]>("/api/paper-trade/open");
}

/** GET /api/paper-trade/position/:ticker — open position for one ticker (null if none) */
export async function fetchPositionForTicker(ticker: string): Promise<PaperPosition | null> {
  return apiFetch<PaperPosition | null>(`/api/paper-trade/position/${ticker.toUpperCase()}`);
}

/** POST /api/paper-trade/open */
export async function openPaperTrade(
  decisionId: string,
  customStopLoss?: number,
  customPositionSize?: number,
): Promise<PaperPosition> {
  return apiFetch("/api/paper-trade/open", {
    method: "POST",
    body: JSON.stringify({
      decision_id:          decisionId,
      custom_stop_loss:     customStopLoss     ?? null,
      custom_position_size: customPositionSize ?? null,
    }),
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
  period: "1d" | "5d" | "1mo" | "3mo" = "1d",
  interval: "1m" | "5m" | "15m" | "1h" | "1d" = "5m",
): Promise<OHLCVBar[]> {
  return apiFetch<OHLCVBar[]>(`/api/chart/${ticker}?period=${period}&interval=${interval}`);
}

// ── Dev / Testing ─────────────────────────────────────────────────────────────

export type DevScoreResult = {
  decision: string;
  strength: string;
  final_score: number;
  trade_allowed: boolean;
  blocking_reasons: string[];
  scores: Record<string, number>;
  news: { event_type: string; directional_bias: string; importance: number; confidence: number; surprise_level: number; reasoning_summary: string };
  market_data: Record<string, number> | null;
  technical_data: Record<string, number | boolean | string> | null;
  market_context: Record<string, string | number> | null;
};

/** POST /api/dev/score — run algorithm on a headline without logging */
export async function devScore(headline: string, ticker: string, body = ""): Promise<DevScoreResult> {
  return apiFetch<DevScoreResult>("/api/dev/score", {
    method: "POST",
    body: JSON.stringify({ headline, ticker, body }),
  });
}

export type BacktestResult = {
  ticker: string; direction: string; logged_at: string;
  entry_price: number; ret_15m: number | null; ret_30m: number | null; ret_45m: number | null;
  correct_15m: boolean | null; correct_45m: boolean | null;
  score: number; strength: string;
};

export type BacktestResponse = {
  signals: number; evaluated: number;
  summary: { win_rate_45m: number | null; avg_return_45m: number; wins: number; losses: number };
  results: BacktestResult[];
};

/** GET /api/backtest */
export async function fetchBacktest(limit = 200): Promise<BacktestResponse> {
  return apiFetch<BacktestResponse>(`/api/backtest?limit=${limit}`);
}
