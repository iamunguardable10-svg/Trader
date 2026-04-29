"""
FastAPI backend for the News-to-Signal Trading Algorithm.
Run locally:  uvicorn main:app --reload --port 8000
"""
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── make sure local packages are importable ─────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from algorithm import TradingAlgorithm
from models.news import NewsItem
from models.portfolio import PortfolioState
from config.risk_config import RISK_CONFIG

from analysis.entity_resolver import EntityResolver
from analysis.llm_news_analyzer import LLMNewsAnalyzer
from analysis.technical_analyzer import TechnicalAnalyzer
from analysis.market_context_analyzer import MarketContextAnalyzer
from data.market_data_provider import MarketDataProvider
from data.duplicate_filter import DuplicateFilter
from evaluation.trade_logger import TradeLogger
from evaluation.performance_tracker import PerformanceTracker
from execution.paper_broker import PaperBroker

# ── singleton state (in-memory; swap for DB later) ──────────────────────────

trade_logger    = TradeLogger()
paper_broker    = PaperBroker()
perf_tracker    = PerformanceTracker()
mdp             = MarketDataProvider()

algorithm = TradingAlgorithm(
    entity_resolver         = EntityResolver(),
    llm_news_analyzer       = LLMNewsAnalyzer(),
    market_data_provider    = mdp,
    technical_analyzer      = TechnicalAnalyzer(),
    market_context_analyzer = MarketContextAnalyzer(),
    duplicate_filter        = DuplicateFilter(),
    trade_logger            = trade_logger,
)

# Default portfolio state — update as trades are opened/closed
_portfolio = PortfolioState(
    account_equity          = RISK_CONFIG["account_equity"],
    daily_pnl_pct           = 0.0,
    weekly_pnl_pct          = 0.0,
    open_positions          = 0,
    trades_today            = 0,
    last_trade_was_loss     = False,
    minutes_since_last_loss = 9999,
    kill_switch_active      = False,
)

# ── app ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Trading backend started")
    yield
    print("🛑 Trading backend stopped")

app = FastAPI(
    title       = "Trading Signal API",
    description = "News-to-signal algorithm backend — paper trading only",
    version     = "1.0.0",
    lifespan    = lifespan,
)

# CORS — allow your Vercel frontend URL (set via env var) + localhost dev
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_URL", "https://your-project.vercel.app"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins     = _allowed_origins,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AnalyzeNewsRequest(BaseModel):
    source:            str
    headline:          str
    body:              str = ""
    published_at:      str                     # ISO 8601
    url:               Optional[str] = None
    candidate_tickers: List[str] = []

class OpenTradeRequest(BaseModel):
    decision_id: str

class CloseTradeRequest(BaseModel):
    trade_id:    str
    exit_reason: str = "manual"
    exit_price:  Optional[float] = None

# ── endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "trading-signal-backend"}


@app.get("/api/latest-decision")
def get_latest_decision():
    """Return the most recent algorithm decision."""
    decision = trade_logger.get_latest()
    if not decision:
        raise HTTPException(status_code=404, detail="No decisions yet")
    return decision


@app.get("/api/decisions")
def get_decisions(limit: int = 50):
    """Return all decisions, newest first."""
    return trade_logger.get_all()[:limit]


@app.get("/api/decisions/{decision_id}")
def get_decision(decision_id: str):
    """Return a specific decision by ID."""
    decision = trade_logger.get_by_id(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@app.post("/api/analyze-news")
def analyze_news(req: AnalyzeNewsRequest):
    """
    Run the full trading algorithm on incoming news.
    Returns a complete decision JSON — no order is executed automatically.
    """
    try:
        published = datetime.fromisoformat(req.published_at)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid published_at format (use ISO 8601)")

    news_item = NewsItem(
        source            = req.source,
        headline          = req.headline,
        body              = req.body,
        published_at      = published,
        received_at       = datetime.utcnow(),
        url               = req.url,
        candidate_tickers = req.candidate_tickers,
    )

    decision = algorithm.process_news(news_item, _portfolio)
    return decision


@app.get("/api/performance")
def get_performance():
    """Return paper-trading performance metrics."""
    closed = paper_broker.closed_trades
    return perf_tracker.calculate(closed)


@app.get("/api/paper-trade/history")
def get_trade_history():
    """Return all paper trades (open + closed)."""
    return paper_broker.all_trades_as_history()


@app.post("/api/paper-trade/open")
def open_paper_trade(req: OpenTradeRequest):
    """
    Manually open a paper trade from a previous decision.
    The decision must have trade_allowed=True.
    """
    decision = trade_logger.get_by_id(req.decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    if not decision.get("trade_allowed"):
        raise HTTPException(status_code=400, detail="Trade not allowed for this decision")

    position = paper_broker.open_position(decision)
    if not position:
        raise HTTPException(status_code=400, detail="Could not open position (check trade_plan)")

    _portfolio.open_positions = len(paper_broker.open_positions)
    _portfolio.trades_today  += 1
    return position


@app.post("/api/paper-trade/close")
def close_paper_trade(req: CloseTradeRequest):
    """Manually close an open paper trade."""
    # Get current price if not provided
    if req.exit_price is not None:
        exit_price = req.exit_price
    else:
        # Find the trade to get the ticker
        pos = next((p for p in paper_broker.open_positions if p["id"] == req.trade_id), None)
        if not pos:
            raise HTTPException(status_code=404, detail="Open trade not found")
        md = mdp.get_market_data(pos["ticker"])
        exit_price = md.price

    result = paper_broker.close_by_id(req.trade_id, exit_price, req.exit_reason)
    if not result:
        raise HTTPException(status_code=404, detail="Open trade not found")

    _portfolio.open_positions = len(paper_broker.open_positions)
    _portfolio.last_trade_was_loss = (result.get("pnl", 0) or 0) < 0
    return result


# ── dev helpers ───────────────────────────────────────────────────────────────

@app.post("/api/dev/reset")
def dev_reset():
    """Reset all in-memory state (dev use only)."""
    trade_logger._decisions.clear()
    paper_broker.open_positions.clear()
    paper_broker.closed_trades.clear()
    _portfolio.open_positions = 0
    _portfolio.trades_today   = 0
    return {"status": "reset"}
