"""
Модуль адаптивных аварийных сценариев для ЭЛОУ-АВТ-5/5.
Содержит логику 4 каскадных техногенных инцидентов согласно технологическому регламенту.
"""
from backend.schemas import SimulatorState, ScenarioStatus

class AdaptiveScenarioManager:
    def __init__(self):
        self.active_scenario = "IDLE"  # "IDLE", "CRUDE_LOSS", "WATER_REFLUX", "GAS_LEAK", "VACUUM_COLLAPSE"
        self.scenario_timer = 0.0
        self.is_failed = False
        self.is_resolved = False

    SCENARIO_ALIASES = {
        'overheat': 'COIL_RUPTURE',
        'vacuum_drop': 'VACUUM_COLLAPSE',
        'salt_breakthrough': 'ELOU_SHORT',
        'vibration_compaks': 'CRUDE_LOSS',
        'k1_overpressure': 'WATER_REFLUX',
        'gas_leak': 'GAS_LEAK',
        'power_blackout': 'CRUDE_LOSS',
        'esd_trip': 'COIL_RUPTURE'
    }

    def trigger_scenario(self, scenario_name: str):
        """Активация выбранного инцидента."""
        mapped = self.SCENARIO_ALIASES.get(scenario_name, scenario_name)
        self.active_scenario = mapped
        self.scenario_timer = 0.0
        self.is_failed = False
        self.is_resolved = False
        try:
            print(f"[ALARM] Сценарий {scenario_name} -> {mapped} активирован.")
        except Exception:
            pass

    def update(self, state: SimulatorState, dt: float):
        """
        Внесение неисправностей в стейт симулятора в зависимости от сценария.
        """
        if self.active_scenario == "IDLE":
            return

        self.scenario_timer += dt

        if self.active_scenario == "CRUDE_LOSS":
            # --- Сценарий 1: Упуск сырья ---
            # Отказ насоса сырья Н-1
            h1 = next((p for p in state.pumps if p.id == "H-1"), None)
            if h1:
                h1.is_running = False
                h1.flow_rate = 0.0
            
            # Сырье не поступает -> падает расход
            state.crude_feed.flow_rate = 0.0
            
            # Уровень в дегидраторе падает
            elou_level = getattr(state.desalter, "phase_level_mm", 4000.0)
            setattr(state.desalter, "phase_level_mm", max(0.0, elou_level - 150.0 * dt))
            
            # Уровень в кубе К-1 падает
            state.atm_column.mazut_flow = max(0.0, state.atm_column.mazut_flow - 4.0 * dt)
            
            # Если оператор НЕ перекрыл топливный газ на печь П-1 -> трубы греются без сырья
            if state.furnace.fuel_gas_flow > 10.0:
                state.furnace.tube_skin_temp += 15.0 * dt
                state.furnace.coking_factor = min(1.0, state.furnace.coking_factor + 0.02 * dt)
                
                # Если температура змеевиков > 500°С -> прогар и авария
                if state.furnace.tube_skin_temp > 500.0:
                    self.is_failed = True
            else:
                # Если оператор среагировал (закрыл газ) -> сценарий успешно решен
                if state.furnace.outlet_temperature < 150.0:
                    self.is_resolved = True

        elif self.active_scenario == "WATER_REFLUX":
            # --- Сценарий 2: Вода в орошении (выброс на факел) ---
            # Заливает водой рефлюксную емкость Е-1
            setattr(state.atm_column, "e1_water_level_pct", 95.0)
            
            # Вода попадает на верхние горячие тарелки К-1 -> резкое испарение -> скачок давления
            if self.scenario_timer < 10.0:
                state.atm_column.top_pressure += 0.05 * dt
            
            # При К-1 давление > 0.45 МПа срабатывает ПАЗ-2 (отсекает топливо печи)
            # Оператор должен снизить расходы и стравить давление. Если давление > 0.6 МПа -> разрушение
            if state.atm_column.top_pressure > 0.6:
                self.is_failed = True
            elif state.atm_column.top_pressure < 0.15 and self.scenario_timer > 15.0:
                self.is_resolved = True

        elif self.active_scenario == "GAS_LEAK":
            # --- Сценарий 3: Прорыв бензина в промканализацию ---
            # Падение уровня подтоварной воды в Е-1 ниже 15%
            setattr(state.atm_column, "e1_water_level_pct", 5.0)
            
            # Если оператор НЕ закрыл дренажную задвижку -> бензин хлещет в канализацию
            # Мы проверяем, открыта ли задвижка дренажа (условно)
            # Если не закрыли задвижку в течение 15 секунд -> взрывоопасная загазованность
            if self.scenario_timer > 15.0:
                # Проверяем, остановили ли насосы
                h6 = next((p for p in state.pumps if p.id == "H-6"), None)
                if h6 and h6.is_running:
                    self.is_failed = True
                else:
                    self.is_resolved = True

        elif self.active_scenario == "VACUUM_COLLAPSE":
            # --- Сценарий 4: Вакуумное схлопывание емкости Е-2 ---
            setattr(state.vac_column, "tar_level_m3", 1.0)
            state.vac_column.top_pressure = max(0.001, state.vac_column.top_pressure - 0.001 * dt)
            
            if state.vac_column.top_pressure < 0.003:
                self.is_failed = True
            elif state.vac_column.top_pressure > 0.007:
                self.is_resolved = True

        elif self.active_scenario == "ELOU_SHORT":
            # --- Сценарий 5: Короткое замыкание в высоковольтном трансформаторе ЭЛОУ ---
            state.desalter.stage1_voltage = 0.0
            state.desalter.stage2_voltage = 0.0
            # Обессоливание прекращается -> скачок соли до 450 мг/л
            state.desalter.outlet_salt_content = min(450.0, state.desalter.outlet_salt_content + 15.0 * dt)
            
            # Коррозия теплообменного оборудования Т-17
            if self.scenario_timer > 20.0 and state.desalter.outlet_salt_content > 300.0:
                self.is_failed = True
            elif state.desalter.outlet_salt_content < 30.0:
                self.is_resolved = True

        elif self.active_scenario == "COIL_RUPTURE":
            # --- Сценарий 6: Прогар змеевика печи П-1 (Взрыв) ---
            state.furnace.tube_skin_temp = min(620.0, state.furnace.tube_skin_temp + 25.0 * dt)
            state.furnace.coking_factor = 0.95
            
            # При Т_стенки > 550°C происходит взрыв змеевика печи
            if state.furnace.tube_skin_temp > 550.0:
                self.is_failed = True
            elif state.furnace.fuel_gas_flow < 5.0:
                self.is_resolved = True
