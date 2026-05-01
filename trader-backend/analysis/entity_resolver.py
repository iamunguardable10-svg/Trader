from models.news import EntityData, NewsItem

_TICKER_MAP: dict[str, dict] = {
    # Mega-cap tech
    "AAPL":  {"company_name": "Apple Inc.",               "sector": "Technology",              "industry": "Consumer Electronics"},
    "MSFT":  {"company_name": "Microsoft Corporation",    "sector": "Technology",              "industry": "Software"},
    "NVDA":  {"company_name": "NVIDIA Corporation",       "sector": "Technology",              "industry": "Semiconductors"},
    "GOOGL": {"company_name": "Alphabet Inc.",            "sector": "Technology",              "industry": "Internet Services"},
    "AMZN":  {"company_name": "Amazon.com Inc.",          "sector": "Consumer Cyclical",       "industry": "E-Commerce"},
    "META":  {"company_name": "Meta Platforms Inc.",      "sector": "Technology",              "industry": "Internet Content"},
    "TSLA":  {"company_name": "Tesla Inc.",               "sector": "Consumer Cyclical",       "industry": "Auto Manufacturers"},
    # Semiconductors
    "AMD":   {"company_name": "Advanced Micro Devices",   "sector": "Technology",              "industry": "Semiconductors"},
    "INTC":  {"company_name": "Intel Corporation",        "sector": "Technology",              "industry": "Semiconductors"},
    "QCOM":  {"company_name": "Qualcomm Inc.",            "sector": "Technology",              "industry": "Semiconductors"},
    "AVGO":  {"company_name": "Broadcom Inc.",            "sector": "Technology",              "industry": "Semiconductors"},
    "MU":    {"company_name": "Micron Technology",        "sector": "Technology",              "industry": "Semiconductors"},
    # Software & Cloud
    "CRM":   {"company_name": "Salesforce Inc.",          "sector": "Technology",              "industry": "Software"},
    "ORCL":  {"company_name": "Oracle Corporation",       "sector": "Technology",              "industry": "Software"},
    "NOW":   {"company_name": "ServiceNow Inc.",          "sector": "Technology",              "industry": "Software"},
    "CRWD":  {"company_name": "CrowdStrike Holdings",     "sector": "Technology",              "industry": "Cybersecurity"},
    "NET":   {"company_name": "Cloudflare Inc.",          "sector": "Technology",              "industry": "Networking"},
    "PLTR":  {"company_name": "Palantir Technologies",    "sector": "Technology",              "industry": "Software"},
    # Consumer & Media
    "NFLX":  {"company_name": "Netflix Inc.",             "sector": "Communication Services",  "industry": "Streaming"},
    "SPOT":  {"company_name": "Spotify Technology",       "sector": "Communication Services",  "industry": "Streaming"},
    "UBER":  {"company_name": "Uber Technologies",        "sector": "Technology",              "industry": "Ridesharing"},
    "SHOP":  {"company_name": "Shopify Inc.",             "sector": "Technology",              "industry": "E-Commerce"},
    # Finance
    "PYPL":  {"company_name": "PayPal Holdings Inc.",     "sector": "Financial Services",      "industry": "Payment Processing"},
    "COIN":  {"company_name": "Coinbase Global Inc.",     "sector": "Financial Services",      "industry": "Crypto Exchange"},
    "SQ":    {"company_name": "Block Inc.",               "sector": "Financial Services",      "industry": "Payment Processing"},
}

KNOWN_TICKERS = list(_TICKER_MAP.keys())


class EntityResolver:
    def resolve_ticker(self, ticker: str) -> EntityData | None:
        """Directly resolve a known ticker string to EntityData."""
        t = ticker.upper()
        data = _TICKER_MAP.get(t, {})
        if not data:
            return None
        return EntityData(
            primary_ticker=t,
            company_name=data.get("company_name"),
            related_tickers=[],
            sector=data.get("sector"),
            industry=data.get("industry"),
        )

    def tickers_for_sector(self, sector: str) -> list[str]:
        """Return all watched tickers that belong to the given sector."""
        return [t for t, d in _TICKER_MAP.items() if d.get("sector") == sector]

    def resolve(self, news_item: NewsItem) -> EntityData:
        ticker = None
        for t in news_item.candidate_tickers:
            if t.upper() in _TICKER_MAP:
                ticker = t.upper()
                break

        # Fallback: first candidate even if not in map
        if not ticker and news_item.candidate_tickers:
            ticker = news_item.candidate_tickers[0].upper()

        data = _TICKER_MAP.get(ticker or "", {})

        return EntityData(
            primary_ticker=ticker,
            company_name=data.get("company_name"),
            related_tickers=[],
            sector=data.get("sector"),
            industry=data.get("industry"),
        )
