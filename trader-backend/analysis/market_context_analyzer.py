"""
Real market context via yfinance.
Fetches SPY, QQQ, VIX to determine broad market regime and sector trend.
Cached 5 minutes — no need to hit Yahoo Finance on every news item.
"""
import logging
import time

import yfinance as yf

from models.market import MarketContext

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[MarketContext, float]] = {}
TTL = 300  # 5 minutes

# Sector ETF map — used to get a per-sector trend
_SECTOR_ETF: dict[str, str] = {
    "Technology":             "XLK",
    "Communication Services": "XLC",
    "Consumer Cyclical":      "XLY",
    "Consumer Defensive":     "XLP",
    "Financial Services":     "XLF",
    "Healthcare":             "XLV",
    "Energy":                 "XLE",
    "Industrials":            "XLI",
    "Basic Materials":        "XLB",
    "Real Estate":            "XLRE",
    "Utilities":              "XLU",
}


def _ema(closes: list[float], period: int) -> float:
    if len(closes) < period:
        return closes[-1] if closes else 0.0
    k = 2 / (period + 1)
    val = sum(closes[:period]) / period
    for c in closes[period:]:
        val = c * k + val * (1 - k)
    return val


def _trend(closes: list[float]) -> str:
    if len(closes) < 21:
        return "neutral"
    e9  = _ema(closes, 9)
    e21 = _ema(closes, 21)
    if e9 > e21 * 1.0015:
        return "bullish"
    if e9 < e21 * 0.9985:
        return "bearish"
    return "neutral"


def _fetch_closes(ticker: str, period: str = "5d", interval: str = "1h") -> list[float]:
    try:
        bars = yf.Ticker(ticker).history(period=period, interval=interval)
        return bars["Close"].tolist() if not bars.empty else []
    except Exception:
        return []


class MarketContextAnalyzer:
    def get_context(self, sector: str | None) -> MarketContext:
        now = time.monotonic()

        # Global market context — cached shared across all sectors
        global_cached = _cache.get("__global__")
        if global_cached and (now - global_cached[1]) < TTL:
            spy_trend, qqq_trend, vix_change_pct, risk_mode = global_cached[0]
        else:
            spy_trend, qqq_trend, vix_change_pct, risk_mode = self._fetch_global()
            _cache["__global__"] = ((spy_trend, qqq_trend, vix_change_pct, risk_mode), now)

        # Sector trend — per-sector ETF, also cached
        sector_key = sector or "__default__"
        sector_cached = _cache.get(sector_key)
        if sector_cached and (now - sector_cached[1]) < TTL:
            sector_trend = sector_cached[0]
        else:
            etf = _SECTOR_ETF.get(sector or "", "SPY")
            closes = _fetch_closes(etf)
            sector_trend = _trend(closes) if closes else qqq_trend
            _cache[sector_key] = (sector_trend, now)

        return MarketContext(
            spy_trend=spy_trend,
            qqq_trend=qqq_trend,
            sector_trend=sector_trend,
            vix_change_pct=vix_change_pct,
            risk_mode=risk_mode,
        )

    def _fetch_global(self) -> tuple[str, str, float, str]:
        try:
            spy_closes = _fetch_closes("SPY")
            qqq_closes = _fetch_closes("QQQ")
            vix_closes = _fetch_closes("^VIX", period="2d", interval="1h")

            spy_trend = _trend(spy_closes)
            qqq_trend = _trend(qqq_closes)

            vix_now  = vix_closes[-1]  if vix_closes              else 20.0
            vix_prev = vix_closes[-2]  if len(vix_closes) >= 2    else vix_now
            vix_change_pct = round((vix_now - vix_prev) / vix_prev * 100, 2) if vix_prev else 0.0

            if vix_now > 30 or vix_change_pct > 15:
                risk_mode = "risk_off"
            elif vix_now < 18 and spy_trend == "bullish":
                risk_mode = "risk_on"
            else:
                risk_mode = "neutral"

            logger.debug(f"[MarketCtx] SPY={spy_trend} QQQ={qqq_trend} VIX={vix_now:.1f} ({vix_change_pct:+.1f}%) → {risk_mode}")
            return spy_trend, qqq_trend, vix_change_pct, risk_mode

        except Exception as exc:
            logger.warning(f"[MarketCtx] Fetch failed: {exc} — using neutral defaults")
            return "neutral", "neutral", 0.0, "neutral"
