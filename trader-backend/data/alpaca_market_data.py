"""
Alpaca Market Data Client

Provides OHLCV bars and snapshots via the official Alpaca Data API.
Used by MarketDataProvider and TechnicalAnalyzer as the primary data source.

Free tier (IEX feed): ~15-min delayed but sufficient for paper trading.
Paid tier (SIP feed): real-time — set ALPACA_DATA_FEED=sip to activate.

Falls back to yfinance automatically when:
  - ALPACA_API_KEY is not set
  - An Alpaca API call fails

Cache TTLs:
  - Snapshot (price, volume, spread): 30 seconds
  - Intraday bars (5-min):            60 seconds
  - Technical bars (15-min):         120 seconds
  - Daily bars (avg volume):        3600 seconds (1 hour)
"""
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

logger = logging.getLogger(__name__)

_FEED = os.getenv("ALPACA_DATA_FEED", "iex").lower()  # "iex" or "sip"

# ── cache ─────────────────────────────────────────────────────────────────────

_snapshot_cache: dict[str, tuple[dict, float]] = {}
_bars5_cache:    dict[str, tuple[list, float]]  = {}
_bars15_cache:   dict[str, tuple[list, float]]  = {}
_daily_cache:    dict[str, tuple[list, float]]  = {}

_TTL_SNAPSHOT = 30
_TTL_BARS5    = 60
_TTL_BARS15   = 120
_TTL_DAILY    = 3600

# ── lazy client ───────────────────────────────────────────────────────────────

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    api_key = os.getenv("ALPACA_API_KEY")
    secret  = os.getenv("ALPACA_SECRET_KEY")
    if not api_key or not secret:
        return None
    try:
        from alpaca.data.historical import StockHistoricalDataClient
        _client = StockHistoricalDataClient(api_key, secret)
        logger.info(f"[AlpacaData] Client initialised (feed={_FEED})")
        return _client
    except Exception as exc:
        logger.warning(f"[AlpacaData] Could not initialise client: {exc}")
        return None


def _feed():
    from alpaca.data.enums import DataFeed
    return DataFeed.SIP if _FEED == "sip" else DataFeed.IEX


# ── public API ────────────────────────────────────────────────────────────────

class BarRow(NamedTuple):
    open:   float
    high:   float
    low:    float
    close:  float
    volume: float
    vwap:   float


def get_snapshot(ticker: str) -> dict | None:
    """
    Returns dict with keys: price, bid, ask, prev_close, today_open,
    today_volume, today_vwap. Returns None if unavailable.
    """
    client = _get_client()
    if not client:
        return None

    now    = time.monotonic()
    cached = _snapshot_cache.get(ticker)
    if cached and (now - cached[1]) < _TTL_SNAPSHOT:
        return cached[0]

    try:
        from alpaca.data.requests import StockSnapshotRequest
        resp = client.get_stock_snapshot(
            StockSnapshotRequest(symbol_or_symbols=ticker, feed=_feed())
        )
        snap = resp.get(ticker)
        if snap is None:
            return None

        latest_trade  = getattr(snap, "latest_trade",    None)
        latest_quote  = getattr(snap, "latest_quote",    None)
        daily_bar     = getattr(snap, "daily_bar",        None)
        prev_bar      = getattr(snap, "prev_daily_bar",   None)

        price      = float(getattr(latest_trade, "price", 0) or 0)
        bid        = float(getattr(latest_quote, "bid_price", 0) or 0)
        ask        = float(getattr(latest_quote, "ask_price", 0) or 0)
        prev_close = float(getattr(prev_bar,  "close", 0)  or 0)
        today_open = float(getattr(daily_bar, "open",  0)  or 0)
        today_vol  = float(getattr(daily_bar, "volume", 0) or 0)
        today_vwap = float(getattr(daily_bar, "vwap",  0)  or price)

        result = {
            "price":       price,
            "bid":         bid,
            "ask":         ask,
            "prev_close":  prev_close,
            "today_open":  today_open,
            "today_volume": today_vol,
            "today_vwap":  today_vwap,
        }
        _snapshot_cache[ticker] = (result, now)
        return result
    except Exception as exc:
        logger.debug(f"[AlpacaData] Snapshot failed for {ticker}: {exc}")
        return None


def get_intraday_bars(ticker: str, minutes: int = 5) -> list[BarRow]:
    """
    Returns up to 1 trading day of OHLCV bars at the given minute interval.
    """
    client = _get_client()
    if not client:
        return []

    cache   = _bars5_cache if minutes == 5 else _bars15_cache
    ttl     = _TTL_BARS5   if minutes == 5 else _TTL_BARS15
    now     = time.monotonic()
    cached  = cache.get(ticker)
    if cached and (now - cached[1]) < ttl:
        return cached[0]

    try:
        from alpaca.data.requests import StockBarsRequest
        from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

        start = datetime.now(timezone.utc) - timedelta(days=2)
        resp  = client.get_stock_bars(
            StockBarsRequest(
                symbol_or_symbols = ticker,
                timeframe         = TimeFrame(minutes, TimeFrameUnit.Minute),
                start             = start,
                feed              = _feed(),
                adjustment        = "raw",
            )
        )
        raw_bars = resp.get(ticker) or []
        rows     = [
            BarRow(
                open   = float(b.open),
                high   = float(b.high),
                low    = float(b.low),
                close  = float(b.close),
                volume = float(b.volume),
                vwap   = float(b.vwap) if b.vwap else float(b.close),
            )
            for b in raw_bars
        ]
        cache[ticker] = (rows, now)
        return rows
    except Exception as exc:
        logger.debug(f"[AlpacaData] {minutes}m bars failed for {ticker}: {exc}")
        return []


def get_daily_bars(ticker: str, days: int = 30) -> list[BarRow]:
    """Returns recent daily bars for average volume calculation."""
    client = _get_client()
    if not client:
        return []

    now    = time.monotonic()
    cached = _daily_cache.get(ticker)
    if cached and (now - cached[1]) < _TTL_DAILY:
        return cached[0]

    try:
        from alpaca.data.requests import StockBarsRequest
        from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

        start = datetime.now(timezone.utc) - timedelta(days=days + 5)
        resp  = client.get_stock_bars(
            StockBarsRequest(
                symbol_or_symbols = ticker,
                timeframe         = TimeFrame(1, TimeFrameUnit.Day),
                start             = start,
                feed              = _feed(),
            )
        )
        raw_bars = resp.get(ticker) or []
        rows     = [
            BarRow(
                open   = float(b.open),
                high   = float(b.high),
                low    = float(b.low),
                close  = float(b.close),
                volume = float(b.volume),
                vwap   = float(b.vwap) if b.vwap else float(b.close),
            )
            for b in raw_bars
        ]
        _daily_cache[ticker] = (rows, now)
        return rows
    except Exception as exc:
        logger.debug(f"[AlpacaData] Daily bars failed for {ticker}: {exc}")
        return []
