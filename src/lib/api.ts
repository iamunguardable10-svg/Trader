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

/** GET /api/latest-decision */
export async function fetchLatestDecision(): Promise<TradeDecision> {
  return apiFetch<TradeDecision>("/api/latest-decision");
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
