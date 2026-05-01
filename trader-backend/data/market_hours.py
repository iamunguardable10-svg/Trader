"""
NYSE market status — checks if the US stock market is currently open.
Uses zoneinfo (stdlib ≥ 3.9) for ET timezone, no extra dependencies.
"""
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

_ET = ZoneInfo("America/New_York")

# NYSE holidays 2025 + 2026 (confirmed official schedule)
_HOLIDAYS = {
    # 2025
    date(2025, 1,  1),   # New Year's Day
    date(2025, 1, 20),   # MLK Day
    date(2025, 2, 17),   # Presidents' Day
    date(2025, 4, 18),   # Good Friday
    date(2025, 5, 26),   # Memorial Day
    date(2025, 6, 19),   # Juneteenth
    date(2025, 7,  4),   # Independence Day
    date(2025, 9,  1),   # Labor Day
    date(2025, 11, 27),  # Thanksgiving
    date(2025, 12, 25),  # Christmas
    # 2026
    date(2026, 1,  1),   # New Year's Day
    date(2026, 1, 19),   # MLK Day
    date(2026, 2, 16),   # Presidents' Day
    date(2026, 4,  3),   # Good Friday
    date(2026, 5, 25),   # Memorial Day
    date(2026, 6, 19),   # Juneteenth
    date(2026, 7,  3),   # Independence Day (observed)
    date(2026, 9,  7),   # Labor Day
    date(2026, 11, 26),  # Thanksgiving
    date(2026, 12, 25),  # Christmas
}

_OPEN  = time(9, 30)
_CLOSE = time(16,  0)


def get_market_status() -> dict:
    """
    Returns:
      is_open   bool
      reason    str  — "Open" | "Weekend" | "Holiday" | "Pre-Market" | "After Hours"
      session   str  — "regular" | "pre" | "after" | "closed"
      et_time   str  — current ET time HH:MM
    """
    now  = datetime.now(_ET)
    today = now.date()
    t    = now.time()

    et_str = now.strftime("%H:%M")

    if now.weekday() >= 5:
        return {"is_open": False, "reason": "Weekend", "session": "closed", "et_time": et_str}

    if today in _HOLIDAYS:
        return {"is_open": False, "reason": "Market Holiday", "session": "closed", "et_time": et_str}

    if t < time(4, 0):
        return {"is_open": False, "reason": "Closed", "session": "closed", "et_time": et_str}
    if t < _OPEN:
        return {"is_open": False, "reason": "Pre-Market", "session": "pre", "et_time": et_str}
    if t < _CLOSE:
        return {"is_open": True,  "reason": "Open",       "session": "regular", "et_time": et_str}

    return {"is_open": False, "reason": "After Hours", "session": "after", "et_time": et_str}
