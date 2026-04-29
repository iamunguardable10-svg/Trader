from config.risk_config import RISK_CONFIG
from config.strategy_config import STRATEGY_CONFIG
from models.decision import LLMNewsAnalysis
from models.market import MarketData
from models.portfolio import PortfolioState


class RiskManager:
    def validate(
        self,
        llm_analysis: LLMNewsAnalysis,
        market_data: MarketData,
        portfolio_state: PortfolioState,
        final_score: float,
        direction: str,
    ) -> dict:
        reasons: list[str] = []
        cfg  = STRATEGY_CONFIG
        rcfg = RISK_CONFIG
        ps   = portfolio_state
        md   = market_data

        if ps.kill_switch_active:
            reasons.append("Kill switch is active")

        if ps.daily_pnl_pct <= -rcfg["max_daily_loss_pct"]:
            reasons.append("Daily loss limit reached")

        if ps.weekly_pnl_pct <= -rcfg["max_weekly_loss_pct"]:
            reasons.append("Weekly loss limit reached")

        if ps.open_positions >= rcfg["max_open_positions"]:
            reasons.append("Maximum open positions reached")

        if ps.trades_today >= rcfg["max_trades_per_day"]:
            reasons.append("Maximum trades per day reached")

        if ps.last_trade_was_loss and ps.minutes_since_last_loss < rcfg["cooldown_after_loss_minutes"]:
            reasons.append("Cooldown after loss is active")

        if llm_analysis.confidence < cfg["min_llm_confidence"]:
            reasons.append(f"LLM confidence too low ({llm_analysis.confidence:.2f} < {cfg['min_llm_confidence']})")

        if llm_analysis.importance < cfg["min_news_importance"]:
            reasons.append(f"News importance too low ({llm_analysis.importance:.2f} < {cfg['min_news_importance']})")

        if md.spread_pct > cfg["max_spread_pct"]:
            reasons.append(f"Spread too high ({md.spread_pct:.2f}% > {cfg['max_spread_pct']}%)")

        if md.relative_volume < cfg["min_relative_volume"]:
            reasons.append(f"Relative volume too low ({md.relative_volume:.2f}x < {cfg['min_relative_volume']}x)")

        if md.avg_daily_volume < cfg["min_avg_daily_volume"]:
            reasons.append("Average daily volume too low")

        if abs(md.gap_pct) > cfg["max_gap_pct_for_entry"]:
            reasons.append(f"Gap too large ({md.gap_pct:.1f}%)")

        if direction == "LONG" and not cfg["allow_long"]:
            reasons.append("Long trades disabled")

        if direction == "SHORT" and not cfg["allow_short"]:
            reasons.append("Short trades disabled")

        if direction == "LONG" and final_score < cfg["long_threshold"]:
            reasons.append("Long score below threshold")

        if direction == "SHORT" and final_score > cfg["short_threshold"]:
            reasons.append("Short score above threshold")

        return {"allowed": len(reasons) == 0, "blocking_reasons": reasons}
