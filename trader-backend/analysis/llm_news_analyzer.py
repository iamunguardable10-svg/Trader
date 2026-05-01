"""
LLM News Analyzer

Two modes:
  1. Mock mode  — keyword-based heuristic, zero latency, no API key needed
  2. LLM mode   — calls Groq or OpenAI (set LLM_PROVIDER=groq|openai)

Env vars:
  LLM_PROVIDER   groq | openai | mock  (default: mock)
  GROQ_API_KEY   required when LLM_PROVIDER=groq
  OPENAI_API_KEY required when LLM_PROVIDER=openai
  LLM_MODEL      override default model (optional)
  LLM_TIMEOUT    seconds per call (default: 8)
"""
import json
import logging
import os
import re
import time
from typing import Any

from models.decision import LLMNewsAnalysis
from models.news import EntityData, NewsItem
from config.event_weights import EVENT_WEIGHTS

logger = logging.getLogger(__name__)

# ── Lazy client singleton — created once, reused on every call ────────────────

_client: Any = None
_client_provider: str = ""


def _get_client(provider: str):
    global _client, _client_provider
    if _client is not None and _client_provider == provider:
        return _client

    import openai
    if provider == "groq":
        _client = openai.OpenAI(
            api_key  = os.environ["GROQ_API_KEY"],
            base_url = "https://api.groq.com/openai/v1",
            timeout  = float(os.getenv("LLM_TIMEOUT", "8")),
        )
    elif provider == "openai":
        _client = openai.OpenAI(
            api_key = os.environ["OPENAI_API_KEY"],
            timeout = float(os.getenv("LLM_TIMEOUT", "8")),
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")

    _client_provider = provider
    return _client


def _default_model(provider: str) -> str:
    defaults = {
        "groq":   "llama-3.3-70b-versatile",
        "openai": "gpt-4o-mini",
    }
    return os.getenv("LLM_MODEL", defaults.get(provider, "gpt-4o-mini"))


# ── Prompt ────────────────────────────────────────────────────────────────────

def build_llm_prompt(news_item: NewsItem, entity_data: EntityData) -> str:
    event_list = ", ".join(EVENT_WEIGHTS.keys())
    return f"""You are an expert quantitative trader analyzing financial news for short-term (intraday) stock price impact.

Your job: assess whether this news is likely to move {entity_data.primary_ticker} significantly in the next 1-2 hours, and in which direction.

Think like a trader:
- Strong earnings beats → bullish, high importance, high surprise
- Analyst upgrade + price target raise → mild bullish
- Vague commentary ("stock to watch") → low importance, neutral
- Past price moves (already happened) → low surprise (already priced in)
- Regulatory approvals, major contracts, M&A → high importance

NEWS:
Headline: {news_item.headline}
Full text: {(news_item.body or "").strip() or "(headline only)"}
Company: {entity_data.company_name} ({entity_data.primary_ticker})
Sector: {entity_data.sector}

Return ONLY valid JSON:
{{
  "event_type": "one of: {event_list}",
  "directional_bias": "bullish | bearish | neutral",
  "impact_time_horizon": "intraday | swing | long_term | unclear",
  "importance": <0.0-1.0>,
  "confidence": <0.0-1.0>,
  "surprise_level": <0.0-1.0, 0 if already priced in>,
  "reasoning_summary": "<one sentence>",
  "key_risks": ["<risk 1>", "<risk 2>"],
  "needs_human_review": <true only for fraud/legal/ambiguous>
}}"""


# ── Output validation ─────────────────────────────────────────────────────────

_VALID_BIASES   = {"bullish", "bearish", "neutral"}
_VALID_HORIZONS = {"intraday", "swing", "long_term", "unclear"}
_VALID_EVENTS   = set(EVENT_WEIGHTS.keys())


def _clamp(val: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, val))


