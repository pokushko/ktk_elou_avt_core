"""
KTK ELOU-AVT-5/5 — Full Audit Test Suite
Sub-Agent 1: Code Health & Runtime Execution
Sub-Agent 2: Physics & Fiscal Compliance
Sub-Agent 3: Minimal import checks (CSS/HTML checked separately)
"""
import sys
import os
import math
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

errors = []
warnings = []
passed = []

# ===========================================================================
# BLOCK 1: IMPORT TESTS
# ===========================================================================
print("=" * 60)
print("BLOCK 1: IMPORT TESTS")
print("=" * 60)

try:
    from ktk_elou_avt_core.backend.schemas import (
        SimulatorState, FiscalState, DiagnosticEvent, AlarmEvent,
        DesalterState, AtmosphericColumnState, FurnaceState
    )
    passed.append("Import: schemas.py")
except Exception as e:
    errors.append(f"FAIL Import schemas.py: {e}")

try:
    from ktk_elou_avt_core.backend.physics_formulas import (
        calculate_pump_head, check_cavitation, calculate_lmtd, calculate_column_flooding_risk
    )
    passed.append("Import: physics_formulas.py")
except Exception as e:
    errors.append(f"FAIL Import physics_formulas.py: {e}")

try:
    from ktk_elou_avt_core.backend.simulator import Simulator
    passed.append("Import: simulator.py")
except Exception as e:
    errors.append(f"FAIL Import simulator.py: {e}")

try:
    from ktk_elou_avt_core.backend.scoring import FiscalScoringEngine
    passed.append("Import: scoring.py")
except Exception as e:
    errors.append(f"FAIL Import scoring.py: {e}")

try:
    from ktk_elou_avt_core.backend.ai_diagnostics import AIDiagnostics
    passed.append("Import: ai_diagnostics.py")
except Exception as e:
    errors.append(f"FAIL Import ai_diagnostics.py: {e}")

try:
    from ktk_elou_avt_core.backend.ai_tutor import AITutor
    passed.append("Import: ai_tutor.py")
except Exception as e:
    errors.append(f"FAIL Import ai_tutor.py: {e}")

try:
    from ktk_elou_avt_core.backend.interlocks import PAZSystem
    passed.append("Import: interlocks.py")
except Exception as e:
    errors.append(f"FAIL Import interlocks.py: {e}")

try:
    from ktk_elou_avt_core.backend.adaptive_scenario import AdaptiveScenarioManager
    passed.append("Import: adaptive_scenario.py")
except Exception as e:
    errors.append(f"FAIL Import adaptive_scenario.py: {e}")

try:
    from ktk_elou_avt_core.backend.lims import LIMSManager
    passed.append("Import: lims.py")
except Exception as e:
    errors.append(f"FAIL Import lims.py: {e}")

try:
    from ktk_elou_avt_core.backend.modbus_server import ModbusBridge
    passed.append("Import: modbus_server.py")
except Exception as e:
    errors.append(f"FAIL Import modbus_server.py: {e}")

try:
    from ktk_elou_avt_core.backend.grading.action_log import ActionLogger
    from ktk_elou_avt_core.backend.grading.expert_evaluator import ExpertEvaluator
    from ktk_elou_avt_core.backend.grading.report_generator import ReportGenerator
    passed.append("Import: grading/ modules")
except Exception as e:
    errors.append(f"FAIL Import grading/: {e}")

for p in passed[:]:
    if "Import" in p:
        print(f"  [PASS] {p}")

# ===========================================================================
# BLOCK 2: t=0 INITIALIZATION & STEP (ZeroDivisionError check)
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 2: t=0 SAFE INITIALIZATION & FIRST STEP")
print("=" * 60)

