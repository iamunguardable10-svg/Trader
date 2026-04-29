RISK_CONFIG = {
    "account_equity": 10_000,

    # Risk per trade
    "risk_per_trade_pct":    0.0025,   # 0.25%
    "max_position_size_pct": 0.02,     # 2% of account

    # Daily / weekly limits
    "max_daily_loss_pct":   0.01,      # 1%
    "max_weekly_loss_pct":  0.03,      # 3%

    # Trade limits
    "max_trades_per_day":   5,
    "max_open_positions":   2,

    # Cooldown
    "cooldown_after_loss_minutes": 30,

    # Exits
    "stop_loss_atr_multiplier":      1.2,
    "take_profit_r_multiple":        2.0,
    "trailing_stop_enabled":         True,
    "trailing_stop_after_r":         1.0,
    "trailing_stop_atr_multiplier":  1.0,
    "max_hold_minutes":              45,

    # Safety
    "kill_switch_enabled":        True,
    "require_manual_confirmation": False,
}
