"""
Модель трубчатой печи П-1 для АВТ-5/5.
Расчёт КПД, температуры стенки, закоксованности, тепловой нагрузки.
"""
import math


def furnace_duty(flow_rate_m3h: float, density: float,
                 inlet_temp: float, outlet_temp: float,
                 cp_avg: float) -> float:
    """
    Тепловая нагрузка печи, кВт.
    Q = m * Cp * (T_out - T_in)
    """
    mass_flow_kgs = flow_rate_m3h * density / 3600.0  # м3/ч → кг/с
    return mass_flow_kgs * cp_avg * (outlet_temp - inlet_temp)


def fuel_gas_consumption(duty_kw: float, efficiency: float,
                         fuel_heat_value: float = 35000.0) -> float:
    """
    Расход топливного газа, нм3/ч.
    fuel_heat_value: теплота сгорания, кДж/нм3 (по умолчанию ≈ природный газ).
    """
    if efficiency <= 0.01:
        return 0.0
    return (duty_kw * 3600.0) / (fuel_heat_value * efficiency)


def tube_skin_temperature(outlet_temp: float, heat_flux: float,
                          coking_factor: float) -> float:
    """
    Температура стенки труб змеевика.
    Закоксованность увеличивает термическое сопротивление → рост температуры стенки.
    """
    base_delta = 50.0  # базовый ΔT между средой и стенкой
    coking_delta = coking_factor * 120.0  # кокс добавляет до 120°C
    flux_factor = max(1.0, heat_flux / 30000.0)  # нормировка по тепловому потоку
    return outlet_temp + base_delta * flux_factor + coking_delta


def coking_rate(tube_skin_temp: float, dt: float, current_coking: float) -> float:
    """
    Скорость коксообразования зависит экспоненциально от температуры стенки.
    Критический порог: 480°C.
    """
    if tube_skin_temp < 380.0:
        rate = 0.00001
    elif tube_skin_temp < 450.0:
        rate = 0.0001 * (tube_skin_temp - 380.0) / 70.0
    else:
        rate = 0.001 * math.exp((tube_skin_temp - 450.0) / 50.0)
    new_coking = current_coking + rate * dt
    return min(1.0, new_coking)


def flue_gas_temperature(duty_kw: float, excess_air: float, efficiency: float) -> float:
    """
    Температура дымовых газов (приближение).
    Высокий избыток воздуха → ниже температура горения → больше потери.
    """
    base_temp = 800.0 - efficiency * 500.0
    air_correction = (excess_air - 1.0) * 200.0
    return max(150.0, base_temp - air_correction)


def furnace_efficiency(flue_gas_temp: float, excess_air: float) -> float:
    """
    КПД печи (метод прямого баланса, упрощённый).
    КПД падает при высокой температуре уходящих газов и при высоком α.
    """
    # Потери с уходящими газами (основные потери)
    q2 = (flue_gas_temp - 20.0) * 0.0012 * excess_air
    # Потери от химической неполноты (малы при α > 1.05)
    q3 = 0.005 if excess_air > 1.05 else 0.02
    # Потери через стенки
    q5 = 0.02
    eff = 1.0 - q2 - q3 - q5
    return max(0.5, min(0.95, eff))


def calculate_emissions(fuel_gas_flow: float, excess_air: float, sulfur_content: float) -> dict:
    """
    Расчет вредных выбросов в дымовую трубу печи.
    Зависит от расхода газа, коэффициента избытка воздуха (excess_air) и содержания серы.
    Возвращает: dict с концентрациями CO, NO2, SO2 (мг/м3) и флагом превышения ПДК.
    """
    if fuel_gas_flow <= 0.1:
        return {"co": 0.0, "no2": 0.0, "so2": 0.0, "is_violating": False}

    # CO (угарный газ) резко растет при недожоге (excess_air < 1.15)
    if excess_air >= 1.15:
        co = 0.5
    else:
        # Экспоненциальный рост CO при приближении к стехиометрии и ниже
        co = 0.5 + 45.0 * math.exp(12.0 * (1.15 - excess_air))
    
    # NO2 (оксиды азота) растут при избытке воздуха и высокой нагрузке (высокий расход газа)
    no2 = 15.0 + 0.04 * fuel_gas_flow * max(1.0, excess_air)

    # SO2 (диоксид серы) пропорционален содержанию серы в топливе/сырье
    so2 = 10.0 + 50.0 * sulfur_content

    # Проверка на превышение ПДК по ГОСТ Р 50831 (норма: CO < 100 мг/м3, NO2 < 150 мг/м3, SO2 < 300 мг/м3)
    is_violating = (co > 100.0) or (no2 > 150.0) or (so2 > 300.0)

    return {
        "co_mg_m3": co,
        "no2_mg_m3": no2,
        "so2_mg_m3": so2,
        "is_violating": is_violating
    }

