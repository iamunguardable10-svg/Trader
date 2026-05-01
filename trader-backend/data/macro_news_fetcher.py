"""
Fetches broad macro / geopolitical news from free RSS feeds.
No API key required.
"""
import os
import feedparser
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

_MAX_AGE_HOURS = int(os.getenv("NEWS_MAX_AGE_HOURS", "24"))

# Free, reliable macro RSS sources
MACRO_FEEDS = [
    # Reuters — top business & world news
    "https://feeds.reuters.com/reuters/businessNews",
    "https://feeds.reuters.com/Reuters/worldNews",
    # MarketWatch — US markets focus
    "https://feeds.marketwatch.com/marketwatch/topstories/",
    # Yahoo Finance — macro/economy section
    "https://finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US",
]

# Keywords that flag an article as macro-relevant (quick pre-filter before LLM call)
_MACRO_KEYWORDS = {
    "tariff", "tariffs", "trade war", "trade deal", "import duty",
    "sanction", "sanctions", "embargo",
    "federal reserve", "fed rate", "interest rate", "fomc", "powell", "rate hike", "rate cut",
    "trump", "executive order", "white house", "administration",
    "gdp", "inflation", "cpi", "ppi", "recession",
    "ukraine", "russia", "china", "taiwan", "iran", "middle east", "opec",
    "oil price", "crude", "energy crisis",
    "nato", "geopolit", "war", "conflict", "military",
    "debt ceiling", "government shutdown", "fiscal",
}


@dataclass
class MacroNewsItem:
    headline: str
    body:     str
    source:   str
    url:      str | None
    published_at: datetime


def fetch_macro_news(max_per_feed: int = 10) -> list[MacroNewsItem]:
    """Fetch recent macro news from all configured feeds. Returns deduplicated items."""
    now     = datetime.utcnow()
    cutoff  = now - timedelta(hours=_MAX_AGE_HOURS)
    seen_urls: set[str] = set()
    items:  list[MacroNewsItem] = []

    for feed_url in MACRO_FEEDS:
        try:
            feed = feedparser.parse(feed_url, request_headers={"User-Agent": "Mozilla/5.0"})
        except Exception:
            continue

        source = feed.feed.get("title", feed_url.split("/")[2])

        for entry in feed.entries[:max_per_feed]:
            headline = entry.get("title", "").strip()
            url      = entry.get("link")
            if not headline or url in seen_urls:
                continue

            # Parse date
            if entry.get("published_parsed"):
                published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).replace(tzinfo=None)
            else:
                published = now

            if published < cutoff:
                continue

            # Quick keyword pre-filter — avoid sending irrelevant sports/entertainment to LLM
            text_lower = (headline + " " + entry.get("summary", "")).lower()
            if not any(kw in text_lower for kw in _MACRO_KEYWORDS):
                continue

            body = entry.get("summary", "")
            seen_urls.add(url or headline)
            items.append(MacroNewsItem(
                headline=headline,
                body=body,
                source=source,
                url=url,
                published_at=published,
            ))

    return items
