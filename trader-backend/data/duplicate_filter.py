import hashlib
from datetime import datetime, timedelta

from config.strategy_config import STRATEGY_CONFIG


class DuplicateFilter:
    def __init__(self):
        self._seen: dict[str, datetime] = {}

    def _hash(self, news_item) -> str:
        raw = f"{news_item.headline.lower().strip()}-{','.join(sorted(news_item.candidate_tickers))}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def is_duplicate(self, news_item) -> bool:
        key = self._hash(news_item)
        now = datetime.utcnow()
        window = timedelta(minutes=STRATEGY_CONFIG["duplicate_window_minutes"])

        # Purge expired entries
        self._seen = {k: v for k, v in self._seen.items() if now - v <= window}

        if key in self._seen:
            return True

        self._seen[key] = now
        return False
