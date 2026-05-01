"""
Alpaca News WebSocket stream.

Subscribes to all US stock news in real-time (~sub-second latency) using the
Alpaca Data Stream API. Replaces the Yahoo Finance RSS poller.

Required env vars (same ones used by AlpacaBroker):
  ALPACA_API_KEY
  ALPACA_SECRET_KEY

The stream calls `on_news_callback(NewsItem)` for every incoming article.
It runs in its own daemon thread so the FastAPI event loop is not blocked.
"""
import logging
import os
import threading
from datetime import datetime
from typing import Callable

from models.news import NewsItem

logger = logging.getLogger(__name__)


class AlpacaNewsStream:
    def __init__(self, on_news_callback: Callable[[NewsItem], None]):
        self._callback = on_news_callback
        self._thread: threading.Thread | None = None
        self._stream = None

    def start(self) -> None:
        api_key = os.getenv("ALPACA_API_KEY")
        secret  = os.getenv("ALPACA_SECRET_KEY")
        if not api_key or not secret:
            logger.warning("[AlpacaNews] ALPACA_API_KEY / ALPACA_SECRET_KEY not set — stream disabled")
            return

        self._thread = threading.Thread(target=self._run, args=(api_key, secret), daemon=True)
        self._thread.start()
        logger.info("[AlpacaNews] WebSocket stream starting…")

    def stop(self) -> None:
        if self._stream:
            try:
                self._stream.stop()
            except Exception:
                pass

    def _run(self, api_key: str, secret: str) -> None:
        try:
            from alpaca.data.live import NewsDataStream
        except ImportError:
            logger.error("[AlpacaNews] alpaca-py not installed — run: pip install alpaca-py")
            return

        self._stream = NewsDataStream(api_key=api_key, secret_key=secret)

        @self._stream.on_news(["*"])
        async def handle(news) -> None:
            try:
                symbols = getattr(news, "symbols", None) or []
                headline = getattr(news, "headline", "") or ""
                body     = getattr(news, "summary", "") or ""
                url      = getattr(news, "url", None)
                raw_time = getattr(news, "created_at", None)

                if isinstance(raw_time, datetime):
                    published = raw_time.replace(tzinfo=None)
                elif isinstance(raw_time, str):
                    published = datetime.fromisoformat(raw_time.replace("Z", ""))
                else:
                    published = datetime.utcnow()

                item = NewsItem(
                    source            = "alpaca",
                    headline          = headline,
                    body              = body,
                    published_at      = published,
                    received_at       = datetime.utcnow(),
                    url               = url,
                    candidate_tickers = [s.upper() for s in symbols if s],
                )
                self._callback(item)
            except Exception as exc:
                logger.error(f"[AlpacaNews] Failed to process news item: {exc}")

        try:
            self._stream.run()
        except Exception as exc:
            logger.error(f"[AlpacaNews] Stream error: {exc}")
