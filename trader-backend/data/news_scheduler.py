"""
NewsScheduler

Coordinates all signal sources:
  - Alpaca News WebSocket (primary, real-time) — requires ALPACA_API_KEY
  - Yahoo Finance RSS fallback (polling every 2 min) — when no Alpaca key
  - Technical scanner (every 5 min)
  - Macro news scanner (every 10 min)
  - Position sync (every 1 min)
  - Keep-alive ping (every 10 min, for Render.com free tier)
"""
import asyncio
import logging
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from data.alpaca_news_stream import AlpacaNewsStream
from data.news_fetcher import WATCH_TICKERS, fetch_ticker_news
from data.macro_news_fetcher import fetch_macro_news
from analysis.technical_scanner import TechnicalScanner
from analysis.macro_analyzer import analyze_macro
from models.news import NewsItem
from notifications.telegram import notify_signal, notify_trade_opened, notify_trade_closed

logger = logging.getLogger(__name__)

_INTERVAL_MINUTES   = int(os.getenv("NEWS_POLL_MINUTES",   "2"))
_TECH_SCAN_MINUTES  = int(os.getenv("TECH_SCAN_MINUTES",   "5"))
_MACRO_POLL_MINUTES = int(os.getenv("MACRO_POLL_MINUTES",  "10"))
_SYNC_MINUTES       = 1
_KEEPALIVE_MINUTES  = 10
_SELF_URL  = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:8000")
_executor  = ThreadPoolExecutor(max_workers=4, thread_name_prefix="trader")

_AUTO_EXECUTE_ENABLED   = os.getenv("AUTO_EXECUTE_ENABLED",   "false").lower() == "true"
_AUTO_EXECUTE_MIN_SCORE = int(os.getenv("AUTO_EXECUTE_MIN_SCORE", "75"))

_tech_scanner = TechnicalScanner()


def _ping_self() -> None:
    try:
        urllib.request.urlopen(f"{_SELF_URL}/", timeout=10)
    except Exception:
        pass


