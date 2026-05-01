"""
Periodically fetches news via RSS and runs each new headline through the
trading algorithm. Also runs a technical scanner every 5 min and a macro
news scanner every 10 min.
"""
import asyncio
import logging
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from data.news_fetcher import WATCH_TICKERS, fetch_ticker_news
from data.macro_news_fetcher import fetch_macro_news
from analysis.technical_scanner import TechnicalScanner
from analysis.macro_analyzer import analyze_macro

logger = logging.getLogger(__name__)

_INTERVAL_MINUTES   = int(os.getenv("NEWS_POLL_MINUTES",   "2"))
_TECH_SCAN_MINUTES  = int(os.getenv("TECH_SCAN_MINUTES",   "5"))
_MACRO_POLL_MINUTES = int(os.getenv("MACRO_POLL_MINUTES",  "10"))
_KEEPALIVE_MINUTES  = 10
_SELF_URL  = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:8000")
_executor  = ThreadPoolExecutor(max_workers=3, thread_name_prefix="news_fetch")

_tech_scanner = TechnicalScanner()


def _ping_self() -> None:
    try:
        urllib.request.urlopen(f"{_SELF_URL}/", timeout=10)
        logger.debug("[KeepAlive] ping ok")
    except Exception as exc:
        logger.debug(f"[KeepAlive] ping failed (non-critical): {exc}")


class NewsScheduler:
    def __init__(self, algorithm, portfolio):
        self._algorithm = algorithm
        self._portfolio = portfolio
        self._seen_news:  set[str] = set()
        self._seen_macro: set[str] = set()
        # Technical: (ticker, pattern_type) → last fired time (prevents re-firing same pattern for 4h)
        self._seen_tech:  dict[str, float] = {}
        self._scheduler  = AsyncIOScheduler()

    def start(self) -> None:
        self._scheduler.add_job(
            self._run_news, "interval", minutes=_INTERVAL_MINUTES,
            id="news_fetch", next_run_time=datetime.now(),
        )
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
        self._scheduler.start()
        logger.info(
            f"[Scheduler] Started — news every {_INTERVAL_MINUTES}m, "
            f"technical every {_TECH_SCAN_MINUTES}m, "
            f"macro every {_MACRO_POLL_MINUTES}m"
        )

    def stop(self) -> None:
        self._scheduler.shutdown(wait=False)
        _executor.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")

    async def _keepalive(self) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, _ping_self)

    # ── News (existing) ───────────────────────────────────────────────────────

    async def _run_news(self) -> None:
        loop = asyncio.get_event_loop()
        processed = 0
        for ticker in WATCH_TICKERS:
            try:
                items = await loop.run_in_executor(_executor, fetch_ticker_news, ticker)
            except Exception as exc:
                logger.error(f"[News] RSS fetch failed for {ticker}: {exc}")
                continue

            for item in items:
                key = item.url or item.headline
                if key in self._seen_news:
                    continue
                self._seen_news.add(key)
                try:
                    decision = self._algorithm.process_news(item, self._portfolio)
                    logger.info(
                        f"[News] {ticker} → {decision.get('decision')} "
                        f"(score={decision.get('final_score', 0):.1f}): {item.headline[:70]}"
                    )
                    processed += 1
                except Exception as exc:
                    logger.error(f"[News] Algorithm error for {ticker}: {exc}")

        if processed:
            logger.info(f"[News] Cycle done — {processed} new items")

    # ── Technical scanner ─────────────────────────────────────────────────────

    async def _run_technical(self) -> None:
        import time
        loop = asyncio.get_event_loop()
        now  = time.monotonic()
        _TECH_COOLDOWN = 4 * 60 * 60   # 4 hours per (ticker, pattern)
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
                key = f"{ticker}:{pattern.pattern_type}:{pattern.direction}"
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
            logger.error(f"[Macro] RSS fetch failed: {exc}")
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
                # Find all watchlist tickers in the affected sector
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
                        fired += 1
                    except Exception as exc:
                        logger.error(f"[Macro] Signal error for {ticker}: {exc}")

        if fired:
            logger.info(f"[Macro] Cycle done — {fired} ticker signals generated")
