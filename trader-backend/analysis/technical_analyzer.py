"""
Real technical indicator calculations via yfinance.
Computes EMA-9, EMA-21, RSI-14, VWAP position and trend for any ticker.
Results are TTL-cached to avoid repeated network calls.
"""
import logging
import time

import yfinance as yf

from models.market import TechnicalData

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[TechnicalData, float]] = {}
TTL = 120  # seconds


def _ema(closes: list[float], period: int) -> float:
    if len(closes) < period:
        return closes[-1] if closes else 0.0
    k = 2 / (period + 1)
    val = sum(closes[:period]) / period
    for c in closes[period:]:
        val = c * k + val * (1 - k)
    return val


def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    recent = deltas[-period:]
    gains  = [max(d, 0) for d in recent]
    losses = [abs(min(d, 0)) for d in recent]
    avg_g  = sum(gains)  / period
    avg_l  = sum(losses) / period
    if avg_l == 0:
        return 100.0
    return round(100 - (100 / (1 + avg_g / avg_l)), 1)


def _defaults(ticker: str) -> TechnicalData:
    return TechnicalData(
        ema_9=0.0, ema_21=0.0, rsi=50.0,
        price_above_vwap=True, ema_trend="neutral", atr=0.0,
    )


class TechnicalAnalyzer:
    def calculate(self, ticker: str) -> TechnicalData:
        ticker = ticker.upper()
        now    = time.monotonic()
        cached = _cache.get(ticker)
        if cached and (now - cached[1]) < TTL:
            return cached[0]

        try:
            result = self._fetch(ticker)
            _cache[ticker] = (result, now)
            return result
        except Exception as exc:
            logger.warning(f"[TechnicalAnalyzer] Failed for {ticker}: {exc}")
            return cached[0] if cached else _defaults(ticker)

    def _fetch(self, ticker: str) -> TechnicalData:
        # 5-day 15m bars give ~130 bars — enough for EMA-21 + RSI-14
        bars = yf.Ticker(ticker).history(period="5d", interval="15m")

        if len(bars) < 22:
            return _defaults(ticker)

        closes  = bars["Close"].tolist()
        highs   = bars["High"].tolist()
        lows    = bars["Low"].tolist()
        volumes = bars["Volume"].tolist()

        ema9  = _ema(closes, 9)
        ema21 = _ema(closes, 21)
        rsi   = _rsi(closes, 14)

        # VWAP over the last session
        typical = [(highs[i] + lows[i] + closes[i]) / 3 for i in range(len(closes))]
        vol_sum = sum(volumes) or 1
        vwap    = sum(typical[i] * volumes[i] for i in range(len(closes))) / vol_sum

        price           = closes[-1]
        price_above_vwap = price > vwap
        ema_trend       = "bullish" if ema9 > ema21 else ("bearish" if ema9 < ema21 else "neutral")

        # ATR(14) from last 14 bars
        tr_vals = [
            max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
            for i in range(1, len(closes))
        ]
        atr = sum(tr_vals[-14:]) / 14 if len(tr_vals) >= 14 else 0.0

        return TechnicalData(
            ema_9=round(ema9, 4),
            ema_21=round(ema21, 4),
            rsi=round(rsi, 1),
            price_above_vwap=price_above_vwap,
            ema_trend=ema_trend,
            atr=round(atr, 4),
        )
