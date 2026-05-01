"""
Market Data Provider

Primary source: Alpaca Data API (official, reliable, provides real bid/ask)
Fallback:       yfinance (when no Alpaca key or on API failure)

All results are TTL-cached to avoid hammering APIs on every request.
"""
import logging
import time

from models.market import MarketData

logger = logging.getLogger(__name__)

_cache:   dict[str, tuple[MarketData, float]] = {}
_MD_TTL = 30  # seconds — shorter than before since Alpaca is reliable

_chart_cache: dict[tuple, tuple[list, float]] = {}
_CHART_TTL: dict[str, int] = {
    "1d":  120,
    "5d":  300,
    "1mo": 600,
    "3mo": 900,
}


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val) if val is not None and val == val else default
    except (TypeError, ValueError):
        return default


class MarketDataProvider:
    def get_market_data(self, ticker: str) -> MarketData:
        ticker = ticker.upper()
        now    = time.monotonic()
        cached = _cache.get(ticker)
        if cached and (now - cached[1]) < _MD_TTL:
            return cached[0]

        data = self._fetch_alpaca(ticker) or self._fetch_yfinance(ticker)
        if data:
            _cache[ticker] = (data, now)
            return data

        if cached:
            return cached[0]
        return self._defaults(ticker)

    # ── Alpaca ────────────────────────────────────────────────────────────────

    def _fetch_alpaca(self, ticker: str) -> MarketData | None:
        from data.alpaca_market_data import get_snapshot, get_intraday_bars, get_daily_bars

        snap = get_snapshot(ticker)
        if not snap or not snap.get("price"):
            return None

        price      = snap["price"]
        prev_close = snap["prev_close"] or price
        today_open = snap["today_open"] or price
        today_vol  = snap["today_volume"]
        today_vwap = snap["today_vwap"] or price
        bid        = snap["bid"]
        ask        = snap["ask"]

        # Spread from real bid/ask
        spread_pct = ((ask - bid) / price * 100) if price > 0 and ask > bid else 0.03

        # Day change
        day_change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0.0

        # Gap (open vs previous close)
        gap_pct = ((today_open - prev_close) / prev_close * 100) if prev_close else 0.0

        # Intraday 5-min bars
        bars5 = get_intraday_bars(ticker, minutes=5)

        price_5m_pct  = 0.0
        price_15m_pct = 0.0
        atr           = 0.0
        vwap          = today_vwap

        if len(bars5) >= 4:
            closes = [b.close for b in bars5]
            highs  = [b.high  for b in bars5]
            lows   = [b.low   for b in bars5]
            vols   = [b.volume for b in bars5]

            price_5m_pct  = (closes[-1] - closes[-2]) / closes[-2] * 100 if closes[-2] else 0.0
            price_15m_pct = (closes[-1] - closes[-4]) / closes[-4] * 100 if closes[-4] else 0.0

            tr = [
                max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
                for i in range(1, len(closes))
            ]
            atr = sum(tr[-14:]) / len(tr[-14:]) if tr else 0.0

            # VWAP from intraday bars (fallback if snapshot vwap was 0)
            if not today_vwap and sum(vols) > 0:
                typicals = [(highs[i] + lows[i] + closes[i]) / 3 for i in range(len(closes))]
                vwap     = sum(typicals[i] * vols[i] for i in range(len(closes))) / sum(vols)

        # Average daily volume from 30-day daily bars
        daily_bars = get_daily_bars(ticker, days=30)
        if daily_bars:
            avg_vol = int(sum(b.volume for b in daily_bars[-20:]) / min(20, len(daily_bars)))
        else:
            avg_vol = int(today_vol) or 1_000_000

        rel_vol  = (today_vol / avg_vol) if avg_vol > 0 and today_vol > 0 else 1.0
        atr_pct  = (atr / price * 100) if price > 0 else 0.0
        vwap_dist = ((price - vwap) / vwap * 100) if vwap > 0 else 0.0

        return MarketData(
            ticker               = ticker,
            price                = round(price, 2),
            previous_close       = round(prev_close, 2),
            day_change_pct       = round(day_change_pct, 2),
            price_change_5m_pct  = round(price_5m_pct, 3),
            price_change_15m_pct = round(price_15m_pct, 3),
            relative_volume      = round(rel_vol, 2),
            avg_daily_volume     = avg_vol,
            spread_pct           = round(spread_pct, 4),
            gap_pct              = round(gap_pct, 2),
            atr                  = round(atr, 4),
            atr_pct              = round(atr_pct, 3),
            vwap                 = round(vwap, 2),
            vwap_distance_pct    = round(vwap_dist, 3),
        )

    # ── yfinance fallback ─────────────────────────────────────────────────────

    def _fetch_yfinance(self, ticker: str) -> MarketData | None:
        try:
            import yfinance as yf
            t    = yf.Ticker(ticker)
            info = t.fast_info

            price       = _safe_float(getattr(info, "last_price",     None))
            prev_close  = _safe_float(getattr(info, "previous_close", None)) or price
            day_chg_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0.0

            bars = t.history(period="1d", interval="5m")
            price_5m_pct  = 0.0
            price_15m_pct = 0.0
            atr           = 0.0
            vwap          = price

            if len(bars) >= 4:
                closes = bars["Close"].values
                highs  = bars["High"].values
                lows   = bars["Low"].values
                volumes= bars["Volume"].values

                price_5m_pct  = (closes[-1] - closes[-2]) / closes[-2] * 100 if closes[-2] else 0.0
                price_15m_pct = (closes[-1] - closes[-4]) / closes[-4] * 100 if closes[-4] else 0.0

                tr   = [max(highs[i]-lows[i], abs(highs[i]-closes[i-1]), abs(lows[i]-closes[i-1]))
                        for i in range(1, len(closes))]
                atr  = sum(tr[-14:]) / len(tr[-14:]) if tr else 0.0

                typical = (bars["High"] + bars["Low"] + bars["Close"]) / 3
                vol_sum = bars["Volume"].sum()
                vwap    = float((typical * bars["Volume"]).sum() / vol_sum) if vol_sum > 0 else price

            avg_vol   = _safe_float(getattr(info, "three_month_average_volume", None))
            day_vol   = _safe_float(getattr(info, "day_volume", None))
            if day_vol == 0 and not bars.empty:
                day_vol = float(bars["Volume"].sum())

            rel_vol  = (day_vol / avg_vol) if avg_vol > 0 and day_vol > 0 else 1.0
            open_px  = _safe_float(getattr(info, "open", None)) or price
            gap_pct  = ((open_px - prev_close) / prev_close * 100) if prev_close else 0.0
            atr_pct  = (atr / price * 100) if price > 0 else 0.0
            vwap_dist = ((price - vwap) / vwap * 100) if vwap > 0 else 0.0

            return MarketData(
                ticker               = ticker,
                price                = round(price, 2),
                previous_close       = round(prev_close, 2),
                day_change_pct       = round(day_chg_pct, 2),
                price_change_5m_pct  = round(price_5m_pct, 3),
                price_change_15m_pct = round(price_15m_pct, 3),
                relative_volume      = round(rel_vol, 2),
                avg_daily_volume     = int(avg_vol),
                spread_pct           = 0.03,
                gap_pct              = round(gap_pct, 2),
                atr                  = round(atr, 4),
                atr_pct              = round(atr_pct, 3),
                vwap                 = round(vwap, 2),
                vwap_distance_pct    = round(vwap_dist, 3),
            )
        except Exception as exc:
            logger.warning(f"[MarketData] yfinance failed for {ticker}: {exc}")
            return None

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
    """OHLCV bars for charting. Alpaca primary, yfinance fallback."""
    ticker = ticker.upper()
    key    = (ticker, period, interval)
    ttl    = _CHART_TTL.get(period, 300)
    now    = time.monotonic()

    cached = _chart_cache.get(key)
    if cached and (now - cached[1]) < ttl:
        return cached[0]

    result = _chart_from_alpaca(ticker, period, interval) or _chart_from_yfinance(ticker, period, interval)
    if result:
        _chart_cache[key] = (result, now)
    return result or (cached[0] if cached else [])


