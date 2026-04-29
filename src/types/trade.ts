export type Decision = "LONG" | "SHORT" | "NO_TRADE";
export type Strength = "strong" | "medium" | "blocked" | "none";
export type Trend = "bullish" | "bearish" | "neutral";
export type RiskMode = "risk_on" | "risk_off" | "neutral";
export type AppMode = "paper" | "live" | "backtest";
export type DirectionalBias = "bullish" | "bearish" | "neutral";

export type TradeDecision = {
  mode: AppMode;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  decision: Decision;
  strength: Strength;
  trade_allowed: boolean;
  blocking_reasons: string[];
  final_score: number;
  confidence: number;

  news: {
    headline: string;
    source: string;
    published_at: string;
    url: string | null;
    event_type: string;
    directional_bias: DirectionalBias;
    importance: number;
    surprise_level: number;
    reasoning_summary: string;
    key_risks: string[];
  };

  scores: {
    news_score: number;
    surprise_score: number;
    momentum_score: number;
    volume_score: number;
    technical_score: number;
    market_score: number;
    sector_score: number;
    risk_penalty: number;
    overextension_penalty: number;
    uncertainty_penalty: number;
    final_score: number;
  };

  market_data: {
    price: number;
    day_change_pct: number;
    price_change_5m_pct: number;
    price_change_15m_pct: number;
    relative_volume: number;
    avg_daily_volume: number;
    spread_pct: number;
    gap_pct: number;
    atr: number;
    atr_pct: number;
    vwap: number;
    vwap_distance_pct: number;
  };

  technical_data: {
    ema_9: number;
    ema_21: number;
    rsi: number;
    price_above_vwap: boolean;
    ema_trend: Trend;
  };

  market_context: {
    spy_trend: Trend;
    qqq_trend: Trend;
    sector_trend: Trend;
    vix_change_pct: number;
    risk_mode: RiskMode;
  };

  trade_plan: null | {
    direction: Decision;
    entry_price: number;
    stop_loss: number;
    take_profit: number;
    position_size: number;
    risk_amount: number;
    reward_amount: number;
    risk_reward_ratio: number;
  };

  exit_plan: null | {
    max_hold_minutes: number;
    stop_loss_type: string;
    take_profit_type: string;
    take_profit_r_multiple: number;
    trailing_stop_enabled: boolean;
    trailing_stop_after_r: number;
    trailing_stop_atr_multiplier: number;
    exit_on_opposite_news: boolean;
    exit_if_score_reverses: boolean;
  };

  explanation: string;
};

export type TradeHistoryEntry = {
  id: string;
  timestamp: string;
  ticker: string;
  decision: Decision;
  score: number;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  status: "open" | "closed" | "skipped";
  exit_reason: string | null;
  hold_minutes: number | null;
};

export type PerformanceData = {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  sharpe_ratio: number | null;
  equity_curve: { date: string; equity: number }[];
};
