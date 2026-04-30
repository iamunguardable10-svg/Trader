"""
Unit tests for ScoringEngine.
All inputs are constructed manually — no network calls.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from strategy.scoring_engine import ScoringEngine
from models.decision import LLMNewsAnalysis
from models.market import MarketData, TechnicalData, MarketContext


def _llm(bias="bullish", event="earnings_beat_strong", importance=0.80, confidence=0.80,
         surprise=0.70, review=False) -> LLMNewsAnalysis:
    return LLMNewsAnalysis(
        event_type=event, directional_bias=bias,
        impact_time_horizon="intraday",
        importance=importance, confidence=confidence, surprise_level=surprise,
        reasoning_summary="test", key_risks=[], needs_human_review=review,
    )


def _md(price=150.0, chg5m=0.3, chg15m=0.5, rel_vol=1.8, gap=0.2,
        atr=1.2, atr_pct=0.8, vwap=148.0, vwap_dist=1.35) -> MarketData:
    return MarketData(
        ticker="TEST", price=price, previous_close=price - 1,
        day_change_pct=0.5,
        price_change_5m_pct=chg5m, price_change_15m_pct=chg15m,
        relative_volume=rel_vol, avg_daily_volume=5_000_000,
        spread_pct=0.05, gap_pct=gap,
        atr=atr, atr_pct=atr_pct, vwap=vwap, vwap_distance_pct=vwap_dist,
    )


def _td(above_vwap=True, ema_trend="bullish", rsi=58.0) -> TechnicalData:
    return TechnicalData(
        ema_9=151.0, ema_21=149.0, rsi=rsi,
        price_above_vwap=above_vwap, ema_trend=ema_trend, atr=1.2,
    )


def _ctx(risk="risk_on", spy="bullish", qqq="bullish", sector="bullish", vix=-2.0) -> MarketContext:
    return MarketContext(
        spy_trend=spy, qqq_trend=qqq, sector_trend=sector,
        vix_change_pct=vix, risk_mode=risk,
    )


engine = ScoringEngine()


class TestNewsScore:
    def test_bullish_event_positive(self):
        scores = engine.calculate(_llm(bias="bullish", event="earnings_beat_strong"), _md(), _td(), _ctx())
        assert scores["news_score"] > 0

    def test_bearish_event_negative(self):
        scores = engine.calculate(_llm(bias="bearish", event="earnings_miss_strong"), _md(), _td(), _ctx())
        assert scores["news_score"] < 0

    def test_neutral_bias_zero_news(self):
        scores = engine.calculate(_llm(bias="neutral", event="macro_news"), _md(), _td(), _ctx())
        assert scores["news_score"] == 0.0
        assert scores["surprise_score"] == 0.0


class TestMomentumScore:
    def test_bullish_price_up_positive(self):
        scores = engine.calculate(_llm(), _md(chg5m=0.6, chg15m=0.8, rel_vol=1.8), _td(), _ctx())
        assert scores["momentum_score"] > 0

    def test_bullish_price_down_penalty(self):
        scores = engine.calculate(_llm(), _md(chg5m=-0.5, chg15m=-0.3), _td(), _ctx())
        assert scores["momentum_score"] < 0


class TestTechnicalScore:
    def test_bullish_above_vwap_ema_up(self):
        scores = engine.calculate(_llm(), _md(), _td(above_vwap=True, ema_trend="bullish", rsi=55), _ctx())
        assert scores["technical_score"] > 0

    def test_bullish_below_vwap_ema_down(self):
        scores = engine.calculate(_llm(), _md(), _td(above_vwap=False, ema_trend="bearish", rsi=55), _ctx())
        assert scores["technical_score"] < 0

    def test_overbought_rsi_penalty(self):
        score_normal = engine.calculate(_llm(), _md(), _td(rsi=55), _ctx())["technical_score"]
        score_overbought = engine.calculate(_llm(), _md(), _td(rsi=82), _ctx())["technical_score"]
        assert score_overbought < score_normal


class TestMarketContextScore:
    def test_risk_on_bullish_positive(self):
        scores = engine.calculate(_llm(), _md(), _td(), _ctx(risk="risk_on"))
        assert scores["market_score"] > 0

    def test_risk_off_bullish_negative(self):
        scores = engine.calculate(_llm(), _md(), _td(), _ctx(risk="risk_off"))
        assert scores["market_score"] < 0


class TestUncertaintyPenalty:
    def test_needs_review_adds_penalty(self):
        base    = engine.calculate(_llm(review=False), _md(), _td(), _ctx())["uncertainty_penalty"]
        with_rv = engine.calculate(_llm(review=True),  _md(), _td(), _ctx())["uncertainty_penalty"]
        assert with_rv > base

    def test_neutral_bias_large_penalty(self):
        scores = engine.calculate(_llm(bias="neutral"), _md(), _td(), _ctx())
        assert scores["uncertainty_penalty"] >= 25


class TestFinalScore:
    def test_strong_bullish_signal_above_threshold(self):
        from config.strategy_config import STRATEGY_CONFIG
        scores = engine.calculate(
            _llm(bias="bullish", event="earnings_beat_strong", importance=0.90, confidence=0.90, surprise=0.80),
            _md(chg5m=0.6, chg15m=0.9, rel_vol=2.8),
            _td(above_vwap=True, ema_trend="bullish", rsi=58),
            _ctx(risk="risk_on", sector="bullish"),
        )
        assert scores["final_score"] >= STRATEGY_CONFIG["long_threshold"]

    def test_neutral_news_below_threshold(self):
        from config.strategy_config import STRATEGY_CONFIG
        scores = engine.calculate(
            _llm(bias="neutral", event="macro_news", importance=0.40, confidence=0.50, surprise=0.20),
            _md(chg5m=0.0, chg15m=0.0, rel_vol=0.9),
            _td(above_vwap=False, ema_trend="bearish", rsi=45),
            _ctx(risk="neutral"),
        )
        assert scores["final_score"] < STRATEGY_CONFIG["long_threshold"]
