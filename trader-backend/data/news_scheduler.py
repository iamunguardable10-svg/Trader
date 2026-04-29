"""
Periodically fetches news via RSS and runs each new headline through the
trading algorithm. Skips duplicates using a URL-keyed seen-set (in-memory).
Also pings its own health endpoint every 10 minutes to prevent Render free
tier from spinning down due to inactivity.
"""
import asyncio
import logging
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from data.news_fetcher import WATCH_TICKERS, fetch_ticker_news

logger = logging.getLogger(__name__)

_INTERVAL_MINUTES = int(os.getenv("NEWS_POLL_MINUTES", "2"))
_KEEPALIVE_MINUTES = 10
_SELF_URL = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:8000")
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="news_fetch")


def _ping_self() -> None:
    try:
        urllib.request.urlopen(f"{_SELF_URL}/", timeout=10)
        logger.debug("[KeepAlive] ping ok")
    except Exception as exc:
        logger.debug(f"[KeepAlive] ping failed (non-critical): {exc}")


class NewsScheduler:
    def __init__(self, algorithm, portfolio):
        self._algorithm  = algorithm
        self._portfolio  = portfolio
        self._seen: set[str] = set()
        self._scheduler  = AsyncIOScheduler()

    def start(self) -> None:
        self._scheduler.add_job(
            self._run,
            "interval",
            minutes=_INTERVAL_MINUTES,
            id="news_fetch",
            next_run_time=datetime.now(),   # fire immediately on startup
        )
        self._scheduler.add_job(
            self._keepalive,
            "interval",
            minutes=_KEEPALIVE_MINUTES,
            id="keepalive",
        )
        self._scheduler.start()
        logger.info(f"[Scheduler] Started — polling every {_INTERVAL_MINUTES} min, keep-alive every {_KEEPALIVE_MINUTES} min")

    def stop(self) -> None:
        self._scheduler.shutdown(wait=False)
        _executor.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")

    async def _keepalive(self) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, _ping_self)

    async def _run(self) -> None:
        loop = asyncio.get_event_loop()
        processed = 0

        for ticker in WATCH_TICKERS:
            try:
                items = await loop.run_in_executor(_executor, fetch_ticker_news, ticker)
            except Exception as exc:
                logger.error(f"[Scheduler] RSS fetch failed for {ticker}: {exc}")
                continue

            for item in items:
                key = item.url or item.headline
                if key in self._seen:
                    continue
                self._seen.add(key)

                try:
                    decision = self._algorithm.process_news(item, self._portfolio)
                    logger.info(
                        f"[Scheduler] {ticker} → {decision.get('decision')} "
                        f"(score={decision.get('final_score', 0):.1f}): "
                        f"{item.headline[:70]}"
                    )
                    processed += 1
                except Exception as exc:
                    logger.error(f"[Scheduler] Algorithm error for {ticker}: {exc}")

        if processed:
            logger.info(f"[Scheduler] Cycle done — {processed} new items processed")
