from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class LLMNewsAnalysis:
    event_type: str
    directional_bias: str        # "bullish" | "bearish" | "neutral"
    impact_time_horizon: str     # "intraday" | "swing" | "long_term" | "unclear"
    importance: float
    confidence: float
    surprise_level: float
    reasoning_summary: str
    key_risks: List[str] = field(default_factory=list)
    needs_human_review: bool = False


@dataclass
class ScoreBreakdown:
    news_score: float
    surprise_score: float
    momentum_score: float
    volume_score: float
    technical_score: float
    market_score: float
    sector_score: float
    risk_penalty: float
    overextension_penalty: float
    uncertainty_penalty: float
    final_score: float


@dataclass
class TradePlan:
    direction: str
    entry_price: Optional[float]
    stop_loss: Optional[float]
    take_profit: Optional[float]
    position_size: int
    risk_amount: float
    reward_amount: float
    risk_reward_ratio: float


@dataclass
class ExitPlan:
    max_hold_minutes: int
    stop_loss_type: str
    take_profit_type: str
    take_profit_r_multiple: float
    trailing_stop_enabled: bool
    trailing_stop_after_r: float
    trailing_stop_atr_multiplier: float
    exit_on_opposite_news: bool
    exit_if_score_reverses: bool