def _parse_response(data: dict) -> LLMNewsAnalysis:
    bias = str(data.get("directional_bias", "neutral")).lower().strip()
    if bias not in _VALID_BIASES:
        if bias in ("positive", "up"):   bias = "bullish"
        elif bias in ("negative", "down"): bias = "bearish"
        else:                              bias = "neutral"

    event = str(data.get("event_type", "unknown")).lower().strip()
    if event not in _VALID_EVENTS:
        event = "unknown"

    horizon = str(data.get("impact_time_horizon", "intraday")).lower().strip()
    if horizon not in _VALID_HORIZONS:
        horizon = "intraday"

    key_risks = data.get("key_risks", [])
    if not isinstance(key_risks, list):
        key_risks = [str(key_risks)]

    return LLMNewsAnalysis(
        event_type           = event,
        directional_bias     = bias,
        impact_time_horizon  = horizon,
        importance           = round(_clamp(float(data.get("importance",     0.5))), 3),
        confidence           = round(_clamp(float(data.get("confidence",     0.5))), 3),
        surprise_level       = round(_clamp(float(data.get("surprise_level", 0.5))), 3),
        reasoning_summary    = str(data.get("reasoning_summary", ""))[:500],
        key_risks            = key_risks[:5],
        needs_human_review   = bool(data.get("needs_human_review", False)),
    )


# ── Real LLM call with retry ──────────────────────────────────────────────────

