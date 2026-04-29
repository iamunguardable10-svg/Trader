from models.news import EntityData, NewsItem

_TICKER_MAP: dict[str, dict] = {
    "TSLA": {"company_name": "Tesla Inc.",          "sector": "Consumer Cyclical", "industry": "Auto Manufacturers"},
    "NVDA": {"company_name": "NVIDIA Corporation",  "sector": "Technology",        "industry": "Semiconductors"},
    "AAPL": {"company_name": "Apple Inc.",           "sector": "Technology",        "industry": "Consumer Electronics"},
    "META": {"company_name": "Meta Platforms Inc.", "sector": "Technology",        "industry": "Internet Content"},
    "AMD":  {"company_name": "Advanced Micro Devices", "sector": "Technology",     "industry": "Semiconductors"},
    "AMZN": {"company_name": "Amazon.com Inc.",     "sector": "Consumer Cyclical", "industry": "E-Commerce"},
    "MSFT": {"company_name": "Microsoft Corporation","sector": "Technology",       "industry": "Software"},
    "GOOGL":{"company_name": "Alphabet Inc.",       "sector": "Technology",        "industry": "Internet Services"},
    "NFLX": {"company_name": "Netflix Inc.",        "sector": "Communication Services","industry": "Streaming"},
    "PYPL": {"company_name": "PayPal Holdings Inc.","sector": "Financial Services","industry": "Payment Processing"},
}


class EntityResolver:
    def resolve(self, news_item: NewsItem) -> EntityData:
        ticker = None
        for t in news_item.candidate_tickers:
            if t.upper() in _TICKER_MAP:
                ticker = t.upper()
                break

        # Fallback: first candidate even if not in map
        if not ticker and news_item.candidate_tickers:
            ticker = news_item.candidate_tickers[0].upper()

        data = _TICKER_MAP.get(ticker, {})

        return EntityData(
            primary_ticker=ticker,
            company_name=data.get("company_name"),
            related_tickers=[],
            sector=data.get("sector"),
            industry=data.get("industry"),
        )
