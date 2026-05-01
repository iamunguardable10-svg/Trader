"""
TechnicalScanner — detects price patterns independently of news.

Runs on every watchlist ticker every 5 minutes and emits signals
when a pattern condition is met. Uses already-fetched MarketData
and TechnicalData so no extra API calls are made.

Patterns:
  breakout      — price closes above 20-bar high with volume surge
  gap_and_go    — intraday gap >1 % in one direction + volume confirmation
  mean_reversion— RSI extreme + price far from VWAP → fade the move
  ema_crossover — EMA-9 crosses EMA-21 within the last 3 bars
"""
from dataclasses import dataclass


@dataclass
class TechnicalPattern:
    pattern_type: str        # breakout | gap_and_go | mean_reversion | ema_crossover
    direction:    str        # LONG | SHORT
    confidence:   float      # 0–1
    importance:   float      # 0–1  (how significant is the setup)
    description:  str        # human-readable reasoning


class TechnicalScanner:
    """Stateless pattern checker — call scan() on every poll cycle."""

    def scan(self, ticker: str, market_data, technical_data) -> list[TechnicalPattern]:
        found: list[TechnicalPattern] = []

        found += self._check_gap_and_go(market_data)
        found += self._check_mean_reversion(market_data, technical_data)
        found += self._check_ema_crossover(market_data, technical_data)
        found += self._check_breakout(market_data, technical_data)

        return found

    # ── Gap & Go ─────────────────────────────────────────────────────────────
    def _check_gap_and_go(self, md) -> list[TechnicalPattern]:
        gap = md.gap_pct
        rvol = md.relative_volume
        mom = md.price_change_15m_pct

        # Needs a meaningful gap AND above-average volume AND price continuing in gap direction
        if abs(gap) < 1.0 or rvol < 1.3:
            return []

        if gap > 1.0 and mom > 0.1:
            conf = min(0.90, 0.60 + (gap - 1.0) * 0.06 + (rvol - 1.3) * 0.05)
            return [TechnicalPattern(
                pattern_type="gap_and_go",
                direction="LONG",
                confidence=round(conf, 2),
                importance=round(min(0.85, 0.55 + gap * 0.04), 2),
                description=f"Gap-up {gap:+.1f}% with {rvol:.1f}x volume, price continuing higher (+{mom:.2f}% 15m)",
            )]

        if gap < -1.0 and mom < -0.1:
            conf = min(0.90, 0.60 + (abs(gap) - 1.0) * 0.06 + (rvol - 1.3) * 0.05)
            return [TechnicalPattern(
                pattern_type="gap_and_go",
                direction="SHORT",
                confidence=round(conf, 2),
                importance=round(min(0.85, 0.55 + abs(gap) * 0.04), 2),
                description=f"Gap-down {gap:+.1f}% with {rvol:.1f}x volume, price continuing lower ({mom:.2f}% 15m)",
            )]

        return []

    # ── Mean Reversion ────────────────────────────────────────────────────────
    def _check_mean_reversion(self, md, td) -> list[TechnicalPattern]:
        rsi  = td.rsi
        vdist = md.vwap_distance_pct   # positive = above VWAP
        rvol  = md.relative_volume

        # Oversold bounce: RSI < 28, price ≥ 1.5 % below VWAP, some volume
        if rsi < 28 and vdist < -1.5 and rvol > 0.8:
            conf = min(0.82, 0.55 + (28 - rsi) * 0.012 + abs(vdist) * 0.02)
            return [TechnicalPattern(
                pattern_type="mean_reversion",
                direction="LONG",
                confidence=round(conf, 2),
                importance=0.65,
                description=f"Oversold bounce: RSI {rsi:.0f}, price {vdist:.1f}% below VWAP",
            )]

        # Overbought fade: RSI > 72, price ≥ 1.5 % above VWAP, some volume
        if rsi > 72 and vdist > 1.5 and rvol > 0.8:
            conf = min(0.82, 0.55 + (rsi - 72) * 0.012 + vdist * 0.02)
            return [TechnicalPattern(
                pattern_type="mean_reversion",
                direction="SHORT",
                confidence=round(conf, 2),
                importance=0.65,
                description=f"Overbought fade: RSI {rsi:.0f}, price {vdist:.1f}% above VWAP",
            )]

        return []

    # ── EMA Crossover ─────────────────────────────────────────────────────────
    def _check_ema_crossover(self, md, td) -> list[TechnicalPattern]:
        e9  = td.ema_9
        e21 = td.ema_21
        if not e9 or not e21:
            return []

        spread_pct = (e9 - e21) / e21 * 100 if e21 else 0
        rvol = md.relative_volume

        # Fresh crossover: EMA9 just crossed EMA21 (spread is small but non-zero)
        # Use spread < 0.3 % to detect a recent cross; direction from which side
        if abs(spread_pct) > 0.05 and abs(spread_pct) < 0.5 and rvol > 0.9:
            if spread_pct > 0:
                return [TechnicalPattern(
                    pattern_type="ema_crossover",
                    direction="LONG",
                    confidence=0.65,
                    importance=0.60,
                    description=f"EMA9 crossed above EMA21 (spread +{spread_pct:.2f}%), {rvol:.1f}x vol",
                )]
            else:
                return [TechnicalPattern(
                    pattern_type="ema_crossover",
                    direction="SHORT",
                    confidence=0.65,
                    importance=0.60,
                    description=f"EMA9 crossed below EMA21 (spread {spread_pct:.2f}%), {rvol:.1f}x vol",
                )]

        return []

    # ── Breakout ──────────────────────────────────────────────────────────────
    def _check_breakout(self, md, td) -> list[TechnicalPattern]:
        rvol  = md.relative_volume
        mom5  = md.price_change_5m_pct
        mom15 = md.price_change_15m_pct
        rsi   = td.rsi

        # Upside breakout: strong momentum in both timeframes + volume surge + RSI not yet overbought
        if mom5 > 0.4 and mom15 > 0.8 and rvol > 1.8 and rsi < 75:
            conf = min(0.88, 0.60 + mom15 * 0.04 + (rvol - 1.8) * 0.04)
            imp  = min(0.90, 0.60 + mom15 * 0.05)
            return [TechnicalPattern(
                pattern_type="breakout",
                direction="LONG",
                confidence=round(conf, 2),
                importance=round(imp, 2),
                description=f"Upside breakout: +{mom5:.2f}% 5m, +{mom15:.2f}% 15m, {rvol:.1f}x vol, RSI {rsi:.0f}",
            )]

        # Downside breakout: strong negative momentum + volume + RSI not yet oversold
        if mom5 < -0.4 and mom15 < -0.8 and rvol > 1.8 and rsi > 25:
            conf = min(0.88, 0.60 + abs(mom15) * 0.04 + (rvol - 1.8) * 0.04)
            imp  = min(0.90, 0.60 + abs(mom15) * 0.05)
            return [TechnicalPattern(
                pattern_type="breakout",
                direction="SHORT",
                confidence=round(conf, 2),
                importance=round(imp, 2),
                description=f"Downside breakout: {mom5:.2f}% 5m, {mom15:.2f}% 15m, {rvol:.1f}x vol, RSI {rsi:.0f}",
            )]

        return []
