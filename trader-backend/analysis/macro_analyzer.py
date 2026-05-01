"""
MacroAnalyzer — runs geopolitical / macro news through Groq/OpenAI.

Instead of resolving to a single ticker, the LLM is asked which sectors
are affected and in which direction. The scheduler then fans out one signal
per affected ticker in the watchlist.
"""
import json
import os
from dataclasses import dataclass, field


@dataclass
class MacroImpact:
    sector:           str    # Technology | Energy | Financials | etc.
    direction:        str    # bullish | bearish | neutral
    confidence:       float  # 0–1
    importance:       float  # 0–1
    reasoning:        str
    affected_tickers: list[str] = field(default_factory=list)  # filled in by scheduler


KNOWN_SECTORS = [
    "Technology", "Energy", "Financials", "Healthcare", "Consumer Cyclical",
    "Consumer Defensive", "Industrials", "Materials", "Real Estate",
    "Communication Services", "Utilities",
]

_MACRO_SYSTEM = (
    "You are a macro-economic analyst for an algorithmic trading desk. "
    "You receive financial or geopolitical news and must identify which stock market sectors "
    "are affected and in which direction. Always respond with valid JSON only — no markdown."
)

_MACRO_PROMPT_TMPL = """Analyze this macro/geopolitical news for its stock market sector impact.

Headline: {headline}
Full text: {body}
Source: {source}

Think like a trader:
- Trump tariffs on China → Technology/Semiconductors bearish, Defense bullish, Consumer discretionary bearish
- Fed rate hike surprise → Financials mixed, Real Estate bearish, Growth tech bearish
- Oil sanctions → Energy bullish, Airlines/Transport bearish, Materials mixed
- Strong jobs report → Consumer cyclical bullish, Fed-sensitive sectors under pressure
- War/conflict escalation → Defense bullish, broad risk-off, Energy bullish
- Trade deal signed → Manufacturing/Industrials bullish, affected sectors relief rally

Read the full text carefully. Only include sectors with a real, non-trivial impact.

Return ONLY valid JSON:
{{
  "is_market_relevant": <true/false — is this actually relevant to stock markets?>,
  "macro_theme": "<one phrase: e.g. 'Trump tariffs', 'Fed pivot', 'Oil shock'>",
  "sector_impacts": [
    {{
      "sector": "<one of: {sectors}>",
      "direction": "bullish | bearish | neutral",
      "confidence": <0.0-1.0>,
      "importance": <0.0-1.0>,
      "reasoning": "<one sentence>"
    }}
  ]
}}"""


def _build_macro_prompt(headline: str, body: str, source: str) -> str:
    return _MACRO_PROMPT_TMPL.format(
        headline=headline,
        body=(body or "").strip() or "(no body — headline only)",
        source=source,
        sectors=", ".join(KNOWN_SECTORS),
    )


def analyze_macro(headline: str, body: str, source: str) -> list[MacroImpact]:
    """
    Call Groq/OpenAI to assess macro sector impacts.
    Returns [] on any failure so the caller can skip gracefully.
    Falls back to [] (not mock) — macro signals without LLM are meaningless.
    """
    provider = os.getenv("LLM_PROVIDER", "mock").lower()
    if provider not in ("groq", "openai"):
        # Without a real LLM there is no reliable macro analysis
        return []

    if provider == "openai":
        import openai
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model  = os.getenv("LLM_MODEL", "gpt-4o-mini")
    else:
        import openai
        client = openai.OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
        )
        model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

    prompt = _build_macro_prompt(headline, body, source)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system",  "content": _MACRO_SYSTEM},
                {"role": "user",    "content": prompt},
            ],
            temperature=0.1,
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content.strip())
    except Exception as e:
        print(f"[MacroAnalyzer] LLM call failed — {type(e).__name__}: {e}")
        return []

    if not data.get("is_market_relevant"):
        return []

    impacts: list[MacroImpact] = []
    for item in data.get("sector_impacts", []):
        sector    = str(item.get("sector", "")).strip()
        direction = str(item.get("direction", "neutral")).lower().strip()
        conf      = float(item.get("confidence", 0.5))
        imp       = float(item.get("importance",  0.5))
        reasoning = str(item.get("reasoning", ""))

        if sector not in KNOWN_SECTORS:
            continue
        if direction not in ("bullish", "bearish", "neutral"):
            direction = "neutral"
        if imp < 0.35 or conf < 0.40:   # skip weak/uncertain impacts
            continue

        impacts.append(MacroImpact(
            sector=sector,
            direction=direction,
            confidence=min(1.0, max(0.0, conf)),
            importance=min(1.0, max(0.0, imp)),
            reasoning=reasoning[:300],
        ))

    return impacts
