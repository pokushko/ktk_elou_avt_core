"""
Модуль противоаварийной автоматической защиты (ПАЗ) установки ЭЛОУ-АВТ-5/5.
Проверяет критические параметры безопасности на частоте 10 Гц и осуществляет аварийную блокировку оборудования.
"""
from typing import List
from backend.schemas import InterlockState, SimulatorState

class PAZSystem:
    def __init__(self):
        self.interlocks = [
            InterlockState(
                id="PAZ-1",
                description="Отключение напряжения ЭЛОУ при уровне раздела фаз < 3500 мм",
                condition_met=False,
                is_tripped=False
            ),
            InterlockState(
                id="PAZ-2",
                description="Отсечка топлива печей П-1, П-2, П-3 при давлении К-1 >= 4.5 кгс/см2 (0.45 МПа)",
                condition_met=False,
                is_tripped=False
            ),
            InterlockState(
                id="PAZ-3",
                description="Блокировка мазутных насосов Н-4, Н-32 при уровне в К-2 < 15%",
                condition_met=False,
                is_tripped=False
            ),
            InterlockState(
                id="PAZ-4",
                description="Аварийный останов насосов орошения Н-6 при уровне воды в Е-1 < 15%",
                condition_met=False,
                is_tripped=False
            ),
            InterlockState(
                id="PAZ-5",
                description="Аварийная отсечка топлива печи П-1 при температуре стенки змеевика > 500°C",
                condition_met=False,
                is_tripped=False
            ),
            InterlockState(
                id="PAZ-6",
                description="Снятие высокого напряжения ЭЛОУ при солесодержании > 300 мг/л",
                condition_met=False,
                is_tripped=False
            )
        ]

    def evaluate_and_trip(self, state: SimulatorState) -> List[InterlockState]:
        """
        Проверка условий блокировок и воздействие на исполнительные органы (насосы, клапаны, напряжение).
        """
        # --- PAZ-1: ЭЛОУ уровень раздела фаз ---
        # В симуляторе храним условный уровень (норма 4000 мм). Если < 3500 мм -> срыв
        # Мы проверим уровень раздела фаз (в desalter_state или условно)
        elou_level = getattr(state.desalter, "phase_level_mm", 4000.0)
        paz1 = self.interlocks[0]
        if elou_level < 3500.0:
            paz1.condition_met = True
            paz1.is_tripped = True
            # Воздействие: Отключаем высокое напряжение дегидраторов
            state.desalter.stage1_voltage = 0.0
            state.desalter.stage2_voltage = 0.0
        else:
            paz1.condition_met = False
            
        # --- PAZ-2: Давление верха К-1 ---
        # Критическое давление верха К-1: 0.45 МПа.
        k1_pressure = state.atm_column.top_pressure
        paz2 = self.interlocks[1]
        if k1_pressure >= 0.45:
            paz2.condition_met = True
            paz2.is_tripped = True
            # Воздействие: отсекаем газ на горелки печи
            state.furnace.fuel_gas_flow = 0.0
            # Перекрываем топливные клапаны
            for valve in state.valves:
                if "fuel_gas" in valve.id:
                    valve.opening_percent = 0.0
                    valve.position = "CLOSED"
        else:
            paz2.condition_met = False
            
        # --- PAZ-3: Уровень в вакуумной колонне К-2 ---
        # Падение уровня в К-2 ниже 15% (условно 15 м3 при норме 20 м3)
        k2_level = getattr(state.vac_column, "tar_level_m3", 20.0)
        paz3 = self.interlocks[2]
        if k2_level < 3.0:  # 15% от 20 м3 = 3.0 м3
            paz3.condition_met = True
            paz3.is_tripped = True
            # Воздействие: блокировка насосов откачки мазута/гудрона (Н-4, Н-32)
            for pump in state.pumps:
                if pump.id in ["H-4", "H-4A", "H-32", "H-32A"]:
                    pump.is_running = False
                    pump.flow_rate = 0.0
        else:
            paz3.condition_met = False
            
        # --- PAZ-4: Уровень воды в рефлюксной емкости Е-1 ---
        # Падение уровня воды в Е-1 ниже 15% -> бензин идет в канализацию -> взрывоопасность
        # В симуляторе храним уровень раздела фаз вода/бензин в Е-1 (условная рефлюксная емкость)
        e1_water_level = getattr(state.atm_column, "e1_water_level_pct", 50.0)
        paz4 = self.interlocks[3]
        if e1_water_level < 15.0:
            paz4.condition_met = True
            paz4.is_tripped = True
            # Воздействие: аварийный останов насосов Н-6
            for pump in state.pumps:
                if pump.id in ["H-6", "H-6A"]:
                    pump.is_running = False
                    pump.flow_rate = 0.0
        else:
            paz4.condition_met = False
            
        # --- PAZ-5: Температура стенки змеевика П-1 > 500°C ---
        paz5 = self.interlocks[4]
        if state.furnace.tube_skin_temp > 500.0:
            paz5.condition_met = True
            paz5.is_tripped = True
            state.furnace.fuel_gas_flow = 0.0
            for valve in state.valves:
                if "fuel_gas" in valve.id:
                    valve.opening_percent = 0.0
                    valve.position = "CLOSED"
        else:
            paz5.condition_met = False

        # --- PAZ-6: Высокое солесодержание > 300 мг/л ---
        paz6 = self.interlocks[5]
        if state.desalter.outlet_salt_content > 300.0:
            paz6.condition_met = True
            paz6.is_tripped = True
            state.desalter.stage1_voltage = 0.0
            state.desalter.stage2_voltage = 0.0
        else:
            paz6.condition_met = False

        return self.interlocks
