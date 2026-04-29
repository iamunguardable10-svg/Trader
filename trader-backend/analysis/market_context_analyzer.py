from models.market import MarketContext

# Mock context — replace with real SPY/QQQ/VIX data (yfinance, Polygon, etc.)
_SECTOR_CONTEXT: dict[str, dict] = {
    "Technology": dict(
        spy_trend="neutral", qqq_trend="bullish", sector_trend="bullish",
        vix_change_pct=-2.1, risk_mode="risk_on",
    ),
    "Consumer Cyclical": dict(
        spy_trend="neutral", qqq_trend="bearish", sector_trend="bearish",
        vix_change_pct=4.2, risk_mode="neutral",
    ),
    "Communication Services": dict(
        spy_trend="neutral", qqq_trend="neutral", sector_trend="neutral",
        vix_change_pct=1.0, risk_mode="neutral",
    ),
    "Financial Services": dict(
        spy_trend="bullish", qqq_trend="neutral", sector_trend="neutral",
        vix_change_pct=-0.5, risk_mode="risk_on",
    ),
}

_DEFAULT = dict(
    spy_trend="neutral", qqq_trend="neutral", sector_trend="neutral",
    vix_change_pct=0.0, risk_mode="neutral",
)


class MarketContextAnalyzer:
    def get_context(self, sector: str | None) -> MarketContext:
        raw = _SECTOR_CONTEXT.get(sector or "", _DEFAULT)
        return MarketContext(**raw)