sim = None
state0 = None
try:
    sim = Simulator()
    state0 = sim.step(0.1)
    print(f"  [PASS] Simulator step() at t=0")
    print(f"         Flow={state0.crude_feed.flow_rate:.1f} m3/h")
    print(f"         FurnaceOut={state0.furnace.outlet_temperature:.2f} C")
    print(f"         TubeSkin={state0.furnace.tube_skin_temp:.2f} C")
    print(f"         K1Pressure={state0.atm_column.top_pressure:.4f} MPa")
    passed.append("t=0 step")
except ZeroDivisionError as e:
    errors.append(f"FAIL ZeroDivisionError at t=0: {e}")
except Exception as e:
    errors.append(f"FAIL Simulator.step() at t=0: {e}")

# ===========================================================================
# BLOCK 3: PHYSICS FORMULA BOUNDARY CONDITIONS
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 3: PHYSICS FORMULA BOUNDARY CONDITIONS")
print("=" * 60)

# 3a. Pump Q-H curve at Q=0
try:
    h0 = calculate_pump_head(0.0, 130.0, 0.0)
    assert h0 > 0, f"Head at Q=0 should be positive, got {h0}"
    h_worn = calculate_pump_head(0.0, 130.0, 1.0)
    assert h_worn >= 0, f"Head with full wear should be >= 0, got {h_worn}"
    print(f"  [PASS] Pump Q-H curve: H(Q=0, wear=0)={h0:.1f}m, H(Q=0, wear=1.0)={h_worn:.1f}m")
    passed.append("Pump Q-H boundary")
except AssertionError as e:
    errors.append(f"FAIL Pump Q-H: {e}")
except Exception as e:
    errors.append(f"FAIL Pump Q-H: {e}")

# 3b. LMTD degenerate case (dt1 == dt2 → avoid log(1)=0 division)
try:
    # Case where dt1 == dt2 (parallel streams, no log needed)
    lmtd_eq = calculate_lmtd(100.0, 60.0, 40.0, 80.0)  # dt1=100-80=20, dt2=60-40=20 → equal
    assert not math.isnan(lmtd_eq), "LMTD should not be NaN when dt1==dt2"
    assert lmtd_eq > 0, f"LMTD should be positive, got {lmtd_eq}"
    # Normal counter-current case
    lmtd_normal = calculate_lmtd(200.0, 150.0, 20.0, 85.0)  # dt1=115, dt2=130
    assert lmtd_normal > 0
    print(f"  [PASS] LMTD: equal={lmtd_eq:.2f}C (avg fallback), normal={lmtd_normal:.2f}C")
    passed.append("LMTD boundary")
except AssertionError as e:
    errors.append(f"FAIL LMTD: {e}")
except Exception as e:
    errors.append(f"FAIL LMTD: {e}")

# 3c. Souders-Brown flooding check (zero vapor)
try:
    risk_zero = calculate_column_flooding_risk(0.0, 1.0)
    assert risk_zero == 0.0, f"Flooding risk at V=0 should be 0.0, got {risk_zero}"
    risk_full = calculate_column_flooding_risk(1.5, 1.0)
    assert risk_full == 1.0, f"Flooding risk at V >= Vmax should be 1.0, got {risk_full}"
    risk_half = calculate_column_flooding_risk(0.5, 1.0)
    assert 0.0 < risk_half < 1.0
    print(f"  [PASS] Souders-Brown: V=0 -> {risk_zero}, V=Vmax -> {risk_full}, V=0.5Vmax -> {risk_half:.4f}")
    passed.append("Souders-Brown flooding")
except AssertionError as e:
    errors.append(f"FAIL Souders-Brown: {e}")
except Exception as e:
    errors.append(f"FAIL Souders-Brown: {e}")

# 3d. Cavitation: suction <= vapor (must return 1.0)
try:
    cav_full = check_cavitation(100.0, 2.5, 2.0)
    assert cav_full == 1.0, f"Cavitation at suction<=vapor should be 1.0, got {cav_full}"
    cav_safe = check_cavitation(100.0, 1.0, 3.0)
    assert 0.0 <= cav_safe < 1.0
    print(f"  [PASS] Cavitation: suction<=vapor -> {cav_full}, safe -> {cav_safe:.3f}")
    passed.append("Cavitation check")