def _chart_from_alpaca(ticker: str, period: str, interval: str) -> list[dict] | None:
    try:
        from data.alpaca_market_data import get_intraday_bars, get_daily_bars
        from alpaca.data.requests import StockBarsRequest
        from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
        from alpaca.data.enums import DataFeed
        from datetime import datetime, timedelta, timezone
        from data.alpaca_market_data import _get_client, _feed

        client = _get_client()
        if not client:
            return None

        _period_days = {"1d": 1, "5d": 5, "1mo": 30, "3mo": 90}
        _interval_map = {
            "1m":  TimeFrame(1,  TimeFrameUnit.Minute),
            "5m":  TimeFrame(5,  TimeFrameUnit.Minute),
            "15m": TimeFrame(15, TimeFrameUnit.Minute),
            "1h":  TimeFrame(1,  TimeFrameUnit.Hour),
            "1d":  TimeFrame(1,  TimeFrameUnit.Day),
        }
        tf = _interval_map.get(interval)
        if not tf:
            return None

        days  = _period_days.get(period, 1)
        start = datetime.now(timezone.utc) - timedelta(days=days + 2)

        resp  = client.get_stock_bars(
            StockBarsRequest(
                symbol_or_symbols = ticker,
                timeframe         = tf,
                start             = start,
                feed              = _feed(),
            )
        )
        raw = resp.get(ticker) or []
        return [
            {
                "time":   b.timestamp.strftime("%H:%M") if period == "1d" else b.timestamp.strftime("%Y-%m-%d"),
                "open":   round(float(b.open), 2),
                "high":   round(float(b.high), 2),
                "low":    round(float(b.low),  2),
                "close":  round(float(b.close), 2),
                "volume": int(b.volume),
            }
            for b in raw
        ] or None
    except Exception as exc:
        logger.debug(f"[Chart] Alpaca chart failed for {ticker}: {exc}")
        return None


def _chart_from_yfinance(ticker: str, period: str, interval: str) -> list[dict] | None:
    try:
        import yfinance as yf
        bars = yf.Ticker(ticker).history(period=period, interval=interval)
        return [
            {
                "time":   ts.strftime("%H:%M") if period == "1d" else ts.strftime("%Y-%m-%d"),
                "open":   round(float(row["Open"]),  2),
                "high":   round(float(row["High"]),  2),
                "low":    round(float(row["Low"]),   2),
                "close":  round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            }
            for ts, row in bars.iterrows()
        ] or None
    except Exception as exc:
        logger.warning(f"[Chart] yfinance chart failed for {ticker}: {exc}")
        return None
