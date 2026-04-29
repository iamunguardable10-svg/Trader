EVENT_WEIGHTS: dict[str, int] = {
    # Strong positive
    "earnings_guidance_raise": 35,
    "earnings_beat_strong":    28,
    "major_contract_win":      25,
    "regulatory_approval":     30,
    "takeover_offer":          35,
    "share_buyback_large":     18,
    "dividend_increase":       12,

    # Mild positive
    "analyst_upgrade":  10,
    "product_launch":   12,
    "partnership":      10,
    "insider_buying":   12,

    # Negative
    "earnings_guidance_cut":    -35,
    "earnings_miss_strong":     -28,
    "major_lawsuit":            -25,
    "regulatory_investigation": -30,
    "accounting_issue":         -40,
    "fraud_allegation":         -45,
    "ceo_resignation":          -15,
    "product_delay":            -18,
    "price_cut":                -16,
    "analyst_downgrade":        -10,
    "insider_selling":           -8,

    # Neutral / context-dependent
    "macro_news":   0,
    "sector_news":  0,
    "rumor":        0,
    "unknown":      0,
}
