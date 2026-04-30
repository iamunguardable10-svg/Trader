import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from strategy.signal_engine import SignalEngine

engine = SignalEngine()


def test_strong_long():
    direction, strength = engine.determine_direction(75.0)
    assert direction == "LONG"
    assert strength  == "strong"

def test_medium_long():
    direction, strength = engine.determine_direction(45.0)
    assert direction == "LONG"
    assert strength  == "medium"

def test_no_trade_positive():
    direction, strength = engine.determine_direction(20.0)
    assert direction == "NO_TRADE"

def test_no_trade_zero():
    direction, strength = engine.determine_direction(0.0)
    assert direction == "NO_TRADE"

def test_no_trade_negative():
    direction, strength = engine.determine_direction(-20.0)
    assert direction == "NO_TRADE"

def test_medium_short():
    direction, strength = engine.determine_direction(-45.0)
    assert direction == "SHORT"
    assert strength  == "medium"

def test_strong_short():
    direction, strength = engine.determine_direction(-75.0)
    assert direction == "SHORT"
    assert strength  == "strong"

def test_boundary_exactly_at_long_threshold():
    from config.strategy_config import STRATEGY_CONFIG
    threshold = STRATEGY_CONFIG["long_threshold"]
    direction, _ = engine.determine_direction(float(threshold))
    assert direction == "LONG"

def test_boundary_just_below_long_threshold():
    from config.strategy_config import STRATEGY_CONFIG
    threshold = STRATEGY_CONFIG["long_threshold"]
    direction, _ = engine.determine_direction(float(threshold) - 0.01)
    assert direction == "NO_TRADE"
