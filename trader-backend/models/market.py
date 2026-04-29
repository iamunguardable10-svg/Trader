from dataclasses import dataclass


@dataclass
class MarketData:
    ticker: str
    price: float
    previous_close: float
    day_change_pct: float
    price_change_5m_pct: float
    price_change_15m_pct: float
    relative_volume: float
    avg_daily_volume: int
    spread_pct: float
    gap_pct: float
    atr: float
    atr_pct: float
    vwap: float
    vwap_distance_pct: float


@dataclass
class TechnicalData:
    ema_9: float
    ema_21: float
    rsi: float
    atr: float
    price_above_vwap: bool
    ema_trend: str  # "bullish" | "bearish" | "neutral"


@dataclass
class MarketContext:
    spy_trend: str    # "bullish" | "bearish" | "neutral"
    qqq_trend: str
    sector_trend: str
    vix_change_pct: float
    risk_mode: str    # "risk_on" | "risk_off" | "neutral"
