from dataclasses import dataclass


@dataclass
class PortfolioState:
    account_equity: float
    daily_pnl_pct: float
    weekly_pnl_pct: float
    open_positions: int
    trades_today: int
    last_trade_was_loss: bool
    minutes_since_last_loss: int
    kill_switch_active: bool
