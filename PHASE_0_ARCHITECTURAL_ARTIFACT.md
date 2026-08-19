# PHASE 0: ARCHITECTURAL ARTIFACT (SMART HYBRID EDITION)

## Goal Description
End-to-end development of a Computer Training Complex (КТК) for an ELOU-AVT-5/5 primary oil refining unit. The system features deterministic physics simulation, closed-loop AI diagnostics (Air-Gapped), 2026 Russian fiscal scoring, an industrial SCADA frontend, and **Championship-level features styled for maximum safety, performance, and stability: LIMS, PAZ (Safety Interlocks), ESG Emissions, Cascading Scenarios, Gamification, and Modbus TCP industrial connectivity**.

> [!IMPORTANT]
> **User Review Required**: Please review the updated design constraints and plan below. We have balanced "WOW-effects" with concrete code stability based on the system analyst audit.

## 1. Directory Tree
```text
ktk_elou_avt_core/
├── backend/
│   ├── __init__.py
│   ├── config/
│   │   ├── economics.json
│   │   └── equipment_specs.json  # Contains Table 18 Heat Exchanger areas
│   ├── schemas.py
│   ├── physics_formulas.py
│   ├── simulator.py
│   ├── ai_diagnostics.py
│   ├── ai_tutor.py
│   ├── adaptive_scenario.py
│   ├── scoring.py
│   ├── lims.py              # LIMS (Lab Analysis) module
│   ├── interlocks.py        # PAZ (Safety Interlocks) module
│   ├── modbus_server.py     # NEW: Modbus TCP industrial bridge
│   └── server.py
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── scada.css
│   └── js/
│       ├── app.js
│       ├── lims_panel.js    # Lab request panel
│       ├── paz_panel.js     # Safety interlocks panel
│       ├── compaks.js       # Vibration diagnostics audio/visual
│       ├── svg_renderer.js  # NEW: 2.5D Isometric SVG renderer (replaces Three.js)
│       └── corporate.js     # NEW: Director's screen (stock price, news)
└── task.md
```

## 2. Updated Pydantic Schemas Highlights (schemas.py)

We have updated `schemas.py` to support LIMS, PAZ, emissions, and PPE. No heavy SciPy solvers are used; all physics is computed at 10 Hz via manual RK4 (Runge-Kutta 4th order) integration on NumPy.

## 3. Multi-Agent Parallel Execution Plan

### Agent 1: Physics, LIMS, & PAZ Developer
- **Target Files**: `backend/physics_formulas.py`, `backend/simulator.py`, `backend/lims.py`, `backend/interlocks.py`
- **Responsibilities**: Implement K-1/K-2 physics using RK4 solver in numpy (guarantees no infinite loops or lockups). Implement Table 18 Heat Exchanger areas (LMTD). Implement PAZ safety blockings.

### Agent 2: Industrial Connectivity & Diagnostics Developer
- **Target Files**: `backend/modbus_server.py`, `backend/ai_diagnostics.py`, `backend/ai_tutor.py`
- **Responsibilities**: Implement asynchronous Modbus TCP server (runs in a separate asyncio thread, mapping simulator registers to Modbus coils/registers). Implement Causal Graph (`networkx`) for AI Tutor, formatting outputs to be displayed as a conversational "Copilot Chat" on the frontend.

### Agent 3: Fiscal, ESG & Scoring Engine Developer
- **Target Files**: `backend/scoring.py`
- **Responsibilities**: Integrate ESG penalties (emissions ПДК), safety violations, and compute Total Cost of Ownership.

### Agent 4: 2.5D Isometric SCADA & Gamification Frontend Developer
- **Target Files**: `frontend/index.html`, `frontend/js/svg_renderer.js`, `frontend/js/corporate.js`
- **Responsibilities**: Build premium dark-themed 2.5D SVG мнемосхему with pulsating flows and CSS smoke filters (lightweight, zero lag). Implement the "Director's Screen" showing real-time Gazprom Neft stock price and Breaking News. Implement "Compaks" voice alarms using Web Audio API.
