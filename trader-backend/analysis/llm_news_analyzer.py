"""
LLM News Analyzer

Two modes:
  1. Mock mode  — keyword-based heuristic, no external API needed
  2. LLM mode   — calls OpenAI-compatible API (set OPENAI_API_KEY or GROQ_API_KEY)

Set env var LLM_PROVIDER=openai|groq|mock  (default: mock)
"""
import json
import os
import re
from models.decision import LLMNewsAnalysis
from models.news import EntityData, NewsItem
from config.event_weights import EVENT_WEIGHTS


# ---------------------------------------------------------------------------
# Prompt builder (shared between mock and real LLM)
# ---------------------------------------------------------------------------

def build_llm_prompt(news_item: NewsItem, entity_data: EntityData) -> str:
    event_list = ", ".join(EVENT_WEIGHTS.keys())
    return f"""You are an expert quantitative trader analyzing financial news for short-term (intraday) stock price impact.

Your job: assess whether this news item is likely to move {entity_data.primary_ticker} stock significantly in the next 1-2 hours, and in which direction.

Think like a trader, not a journalist:
- Strong earnings beats → strong bullish, high importance, high surprise
- Analyst upgrades with price target raise → mild bullish
- Vague market commentary ("stock to watch") → low importance, neutral
- Price percentage moves already happened (past tense, e.g. "gained 2%") → low surprise (already priced in), directional bias still valid
- Regulatory approvals, major contracts, M&A → high importance
- Macroeconomic news about the sector → moderate importance

NEWS:
Headline: {news_item.headline}
Body: {news_item.body or "(no body)"}
Company: {entity_data.company_name} ({entity_data.primary_ticker})
Sector: {entity_data.sector}

Return ONLY valid JSON, no markdown, no explanation:
{{
  "event_type": "one of: {event_list}",
  "directional_bias": "bullish | bearish | neutral",
  "impact_time_horizon": "intraday | swing | long_term | unclear",
  "importance": <0.0-1.0, how market-moving is this news>,
  "confidence": <0.0-1.0, how certain are you of the direction>,
  "surprise_level": <0.0-1.0, how unexpected is this — 0 if already priced in>,
  "reasoning_summary": "<one sentence explaining your assessment>",
  "key_risks": ["<risk 1>", "<risk 2>"],
  "needs_human_review": <true only for fraud/legal/ambiguous situations>
}}"""


# ---------------------------------------------------------------------------
# Mock analyzer — keyword heuristic, no API needed
# ---------------------------------------------------------------------------

_BEARISH_KEYWORDS = {
    # Price movement
    "falls", "fall", "fell", "drop", "drops", "dropped", "decline", "declines", "declined",
    "down", "lower", "loses", "lost", "slide", "slides", "slid", "slump", "slumps",
    "tumble", "tumbles", "tumbled", "plunge", "plunges", "plunged", "sink", "sinks",
    "retreats", "retreat", "selloff", "sell-off", "dip", "dips",
    # Fundamentals
    "miss", "misses", "missed", "loss", "losses", "cut", "cuts",
    "lawsuit", "investigation", "fraud", "recall", "delay", "delays",
    "resign", "fired", "lays off", "layoffs", "guidance cut", "warning",
    "downgrade", "downgraded", "concern", "concerns", "risk", "risks",
    "weak", "weakness", "disappoints", "disappointing", "disappointing",
    "bearish", "short", "overvalued", "trouble", "troubles", "struggles",
    "bankruptcy", "default", "debt", "losses", "shrinks", "shrinking",
}

