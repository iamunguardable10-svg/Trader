"""
Real market data via yfinance.
All results are TTL-cached to avoid hammering Yahoo Finance on every request.
Falls back to stale cache (or defaults) on network errors.
"""
import logging
import time
from datetime import timedelta

import yfinance as yf

from models.market import MarketData

logger = logging.getLogger(__name__)

# ── cache stores ──────────────────────────────────────────────────────────────

# MarketData cache: ticker → (MarketData, fetched_at_unix)
_md_cache:    dict[str, tuple[MarketData, float]] = {}
MD_TTL = 60          # seconds

# Chart cache: (ticker, period, interval) → (bars, fetched_at_unix)
_chart_cache: dict[tuple, tuple[list, float]] = {}
# shorter TTL for intraday, longer for multi-day views
_CHART_TTL: dict[str, int] = {
    "1d":  120,   # 2 min — intraday bars change frequently
    "5d":  300,   # 5 min
    "1mo": 600,   # 10 min
    "3mo": 900,   # 15 min
}


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val) if val is not None and val == val else default
    except (TypeError, ValueError):
        return default


class MarketDataProvider:
    def get_market_data(self, ticker: str) -> MarketData:
        ticker = ticker.upper()
        now = time.monotonic()
        cached = _md_cache.get(ticker)
        if cached and (now - cached[1]) < MD_TTL:
            return cached[0]
        try:
            data = self._fetch(ticker)
            _md_cache[ticker] = (data, now)
            return data
        except Exception as exc:
            logger.warning(f"[MarketData] yfinance failed for {ticker}: {exc} — using cache/defaults")
            return (cached[0] if cached else self._defaults(ticker))

    def _fetch(self, ticker: str) -> MarketData:
        t = yf.Ticker(ticker)
        info = t.fast_info

        price        = _safe_float(getattr(info, "last_price",       None))
        prev_close   = _safe_float(getattr(info, "previous_close",   None)) or price
        day_chg_pct  = ((price - prev_close) / prev_close * 100) if prev_close else 0.0

        # Intraday 5-min bars for short-term momentum and ATR
        bars = t.history(period="1d", interval="5m")
        price_5m_pct  = 0.0
        price_15m_pct = 0.0
        atr           = 0.0
        vwap          = price

        if len(bars) >= 4:
            closes        = bars["Close"].values
            price_5m_pct  = (closes[-1] - closes[-2]) / closes[-2] * 100 if closes[-2] else 0.0
            price_15m_pct = (closes[-1] - closes[-4]) / closes[-4] * 100 if closes[-4] else 0.0

            highs  = bars["High"].values
            lows   = bars["Low"].values
            tr     = [max(h - l, abs(h - c), abs(l - c))
                      for h, l, c in zip(highs[1:], lows[1:], closes[:-1])]
            atr    = sum(tr[-14:]) / len(tr[-14:]) if tr else 0.0

            typical = (bars["High"] + bars["Low"] + bars["Close"]) / 3
            volumes  = bars["Volume"]
            vwap     = float((typical * volumes).sum() / volumes.sum()) if volumes.sum() > 0 else price

        avg_vol   = _safe_float(getattr(info, "three_month_average_volume", None))
        day_vol   = _safe_float(getattr(info, "day_volume",                 None))
        rel_vol   = (day_vol / avg_vol) if avg_vol > 0 else 1.0

        open_price = _safe_float(getattr(info, "open",          None)) or price
        gap_pct    = ((open_price - prev_close) / prev_close * 100) if prev_close else 0.0

        atr_pct    = (atr / price * 100) if price > 0 else 0.0
        vwap_dist  = ((price - vwap) / vwap * 100) if vwap > 0 else 0.0

        return MarketData(
            ticker=ticker,
            price=round(price, 2),
            previous_close=round(prev_close, 2),
            day_change_pct=round(day_chg_pct, 2),
            price_change_5m_pct=round(price_5m_pct, 3),
            price_change_15m_pct=round(price_15m_pct, 3),
            relative_volume=round(rel_vol, 2),
            avg_daily_volume=int(avg_vol),
            spread_pct=0.03,
            gap_pct=round(gap_pct, 2),
            atr=round(atr, 4),
            atr_pct=round(atr_pct, 3),
            vwap=round(vwap, 2),
            vwap_distance_pct=round(vwap_dist, 3),
        )

    @staticmethod
    def _defaults(ticker: str) -> MarketData:
        return MarketData(
            ticker=ticker,
            price=0.0, previous_close=0.0, day_change_pct=0.0,
            price_change_5m_pct=0.0, price_change_15m_pct=0.0,
            relative_volume=1.0, avg_daily_volume=1_000_000,
            spread_pct=0.05, gap_pct=0.0,
            atr=0.0, atr_pct=0.0, vwap=0.0, vwap_distance_pct=0.0,
        )


def get_chart_data(ticker: str, period: str = "1d", interval: str = "5m") -> list[dict]:
    """Return OHLCV bars for charting. Results are TTL-cached per (ticker, period, interval)."""
    ticker = ticker.upper()
    key    = (ticker, period, interval)
    ttl    = _CHART_TTL.get(period, 300)
    now    = time.monotonic()

    cached = _chart_cache.get(key)
    if cached and (now - cached[1]) < ttl:
        return cached[0]

    try:
        bars = yf.Ticker(ticker).history(period=period, interval=interval)
        result = []
        for ts, row in bars.iterrows():
            result.append({
                "time":   ts.strftime("%H:%M") if period == "1d" else ts.strftime("%Y-%m-%d"),
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row["Volume"]),
            })
        _chart_cache[key] = (result, now)
        return result
    except Exception as exc:
        logger.warning(f"[Chart] Failed for {ticker}: {exc}")
        return (cached[0] if cached else [])
