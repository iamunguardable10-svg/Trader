from datetime import datetime


class PaperBroker:
    def __init__(self):
        self.open_positions: list[dict] = []
        self.closed_trades:  list[dict] = []

    # ── open ────────────────────────────────────────────────────────────────

    def open_position(self, decision: dict) -> dict | None:
        if not decision.get("trade_allowed"):
            return None
        plan = decision.get("trade_plan")
        if not plan or plan.get("position_size", 0) <= 0:
            return None

        position = {
            "id":            self._generate_id(decision),
            "ticker":        decision["ticker"],
            "direction":     decision["decision"],
            "entry_time":    datetime.utcnow().isoformat(),
            "entry_price":   plan["entry_price"],
            "position_size": plan["position_size"],
            "stop_loss":     plan["stop_loss"],
            "take_profit":   plan["take_profit"],
            "status":        "OPEN",
            "decision_id":   decision.get("id"),
        }
        self.open_positions.append(position)
        return position

    # ── update ──────────────────────────────────────────────────────────────

    def update_positions(self, market_data_provider) -> list[dict]:
        closed = []
        for pos in list(self.open_positions):
            md = market_data_provider.get_market_data(pos["ticker"])
            should_close, reason = self._should_close(pos, md.price)
            if should_close:
                closed.append(self.close_position(pos, md.price, reason))
        return closed

    # ── close ───────────────────────────────────────────────────────────────

    def close_position(self, position: dict, exit_price: float, reason: str) -> dict:
        position["exit_time"]   = datetime.utcnow().isoformat()
        position["exit_price"]  = exit_price
        position["exit_reason"] = reason
        position["status"]      = "CLOSED"
        position["pnl"]         = self._calc_pnl(position, exit_price)
        position["pnl_pct"]     = round(
            (exit_price - position["entry_price"]) / position["entry_price"] * 100
            * (1 if position["direction"] == "LONG" else -1), 4
        )

        if position in self.open_positions:
            self.open_positions.remove(position)
        self.closed_trades.append(position)
        return position

    def close_by_id(self, trade_id: str, exit_price: float, reason: str) -> dict | None:
        for pos in self.open_positions:
            if pos["id"] == trade_id:
                return self.close_position(pos, exit_price, reason)
        return None

    # ── helpers ─────────────────────────────────────────────────────────────

    def _should_close(self, pos: dict, price: float) -> tuple[bool, str]:
        if pos["direction"] == "LONG":
            if price <= pos["stop_loss"]:  return True, "STOP_LOSS"
            if price >= pos["take_profit"]: return True, "TAKE_PROFIT"
        elif pos["direction"] == "SHORT":
            if price >= pos["stop_loss"]:  return True, "STOP_LOSS"
            if price <= pos["take_profit"]: return True, "TAKE_PROFIT"
        return False, ""

    def _calc_pnl(self, pos: dict, exit_price: float) -> float:
        diff = exit_price - pos["entry_price"]
        pnl  = diff * pos["position_size"]
        if pos["direction"] == "SHORT":
            pnl = -pnl
        return round(pnl, 2)

    def _generate_id(self, decision: dict) -> str:
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:17]
        return f"{ts}-{decision.get('ticker','XX')}-{decision.get('decision','?')}"

    # ── read helpers ─────────────────────────────────────────────────────────

    def all_trades_as_history(self) -> list[dict]:
        result = []
        for t in self.closed_trades:
            result.append({
                "id": t["id"], "timestamp": t["entry_time"],
                "ticker": t["ticker"], "decision": t["direction"],
                "score": None, "entry_price": t["entry_price"],
                "exit_price": t.get("exit_price"), "pnl": t.get("pnl"),
                "pnl_pct": t.get("pnl_pct"), "status": "closed",
                "exit_reason": t.get("exit_reason"), "hold_minutes": None,
            })
        for t in self.open_positions:
            result.append({
                "id": t["id"], "timestamp": t["entry_time"],
                "ticker": t["ticker"], "decision": t["direction"],
                "score": None, "entry_price": t["entry_price"],
                "exit_price": None, "pnl": None,
                "pnl_pct": None, "status": "open",
                "exit_reason": None, "hold_minutes": None,
            })
        return result
