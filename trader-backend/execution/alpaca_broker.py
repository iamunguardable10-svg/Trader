"""
AlpacaBroker — routes orders through the Alpaca Trading API.

Required env vars:
  ALPACA_API_KEY     — Alpaca API key ID
  ALPACA_SECRET_KEY  — Alpaca secret key
  ALPACA_PAPER       — "true" (default) = paper trading, "false" = live
"""
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class AlpacaBroker:
    def __init__(self):
        from alpaca.trading.client import TradingClient

        api_key    = os.environ["ALPACA_API_KEY"]
        secret     = os.environ["ALPACA_SECRET_KEY"]
        self._paper = os.getenv("ALPACA_PAPER", "true").lower() != "false"

        self._client = TradingClient(api_key, secret, paper=self._paper)
        self.open_positions: list[dict] = []
        self.closed_trades:  list[dict] = []

        mode = "PAPER" if self._paper else "LIVE"
        logger.info(f"[AlpacaBroker] Connected — {mode} mode")

        self._sync_on_startup()

    # ── open ──────────────────────────────────────────────────────────────────

    def open_position(self, decision: dict) -> dict | None:
        from alpaca.trading.requests import MarketOrderRequest, TakeProfitRequest, StopLossRequest
        from alpaca.trading.enums import OrderSide, TimeInForce, OrderClass

        if not decision.get("trade_allowed"):
            return None
        plan = decision.get("trade_plan")
        if not plan or plan.get("position_size", 0) <= 0:
            return None

        ticker      = decision["ticker"]
        direction   = decision["decision"]
        qty         = int(plan["position_size"])
        sl          = round(float(plan["stop_loss"]),   2)
        tp          = round(float(plan["take_profit"]), 2)
        entry       = float(plan["entry_price"])
        side        = OrderSide.BUY if direction == "LONG" else OrderSide.SELL
        internal_id = self._generate_id(decision)

        try:
            order = self._client.submit_order(
                MarketOrderRequest(
                    symbol          = ticker,
                    qty             = qty,
                    side            = side,
                    time_in_force   = TimeInForce.DAY,
                    order_class     = OrderClass.BRACKET,
                    take_profit     = TakeProfitRequest(limit_price=tp),
                    stop_loss       = StopLossRequest(stop_price=sl),
                    client_order_id = internal_id,
                )
            )
        except Exception as exc:
            logger.error(f"[AlpacaBroker] Order failed for {ticker}: {exc}")
            return None

        position = {
            "id":              internal_id,
            "alpaca_order_id": str(order.id),
            "ticker":          ticker,
            "direction":       direction,
            "entry_time":      datetime.utcnow().isoformat(),
            "entry_price":     entry,
            "position_size":   qty,
            "stop_loss":       sl,
            "take_profit":     tp,
            "status":          "OPEN",
            "decision_id":     decision.get("id"),
        }
        self.open_positions.append(position)
        logger.info(f"[AlpacaBroker] Opened {direction} {ticker} x{qty} @ ~{entry:.2f} (SL {sl} / TP {tp})")
        return position

    # ── close ─────────────────────────────────────────────────────────────────

    def close_by_id(self, trade_id: str, exit_price: float, reason: str) -> dict | None:
        pos = next((p for p in self.open_positions if p["id"] == trade_id), None)
        if not pos:
            return None
        try:
            self._client.close_position(pos["ticker"])
            logger.info(f"[AlpacaBroker] Closed {pos['ticker']} via Alpaca — reason: {reason}")
        except Exception as exc:
            logger.error(f"[AlpacaBroker] Close failed for {pos['ticker']}: {exc}")
        return self._finalize_close(pos, exit_price, reason)

    def close_all(self) -> list[dict]:
        try:
            self._client.close_all_positions(cancel_orders=True)
            logger.info("[AlpacaBroker] Kill switch — all positions closed via Alpaca")
        except Exception as exc:
            logger.error(f"[AlpacaBroker] close_all failed: {exc}")
        closed = []
        for pos in list(self.open_positions):
            closed.append(self._finalize_close(pos, pos["entry_price"], "kill_switch"))
        return closed

    # ── sync ──────────────────────────────────────────────────────────────────

    def sync_positions(self, market_data_provider=None) -> list[dict]:
        """
        Compare local open_positions against Alpaca.
        Positions no longer on Alpaca were auto-closed (SL/TP hit).
        Uses actual fill price from Alpaca order history when available.
        """
        try:
            alpaca_symbols = {p.symbol for p in self._client.get_all_positions()}
        except Exception as exc:
            logger.debug(f"[AlpacaBroker] sync_positions failed: {exc}")
            return []

        newly_closed = []
        for pos in list(self.open_positions):
            if pos["ticker"] not in alpaca_symbols:
                exit_price = self._get_fill_price(pos) or self._market_price(
                    pos["ticker"], pos["entry_price"], market_data_provider
                )
                reason = self._detect_close_reason(pos, exit_price)
                closed = self._finalize_close(pos, exit_price, reason)
                newly_closed.append(closed)
                logger.info(
                    f"[AlpacaBroker] Auto-close: {pos['ticker']} "
                    f"reason={reason} fill={exit_price:.2f} pnl={closed.get('pnl', 0):+.2f}"
                )
        return newly_closed

    def update_positions(self, market_data_provider) -> list[dict]:
        return self.sync_positions(market_data_provider)

    # ── account ───────────────────────────────────────────────────────────────

    def get_account(self) -> dict:
        try:
            acc = self._client.get_account()
            return {
                "equity":       float(acc.equity),
                "buying_power": float(acc.buying_power),
                "cash":         float(acc.cash),
                "paper":        self._paper,
                "status":       str(acc.status),
                "connected":    True,
            }
        except Exception as exc:
            return {"connected": False, "error": str(exc)}

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

    # ── internal ──────────────────────────────────────────────────────────────

    def _sync_on_startup(self) -> None:
        """Load any positions already open in Alpaca so we don't lose track after a restart."""
        try:
            alpaca_positions = self._client.get_all_positions()
            if not alpaca_positions:
                return
            for ap in alpaca_positions:
                ticker    = str(ap.symbol)
                direction = "LONG" if float(ap.qty) > 0 else "SHORT"
                entry     = float(ap.avg_entry_price)
                qty       = abs(int(float(ap.qty)))
                position  = {
                    "id":              f"startup-{ticker}-{direction}",
                    "alpaca_order_id": None,
                    "ticker":          ticker,
                    "direction":       direction,
                    "entry_time":      datetime.utcnow().isoformat(),
                    "entry_price":     entry,
                    "position_size":   qty,
                    "stop_loss":       0.0,
                    "take_profit":     0.0,
                    "status":          "OPEN",
                    "decision_id":     None,
                }
                self.open_positions.append(position)
                logger.info(f"[AlpacaBroker] Loaded existing position: {direction} {ticker} x{qty} @ {entry:.2f}")
        except Exception as exc:
            logger.warning(f"[AlpacaBroker] Startup sync failed (non-critical): {exc}")

    def _get_fill_price(self, pos: dict) -> float | None:
        """Try to get the actual fill price from Alpaca's closed orders for this position."""
        try:
            from alpaca.trading.requests import GetOrdersRequest
            from alpaca.trading.enums import QueryOrderStatus
            orders = self._client.get_orders(
                GetOrdersRequest(
                    status    = QueryOrderStatus.CLOSED,
                    symbols   = [pos["ticker"]],
                    limit     = 10,
                )
            )
            for order in orders:
                if order.filled_avg_price and order.filled_at:
                    return float(order.filled_avg_price)
        except Exception as exc:
            logger.debug(f"[AlpacaBroker] Could not get fill price for {pos['ticker']}: {exc}")
        return None

    def _detect_close_reason(self, pos: dict, exit_price: float) -> str:
        if pos.get("stop_loss") and pos.get("take_profit"):
            direction = pos["direction"]
            if direction == "LONG":
                if exit_price <= pos["stop_loss"] * 1.01:
                    return "STOP_LOSS"
                if exit_price >= pos["take_profit"] * 0.99:
                    return "TAKE_PROFIT"
        return "AUTO_CLOSE"

    def _market_price(self, ticker: str, fallback: float, mdp) -> float:
        if mdp:
            try:
                return mdp.get_market_data(ticker).price
            except Exception:
                pass
        return fallback

    def _finalize_close(self, pos: dict, exit_price: float, reason: str) -> dict:
        pos["exit_time"]   = datetime.utcnow().isoformat()
        pos["exit_price"]  = exit_price
        pos["exit_reason"] = reason
        pos["status"]      = "CLOSED"
        diff = exit_price - pos["entry_price"]
        mult = 1 if pos["direction"] == "LONG" else -1
        pos["pnl"]     = round(diff * pos["position_size"] * mult, 2)
        pos["pnl_pct"] = round(diff / pos["entry_price"] * 100 * mult, 4) if pos["entry_price"] else 0.0
        if pos in self.open_positions:
            self.open_positions.remove(pos)
        self.closed_trades.append(pos)
        return pos

    def _generate_id(self, decision: dict) -> str:
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:17]
        return f"{ts}-{decision.get('ticker','XX')}-{decision.get('decision','?')}"
