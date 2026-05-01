"""
Entity Resolver

Resolves a news item or ticker string to EntityData (ticker, company, sector, industry).

Priority:
  1. Static map — instant, no network call, covers well-known large-caps
  2. yfinance lookup — for any ticker not in the static map (cached in-process)
  3. Minimal fallback — returns the ticker with Unknown sector so the pipeline
     can still run rather than silently dropping the news
"""
import logging
from functools import lru_cache

from models.news import EntityData, NewsItem

logger = logging.getLogger(__name__)

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
    # Finance — large-cap banks
    "JPM":   {"company_name": "JPMorgan Chase & Co.",     "sector": "Financial Services",      "industry": "Banks"},
    "GS":    {"company_name": "Goldman Sachs Group",      "sector": "Financial Services",      "industry": "Investment Banking"},
    "MS":    {"company_name": "Morgan Stanley",           "sector": "Financial Services",      "industry": "Investment Banking"},
    "BAC":   {"company_name": "Bank of America Corp.",    "sector": "Financial Services",      "industry": "Banks"},
    # Healthcare
    "JNJ":   {"company_name": "Johnson & Johnson",        "sector": "Healthcare",              "industry": "Drug Manufacturers"},
    "UNH":   {"company_name": "UnitedHealth Group",       "sector": "Healthcare",              "industry": "Health Insurance"},
    "PFE":   {"company_name": "Pfizer Inc.",              "sector": "Healthcare",              "industry": "Drug Manufacturers"},
    "ABBV":  {"company_name": "AbbVie Inc.",              "sector": "Healthcare",              "industry": "Drug Manufacturers"},
    # Energy
    "XOM":   {"company_name": "Exxon Mobil Corporation",  "sector": "Energy",                  "industry": "Oil & Gas"},
    "CVX":   {"company_name": "Chevron Corporation",      "sector": "Energy",                  "industry": "Oil & Gas"},
    # Consumer Staples
    "WMT":   {"company_name": "Walmart Inc.",             "sector": "Consumer Defensive",      "industry": "Discount Stores"},
    "COST":  {"company_name": "Costco Wholesale Corp.",   "sector": "Consumer Defensive",      "industry": "Discount Stores"},
    # Industrials
    "CAT":   {"company_name": "Caterpillar Inc.",         "sector": "Industrials",             "industry": "Farm & Heavy Construction"},
    "BA":    {"company_name": "Boeing Company",           "sector": "Industrials",             "industry": "Aerospace & Defense"},
}

KNOWN_TICKERS = list(_TICKER_MAP.keys())


@lru_cache(maxsize=512)
def _lookup_via_yfinance(ticker: str) -> dict:
    """Fetch company info for unknown tickers. Result is cached in-process."""
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).fast_info
        # fast_info doesn't have sector — fall back to full info for that
        full = yf.Ticker(ticker).info
        return {
            "company_name": full.get("longName") or full.get("shortName") or ticker,
            "sector":       full.get("sector") or "Unknown",
            "industry":     full.get("industry") or "Unknown",
        }
    except Exception as exc:
        logger.debug(f"[EntityResolver] yfinance lookup failed for {ticker}: {exc}")
        return {"company_name": ticker, "sector": "Unknown", "industry": "Unknown"}


class EntityResolver:
    def resolve_ticker(self, ticker: str) -> EntityData | None:
        t    = ticker.upper()
        data = _TICKER_MAP.get(t) or _lookup_via_yfinance(t)
        return EntityData(
            primary_ticker = t,
            company_name   = data["company_name"],
            related_tickers= [],
            sector         = data["sector"],
            industry       = data["industry"],
        )

    def tickers_for_sector(self, sector: str) -> list[str]:
        return [t for t, d in _TICKER_MAP.items() if d.get("sector") == sector]

    def resolve(self, news_item: NewsItem) -> EntityData:
        for raw in news_item.candidate_tickers:
            t = raw.upper()
            if len(t) > 5 or not t.isalpha():
                continue
            data = _TICKER_MAP.get(t) or _lookup_via_yfinance(t)
            return EntityData(
                primary_ticker = t,
                company_name   = data["company_name"],
                related_tickers= [],
                sector         = data["sector"],
                industry       = data["industry"],
            )

        return EntityData(
            primary_ticker  = None,
            company_name    = None,
            related_tickers = [],
            sector          = None,
            industry        = None,
        )
