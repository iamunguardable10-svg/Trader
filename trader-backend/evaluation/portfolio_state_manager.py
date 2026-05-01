"""
PortfolioStateManager

Single source of truth for live portfolio metrics.
Call `refresh(broker, portfolio)` after every trade open or close to keep
PortfolioState in sync with actual broker data.
"""
from datetime import datetime, timedelta

from config.risk_config import RISK_CONFIG
from models.portfolio import PortfolioState


def refresh(broker, portfolio: PortfolioState) -> None:
    """Recompute all PortfolioState fields from the broker's actual trade history."""
    account_equity = _current_equity(broker)
    closed         = broker.closed_trades

    portfolio.account_equity    = account_equity
    portfolio.open_positions     = len(broker.open_positions)
    portfolio.daily_pnl_pct      = _pnl_pct_since(closed, account_equity, days=0)
    portfolio.weekly_pnl_pct     = _pnl_pct_since(closed, account_equity, days=6)
    portfolio.trades_today       = _count_today(broker.open_positions, closed)

    last_loss_minutes = _minutes_since_last_loss(closed)
    portfolio.last_trade_was_loss    = last_loss_minutes is not None
    portfolio.minutes_since_last_loss = last_loss_minutes if last_loss_minutes is not None else 9999


# ── helpers ───────────────────────────────────────────────────────────────────

def _current_equity(broker) -> float:
    if hasattr(broker, "get_account"):
        try:
            acc = broker.get_account()
            return float(acc.get("equity") or RISK_CONFIG["account_equity"])
        except Exception:
            pass
    closed_pnl = sum(t.get("pnl") or 0 for t in broker.closed_trades)
    return round(RISK_CONFIG["account_equity"] + closed_pnl, 2)


def _pnl_pct_since(closed: list[dict], equity: float, days: int) -> float:
    if not equity:
        return 0.0
    cutoff = (datetime.utcnow() - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    total  = sum(
        t.get("pnl") or 0
        for t in closed
        if _exit_time(t) >= cutoff
    )
    return round(total / equity, 6)


def _count_today(open_positions: list[dict], closed: list[dict]) -> int:
    today = datetime.utcnow().date()
    opened_today = sum(
        1 for t in closed
        if _parse_dt(t.get("entry_time", "")).date() == today
    )
    opened_today += sum(
        1 for p in open_positions
        if _parse_dt(p.get("entry_time", "")).date() == today
    )
    return opened_today


def _minutes_since_last_loss(closed: list[dict]) -> int | None:
    losses = [t for t in closed if (t.get("pnl") or 0) < 0]
    if not losses:
        return None
    last_loss_time = max(_exit_time(t) for t in losses)
    delta = datetime.utcnow() - last_loss_time
    return int(delta.total_seconds() / 60)


def _exit_time(t: dict) -> datetime:
    return _parse_dt(t.get("exit_time") or t.get("entry_time") or "")


def _parse_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return datetime.min
