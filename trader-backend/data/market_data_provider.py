from models.market import MarketData

# Mock market data — replace with real API (yfinance, Alpaca, Polygon, etc.)
_MOCK: dict[str, dict] = {
    "TSLA": dict(
        price=238.40, previous_close=243.50, day_change_pct=-2.10,
        price_change_5m_pct=-0.80, price_change_15m_pct=-1.30,
        relative_volume=2.30, avg_daily_volume=95_000_000,
        spread_pct=0.04, gap_pct=-1.70,
        atr=2.25, atr_pct=0.94, vwap=239.85, vwap_distance_pct=-0.60,
    ),
    "NVDA": dict(
        price=890.20, previous_close=870.00, day_change_pct=2.32,
        price_change_5m_pct=0.45, price_change_15m_pct=1.10,
        relative_volume=1.80, avg_daily_volume=60_000_000,
        spread_pct=0.03, gap_pct=1.20,
        atr=8.50, atr_pct=0.95, vwap=884.50, vwap_distance_pct=0.64,
    ),
    "AAPL": dict(
        price=188.60, previous_close=186.20, day_change_pct=1.29,
        price_change_5m_pct=0.20, price_change_15m_pct=0.55,
        relative_volume=1.10, avg_daily_volume=55_000_000,
        spread_pct=0.02, gap_pct=0.80,
        atr=2.10, atr_pct=1.11, vwap=188.10, vwap_distance_pct=0.27,
    ),
    "META": dict(
        price=512.00, previous_close=520.00, day_change_pct=-1.54,
        price_change_5m_pct=-0.40, price_change_15m_pct=-0.90,
        relative_volume=1.60, avg_daily_volume=20_000_000,
        spread_pct=0.04, gap_pct=-0.50,
        atr=9.20, atr_pct=1.80, vwap=514.50, vwap_distance_pct=-0.49,
    ),
    "AMD": dict(
        price=162.40, previous_close=168.00, day_change_pct=-3.33,
        price_change_5m_pct=-0.60, price_change_15m_pct=-1.20,
        relative_volume=2.10, avg_daily_volume=45_000_000,
        spread_pct=0.05, gap_pct=-2.10,
        atr=4.10, atr_pct=2.53, vwap=164.20, vwap_distance_pct=-1.10,
    ),
}

_DEFAULT = "TSLA"


class MarketDataProvider:
    def get_market_data(self, ticker: str) -> MarketData:
        raw = _MOCK.get(ticker.upper(), _MOCK[_DEFAULT])
        return MarketData(ticker=ticker.upper(), **raw)
