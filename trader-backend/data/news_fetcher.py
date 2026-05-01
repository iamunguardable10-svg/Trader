"""
Fetches financial news from Yahoo Finance RSS feeds.
No API key required. Returns NewsItem objects ready for the algorithm.
"""
import os
import feedparser
from datetime import datetime, timedelta, timezone
from models.news import NewsItem

from analysis.entity_resolver import KNOWN_TICKERS

# All tickers the scheduler will poll — driven by entity_resolver
WATCH_TICKERS = KNOWN_TICKERS

_RSS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"


_MAX_AGE_HOURS = int(os.getenv("NEWS_MAX_AGE_HOURS", "24"))


def fetch_ticker_news(ticker: str, max_items: int = 5) -> list[NewsItem]:
    """Fetch latest RSS headlines for a single ticker. Blocking call — run in executor."""
    url = _RSS_URL.format(ticker=ticker)
    try:
        feed = feedparser.parse(url)
    except Exception:
        return []

    now = datetime.utcnow()
    cutoff = now - timedelta(hours=_MAX_AGE_HOURS)

    items: list[NewsItem] = []
    for entry in feed.entries[:max_items]:
        headline = entry.get("title", "").strip()
        if not headline:
            continue

        # Parse publish time; fall back to now if missing
        if entry.get("published_parsed"):
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            published = published.replace(tzinfo=None)
        else:
            published = now

        # Skip stale articles so startup doesn't flood with old news
        if published < cutoff:
            continue

        items.append(NewsItem(
            source="yahoo_finance",
            headline=headline,
            body=entry.get("summary", ""),
            published_at=published,
            received_at=now,
            url=entry.get("link"),
            candidate_tickers=[ticker],
        ))

    return items
