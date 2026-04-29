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
    return f"""You are a financial news analysis engine.
Analyze the following news for short-term stock market impact.
Return ONLY valid JSON — no markdown, no explanation.

Headline: {news_item.headline}
Body: {news_item.body}
Company: {entity_data.company_name} / {entity_data.primary_ticker}
Sector: {entity_data.sector}

Output schema:
{{
  "event_type": "one of: {', '.join(EVENT_WEIGHTS.keys())}",
  "directional_bias": "bullish | bearish | neutral",
  "impact_time_horizon": "intraday | swing | long_term | unclear",
  "importance": 0.0,
  "confidence": 0.0,
  "surprise_level": 0.0,
  "reasoning_summary": "...",
  "key_risks": ["...", "..."],
  "needs_human_review": false
}}

Rules:
- Do NOT recommend buying or selling.
- Only analyze likely market impact.
- If unclear → reduce confidence.
- If already priced in → reduce surprise_level.
- importance and confidence must be between 0.0 and 1.0.
"""


# ---------------------------------------------------------------------------
# Mock analyzer — keyword heuristic, no API needed
# ---------------------------------------------------------------------------

_BEARISH_KEYWORDS = {
    "cut", "cuts", "miss", "misses", "missed", "decline", "declines",
    "drop", "drops", "fell", "fall", "loss", "losses", "lawsuit",
    "investigation", "fraud", "recall", "delay", "delays", "resign",
    "fired", "lays off", "layoffs", "guidance cut", "warning",
}

_BULLISH_KEYWORDS = {
    "beat", "beats", "record", "raise", "raised", "raises", "upgrade",
    "upgraded", "buyback", "dividend", "approval", "approved", "contract",
    "partnership", "launch", "launches", "acquisition", "takeover",
    "guidance raise", "strong", "surge", "surges",
}

_EVENT_KEYWORDS: dict[str, list[str]] = {
    "price_cut":                ["price cut", "cuts price", "price reduction", "reduces price"],
    "earnings_beat_strong":     ["beat", "beats earnings", "earnings beat"],
    "earnings_miss_strong":     ["miss", "misses earnings", "earnings miss"],
    "earnings_guidance_raise":  ["raises guidance", "guidance raise", "raised outlook"],
    "earnings_guidance_cut":    ["cuts guidance", "guidance cut", "lowered outlook"],
    "analyst_upgrade":          ["upgrade", "upgraded", "raises target", "raised target"],
    "analyst_downgrade":        ["downgrade", "downgraded", "lowers target"],
    "major_lawsuit":            ["lawsuit", "sued", "sues", "legal action"],
    "regulatory_investigation": ["investigation", "probe", "sec", "doj"],
    "regulatory_approval":      ["approved", "approval", "fda approved"],
    "ceo_resignation":          ["ceo resign", "ceo steps down", "ceo fired"],
    "product_launch":           ["launch", "launches", "unveils", "announced"],
    "fraud_allegation":         ["fraud", "accounting fraud", "falsified"],
    "insider_buying":           ["insider buy", "insider purchase"],
    "insider_selling":          ["insider sell", "insider sold"],
    "takeover_offer":           ["takeover", "acquisition", "buyout", "merger"],
    "share_buyback_large":      ["buyback", "share repurchase"],
    "product_delay":            ["delay", "delayed", "postponed"],
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


def _mock_analyze(news_item: NewsItem, entity_data: EntityData) -> LLMNewsAnalysis:
    event_type = _detect_event_type(news_item.headline, news_item.body)
    bias = _detect_bias(news_item.headline, news_item.body, event_type)
    weight = abs(EVENT_WEIGHTS.get(event_type, 0))

    importance    = min(0.95, 0.50 + weight / 100)
    confidence    = 0.72
    surprise_level= min(0.90, 0.40 + weight / 80)
    needs_review  = event_type in ("fraud_allegation", "accounting_issue", "unknown")

    return LLMNewsAnalysis(
        event_type=event_type,
        directional_bias=bias,
        impact_time_horizon="intraday",
        importance=round(importance, 2),
        confidence=round(confidence, 2),
        surprise_level=round(surprise_level, 2),
        reasoning_summary=(
            f"Keyword-based analysis detected event '{event_type}' "
            f"with {bias} bias. Replace with real LLM for better accuracy."
        ),
        key_risks=["Signal based on heuristics only", "LLM not connected"],
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