_BULLISH_KEYWORDS = {
    # Price movement
    "gains", "gain", "rises", "rise", "rose", "up", "higher", "jumps", "jumped",
    "surges", "surge", "surged", "soars", "soar", "soared", "climbs", "climb",
    "rallies", "rally", "rallied", "advances", "advance", "pops", "pop",
    "outperforms", "outperform",
    # Fundamentals
    "beat", "beats", "record", "raise", "raised", "raises", "upgrade",
    "upgraded", "buyback", "dividend", "approval", "approved", "contract",
    "partnership", "launch", "launches", "acquisition", "takeover",
    "guidance raise", "strong", "growth", "growing", "profit", "profitable",
    "bullish", "buy", "overweight", "positive", "exceeds", "tops", "crushes",
    "momentum", "breakout", "opportunity", "undervalued",
}

_EVENT_KEYWORDS: dict[str, list[str]] = {
    "price_cut":                ["price cut", "cuts price", "price reduction", "reduces price"],
    "earnings_beat_strong":     ["beat", "beats earnings", "earnings beat", "topped estimates",
                                 "exceeded expectations", "above expectations", "earnings topped"],
    "earnings_miss_strong":     ["miss", "misses earnings", "earnings miss", "missed estimates",
                                 "below expectations", "earnings fell short"],
    "earnings_guidance_raise":  ["raises guidance", "guidance raise", "raised outlook", "raised forecast",
                                 "raised full-year", "raises full-year", "raised its outlook"],
    "earnings_guidance_cut":    ["cuts guidance", "guidance cut", "lowered outlook", "lowered forecast",
                                 "cut its outlook", "reduced guidance"],
    "analyst_upgrade":          ["upgrade", "upgraded", "raises target", "raised target",
                                 "raised price target", "initiates", "outperform", "overweight",
                                 "buy rating", "strong buy"],
    "analyst_downgrade":        ["downgrade", "downgraded", "lowers target", "lowered target",
                                 "lowered price target", "underperform", "underweight", "sell rating"],
    "major_lawsuit":            ["lawsuit", "sued", "sues", "legal action", "class action",
                                 "antitrust", "litigation"],
    "regulatory_investigation": ["investigation", "probe", "sec", "doj", "ftc", "investigated",
                                 "subpoena", "regulatory scrutiny"],
    "regulatory_approval":      ["approved", "approval", "fda approved", "cleared", "authorized",
                                 "green light", "regulatory approval"],
    "ceo_resignation":          ["ceo resign", "ceo steps down", "ceo fired", "ceo departs",
                                 "chief executive resign", "steps down as ceo"],
    "product_launch":           ["launch", "launches", "unveils", "announced", "introduces",
                                 "new product", "release", "releases", "debuts"],
    "fraud_allegation":         ["fraud", "accounting fraud", "falsified", "manipulated",
                                 "misrepresented", "embezzlement"],
    "insider_buying":           ["insider buy", "insider purchase", "insider bought",
                                 "director bought", "executive bought"],
    "insider_selling":          ["insider sell", "insider sold", "insider selling",
                                 "director sold", "executive sold"],
    "takeover_offer":           ["takeover", "acquisition", "buyout", "merger", "acquires",
                                 "to acquire", "bid for", "deal to buy"],
    "share_buyback_large":      ["buyback", "share repurchase", "repurchase program",
                                 "buying back shares"],
    "product_delay":            ["delay", "delayed", "postponed", "pushes back", "pushed back"],
    "partnership":              ["partnership", "partner", "partners with", "joint venture",
                                 "collaboration", "deal with", "agreement with", "signs deal"],
    "major_contract_win":       ["wins contract", "awarded contract", "major contract",
                                 "government contract", "contract win"],
}


def _detect_event_type(headline: str, body: str) -> str:
    text = (headline + " " + body).lower()
    for event, keywords in _EVENT_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return event
    return "unknown"


def _detect_bias(headline: str, body: str, event_type: str) -> str:
    weight = EVENT_WEIGHTS.get(event_type, 0)
    if weight > 0:
        return "bullish"
    if weight < 0:
        return "bearish"

    text = (headline + " " + body).lower()
    bull = sum(1 for kw in _BULLISH_KEYWORDS if kw in text)
    bear = sum(1 for kw in _BEARISH_KEYWORDS if kw in text)

    if bull > bear:
        return "bullish"
    if bear > bull:
        return "bearish"
    return "neutral"


