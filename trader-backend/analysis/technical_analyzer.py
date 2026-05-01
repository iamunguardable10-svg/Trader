"""
Technical Analyzer

Computes EMA-9, EMA-21, RSI-14, VWAP position, EMA trend, and ATR.

Primary source: Alpaca Data API (15-min bars, last 5 trading days)
Fallback:       yfinance
"""
import logging
import time

from models.market import TechnicalData

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[TechnicalData, float]] = {}
_TTL   = 120  # seconds


def _ema(closes: list[float], period: int) -> float:
    if len(closes) < period:
        return closes[-1] if closes else 0.0
    k   = 2 / (period + 1)
    val = sum(closes[:period]) / period
    for c in closes[period:]:
        val = c * k + val * (1 - k)
    return val


def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    recent = deltas[-period:]
    gains  = [max(d, 0) for d in recent]
    losses = [abs(min(d, 0)) for d in recent]
    avg_g  = sum(gains)  / period
    avg_l  = sum(losses) / period
    if avg_l == 0:
        return 100.0
    return round(100 - (100 / (1 + avg_g / avg_l)), 1)


def _defaults() -> TechnicalData:
    return TechnicalData(ema_9=0.0, ema_21=0.0, rsi=50.0, price_above_vwap=True, ema_trend="neutral", atr=0.0)


class TechnicalAnalyzer:
    def calculate(self, ticker: str) -> TechnicalData:
        ticker = ticker.upper()
        now    = time.monotonic()
        cached = _cache.get(ticker)
        if cached and (now - cached[1]) < _TTL:
            return cached[0]

        result = self._from_alpaca(ticker) or self._from_yfinance(ticker)
        if result:
            _cache[ticker] = (result, now)
            return result

        return cached[0] if cached else _defaults()

    def _from_alpaca(self, ticker: str) -> TechnicalData | None:
        try:
            from data.alpaca_market_data import get_intraday_bars
            # 15-min bars over 5 days → ~130 bars, enough for EMA-21 + RSI-14
            bars = get_intraday_bars(ticker, minutes=15)
            if len(bars) < 22:
                return None
            return _compute(bars)
        except Exception as exc:
            logger.debug(f"[TechnicalAnalyzer] Alpaca failed for {ticker}: {exc}")
            return None

    def _from_yfinance(self, ticker: str) -> TechnicalData | None:
        try:
            import yfinance as yf
            raw = yf.Ticker(ticker).history(period="5d", interval="15m")
            if len(raw) < 22:
                return None
            from data.alpaca_market_data import BarRow
            bars = [
                BarRow(
                    open   = float(row["Open"]),
                    high   = float(row["High"]),
                    low    = float(row["Low"]),
                    close  = float(row["Close"]),
                    volume = float(row["Volume"]),
                    vwap   = float((row["High"] + row["Low"] + row["Close"]) / 3),
                )
                for _, row in raw.iterrows()
            ]
            return _compute(bars)
        except Exception as exc:
            logger.warning(f"[TechnicalAnalyzer] yfinance failed for {ticker}: {exc}")
            return None


def _compute(bars) -> TechnicalData:
    closes  = [b.close  for b in bars]
    highs   = [b.high   for b in bars]
    lows    = [b.low    for b in bars]
    volumes = [b.volume for b in bars]

    ema9  = _ema(closes, 9)
    ema21 = _ema(closes, 21)
    rsi   = _rsi(closes, 14)

    vol_sum  = sum(volumes) or 1
    typicals = [(highs[i] + lows[i] + closes[i]) / 3 for i in range(len(closes))]
    vwap     = sum(typicals[i] * volumes[i] for i in range(len(closes))) / vol_sum

    price           = closes[-1]
    price_above_vwap = price > vwap
    ema_trend        = "bullish" if ema9 > ema21 else ("bearish" if ema9 < ema21 else "neutral")

    tr_vals = [
        max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
        for i in range(1, len(closes))
    ]
    atr = sum(tr_vals[-14:]) / 14 if len(tr_vals) >= 14 else 0.0

    return TechnicalData(
        ema_9            = round(ema9, 4),
        ema_21           = round(ema21, 4),
        rsi              = round(rsi, 1),
        price_above_vwap = price_above_vwap,
        ema_trend        = ema_trend,
        atr              = round(atr, 4),
    )
