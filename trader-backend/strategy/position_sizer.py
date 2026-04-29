from config.risk_config import RISK_CONFIG


class PositionSizer:
    def calculate(self, account_equity: float, entry_price: float, stop_loss: float) -> tuple[int, float]:
        max_risk   = account_equity * RISK_CONFIG["risk_per_trade_pct"]
        risk_share = abs(entry_price - stop_loss)

        if risk_share <= 0:
            return 0, 0.0

        raw_shares = max_risk / risk_share
        max_by_val = (account_equity * RISK_CONFIG["max_position_size_pct"]) / entry_price
        shares     = int(min(raw_shares, max_by_val))
        risk_amt   = round(shares * risk_share, 2)

        return shares, risk_amt
