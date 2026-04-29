from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class NewsItem:
    source: str
    headline: str
    body: str
    published_at: datetime
    received_at: datetime
    url: Optional[str]
    candidate_tickers: List[str] = field(default_factory=list)


@dataclass
class EntityData:
    primary_ticker: Optional[str]
    company_name: Optional[str]
    related_tickers: List[str]
    sector: Optional[str]
    industry: Optional[str]