def _llm_analyze(news_item: NewsItem, entity_data: EntityData, provider: str) -> LLMNewsAnalysis:
    client = _get_client(provider)
    model  = _default_model(provider)
    prompt = build_llm_prompt(news_item, entity_data)

    last_exc = None
    for attempt in range(2):
        try:
            t0 = time.monotonic()
            response = client.chat.completions.create(
                model    = model,
                messages = [
                    {
                        "role": "system",
                        "content": "Financial news analysis engine. Respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature     = 0.1,
                max_tokens      = 400,
                response_format = {"type": "json_object"},
            )
            latency = round((time.monotonic() - t0) * 1000)
            raw     = response.choices[0].message.content.strip()
            result  = _parse_response(json.loads(raw))
            logger.debug(f"[LLM] {provider} {model} — {latency}ms")
            return result
        except Exception as exc:
            last_exc = exc
            if attempt == 0:
                logger.warning(f"[LLM] Call failed (attempt 1): {exc} — retrying")
                time.sleep(0.3)

    raise last_exc


# ── Mock analyzer (keyword heuristic) ────────────────────────────────────────

_BEARISH_KEYWORDS = {
    "falls", "fall", "fell", "drop", "drops", "dropped", "decline", "declines", "declined",
    "down", "lower", "loses", "lost", "slide", "slides", "slid", "slump", "slumps",
    "tumble", "tumbles", "tumbled", "plunge", "plunges", "plunged", "sink", "sinks",
    "retreats", "retreat", "selloff", "sell-off", "dip", "dips",
    "miss", "misses", "missed", "loss", "losses", "cut", "cuts",
    "lawsuit", "investigation", "fraud", "recall", "delay", "delays",
    "resign", "fired", "lays off", "layoffs", "warning",
    "downgrade", "downgraded", "concern", "concerns",
    "weak", "weakness", "disappoints", "disappointing",
    "bearish", "overvalued", "trouble", "struggles",
    "bankruptcy", "default", "debt", "shrinks", "shrinking",
}

_BULLISH_KEYWORDS = {
    "gains", "gain", "rises", "rise", "rose", "up", "higher", "jumps", "jumped",
    "surges", "surge", "surged", "soars", "soar", "soared", "climbs", "climb",
    "rallies", "rally", "rallied", "advances", "advance", "pops", "pop",
    "outperforms", "outperform",
    "beat", "beats", "record", "raise", "raised", "raises", "upgrade",
    "upgraded", "buyback", "dividend", "approval", "approved", "contract",
    "partnership", "launch", "launches", "acquisition", "takeover",
    "strong", "growth", "growing", "profit", "profitable",
    "bullish", "buy", "overweight", "positive", "exceeds", "tops", "crushes",
    "momentum", "breakout", "opportunity",
}

_EVENT_KEYWORDS: dict[str, list[str]] = {
    "price_cut":                ["price cut", "cuts price", "price reduction"],
    "earnings_beat_strong":     ["beat", "beats earnings", "earnings beat", "topped estimates",
                                 "exceeded expectations", "above expectations"],
    "earnings_miss_strong":     ["miss", "misses earnings", "earnings miss", "missed estimates",
                                 "below expectations", "earnings fell short"],
    "earnings_guidance_raise":  ["raises guidance", "guidance raise", "raised outlook",
                                 "raised forecast", "raised full-year", "raises full-year"],
    "earnings_guidance_cut":    ["cuts guidance", "guidance cut", "lowered outlook",
                                 "lowered forecast", "reduced guidance"],
    "analyst_upgrade":          ["upgrade", "upgraded", "raises target", "raised target",
                                 "raised price target", "initiates", "outperform", "overweight",
                                 "buy rating", "strong buy"],
    "analyst_downgrade":        ["downgrade", "downgraded", "lowers target", "lowered target",
                                 "lowered price target", "underperform", "underweight", "sell rating"],
    "major_lawsuit":            ["lawsuit", "sued", "sues", "legal action", "class action",
                                 "antitrust", "litigation"],
    "regulatory_investigation": ["investigation", "probe", "sec", "doj", "ftc",
                                 "investigated", "subpoena", "regulatory scrutiny"],
    "regulatory_approval":      ["approved", "approval", "fda approved", "cleared",
                                 "authorized", "regulatory approval"],
    "ceo_resignation":          ["ceo resign", "ceo steps down", "ceo fired", "ceo departs",
                                 "chief executive resign", "steps down as ceo"],
    "product_launch":           ["launch", "launches", "unveils", "introduces",
                                 "new product", "release", "releases", "debuts"],
    "fraud_allegation":         ["fraud", "accounting fraud", "falsified", "manipulated",
                                 "misrepresented", "embezzlement"],
    "insider_buying":           ["insider buy", "insider purchase", "insider bought",
                                 "director bought", "executive bought"],
    "insider_selling":          ["insider sell", "insider sold", "insider selling",
                                 "director sold", "executive sold"],
    "takeover_offer":           ["takeover", "acquisition", "buyout", "merger", "acquires",
                                 "to acquire", "bid for", "deal to buy"],
    "share_buyback_large":      ["buyback", "share repurchase", "repurchase program"],
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
    if bull > bear:   return "bullish"
    if bear > bull:   return "bearish"
    return "neutral"


def _mock_analyze(news_item: NewsItem, entity_data: EntityData) -> LLMNewsAnalysis:
    text       = news_item.headline + " " + news_item.body
    event_type = _detect_event_type(news_item.headline, news_item.body)
    bias       = _detect_bias(news_item.headline, news_item.body, event_type)
    weight     = abs(EVENT_WEIGHTS.get(event_type, 0))

    if bias == "neutral":
        m = re.search(r'([+-]?\d+\.?\d*)\s*%', text)
        if m:
            pct = float(m.group(1))
            if pct > 0.5:   bias = "bullish"
            elif pct < -0.5: bias = "bearish"

    importance     = round(min(0.95, 0.60 + weight / 80), 2)
    surprise_level = round(min(0.90, 0.45 + weight / 70), 2)
    confidence     = 0.68 if bias == "neutral" else 0.75

    return LLMNewsAnalysis(
        event_type           = event_type,
        directional_bias     = bias,
        impact_time_horizon  = "intraday",
        importance           = importance,
        confidence           = confidence,
        surprise_level       = surprise_level,
        reasoning_summary    = (
            f"Keyword heuristic: event='{event_type}', bias={bias}. "
            "Set LLM_PROVIDER=groq for real analysis."
        ),
        key_risks            = ["Heuristic analysis — set LLM_PROVIDER=groq for production"],
        needs_human_review   = event_type in ("fraud_allegation", "accounting_issue"),
    )


# ── Public class ──────────────────────────────────────────────────────────────

class LLMNewsAnalyzer:
    def __init__(self):
        provider = os.getenv("LLM_PROVIDER", "mock").lower()
        if provider == "groq":
            key    = os.getenv("GROQ_API_KEY", "")
            masked = (key[:8] + "…") if len(key) > 8 else ("SET" if key else "MISSING")
            logger.info(f"[LLM] Provider=groq  model={_default_model('groq')}  key={masked}")
        elif provider == "openai":
            key = os.getenv("OPENAI_API_KEY", "")
            logger.info(f"[LLM] Provider=openai  model={_default_model('openai')}  key={'SET' if key else 'MISSING'}")
        else:
            logger.info("[LLM] Provider=mock (keyword heuristic — set LLM_PROVIDER=groq for real analysis)")

    def analyze(self, news_item: NewsItem, entity_data: EntityData) -> LLMNewsAnalysis:
        provider = os.getenv("LLM_PROVIDER", "mock").lower()
        if provider == "mock":
            return _mock_analyze(news_item, entity_data)
        try:
            return _llm_analyze(news_item, entity_data, provider)
        except Exception as exc:
            logger.warning(f"[LLM] Failed after retries — falling back to mock: {exc}")
            return _mock_analyze(news_item, entity_data)
