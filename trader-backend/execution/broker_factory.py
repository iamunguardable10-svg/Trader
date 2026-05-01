"""
Returns the correct broker based on environment variables.
  ALPACA_API_KEY set → AlpacaBroker (paper or live depending on ALPACA_PAPER)
  Not set            → PaperBroker  (in-memory, no real orders)
"""
import logging
import os

logger = logging.getLogger(__name__)


def get_broker():
    if os.getenv("ALPACA_API_KEY"):
        try:
            from execution.alpaca_broker import AlpacaBroker
            return AlpacaBroker()
        except Exception as exc:
            logger.error(f"[BrokerFactory] Alpaca init failed: {exc} — falling back to PaperBroker")

    from execution.paper_broker import PaperBroker
    logger.info("[BrokerFactory] Using PaperBroker (in-memory)")
    return PaperBroker()