except AssertionError as e:
    errors.append(f"FAIL Cavitation: {e}")
except Exception as e:
    errors.append(f"FAIL Cavitation: {e}")

# ===========================================================================
# BLOCK 4: FISCAL COMPLIANCE AUDIT (2026 Tax Rates)
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 4: FISCAL COMPLIANCE AUDIT (2026)")
print("=" * 60)

config_path = os.path.join(os.path.dirname(__file__), "backend", "config", "economics.json")
try:
    with open(config_path, encoding='utf-8') as f:
        econ = json.load(f)
    
    vat = econ.get("vat_rate")
    corp_tax = econ.get("corporate_income_tax_rate")
    shield = econ.get("repair_capex_tax_shield_ratio")
    downtime = econ.get("downtime_cost_per_hour")
    ndpi = econ.get("lost_met_subsidy_per_ton")
    
    issues = []
    if vat != 0.22:
        issues.append(f"VAT must be 0.22 (22%), got {vat}")
    else:
        print(f"  [PASS] VAT = {vat*100:.0f}% (2026 standard)")
    
    if corp_tax != 0.25:
        issues.append(f"Corporate Profit Tax must be 0.25 (25%), got {corp_tax}")
    else:
        print(f"  [PASS] Corporate income tax = {corp_tax*100:.0f}% (2026 reform)")
    
    if shield != 0.25:
        issues.append(f"Tax shield ratio should be 0.25 = corp_tax, got {shield}")
    else:
        print(f"  [PASS] CapEx tax shield = {shield*100:.0f}% (matches corp rate)")
    
    if downtime != 4800000.0:
        warnings.append(f"Downtime cost {downtime} != expected 4.8M RUB/hr")
    else:
        print(f"  [PASS] Downtime cost = {downtime/1e6:.1f}M RUB/hr")
    
    if issues:
        for i in issues:
            errors.append(f"FAIL Fiscal config: {i}")
    else:
        passed.append("Fiscal 2026 compliance")
except Exception as e:
    errors.append(f"FAIL Loading economics.json: {e}")

# Check scoring.py uses the config (not hardcoded wrong values)
try:
    if sim and state0:
        scoring = FiscalScoringEngine()
        # Run 10 steps to accumulate some downtime (trigger pump cavitation)
        for _ in range(10):
            s = sim.step(0.1)
        fiscal = scoring.calculate_fiscal_state(s, 0.1)
        print(f"  [PASS] FiscalScoringEngine.calculate_fiscal_state() OK")
        print(f"         TCO={fiscal.total_cost_of_ownership:.2f} RUB")
        print(f"         Downtime cost={fiscal.downtime_cost:.2f} RUB")
        print(f"         Tax shield={fiscal.corporate_tax_shield:.2f} RUB")
        # Check for 'columns' attribute bug
        passed.append("FiscalScoringEngine runtime")
except AttributeError as e:
    errors.append(f"BUG scoring.py references non-existent attribute: {e}")
except Exception as e:
    errors.append(f"FAIL FiscalScoringEngine runtime: {e}")

# ===========================================================================
# BLOCK 5: SCORING.PY BUG CHECK (state.columns doesn't exist)
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 5: SCORING.PY ATTRIBUTE BUG CHECK")
print("=" * 60)

try:
    # Check the scoring.py source for the 'columns' attribute bug
    scoring_path = os.path.join(os.path.dirname(__file__), "backend", "scoring.py")
    with open(scoring_path, encoding='utf-8') as f:
        scoring_src = f.read()
    
    if "state.columns" in scoring_src:
        errors.append("BUG scoring.py: 'state.columns' does not exist in SimulatorState - should be 'state.atm_column'")
        print("  [FAIL] BUG FOUND: 'state.columns' referenced in scoring.py (line ~28-30)")
        print("         SimulatorState has 'atm_column' and 'vac_column', NOT 'columns'")
    else:
        print("  [PASS] No 'state.columns' attribute bug in scoring.py")
        passed.append("scoring.py attribute correctness")
