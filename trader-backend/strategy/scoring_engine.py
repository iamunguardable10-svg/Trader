from config.event_weights import EVENT_WEIGHTS
from models.decision import LLMNewsAnalysis
from models.market import MarketContext, MarketData, TechnicalData


class ScoringEngine:
    def calculate(
        self,
        llm_analysis: LLMNewsAnalysis,
        market_data: MarketData,
        technical_data: TechnicalData,
        market_context: MarketContext,
    ) -> dict:
        news_score            = self._score_news(llm_analysis)
        surprise_score        = self._score_surprise(llm_analysis)
        momentum_score        = self._score_momentum(llm_analysis.directional_bias, market_data)
        volume_score          = self._score_volume(llm_analysis.directional_bias, market_data.relative_volume)
        technical_score       = self._score_technicals(llm_analysis.directional_bias, market_data, technical_data)
        market_score          = self._score_market_context(llm_analysis.directional_bias, market_context)
        sector_score          = self._score_sector_context(llm_analysis.directional_bias, market_context)
        overextension_penalty = self._score_overextension(llm_analysis.directional_bias, market_data, technical_data)
        uncertainty_penalty   = self._score_uncertainty(llm_analysis)
        risk_penalty          = 0.0

        final_score = (
            news_score + surprise_score + momentum_score + volume_score
            + technical_score + market_score + sector_score
            - risk_penalty - overextension_penalty - uncertainty_penalty
        )

        return {
            "news_score":            round(news_score, 2),
            "surprise_score":        round(surprise_score, 2),
            "momentum_score":        round(momentum_score, 2),
            "volume_score":          round(volume_score, 2),
            "technical_score":       round(technical_score, 2),
            "market_score":          round(market_score, 2),
            "sector_score":          round(sector_score, 2),
            "risk_penalty":          round(risk_penalty, 2),
            "overextension_penalty": round(overextension_penalty, 2),
            "uncertainty_penalty":   round(uncertainty_penalty, 2),
            "final_score":           round(final_score, 2),
        }

    # ── individual scorers ──────────────────────────────────────────────────

    def _score_news(self, a: LLMNewsAnalysis) -> float:
        if a.directional_bias == "neutral":
            return 0.0
        base = EVENT_WEIGHTS.get(a.event_type, 0)
        score = base * a.importance * a.confidence
        return score

    def _score_surprise(self, a: LLMNewsAnalysis) -> float:
        if a.directional_bias == "neutral":
            return 0.0
        base = 20 * a.surprise_level * a.confidence
        if a.directional_bias == "bullish":
            return base
        return -base

    def _score_momentum(self, direction: str, md: MarketData) -> float:
        score = 0.0
        if direction == "bullish":
            if md.price_change_5m_pct > 0:   score += 8
            if md.price_change_15m_pct > 0:  score += 8
            if md.price_change_5m_pct > 0.5: score += 4
            if md.relative_volume > 1.5:     score += 5
            if md.price_change_5m_pct < -0.3: score -= 12
        elif direction == "bearish":
            if md.price_change_5m_pct < 0:    score -= 8
            if md.price_change_15m_pct < 0:   score -= 8
            if md.price_change_5m_pct < -0.5: score -= 4
            if md.relative_volume > 1.5:      score -= 5
            if md.price_change_5m_pct > 0.3:  score += 12
        return score

    def _score_volume(self, direction: str, rel_vol: float) -> float:
        if rel_vol < 1.0:     base = 0
        elif rel_vol < 1.5:   base = 4
        elif rel_vol < 2.5:   base = 8
        else:                 base = 12

        if direction == "bullish": return  base
        if direction == "bearish": return -base
        return 0.0

    def _score_technicals(self, direction: str, md: MarketData, td: TechnicalData) -> float:
        score = 0.0
        if direction == "bullish":
            score += 8 if td.price_above_vwap else -5
            if td.ema_trend == "bullish":   score += 8
            elif td.ema_trend == "bearish": score -= 8
            if 45 <= td.rsi <= 70:          score += 6
            elif td.rsi > 78:               score -= 12
        elif direction == "bearish":
            score += -8 if not td.price_above_vwap else 5
            if td.ema_trend == "bearish":   score -= 8
            elif td.ema_trend == "bullish": score += 8
            if 30 <= td.rsi <= 55:          score -= 6
            elif td.rsi < 22:               score += 12
        return score

    def _score_market_context(self, direction: str, ctx: MarketContext) -> float:
        score = 0.0
        if ctx.risk_mode == "risk_on":
            score += 8 if direction == "bullish" else 4
        elif ctx.risk_mode == "risk_off":
            score -= 10 if direction == "bullish" else 8
        if ctx.vix_change_pct > 8:
            score -= 6 if direction == "bullish" else 4
        return score

    def _score_sector_context(self, direction: str, ctx: MarketContext) -> float:
        score = 0.0
        if direction == "bullish":
            if ctx.sector_trend == "bullish":   score += 7
            elif ctx.sector_trend == "bearish": score -= 7
        elif direction == "bearish":
            if ctx.sector_trend == "bearish":   score -= 7
            elif ctx.sector_trend == "bullish": score += 7
        return score

    def _score_overextension(self, direction: str, md: MarketData, td: TechnicalData) -> float:
        penalty = 0.0
        atr_ext = abs(md.vwap_distance_pct) / max(md.atr_pct, 0.01)
        if direction == "bullish":
            if td.rsi > 78:       penalty += 10
            if md.gap_pct > 8:    penalty += 10
            if atr_ext > 2.5:     penalty += 8
        elif direction == "bearish":
            if td.rsi < 22:       penalty += 10
            if md.gap_pct < -8:   penalty += 10
            if atr_ext > 2.5:     penalty += 8
        return penalty

    def _score_uncertainty(self, a: LLMNewsAnalysis) -> float:
        penalty = 0.0
        if a.confidence < 0.75:           penalty += 5
        if a.importance < 0.70:           penalty += 5
        if a.needs_human_review:          penalty += 15
        if a.directional_bias == "neutral": penalty += 25
        return penalty
