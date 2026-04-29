from models.market import TechnicalData

# Mock technical data — replace with real calculation (pandas-ta, TA-Lib, etc.)
_MOCK: dict[str, dict] = {
    "TSLA": dict(ema_9=238.70, ema_21=240.10, rsi=41,  atr=2.25, price_above_vwap=False, ema_trend="bearish"),
    "NVDA": dict(ema_9=888.20, ema_21=880.10, rsi=62,  atr=8.50, price_above_vwap=True,  ema_trend="bullish"),
    "AAPL": dict(ema_9=188.40, ema_21=186.90, rsi=55,  atr=2.10, price_above_vwap=True,  ema_trend="bullish"),
    "META": dict(ema_9=513.00, ema_21=518.00, rsi=44,  atr=9.20, price_above_vwap=False, ema_trend="bearish"),
    "AMD":  dict(ema_9=163.00, ema_21=167.00, rsi=36,  atr=4.10, price_above_vwap=False, ema_trend="bearish"),
}

_DEFAULT = "TSLA"


class TechnicalAnalyzer:
    def calculate(self, ticker: str) -> TechnicalData:
        raw = _MOCK.get(ticker.upper(), _MOCK[_DEFAULT])
        return TechnicalData(**raw)
