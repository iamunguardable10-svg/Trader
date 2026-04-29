"""
Fetches financial news from Yahoo Finance RSS feeds.
No API key required. Returns NewsItem objects ready for the algorithm.
"""
import feedparser
from datetime import datetime, timezone
from models.news import NewsItem

from analysis.entity_resolver import KNOWN_TICKERS

# All tickers the scheduler will poll — driven by entity_resolver
WATCH_TICKERS = KNOWN_TICKERS

_RSS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"


def fetch_ticker_news(ticker: str, max_items: int = 5) -> list[NewsItem]:
    """Fetch latest RSS headlines for a single ticker. Blocking call — run in executor."""
    url = _RSS_URL.format(ticker=ticker)
    try:
        feed = feedparser.parse(url)
    except Exception:
        return []

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
            published = datetime.utcnow()

        items.append(NewsItem(
            source="yahoo_finance",
            headline=headline,
            body=entry.get("summary", ""),
            published_at=published,
            received_at=datetime.utcnow(),
            url=entry.get("link"),
            candidate_tickers=[ticker],
        ))

    return items
