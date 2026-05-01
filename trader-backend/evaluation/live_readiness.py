"""
Live-Go Readiness Checker

Evaluates whether the paper trading results meet the minimum bar for
switching to live trading. Each criterion has a status (pass/fail/pending)
and a current vs. required value so the frontend can show progress.
"""
from datetime import datetime

_CRITERIA = {
    "min_trades":        {"required": 100,  "label": "Minimum completed trades"},
    "min_win_rate_pct":  {"required": 55.0, "label": "Win rate (45-min basis, %)"},
    "min_profit_factor": {"required": 1.30, "label": "Profit factor (gross profit / gross loss)"},
    "max_drawdown_pct":  {"required": 10.0, "label": "Max drawdown (%)"},
    "min_avg_rr":        {"required": 1.50, "label": "Average risk/reward ratio"},
}


def evaluate(closed_trades: list[dict], backtest_summary: dict | None = None) -> dict:
    results = {}

    wins   = [t for t in closed_trades if (t.get("pnl") or 0) > 0]
    losses = [t for t in closed_trades if (t.get("pnl") or 0) < 0]
    total  = len(closed_trades)

    win_rate      = (len(wins) / total * 100) if total else 0.0
    gross_profit  = sum(t.get("pnl", 0) for t in wins)
    gross_loss    = abs(sum(t.get("pnl", 0) for t in losses))
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 0.0
    max_dd_pct    = _max_drawdown_pct(closed_trades)
    avg_rr        = _avg_rr(closed_trades)

    actuals = {
        "min_trades":        total,
        "min_win_rate_pct":  round(win_rate, 1),
        "min_profit_factor": round(profit_factor, 2),
        "max_drawdown_pct":  round(max_dd_pct, 1),
        "min_avg_rr":        round(avg_rr, 2),
    }

    all_pass = True
    for key, cfg in _CRITERIA.items():
        actual   = actuals[key]
        required = cfg["required"]
        if key == "max_drawdown_pct":
            passed = actual <= required
        else:
            passed = actual >= required

        pending = total < 10 and key != "min_trades"

        results[key] = {
            "label":    cfg["label"],
            "required": required,
            "actual":   actual,
            "status":   "pending" if pending else ("pass" if passed else "fail"),
        }
        if not passed and not pending:
            all_pass = False

    return {
        "ready":      all_pass and total >= _CRITERIA["min_trades"]["required"],
        "evaluated_at": datetime.utcnow().isoformat(),
        "total_trades": total,
        "criteria":   results,
    }


def _max_drawdown_pct(trades: list[dict]) -> float:
    if not trades:
        return 0.0
    peak = cumulative = max_dd = 0.0
    for t in trades:
        cumulative += t.get("pnl") or 0
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_dd:
            max_dd = dd
    if peak <= 0:
        return 0.0
    return round(max_dd / peak * 100, 2)


def _avg_rr(trades: list[dict]) -> float:
    rr_values = [t.get("risk_reward_ratio") or 0 for t in trades if t.get("risk_reward_ratio")]
    if not rr_values:
        return 0.0
    return round(sum(rr_values) / len(rr_values), 2)
