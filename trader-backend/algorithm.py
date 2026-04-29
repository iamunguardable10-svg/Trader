"""
TradingAlgorithm — orchestrates all modules.
No trading logic lives anywhere else; this is the single source of truth.
"""
from config.strategy_config import STRATEGY_CONFIG
from models.news import NewsItem
from models.portfolio import PortfolioState
from strategy.scoring_engine import ScoringEngine
from strategy.signal_engine import SignalEngine
from strategy.risk_manager import RiskManager
from strategy.position_sizer import PositionSizer
from strategy.exit_manager import ExitManager


class TradingAlgorithm:
    def __init__(
        self,
        entity_resolver,
        llm_news_analyzer,
        market_data_provider,
        technical_analyzer,
        market_context_analyzer,
        duplicate_filter,
        trade_logger,
    ):
        self.entity_resolver         = entity_resolver
        self.llm_news_analyzer       = llm_news_analyzer
        self.market_data_provider    = market_data_provider
        self.technical_analyzer      = technical_analyzer
        self.market_context_analyzer = market_context_analyzer
        self.duplicate_filter        = duplicate_filter
        self.trade_logger            = trade_logger

        self.scoring_engine  = ScoringEngine()
        self.signal_engine   = SignalEngine()
        self.risk_manager    = RiskManager()
        self.position_sizer  = PositionSizer()
        self.exit_manager    = ExitManager()

    # ── main entry point ────────────────────────────────────────────────────

    def process_news(self, news_item: NewsItem, portfolio_state: PortfolioState) -> dict:
        # 1. Duplicate check
        if self.duplicate_filter.is_duplicate(news_item):
            return self._no_trade(news_item, "Duplicate news — already processed")

        # 2. Entity resolution
        entity_data = self.entity_resolver.resolve(news_item)
        if not entity_data.primary_ticker:
            return self._no_trade(news_item, "No tradable ticker found")

        # 3. LLM news analysis
        llm_analysis = self.llm_news_analyzer.analyze(news_item, entity_data)

        # 4. Market data
        market_data = self.market_data_provider.get_market_data(entity_data.primary_ticker)

        # 5. Technical indicators
        technical_data = self.technical_analyzer.calculate(entity_data.primary_ticker)

        # 6. Market context
        market_context = self.market_context_analyzer.get_context(entity_data.sector)

        # 7. Score calculation
        scores      = self.scoring_engine.calculate(llm_analysis, market_data, technical_data, market_context)
        final_score = scores["final_score"]

        # 8. Direction
        direction, strength = self.signal_engine.determine_direction(final_score)

        if direction == "NO_TRADE":
            decision = self._full_response(
                news_item, entity_data, llm_analysis, market_data,
                technical_data, market_context, scores,
                direction="NO_TRADE", strength="none",
                trade_allowed=False,
                blocking_reasons=["Final score not strong enough"],
                trade_plan=None, exit_plan=None,
            )
            self.trade_logger.log_paper_signal(decision)
            return decision

        # 9. Risk validation
        risk_check = self.risk_manager.validate(
            llm_analysis, market_data, portfolio_state, final_score, direction
        )

        if not risk_check["allowed"]:
            decision = self._full_response(
                news_item, entity_data, llm_analysis, market_data,
                technical_data, market_context, scores,
                direction="NO_TRADE", strength="blocked",
                trade_allowed=False,
                blocking_reasons=risk_check["blocking_reasons"],
                trade_plan=None, exit_plan=None,
            )
            self.trade_logger.log_paper_signal(decision)
            return decision

        # 10. Trade plan
        trade_plan = self.exit_manager.create_trade_plan(
            direction, market_data, portfolio_state.account_equity, self.position_sizer
        )

        if trade_plan.get("position_size", 0) <= 0:
            decision = self._full_response(
                news_item, entity_data, llm_analysis, market_data,
                technical_data, market_context, scores,
                direction="NO_TRADE", strength="blocked",
                trade_allowed=False,
                blocking_reasons=["Position size is zero (risk too small)"],
                trade_plan=trade_plan, exit_plan=None,
            )
            self.trade_logger.log_paper_signal(decision)
            return decision

        # 11. Exit plan
        exit_plan = self.exit_manager.create_exit_plan()

        # 12. Final decision
        decision = self._full_response(
            news_item, entity_data, llm_analysis, market_data,
            technical_data, market_context, scores,
            direction=direction, strength=strength,
            trade_allowed=True, blocking_reasons=[],
            trade_plan=trade_plan, exit_plan=exit_plan,
        )
        self.trade_logger.log_paper_signal(decision)
        return decision

    # ── response builders ───────────────────────────────────────────────────

    def _no_trade(self, news_item: NewsItem, reason: str) -> dict:
        return {
            "mode": STRATEGY_CONFIG["mode"],
            "ticker": None, "company": None, "sector": None,
            "decision": "NO_TRADE", "strength": "none",
            "trade_allowed": False, "blocking_reasons": [reason],
            "final_score": 0.0, "confidence": 0.0,
            "news": {
                "headline":    news_item.headline,
                "source":      news_item.source,
                "published_at":news_item.published_at.isoformat(),
                "url":         news_item.url,
                "event_type":  "unknown",
                "directional_bias": "neutral",
                "importance": 0.0, "surprise_level": 0.0,
                "reasoning_summary": reason,
                "key_risks": [],
            },
            "scores": {k: 0.0 for k in [
                "news_score","surprise_score","momentum_score","volume_score",
                "technical_score","market_score","sector_score","risk_penalty",
                "overextension_penalty","uncertainty_penalty","final_score",
            ]},
            "market_data": None, "technical_data": None, "market_context": None,
            "trade_plan": None, "exit_plan": None,
            "explanation": reason,
        }

    def _full_response(
        self, news_item, entity_data, llm_analysis, market_data,
        technical_data, market_context, scores,
        direction, strength, trade_allowed, blocking_reasons,
        trade_plan, exit_plan,
    ) -> dict:
        return {
            "mode":             STRATEGY_CONFIG["mode"],
            "ticker":           entity_data.primary_ticker,
            "company":          entity_data.company_name,
            "sector":           entity_data.sector,
            "decision":         direction,
            "strength":         strength,
            "trade_allowed":    trade_allowed,
            "blocking_reasons": blocking_reasons,
            "final_score":      scores["final_score"],
            "confidence":       llm_analysis.confidence,
            "news": {
                "headline":          news_item.headline,
                "source":            news_item.source,
                "published_at":      news_item.published_at.isoformat(),
                "url":               news_item.url,
                "event_type":        llm_analysis.event_type,
                "directional_bias":  llm_analysis.directional_bias,
                "importance":        llm_analysis.importance,
                "surprise_level":    llm_analysis.surprise_level,
                "reasoning_summary": llm_analysis.reasoning_summary,
                "key_risks":         llm_analysis.key_risks,
            },
            "scores": scores,
            "market_data": {
                "price":                 market_data.price,
                "day_change_pct":        market_data.day_change_pct,
                "price_change_5m_pct":   market_data.price_change_5m_pct,
                "price_change_15m_pct":  market_data.price_change_15m_pct,
                "relative_volume":       market_data.relative_volume,
                "avg_daily_volume":      market_data.avg_daily_volume,
                "spread_pct":            market_data.spread_pct,
                "gap_pct":               market_data.gap_pct,
                "atr":                   market_data.atr,
                "atr_pct":               market_data.atr_pct,
                "vwap":                  market_data.vwap,
                "vwap_distance_pct":     market_data.vwap_distance_pct,
            },
            "technical_data": {
                "ema_9":            technical_data.ema_9,
                "ema_21":           technical_data.ema_21,
                "rsi":              technical_data.rsi,
                "price_above_vwap": technical_data.price_above_vwap,
                "ema_trend":        technical_data.ema_trend,
            },
            "market_context": {
                "spy_trend":      market_context.spy_trend,
                "qqq_trend":      market_context.qqq_trend,
                "sector_trend":   market_context.sector_trend,
                "vix_change_pct": market_context.vix_change_pct,
                "risk_mode":      market_context.risk_mode,
            },
            "trade_plan":  trade_plan,
            "exit_plan":   exit_plan,
            "explanation": self._explain(direction, scores, llm_analysis, blocking_reasons),
        }

    def _explain(self, direction, scores, llm_analysis, blocking_reasons) -> str:
        if blocking_reasons:
            return "No trade because: " + "; ".join(blocking_reasons)
        if direction == "LONG":
            return (
                f"Long signal: {llm_analysis.event_type} ({llm_analysis.directional_bias}), "
                f"importance={llm_analysis.importance}, confidence={llm_analysis.confidence}, "
                f"final_score={scores['final_score']}."
            )
        if direction == "SHORT":
            return (
                f"Short signal: {llm_analysis.event_type} ({llm_analysis.directional_bias}), "
                f"importance={llm_analysis.importance}, confidence={llm_analysis.confidence}, "
                f"final_score={scores['final_score']}."
            )
        return f"No trade: final score {scores['final_score']} did not meet threshold."