class NewsScheduler:
    def __init__(self, algorithm, portfolio, broker=None):
        self._algorithm = algorithm
        self._portfolio = portfolio
        self._broker    = broker
        self._seen_news:  set[str] = set()
        self._seen_macro: set[str] = set()
        self._seen_tech:  dict[str, float] = {}
        self._scheduler  = AsyncIOScheduler()
        self._news_stream: AlpacaNewsStream | None = None

        self.auto_execute_enabled   = _AUTO_EXECUTE_ENABLED
        self.auto_execute_min_score = _AUTO_EXECUTE_MIN_SCORE

    def start(self) -> None:
        # ── Alpaca WebSocket (real-time) ──────────────────────────────────────
        if os.getenv("ALPACA_API_KEY"):
            self._news_stream = AlpacaNewsStream(on_news_callback=self._on_alpaca_news)
            self._news_stream.start()
            logger.info("[Scheduler] Alpaca News WebSocket enabled — RSS polling disabled")
        else:
            # Fallback: poll Yahoo Finance RSS every N minutes
            self._scheduler.add_job(
                self._run_rss_news, "interval", minutes=_INTERVAL_MINUTES,
                id="news_fetch", next_run_time=datetime.now(),
            )
            logger.info(f"[Scheduler] No Alpaca key — RSS polling every {_INTERVAL_MINUTES}m")

        # ── Other scheduled jobs ──────────────────────────────────────────────
        self._scheduler.add_job(
            self._run_technical, "interval", minutes=_TECH_SCAN_MINUTES,
            id="tech_scan", next_run_time=datetime.now(),
        )
        self._scheduler.add_job(
            self._run_macro, "interval", minutes=_MACRO_POLL_MINUTES,
            id="macro_scan", next_run_time=datetime.now(),
        )
        self._scheduler.add_job(
            self._keepalive, "interval", minutes=_KEEPALIVE_MINUTES,
            id="keepalive",
        )
        if self._broker:
            self._scheduler.add_job(
                self._sync_positions, "interval", minutes=_SYNC_MINUTES,
                id="pos_sync",
            )

        self._scheduler.start()
        logger.info(
            f"[Scheduler] Started — technical every {_TECH_SCAN_MINUTES}m, "
            f"macro every {_MACRO_POLL_MINUTES}m"
            + (f", position sync every {_SYNC_MINUTES}m" if self._broker else "")
        )

    def stop(self) -> None:
        if self._news_stream:
            self._news_stream.stop()
        self._scheduler.shutdown(wait=False)
        _executor.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")

    # ── Alpaca News WebSocket callback (runs in stream thread) ────────────────

    def _on_alpaca_news(self, news_item: NewsItem) -> None:
        key = news_item.url or news_item.headline
        if key in self._seen_news:
            return
        self._seen_news.add(key)

        try:
            decision = self._algorithm.process_news(news_item, self._portfolio)
            if decision.get("decision") != "NO_TRADE":
                logger.info(
                    f"[AlpacaNews] {decision.get('ticker')} → {decision.get('decision')} "
                    f"(score={decision.get('final_score', 0):.1f}): {news_item.headline[:70]}"
                )
                notify_signal(decision)
            self._maybe_auto_execute(decision)
        except Exception as exc:
            logger.error(f"[AlpacaNews] Algorithm error: {exc}")

    # ── Auto-execute ──────────────────────────────────────────────────────────

    def _maybe_auto_execute(self, decision: dict) -> None:
        if not self.auto_execute_enabled:
            return
        if not self._broker:
            return
        if decision.get("decision") not in ("LONG", "SHORT"):
            return
        if not decision.get("trade_allowed"):
            return
        score = decision.get("final_score", 0) or 0
        if score < self.auto_execute_min_score:
            return

        from data.market_hours import get_market_status
        if not get_market_status()["is_open"]:
            return

        from config.risk_config import RISK_CONFIG
        if len(self._broker.open_positions) >= RISK_CONFIG.get("max_open_positions", 2):
            return

        ticker = decision.get("ticker", "?")
        try:
            position = self._broker.open_position(decision)
            if position:
                self._portfolio.open_positions = len(self._broker.open_positions)
                self._portfolio.trades_today  += 1
                logger.info(
                    f"[AutoExec] {decision['decision']} {ticker} "
                    f"x{position['position_size']} @ {position['entry_price']:.2f} "
                    f"(score={score:.1f})"
                )
                notify_trade_opened(position)
        except Exception as exc:
            logger.error(f"[AutoExec] Failed for {ticker}: {exc}")

    # ── Position sync ─────────────────────────────────────────────────────────

    async def _sync_positions(self) -> None:
        if not self._broker or not hasattr(self._broker, "sync_positions"):
            return
        loop = asyncio.get_event_loop()
        mdp  = self._algorithm.market_data_provider
        newly_closed = await loop.run_in_executor(
            _executor, lambda: self._broker.sync_positions(mdp)
        )
        for pos in newly_closed:
            self._portfolio.open_positions      = len(self._broker.open_positions)
            self._portfolio.last_trade_was_loss = (pos.get("pnl") or 0) < 0
            logger.info(
                f"[Sync] Closed {pos['ticker']} "
                f"reason={pos['exit_reason']} pnl={pos.get('pnl', 0):+.2f}"
            )
            notify_trade_closed(pos)

    # ── RSS fallback (only used when no Alpaca key) ───────────────────────────

    async def _run_rss_news(self) -> None:
        loop = asyncio.get_event_loop()
        processed = 0
        for ticker in WATCH_TICKERS:
            try:
                items = await loop.run_in_executor(_executor, fetch_ticker_news, ticker)
            except Exception as exc:
                logger.error(f"[RSS] Fetch failed for {ticker}: {exc}")
                continue

            for item in items:
                key = item.url or item.headline
                if key in self._seen_news:
                    continue
                self._seen_news.add(key)
                try:
                    decision = self._algorithm.process_news(item, self._portfolio)
                    logger.info(
                        f"[RSS] {ticker} → {decision.get('decision')} "
                        f"(score={decision.get('final_score', 0):.1f}): {item.headline[:70]}"
                    )
                    self._maybe_auto_execute(decision)
                    processed += 1
                except Exception as exc:
                    logger.error(f"[RSS] Algorithm error for {ticker}: {exc}")

        if processed:
            logger.info(f"[RSS] Cycle done — {processed} new items")

    # ── Technical scanner ─────────────────────────────────────────────────────

    async def _run_technical(self) -> None:
        import time
        loop = asyncio.get_event_loop()
        now  = time.monotonic()
        _TECH_COOLDOWN = 4 * 60 * 60
        fired = 0

        for ticker in WATCH_TICKERS:
            try:
                md = await loop.run_in_executor(
                    _executor,
                    lambda t=ticker: self._algorithm.market_data_provider.get_market_data(t),
                )
                td = await loop.run_in_executor(
                    _executor,
                    lambda t=ticker: self._algorithm.technical_analyzer.calculate(t),
                )
            except Exception as exc:
                logger.debug(f"[Technical] Data fetch failed for {ticker}: {exc}")
                continue

            try:
                patterns = _tech_scanner.scan(ticker, md, td)
            except Exception as exc:
                logger.debug(f"[Technical] Scan error for {ticker}: {exc}")
                continue

            for pattern in patterns:
                key  = f"{ticker}:{pattern.pattern_type}:{pattern.direction}"
                last = self._seen_tech.get(key, 0)
                if now - last < _TECH_COOLDOWN:
                    continue
                self._seen_tech[key] = now

                try:
                    decision = self._algorithm.process_technical_signal(ticker, pattern, self._portfolio)
                    logger.info(
                        f"[Technical] {ticker} → {decision.get('decision')} "
                        f"(score={decision.get('final_score', 0):.1f}) "
                        f"pattern={pattern.pattern_type}: {pattern.description[:60]}"
                    )
                    self._maybe_auto_execute(decision)
                    fired += 1
                except Exception as exc:
                    logger.error(f"[Technical] Algorithm error for {ticker}: {exc}")

        if fired:
            logger.info(f"[Technical] Cycle done — {fired} patterns fired")

    # ── Macro scanner ─────────────────────────────────────────────────────────

    async def _run_macro(self) -> None:
        loop = asyncio.get_event_loop()
        fired = 0

        try:
            macro_items = await loop.run_in_executor(_executor, fetch_macro_news)
        except Exception as exc:
            logger.error(f"[Macro] Fetch failed: {exc}")
            return

        for item in macro_items:
            key = item.url or item.headline
            if key in self._seen_macro:
                continue
            self._seen_macro.add(key)

            try:
                impacts = await loop.run_in_executor(
                    _executor,
                    lambda i=item: analyze_macro(i.headline, i.body, i.source),
                )
            except Exception as exc:
                logger.error(f"[Macro] LLM analysis failed: {exc}")
                continue

            if not impacts:
                continue

            logger.info(f"[Macro] '{item.headline[:70]}' → {len(impacts)} sector impacts")

            for impact in impacts:
                tickers = self._algorithm.entity_resolver.tickers_for_sector(impact.sector)
                for ticker in tickers:
                    try:
                        decision = self._algorithm.process_macro_signal(
                            ticker, impact, item.headline, item.url, self._portfolio
                        )
                        if decision.get("decision") != "NO_TRADE":
                            logger.info(
                                f"[Macro] {ticker} ({impact.sector}) → {decision.get('decision')} "
                                f"(score={decision.get('final_score', 0):.1f})"
                            )
                            self._maybe_auto_execute(decision)
                        fired += 1
                    except Exception as exc:
                        logger.error(f"[Macro] Signal error for {ticker}: {exc}")

        if fired:
            logger.info(f"[Macro] Cycle done — {fired} ticker signals generated")

    async def _keepalive(self) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, _ping_self)
