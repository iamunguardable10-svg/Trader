"""
Telegram Push Notifications

Sends a message when the algorithm generates a tradeable signal.

Setup:
  1. Create a bot via @BotFather on Telegram → get TELEGRAM_BOT_TOKEN
  2. Send a message to your bot → get your TELEGRAM_CHAT_ID via
     https://api.telegram.org/bot<TOKEN>/getUpdates
  3. Set env vars:
       TELEGRAM_BOT_TOKEN=123456:ABC-...
       TELEGRAM_CHAT_ID=987654321

If either env var is missing, notifications are silently skipped.
"""
import logging
import os
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

_TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN")
_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")


def _send(text: str) -> None:
    if not _TOKEN or not _CHAT_ID:
        return
    try:
        payload = urllib.parse.urlencode({"chat_id": _CHAT_ID, "text": text, "parse_mode": "HTML"})
        url     = f"https://api.telegram.org/bot{_TOKEN}/sendMessage"
        req     = urllib.request.Request(url, data=payload.encode(), method="POST")
        urllib.request.urlopen(req, timeout=5)
    except Exception as exc:
        logger.warning(f"[Telegram] Failed to send notification: {exc}")


def notify_signal(decision: dict) -> None:
    direction = decision.get("decision", "NO_TRADE")
    if direction not in ("LONG", "SHORT"):
        return

    ticker  = decision.get("ticker", "?")
    company = decision.get("company", ticker)
    score   = decision.get("final_score", 0)
    plan    = decision.get("trade_plan") or {}
    entry   = plan.get("entry_price")
    stop    = plan.get("stop_loss")
    target  = plan.get("take_profit")
    size    = plan.get("position_size")
    rr      = plan.get("risk_reward_ratio")
    news    = decision.get("news") or {}
    headline= news.get("headline", "")[:100]
    source  = decision.get("signal_source", "news")

    arrow = "" if direction == "LONG" else ""
    lines = [
        f"<b>{arrow} {direction} Signal — {ticker}</b>",
        f"{company}",
        f"Score: <b>{score:.1f}</b> | Source: {source}",
        f"Entry: ${entry:.2f} | Stop: ${stop:.2f} | Target: ${target:.2f}" if entry else "",
        f"Size: {size} shares | R/R: {rr}" if size else "",
        f"<i>{headline}</i>" if headline else "",
    ]
    _send("\n".join(l for l in lines if l))


def notify_trade_opened(position: dict) -> None:
    ticker    = position.get("ticker", "?")
    direction = position.get("direction", "?")
    entry     = position.get("entry_price", 0)
    size      = position.get("position_size", 0)
    stop      = position.get("stop_loss", 0)
    target    = position.get("take_profit", 0)
    _send(
        f"<b>Trade opened</b>\n"
        f"{direction} {ticker} x{size} @ ${entry:.2f}\n"
        f"Stop: ${stop:.2f} | Target: ${target:.2f}"
    )


def notify_trade_closed(position: dict) -> None:
    ticker = position.get("ticker", "?")
    pnl    = position.get("pnl", 0)
    reason = position.get("exit_reason", "unknown")
    emoji  = "" if pnl >= 0 else ""
    _send(f"<b>{emoji} Trade closed</b> — {ticker}\nPnL: ${pnl:+.2f} | Reason: {reason}")