import re as _re

def _extract_pct_move(text: str) -> float | None:
    """Extract percentage move from headline, e.g. 'gains 2.5%' → +2.5, 'falls 3%' → -3."""
    m = _re.search(r'([+-]?\d+\.?\d*)\s*%', text)
    if m:
        return float(m.group(1))
    return None


def _mock_analyze(news_item: NewsItem, entity_data: EntityData) -> LLMNewsAnalysis:
    text       = news_item.headline + " " + news_item.body
    event_type = _detect_event_type(news_item.headline, news_item.body)
    bias       = _detect_bias(news_item.headline, news_item.body, event_type)
    weight     = abs(EVENT_WEIGHTS.get(event_type, 0))

    # If bias still neutral after keyword check, try reading explicit % move
    if bias == "neutral":
        pct = _extract_pct_move(text)
        if pct is not None:
            if pct > 0.5:
                bias = "bullish"
            elif pct < -0.5:
                bias = "bearish"

    # Scale importance/surprise by event weight; floor higher so more signals pass
    importance     = round(min(0.95, 0.60 + weight / 80), 2)
    surprise_level = round(min(0.90, 0.45 + weight / 70), 2)
    confidence     = 0.68 if bias == "neutral" else 0.75

    needs_review = event_type in ("fraud_allegation", "accounting_issue")

    return LLMNewsAnalysis(
        event_type=event_type,
        directional_bias=bias,
        impact_time_horizon="intraday",
        importance=importance,
        confidence=confidence,
        surprise_level=surprise_level,
        reasoning_summary=(
            f"Keyword-based: event='{event_type}', bias={bias}. "
            f"Set LLM_PROVIDER=openai/groq for better accuracy."
        ),
        key_risks=["Heuristic analysis only — connect LLM for production"],
        needs_human_review=needs_review,
    )


# ---------------------------------------------------------------------------
# Real LLM call (OpenAI or Groq — both use OpenAI-compatible API)
# ---------------------------------------------------------------------------

def _llm_analyze(news_item: NewsItem, entity_data: EntityData) -> LLMNewsAnalysis:
    provider = os.getenv("LLM_PROVIDER", "mock").lower()

    if provider == "openai":
        import openai
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model  = os.getenv("LLM_MODEL", "gpt-4o-mini")
    elif provider == "groq":
        import openai
        client = openai.OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
        )
        model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
    else:
        return _mock_analyze(news_item, entity_data)

    prompt = build_llm_prompt(news_item, entity_data)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=600,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    data = json.loads(raw)

    return LLMNewsAnalysis(
        event_type=data.get("event_type", "unknown"),
        directional_bias=data.get("directional_bias", "neutral"),
        impact_time_horizon=data.get("impact_time_horizon", "intraday"),
        importance=float(data.get("importance", 0.5)),
        confidence=float(data.get("confidence", 0.5)),
        surprise_level=float(data.get("surprise_level", 0.5)),
        reasoning_summary=data.get("reasoning_summary", ""),
        key_risks=data.get("key_risks", []),
        needs_human_review=bool(data.get("needs_human_review", False)),
    )


# ---------------------------------------------------------------------------
# Public class
# ---------------------------------------------------------------------------

class LLMNewsAnalyzer:
    def analyze(self, news_item: NewsItem, entity_data: EntityData) -> LLMNewsAnalysis:
        provider = os.getenv("LLM_PROVIDER", "mock").lower()

        if provider == "mock":
            return _mock_analyze(news_item, entity_data)

        try:
            return _llm_analyze(news_item, entity_data)
        except Exception as e:
            print(f"[LLMNewsAnalyzer] LLM call failed ({e}), falling back to mock.")
            return _mock_analyze(news_item, entity_data)
