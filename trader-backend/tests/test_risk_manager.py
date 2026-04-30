import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from strategy.risk_manager import RiskManager
from models.decision import LLMNewsAnalysis
from models.market import MarketData
from models.portfolio import PortfolioState

manager = RiskManager()


def _llm(confidence=0.80, importance=0.75) -> LLMNewsAnalysis:
    return LLMNewsAnalysis(
        event_type="earnings_beat_strong", directional_bias="bullish",
        impact_time_horizon="intraday",
        importance=importance, confidence=confidence, surprise_level=0.6,
        reasoning_summary="test", key_risks=[], needs_human_review=False,
    )


def _md(rel_vol=1.5, spread=0.05, avg_vol=5_000_000, gap=0.5) -> MarketData:
    return MarketData(
        ticker="TEST", price=150.0, previous_close=149.0,
        day_change_pct=0.5, price_change_5m_pct=0.3, price_change_15m_pct=0.5,
        relative_volume=rel_vol, avg_daily_volume=avg_vol,
        spread_pct=spread, gap_pct=gap,
        atr=1.2, atr_pct=0.8, vwap=148.0, vwap_distance_pct=1.3,
    )


def _ps(**kwargs) -> PortfolioState:
    defaults = dict(
        account_equity=10_000, daily_pnl_pct=0.0, weekly_pnl_pct=0.0,
        open_positions=0, trades_today=0,
        last_trade_was_loss=False, minutes_since_last_loss=9999,
        kill_switch_active=False,
    )
    defaults.update(kwargs)
    return PortfolioState(**defaults)


class TestAllowed:
    def test_clean_state_allowed(self):
        result = manager.validate(_llm(), _md(), _ps(), 50.0, "LONG")
        assert result["allowed"] is True

    def test_allowed_short(self):
        result = manager.validate(_llm(), _md(), _ps(), -50.0, "SHORT")
        assert result["allowed"] is True


class TestPortfolioBlocks:
    def test_kill_switch(self):
        result = manager.validate(_llm(), _md(), _ps(kill_switch_active=True), 50.0, "LONG")
        assert result["allowed"] is False
        assert any("kill" in r.lower() for r in result["blocking_reasons"])

    def test_daily_loss_limit(self):
        result = manager.validate(_llm(), _md(), _ps(daily_pnl_pct=-0.02), 50.0, "LONG")
        assert result["allowed"] is False

    def test_max_positions(self):
        result = manager.validate(_llm(), _md(), _ps(open_positions=2), 50.0, "LONG")
        assert result["allowed"] is False

    def test_max_trades_per_day(self):
        result = manager.validate(_llm(), _md(), _ps(trades_today=5), 50.0, "LONG")
        assert result["allowed"] is False

    def test_cooldown_after_loss(self):
        result = manager.validate(_llm(), _md(), _ps(last_trade_was_loss=True, minutes_since_last_loss=5), 50.0, "LONG")
        assert result["allowed"] is False


class TestMarketBlocks:
    def test_low_confidence_blocked(self):
        result = manager.validate(_llm(confidence=0.30), _md(), _ps(), 50.0, "LONG")
        assert result["allowed"] is False

    def test_low_importance_blocked(self):
        result = manager.validate(_llm(importance=0.20), _md(), _ps(), 50.0, "LONG")
        assert result["allowed"] is False

    def test_low_volume_blocked(self):
        result = manager.validate(_llm(), _md(rel_vol=0.3), _ps(), 50.0, "LONG")
        assert result["allowed"] is False

    def test_gap_too_large_blocked(self):
        result = manager.validate(_llm(), _md(gap=10.0), _ps(), 50.0, "LONG")
        assert result["allowed"] is False

    def test_thin_volume_stock_blocked(self):
        result = manager.validate(_llm(), _md(avg_vol=100_000), _ps(), 50.0, "LONG")
        assert result["allowed"] is False


class TestMultipleReasons:
    def test_multiple_blocking_reasons_all_reported(self):
        result = manager.validate(
            _llm(confidence=0.20, importance=0.20),
            _md(rel_vol=0.2),
            _ps(kill_switch_active=True),
            50.0, "LONG",
        )
        assert result["allowed"] is False
        assert len(result["blocking_reasons"]) >= 3
