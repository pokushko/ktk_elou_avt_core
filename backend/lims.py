"""
Модуль лабораторного контроля (LIMS) по ГОСТ РФ.
Проверяет пробы технологических потоков на соответствие стандартам качества.
Любое нарушение ведет к браку и сбросу в некондицию.
"""
from typing import List, Dict, Any
from backend.schemas import LabAnalysisResult, SimulatorState

# Нормативные показатели по регламенту (Раздел 5.1, Таблица 3)
GOST_LIMITS = {
    "crude_oil": {
        "water_content": {"max": 1.0, "gost": "ГОСТ 2477"}
    },
    "desalted_oil": {
        "water_content": {"max": 0.15, "gost": "ГОСТ 2477"},
        "salt_content": {"max": 5.0, "gost": "ГОСТ 21534"}
    },
    "gasoline": {
        "tbp_end": {"max": 195.0, "gost": "ГОСТ 2177"},  # Летний предел
        "water_content": {"max": 0.0, "gost": "Визуально"}
    },
    "kerosene": {
        "viscosity": {"min": 1.25, "gost": "ГОСТ 33"},
        "flash_point": {"min": 28.0, "gost": "ГОСТ 6356"}
    },
    "mazut": {
        "viscosity": {"max": 6.8, "gost": "ГОСТ 6258"},
        "water_content": {"max": 1.0, "gost": "ГОСТ 2477"}
    }
}

class LIMSManager:
    def __init__(self):
        self.analysis_history: List[LabAnalysisResult] = []

    def run_analysis(self, timestamp: float, product_name: str, simulator_state: SimulatorState) -> List[LabAnalysisResult]:
        """
        Проведение экспресс-анализа пробы и сравнение с нормами ГОСТ.
        """
        results = []
        if product_name not in GOST_LIMITS:
            return results
            
        limits = GOST_LIMITS[product_name]
        
        if product_name == "crude_oil":
            val = simulator_state.crude_feed.water_content
            limit_val = limits["water_content"]["max"]
            results.append(LabAnalysisResult(
                timestamp=timestamp,
                product_name="Сырая нефть",
                property_name=f"Содержание воды (норма <= {limit_val}%) [{limits['water_content']['gost']}]",
                measured_value=val,
                target_value=limit_val,
                is_spec=val <= limit_val
            ))
            
        elif product_name == "desalted_oil":
            # Вода
            val_w = simulator_state.desalter.outlet_water_content
            limit_w = limits["water_content"]["max"]
            results.append(LabAnalysisResult(
                timestamp=timestamp,
                product_name="Обессоленная нефть",
                property_name=f"Содержание воды (норма <= {limit_w}%) [{limits['water_content']['gost']}]",
                measured_value=val_w,
                target_value=limit_w,
                is_spec=val_w <= limit_w
            ))
            # Соли
            val_s = simulator_state.desalter.outlet_salt_content
            limit_s = limits["salt_content"]["max"]
            results.append(LabAnalysisResult(
                timestamp=timestamp,
                product_name="Обессоленная нефть",
                property_name=f"Содержание хлористых солей (норма <= {limit_s} мг/л) [{limits['salt_content']['gost']}]",
                measured_value=val_s,
                target_value=limit_s,
                is_spec=val_s <= limit_s
            ))
            
        elif product_name == "gasoline":
            val = simulator_state.atm_column.gasoline_flow # В симуляторе храним температуру конца кипения
            # Для бензина в симуляторе мы берем расчетную температуру конца перегонки
            # Получаем свойства из колонны (атмосферный блок)
            # В бэкенде simulator.py мы заполним это свойство
            t_end = getattr(simulator_state.atm_column, "gasoline_t_end", 185.0)
            limit_val = limits["tbp_end"]["max"]
            results.append(LabAnalysisResult(
                timestamp=timestamp,
                product_name="Фракция бензина",
                property_name=f"Температура конца перегонки (норма <= {limit_val}°C) [{limits['tbp_end']['gost']}]",
                measured_value=t_end,
                target_value=limit_val,
                is_spec=t_end <= limit_val
            ))
            
        elif product_name == "kerosene":
            visc = getattr(simulator_state.atm_column, "kerosene_viscosity", 1.30)
            limit_v = limits["viscosity"]["min"]
            results.append(LabAnalysisResult(
                timestamp=timestamp,
                product_name="Фракция керосина",
                property_name=f"Кинематическая вязкость при 20°C (норма >= {limit_v} сСт) [{limits['viscosity']['gost']}]",
                measured_value=visc,
                target_value=limit_v,
                is_spec=visc >= limit_v
            ))
            
        elif product_name == "mazut":
            visc = getattr(simulator_state.atm_column, "mazut_viscosity", 6.8)
            limit_v = limits["viscosity"]["max"]
            results.append(LabAnalysisResult(
                timestamp=timestamp,
                product_name="Топочный мазут 100",
                property_name=f"Условная вязкость при 100°C (норма <= {limit_v} ВУ) [{limits['viscosity']['gost']}]",
                measured_value=visc,
                target_value=limit_v,
                is_spec=visc <= limit_v
            ))
            
        self.analysis_history.extend(results)
        # Храним последние 50 записей
        if len(self.analysis_history) > 50:
            self.analysis_history = self.analysis_history[-50:]
            
        return results
