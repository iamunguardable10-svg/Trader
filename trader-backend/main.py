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
from evaluation.portfolio_state_manager import refresh as refresh_portfolio
from evaluation.live_readiness import evaluate as evaluate_live_readiness
from execution.broker_factory import get_broker
from data.news_scheduler import NewsScheduler
from data.market_data_provider import get_chart_data

# ── singleton state ──────────────────────────────────────────────────────────

trade_logger = TradeLogger()
paper_broker = get_broker()        # AlpacaBroker if ALPACA_API_KEY set, else PaperBroker
perf_tracker = PerformanceTracker()
mdp          = MarketDataProvider()

algorithm = TradingAlgorithm(
    entity_resolver         = EntityResolver(),
    llm_news_analyzer       = LLMNewsAnalyzer(),
    market_data_provider    = mdp,
    technical_analyzer      = TechnicalAnalyzer(),
    market_context_analyzer = MarketContextAnalyzer(),
    duplicate_filter        = DuplicateFilter(),
    trade_logger            = trade_logger,
)

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

_scheduler: NewsScheduler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    _scheduler = NewsScheduler(algorithm, _portfolio, broker=paper_broker)
    _scheduler.start()
    print("🚀 Trading backend started")
    yield
    _scheduler.stop()
    print("🛑 Trading backend stopped")


