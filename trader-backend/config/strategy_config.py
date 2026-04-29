STRATEGY_CONFIG = {
    # Signal thresholds
    "strong_long_threshold":  75,
    "long_threshold":         55,
    "short_threshold":       -55,
    "strong_short_threshold":-75,

    # LLM minimums
    "min_llm_confidence":   0.70,
    "min_news_importance":  0.65,
    "min_surprise_level":   0.30,

    # News age
    "max_news_age_seconds":      180,
    "duplicate_window_minutes":   45,

    # Market filters
    "min_relative_volume":       1.30,
    "max_spread_pct":            0.15,
    "min_avg_daily_volume":  1_000_000,
    "max_gap_pct_for_entry":     8.0,

    # Technical filters
    "max_rsi_long":   78,
    "min_rsi_short":  22,
    "max_atr_extension": 2.5,

    # Mode
    "mode":        "paper",
    "allow_long":  True,
    "allow_short": False,   # Safety: shorts disabled by default
}
