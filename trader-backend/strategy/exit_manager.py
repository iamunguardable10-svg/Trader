from config.risk_config import RISK_CONFIG
from models.market import MarketData
from strategy.position_sizer import PositionSizer


class ExitManager:
    def create_trade_plan(
        self,
        direction: str,
        market_data: MarketData,
        account_equity: float,
        position_sizer: PositionSizer,
    ) -> dict:
        entry = market_data.price
        atr   = market_data.atr
        rcfg  = RISK_CONFIG

        if direction == "LONG":
            stop_loss   = entry - atr * rcfg["stop_loss_atr_multiplier"]
            risk_share  = entry - stop_loss
            take_profit = entry + risk_share * rcfg["take_profit_r_multiple"]
        elif direction == "SHORT":
            stop_loss   = entry + atr * rcfg["stop_loss_atr_multiplier"]
            risk_share  = stop_loss - entry
            take_profit = entry - risk_share * rcfg["take_profit_r_multiple"]
        else:
            return {
                "direction": "NO_TRADE", "entry_price": None, "stop_loss": None,
                "take_profit": None, "position_size": 0, "risk_amount": 0.0,
                "reward_amount": 0.0, "risk_reward_ratio": 0.0,
            }

        size, risk_amt = position_sizer.calculate(account_equity, entry, stop_loss)
        reward_share   = abs(take_profit - entry)
        reward_amt     = round(reward_share * size, 2)
        rr_ratio       = round(reward_amt / risk_amt, 2) if risk_amt > 0 else 0.0

        return {
            "direction":        direction,
            "entry_price":      round(entry, 2),
            "stop_loss":        round(stop_loss, 2),
            "take_profit":      round(take_profit, 2),
            "position_size":    size,
            "risk_amount":      risk_amt,
            "reward_amount":    reward_amt,
            "risk_reward_ratio": rr_ratio,
        }

    def create_exit_plan(self) -> dict:
        rcfg = RISK_CONFIG
        return {
            "max_hold_minutes":            rcfg["max_hold_minutes"],
            "stop_loss_type":              "atr_based",
            "take_profit_type":            "r_multiple",
            "take_profit_r_multiple":      rcfg["take_profit_r_multiple"],
            "trailing_stop_enabled":       rcfg["trailing_stop_enabled"],
            "trailing_stop_after_r":       rcfg["trailing_stop_after_r"],
            "trailing_stop_atr_multiplier":rcfg["trailing_stop_atr_multiplier"],
            "exit_on_opposite_news":       True,
            "exit_if_score_reverses":      True,
        }
