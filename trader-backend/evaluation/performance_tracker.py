class PerformanceTracker:
    def calculate(self, closed_trades: list[dict]) -> dict:
        if not closed_trades:
            return {
                "total_trades": 0, "winning_trades": 0, "losing_trades": 0,
                "win_rate": 0.0, "total_pnl": 0.0, "avg_win": 0.0,
                "avg_loss": 0.0, "profit_factor": 0.0,
                "max_drawdown": 0.0, "max_drawdown_pct": 0.0,
                "sharpe_ratio": None, "equity_curve": [],
            }

        wins   = [t for t in closed_trades if (t.get("pnl") or 0) > 0]
        losses = [t for t in closed_trades if (t.get("pnl") or 0) < 0]

        total_pnl    = round(sum(t.get("pnl", 0) for t in closed_trades), 2)
        gross_profit = sum(t.get("pnl", 0) for t in wins)
        gross_loss   = abs(sum(t.get("pnl", 0) for t in losses))

        win_rate      = round(len(wins) / len(closed_trades), 4)
        avg_win       = round(gross_profit / len(wins), 2)   if wins   else 0.0
        avg_loss      = round(gross_loss   / len(losses), 2) if losses else 0.0
        profit_factor = round(gross_profit / gross_loss, 2)  if gross_loss > 0 else 0.0

        max_dd, max_dd_pct = self._max_drawdown(closed_trades)
        equity_curve       = self._equity_curve(closed_trades)

        return {
            "total_trades":    len(closed_trades),
            "winning_trades":  len(wins),
            "losing_trades":   len(losses),
            "win_rate":        win_rate,
            "total_pnl":       total_pnl,
            "avg_win":         avg_win,
            "avg_loss":        avg_loss,
            "profit_factor":   profit_factor,
            "max_drawdown":    max_dd,
            "max_drawdown_pct": max_dd_pct,
            "sharpe_ratio":    self._sharpe(closed_trades),
            "equity_curve":    equity_curve,
        }

    def _max_drawdown(self, trades: list[dict]) -> tuple[float, float]:
        peak = 0.0
        cumulative = 0.0
        max_dd = 0.0

        for t in trades:
            cumulative += t.get("pnl", 0)
            if cumulative > peak:
                peak = cumulative
            dd = peak - cumulative
            if dd > max_dd:
                max_dd = dd

        max_dd_pct = round((max_dd / peak * 100) if peak > 0 else 0.0, 2)
        return round(max_dd, 2), max_dd_pct

    def _equity_curve(self, trades: list[dict]) -> list[dict]:
        curve = []
        cumulative = 0.0
        for t in trades:
            cumulative += t.get("pnl", 0)
            date = (t.get("exit_time") or t.get("entry_time") or "")[:10]
            curve.append({"date": date, "equity": round(10_000 + cumulative, 2)})
        return curve

    def _sharpe(self, trades: list[dict]) -> float | None:
        pnls = [t.get("pnl", 0) for t in trades]
        if len(pnls) < 2:
            return None
        import statistics
        mean = statistics.mean(pnls)
        std  = statistics.stdev(pnls)
        if std == 0:
            return None
        return round(mean / std * (252 ** 0.5 / 20), 2)  # rough annualisation
