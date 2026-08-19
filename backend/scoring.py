import json
import os
from backend.schemas import SimulatorState, FiscalState

class FiscalScoringEngine:
    def __init__(self):
        # Since this runs inside ktk_elou_avt_core, we resolve the absolute path relative to this script
        base_dir = os.path.dirname(os.path.abspath(__file__))
        full_config_path = os.path.join(base_dir, "config", "economics.json")
        with open(full_config_path, "r", encoding="utf-8") as f:
            self.economics = json.load(f)
            
        self.cumulative_downtime_s = 0.0
        self.repair_costs = 0.0

    def calculate_fiscal_state(self, state: SimulatorState, dt: float) -> FiscalState:
        # Check if unit is down (e.g. pump cavitation risk > 0.9 or flooding > 0.9 or PAZ tripped)
        is_down = False
        
        # Проверка аварийных остановов ПАЗ
        has_paz_trip = any(item.is_tripped for item in state.interlocks)
        if has_paz_trip:
            is_down = True
            
        if state.pumps and state.pumps[0].cavitation_risk > 0.9:
            is_down = True
            self.repair_costs += 1000.0 * dt # Стоимость ремонта насоса
        # Check K-1 flooding risk (atm_column) and K-2 flooding risk (vac_column)
        if state.atm_column.flooding_risk > 0.9 or state.vac_column.flooding_risk > 0.9:
            is_down = True
            self.repair_costs += 2000.0 * dt
            
        # Экологические штрафы за превышение выбросов CO/NO2/SO2
        if state.furnace.emissions.is_violating:
            self.repair_costs += 5000.0 * dt  # Экологический штраф ПДК в рублях в секунду
            
        if is_down:
            self.cumulative_downtime_s += dt
            
        downtime_hr = self.cumulative_downtime_s / 3600.0
        downtime_cost = downtime_hr * self.economics["downtime_cost_per_hour"]
        
        # Lost MET (NDPI) subsidy: Assume nominal 150 m3/h ~ 120 tons/hr
        lost_production_tons = downtime_hr * 120.0
        lost_met_subsidy = lost_production_tons * self.economics["lost_met_subsidy_per_ton"]
        
        corporate_tax_shield = self.repair_costs * self.economics["repair_capex_tax_shield_ratio"]
        
        # TCO including repair costs and downtime minus tax shield
        tco = downtime_cost + self.repair_costs + lost_met_subsidy - corporate_tax_shield
        
        # Format string for SCADA
        cost_string = f"TCO: {tco/1000000:.2f}M RUB | DOW: {downtime_hr:.2f}h"
        
        return FiscalState(
            operator_cost_string=cost_string,
            downtime_cost=downtime_cost,
            lost_met_subsidy=lost_met_subsidy,
            corporate_tax_shield=corporate_tax_shield,
            total_cost_of_ownership=tco
        )
        
    def generate_session_debriefing_report(self) -> str:
        report = "=== SESSION DEBRIEFING REPORT ===\n"
        report += f"Total Downtime: {self.cumulative_downtime_s / 3600.0:.2f} hours\n"
        report += f"Repair Costs (OpEx/CapEx): {self.repair_costs:,.2f} RUB\n"
        report += f"Tax Shield Generated: {self.repair_costs * self.economics['repair_capex_tax_shield_ratio']:,.2f} RUB\n"
        report += "================================="
        return report