app = FastAPI(
    title       = "Trading Signal API",
    description = "News-to-signal algorithm backend — paper trading only",
    version     = "1.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = False,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AnalyzeNewsRequest(BaseModel):
    source:            str
    headline:          str
    body:              str = ""
    published_at:      str
    url:               Optional[str] = None
    candidate_tickers: List[str] = []

class OpenTradeRequest(BaseModel):
    decision_id:          str
    custom_stop_loss:     Optional[float] = None
    custom_position_size: Optional[int]   = None

class CloseTradeRequest(BaseModel):
    trade_id:    str
    exit_reason: str = "manual"
    exit_price:  Optional[float] = None

class AutoExecuteRequest(BaseModel):
    enabled:   bool
    min_score: Optional[int] = None

# ── health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "trading-signal-backend"}


# ── market status ─────────────────────────────────────────────────────────────

@app.get("/api/market/status")
def market_status():
    from data.market_hours import get_market_status
    return get_market_status()


# ── signals / decisions ───────────────────────────────────────────────────────

@app.get("/api/latest-decision")
def get_latest_decision():
    decision = trade_logger.get_latest()
    if not decision:
        raise HTTPException(status_code=404, detail="No decisions yet")
    return decision


@app.get("/api/decisions")
def get_decisions(limit: int = 50):
    return trade_logger.get_all()[:limit]


@app.get("/api/decisions/{decision_id}")
def get_decision(decision_id: str):
    decision = trade_logger.get_by_id(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@app.get("/api/signals/{ticker}")
def get_signals_for_ticker(ticker: str, limit: int = 100):
    t = ticker.upper()
    return [d for d in trade_logger.get_all() if (d.get("ticker") or "").upper() == t][:limit]


@app.get("/api/tickers")
def get_known_tickers():
    from analysis.entity_resolver import KNOWN_TICKERS, _TICKER_MAP
    return [{"ticker": t, **_TICKER_MAP[t]} for t in KNOWN_TICKERS]


@app.post("/api/analyze-news")
def analyze_news(req: AnalyzeNewsRequest):
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
    return algorithm.process_news(news_item, _portfolio)


# ── performance ───────────────────────────────────────────────────────────────

@app.get("/api/performance")
def get_performance():
    return perf_tracker.calculate(paper_broker.closed_trades)


@app.get("/api/paper-trade/history")
def get_trade_history():
    return paper_broker.all_trades_as_history()


# ── open positions ────────────────────────────────────────────────────────────

@app.get("/api/paper-trade/open")
def get_open_positions():
    return paper_broker.open_positions


@app.get("/api/paper-trade/position/{ticker}")
def get_position_for_ticker(ticker: str):
    t   = ticker.upper()
    pos = next((p for p in paper_broker.open_positions if p["ticker"] == t), None)
    if not pos:
        return None
    md        = mdp.get_market_data(t)
    current   = md.price
    entry     = pos["entry_price"]
    size      = pos["position_size"]
    direction = pos["direction"]
    pnl     = round((current - entry) * size * (1 if direction == "LONG" else -1), 2)
    pnl_pct = round((current - entry) / entry * 100 * (1 if direction == "LONG" else -1), 3)
    return {**pos, "current_price": current, "live_pnl": pnl, "live_pnl_pct": pnl_pct}


@app.post("/api/paper-trade/open")
def open_paper_trade(req: OpenTradeRequest):
    decision = trade_logger.get_by_id(req.decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    if not decision.get("trade_allowed"):
        raise HTTPException(status_code=400, detail="Trade not allowed for this decision")

    if (req.custom_stop_loss is not None or req.custom_position_size is not None) and decision.get("trade_plan"):
        decision = dict(decision)
        decision["trade_plan"] = dict(decision["trade_plan"])
        if req.custom_stop_loss is not None:
            decision["trade_plan"]["stop_loss"] = req.custom_stop_loss
        if req.custom_position_size is not None and req.custom_position_size > 0:
            decision["trade_plan"]["position_size"] = req.custom_position_size

    position = paper_broker.open_position(decision)
    if not position:
        raise HTTPException(status_code=400, detail="Could not open position (check trade_plan)")

    refresh_portfolio(paper_broker, _portfolio)
    return position


@app.post("/api/paper-trade/close")
def close_paper_trade(req: CloseTradeRequest):
    if req.exit_price is not None:
        exit_price = req.exit_price
    else:
        pos = next((p for p in paper_broker.open_positions if p["id"] == req.trade_id), None)
        if not pos:
            raise HTTPException(status_code=404, detail="Open trade not found")
        md = mdp.get_market_data(pos["ticker"])
        exit_price = md.price

    result = paper_broker.close_by_id(req.trade_id, exit_price, req.exit_reason)
    if not result:
        raise HTTPException(status_code=404, detail="Open trade not found")

    refresh_portfolio(paper_broker, _portfolio)
    return result


# ── auto-execute ──────────────────────────────────────────────────────────────

@app.get("/api/auto-execute")
def get_auto_execute():
    enabled   = _scheduler.auto_execute_enabled   if _scheduler else False
    min_score = _scheduler.auto_execute_min_score if _scheduler else RISK_CONFIG["auto_execute_min_score"]
    return {
        "enabled":   enabled,
        "min_score": min_score,
        "broker":    type(paper_broker).__name__,
    }


@app.post("/api/auto-execute")
def set_auto_execute(req: AutoExecuteRequest):
    if not _scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not running")
    _scheduler.auto_execute_enabled = req.enabled
    if req.min_score is not None:
        _scheduler.auto_execute_min_score = req.min_score
    return {
        "enabled":   _scheduler.auto_execute_enabled,
        "min_score": _scheduler.auto_execute_min_score,
    }


# ── kill switch ───────────────────────────────────────────────────────────────

@app.post("/api/kill-switch")
def kill_switch():
    """Close all open positions immediately and disable auto-execute."""
    if _scheduler:
        _scheduler.auto_execute_enabled = False

    if hasattr(paper_broker, "close_all"):
        closed = paper_broker.close_all()
    else:
        closed = []
        for pos in list(paper_broker.open_positions):
            try:
                md = mdp.get_market_data(pos["ticker"])
                result = paper_broker.close_by_id(pos["id"], md.price, "kill_switch")
                if result:
                    closed.append(result)
            except Exception:
                pass

    _portfolio.kill_switch_active = True
    refresh_portfolio(paper_broker, _portfolio)
    return {"closed": len(closed), "auto_execute_disabled": True}


# ── account info ──────────────────────────────────────────────────────────────

@app.get("/api/account")
def get_account():
    if hasattr(paper_broker, "get_account"):
        return paper_broker.get_account()
    closed_pnl = sum(t.get("pnl") or 0 for t in paper_broker.closed_trades)
    return {
        "equity":       round(RISK_CONFIG["account_equity"] + closed_pnl, 2),
        "buying_power": round(RISK_CONFIG["account_equity"] + closed_pnl, 2),
        "cash":         round(RISK_CONFIG["account_equity"] + closed_pnl, 2),
        "paper":        True,
        "status":       "ACTIVE",
        "connected":    False,
    }


# ── watchlist ─────────────────────────────────────────────────────────────────

from data.news_fetcher import WATCH_TICKERS as _DEFAULT_TICKERS

_watchlist: list[str] = list(_DEFAULT_TICKERS)


@app.get("/api/watchlist")
def get_watchlist():
    result = []
    for ticker in _watchlist:
        try:
            md = mdp.get_market_data(ticker)
            result.append({
                "ticker":         md.ticker,
                "price":          md.price,
                "day_change_pct": md.day_change_pct,
                "volume":         md.avg_daily_volume,
            })
        except Exception:
            result.append({"ticker": ticker, "price": None, "day_change_pct": None, "volume": None})
    return result


@app.post("/api/watchlist/{ticker}")
def add_to_watchlist(ticker: str):
    t = ticker.upper()
    if t not in _watchlist:
        _watchlist.append(t)
    return {"watchlist": _watchlist}


@app.delete("/api/watchlist/{ticker}")
def remove_from_watchlist(ticker: str):
    t = ticker.upper()
    if t in _watchlist:
        _watchlist.remove(t)
    return {"watchlist": _watchlist}


# ── chart data ────────────────────────────────────────────────────────────────

@app.get("/api/chart/{ticker}")
def get_chart(ticker: str, period: str = "1d", interval: str = "5m"):
    return get_chart_data(ticker, period, interval)


# ── dev helpers ───────────────────────────────────────────────────────────────

class DevScoreRequest(BaseModel):
    headline: str
    ticker:   str
    body:     str = ""
    source:   str = "manual"


@app.post("/api/dev/score")
def dev_score(req: DevScoreRequest):
    news_item = NewsItem(
        source            = req.source,
        headline          = req.headline,
        body              = req.body,
        published_at      = datetime.utcnow(),
        received_at       = datetime.utcnow(),
        url               = None,
        candidate_tickers = [req.ticker.upper()],
    )
    return algorithm.score_news_debug(news_item, _portfolio)


@app.get("/api/live-readiness")
def live_readiness():
    return evaluate_live_readiness(paper_broker.closed_trades)


@app.get("/api/backtest")
def backtest(limit: int = 200):
    import yfinance as yf

    decisions  = trade_logger.get_all()
    actionable = [
        d for d in decisions
        if d.get("decision") in ("LONG", "SHORT") and d.get("ticker")
    ][:limit]

    if not actionable:
        return {"signals": 0, "results": [], "summary": {}}

    results = []
    for d in actionable:
        ticker    = d["ticker"]
        direction = d["decision"]
        logged_at = d.get("logged_at")
        entry_px  = (d.get("trade_plan") or {}).get("entry_price") or (d.get("market_data") or {}).get("price")

        if not logged_at or not entry_px:
            continue

        try:
            signal_time = datetime.fromisoformat(logged_at)
        except Exception:
            continue

        try:
            bars = yf.Ticker(ticker).history(period="5d", interval="5m")
            if bars.empty:
                continue

            bars.index   = bars.index.tz_localize(None) if bars.index.tzinfo is None else bars.index.tz_convert(None)
            signal_naive = signal_time.replace(tzinfo=None)

            diffs    = [(abs((ts - signal_naive).total_seconds()), i) for i, ts in enumerate(bars.index)]
            diffs.sort()
            base_idx = diffs[0][1]
            closes   = bars["Close"].tolist()

            def ret_at(offset_bars: int) -> float | None:
                idx = base_idx + offset_bars
                if idx >= len(closes):
                    return None
                return round((closes[idx] - entry_px) / entry_px * 100, 3)

            r15 = ret_at(3)
            r30 = ret_at(6)
            r45 = ret_at(9)

            correct_15 = None if r15 is None else (r15 > 0 if direction == "LONG" else r15 < 0)
            correct_45 = None if r45 is None else (r45 > 0 if direction == "LONG" else r45 < 0)

            results.append({
                "ticker": ticker, "direction": direction, "logged_at": logged_at,
                "entry_price": entry_px, "ret_15m": r15, "ret_30m": r30, "ret_45m": r45,
                "correct_15m": correct_15, "correct_45m": correct_45,
                "score": d.get("final_score"), "strength": d.get("strength"),
            })
        except Exception:
            continue

    evaluated = [r for r in results if r["correct_45m"] is not None]
    wins      = sum(1 for r in evaluated if r["correct_45m"])
    total     = len(evaluated)
    avg_ret   = round(sum(r["ret_45m"] for r in evaluated) / total, 3) if total else 0.0

    return {
        "signals":   len(actionable),
        "evaluated": total,
        "summary": {
            "win_rate_45m":   round(wins / total * 100, 1) if total else None,
            "avg_return_45m": avg_ret,
            "wins":           wins,
            "losses":         total - wins,
        },
        "results": results,
    }


@app.post("/api/dev/reset")
def dev_reset():
    trade_logger._decisions.clear()
    paper_broker.open_positions.clear()
    paper_broker.closed_trades.clear()
    _portfolio.open_positions = 0
    _portfolio.trades_today   = 0
    return {"status": "reset"}
