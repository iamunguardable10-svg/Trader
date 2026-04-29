from config.strategy_config import STRATEGY_CONFIG


class SignalEngine:
    def determine_direction(self, final_score: float) -> tuple[str, str]:
        cfg = STRATEGY_CONFIG
        if final_score >= cfg["strong_long_threshold"]:  return "LONG",     "strong"
        if final_score >= cfg["long_threshold"]:         return "LONG",     "medium"
        if final_score <= cfg["strong_short_threshold"]: return "SHORT",    "strong"
        if final_score <= cfg["short_threshold"]:        return "SHORT",    "medium"
        return "NO_TRADE", "none"
