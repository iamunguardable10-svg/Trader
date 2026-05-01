RISK_CONFIG = {
    "account_equity": 10_000,

    # Risk per trade — 1% of account = $100 max loss per trade
    "risk_per_trade_pct":    0.01,    # 1%
    # Max position value = 15% of account ($1 500) so P&L is meaningful
    "max_position_size_pct": 0.15,    # 15%

    # Daily / weekly limits
    "max_daily_loss_pct":   0.02,      # 2%
    "max_weekly_loss_pct":  0.06,      # 6%

    # Trade limits
    "max_trades_per_day":   5,
    "max_open_positions":   2,

    # Cooldown
    "cooldown_after_loss_minutes": 30,

    # Exits
    # ATR here comes from 5-min bars — use 2.5× so the stop has room to breathe
    "stop_loss_atr_multiplier":      2.5,
    # Hard floor: stop distance is never less than 0.5 % of entry price
    "min_stop_loss_pct":             0.005,
    "take_profit_r_multiple":        2.0,
    "trailing_stop_enabled":         True,
    "trailing_stop_after_r":         1.0,
    "trailing_stop_atr_multiplier":  1.0,
    "max_hold_minutes":              60,

    # Safety
    "kill_switch_enabled":        True,
    "require_manual_confirmation": False,

    # Auto-execute — automatically open a position when score >= this threshold
    # Set AUTO_EXECUTE_ENABLED=true in env to activate; threshold can be overridden
    # via AUTO_EXECUTE_MIN_SCORE env var.
    "auto_execute_min_score": 75,
}