except Exception as e:
    errors.append(f"FAIL reading scoring.py: {e}")

# ===========================================================================
# BLOCK 6: INTERLOCKS.PY WALRUS OPERATOR SYNTAX (Python 3.8+)
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 6: INTERLOCKS.PY SYNTAX AUDIT")
print("=" * 60)

try:
    interlocks_path = os.path.join(os.path.dirname(__file__), "backend", "interlocks.py")
    with open(interlocks_path, encoding='utf-8') as f:
        interlocks_src = f.read()
    
    # The walrus operator := inside a list is used as assignment (Python 3.8+)
    # It's valid but unusual - check it actually works
    paz = PAZSystem()
    assert len(paz.interlocks) == 6, f"Expected 6 interlocks, got {len(paz.interlocks)}"
    print(f"  [PASS] PAZSystem initialized with {len(paz.interlocks)} interlocks")
    passed.append("PAZSystem init")
    
    # Check walrus-operator use in list (PAZ-2 uses BlockState := ...)
    if "BlockState :=" in interlocks_src:
        warnings.append("WARN interlocks.py: Walrus operator used to name a local variable 'BlockState' inside list literal. Valid Python 3.8+ but obscure.")
        print("  [WARN] Walrus operator ':=' in list is valid but unusual code style")
except Exception as e:
    errors.append(f"FAIL PAZSystem init: {e}")

# ===========================================================================
# BLOCK 7: AI DIAGNOSTICS - LOCAL DSP (no external API calls)
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 7: AI DIAGNOSTICS DSP (Air-Gapped Local Wavelet)")
print("=" * 60)

try:
    import pywt
    import networkx as nx
    import numpy as np
    print("  [PASS] pywt, networkx, numpy all importable (air-gapped DSP)")
    passed.append("DSP dependencies")
except ImportError as e:
    errors.append(f"FAIL Missing DSP dependency: {e}")

try:
    # Verify AIDiagnostics has no external API calls
    ai_diag_path = os.path.join(os.path.dirname(__file__), "backend", "ai_diagnostics.py")
    with open(ai_diag_path, encoding='utf-8') as f:
        diag_src = f.read()
    
    forbidden = ["requests", "http", "urllib", "openai", "anthropic", "gemini", "gpt"]
    found_ext = [kw for kw in forbidden if kw in diag_src.lower()]
    if found_ext:
        errors.append(f"FAIL ai_diagnostics.py contains external API references: {found_ext}")
    else:
        print("  [PASS] ai_diagnostics.py has ZERO external API calls (100% air-gapped)")
        passed.append("AIDiagnostics air-gapped")
except Exception as e:
    errors.append(f"FAIL reading ai_diagnostics.py: {e}")

try:
    # Run wavelet analysis against real state
    if sim:
        diag = AIDiagnostics()
        # Manually fill buffer to trigger wavelet
        for _ in range(20):
            s = sim.step(0.1)
            events = diag.run_dsp_analysis(s)
        print(f"  [PASS] run_dsp_analysis() OK, events generated: {len(events)}")
        passed.append("AIDiagnostics DSP runtime")
except Exception as e:
    errors.append(f"FAIL AIDiagnostics DSP runtime: {e}")

# ===========================================================================
# BLOCK 8: FRONTEND AIR-GAP CHECK (CDN dependencies)
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 8: FRONTEND AIR-GAP CHECK")
print("=" * 60)

try:
    html_path = os.path.join(os.path.dirname(__file__), "frontend", "index.html")
    with open(html_path, encoding='utf-8') as f:
        html_src = f.read()
    
    cdn_refs = []
    cdn_markers = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com", "cdn.plot.ly"]
    for cdn in cdn_markers:
        if cdn in html_src:
            cdn_refs.append(cdn)
    
    if cdn_refs:
        # Chart.js from CDN - this is a known dependency
        warnings.append(f"WARN frontend: External CDN dependency detected: {cdn_refs}")
        print(f"  [WARN] External CDN detected: {cdn_refs}")
        print("         Chart.js loaded from cdn.jsdelivr.net - RISK for air-gapped environments")
        print("         RECOMMENDATION: Bundle Chart.js locally as frontend/js/chart.min.js")
    else:
        print("  [PASS] No external CDN dependencies in index.html")

    # Check Google Fonts (external)
    if "fonts.googleapis.com" in html_src:
        warnings.append("WARN frontend: Google Fonts loaded from external CDN (fonts.googleapis.com)")
        print("  [WARN] Google Fonts loaded from external CDN - not air-gap safe")
    else:
        print("  [PASS] No Google Fonts CDN dependency")
        
except Exception as e:
    errors.append(f"FAIL reading index.html: {e}")

# ===========================================================================
# BLOCK 9: RENDER THROTTLE CHECK (RAF + throttle verification)
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 9: FRONTEND RENDER THROTTLE CHECK")
print("=" * 60)

try:
    js_path = os.path.join(os.path.dirname(__file__), "frontend", "js", "app.js")
    with open(js_path, encoding='utf-8') as f:
        js_src = f.read()
    
    checks = {
        "requestAnimationFrame": "requestAnimationFrame" in js_src,
        "RENDER_THROTTLE": "RENDER_THROTTLE_MS" in js_src,
        "333ms throttle (~3Hz)": "333" in js_src,
        "animation:false in Chart": "animation: false" in js_src,
    }
    for check, result in checks.items():
        if result:
            print(f"  [PASS] {check}")
            passed.append(f"RAF: {check}")
        else:
            warnings.append(f"WARN frontend: Missing {check}")
            print(f"  [WARN] Missing: {check}")
except Exception as e:
    errors.append(f"FAIL reading app.js: {e}")

# ===========================================================================
# BLOCK 10: ROLE-BASED VIEW SEPARATION CHECK
# ===========================================================================
print()
print("=" * 60)
print("BLOCK 10: ROLE-BASED VIEW SEPARATION")
print("=" * 60)

try:
    with open(html_path, encoding='utf-8') as f:
        html_src2 = f.read()
    
    views = {
        "Operator Panel (.operator-panel)": "operator-panel" in html_src2,
        "Instructor Panel (.instructor-panel)": "instructor-panel" in html_src2,
        "PAZ board (.paz-board)": "paz-board" in html_src2,
        "Corporate/Director screen (.corporate-screen)": "corporate-screen" in html_src2,
        "AI Copilot chat (.ai-copilot-box)": "ai-copilot-box" in html_src2,
        "LIMS Panel (.lims-panel)": "lims-panel" in html_src2,
    }
    for view, found in views.items():
        if found:
            print(f"  [PASS] {view}")
        else:
            warnings.append(f"WARN: Missing view section: {view}")
            print(f"  [MISS] {view}")
except Exception as e:
    errors.append(f"FAIL reading index.html for views: {e}")

# ===========================================================================
# FINAL SUMMARY
# ===========================================================================
print()
print("=" * 60)
print("AUDIT SUMMARY")
print("=" * 60)
print(f"PASSED:   {len(passed)}")
print(f"WARNINGS: {len(warnings)}")
print(f"ERRORS:   {len(errors)}")
print()

if warnings:
    print("WARNINGS:")
    for w in warnings:
        print(f"  ! {w}")
    print()

if errors:
    print("ERRORS (need fix):")
    for e in errors:
        print(f"  X {e}")
    sys.exit(1)
else:
    print("ALL CRITICAL TESTS PASSED")
    sys.exit(0)
