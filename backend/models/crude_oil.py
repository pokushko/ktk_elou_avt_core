"""
Модель сырой нефти для ЭЛОУ-АВТ-5/5.
Корреляции свойств нефти и нефтяных фракций.
"""
import math


def oil_density_at_temp(density_20: float, temperature: float) -> float:
    """
    Плотность нефти при заданной температуре (формула Менделеева).
    density_20: плотность при 20°C, кг/м3
    temperature: °C
    Возвращает: кг/м3
    """
    beta = 1.825e-3 - 1.315e-6 * density_20
    return density_20 - beta * (temperature - 20.0)


def oil_viscosity(density_20: float, temperature: float) -> float:
    """
    Кинематическая вязкость нефти (корреляция Уолтера).
    Возвращает: сСт (мм²/с)
    """
    a = 10.0 - 0.0075 * density_20
    b = 3.5 + 0.01 * density_20
    t_k = temperature + 273.15
    log_log_v = a - b * math.log10(t_k)
    try:
        return 10.0 ** (10.0 ** log_log_v) - 0.8
    except (OverflowError, ValueError):
        return 1.0


def oil_specific_heat(density_15: float, temperature: float) -> float:
    """
    Удельная теплоёмкость нефтепродуктов (формула Крэгое-Бальжона).
    Возвращает: кДж/(кг·°C)
    """
    d = density_15 / 1000.0  # переводим в г/см3
    return (1.687 + 0.00339 * temperature) / math.sqrt(d)


def oil_enthalpy_liquid(density_15: float, temperature: float) -> float:
    """
    Энтальпия жидкой нефтяной фракции (корреляция Ли-Кеслера, упрощённая).
    Возвращает: кДж/кг
    """
    cp = oil_specific_heat(density_15, temperature / 2.0)
    return cp * temperature


def oil_enthalpy_vapor(density_15: float, temperature: float) -> float:
    """
    Энтальпия паровой фазы (корреляция Ли-Кеслера, упрощённая).
    Возвращает: кДж/кг
    """
    h_liquid = oil_enthalpy_liquid(density_15, temperature)
    # Теплота испарения (приблизительная корреляция)
    d = density_15 / 1000.0
    heat_of_vaporization = (362.0 - 310.0 * d) * (1.0 - 0.001 * temperature)
    return h_liquid + max(heat_of_vaporization, 50.0)


def antoine_pressure(a: float, b: float, c: float, temperature: float) -> float:
    """
    Давление насыщенных паров по уравнению Антуана.
    log10(P) = A - B / (C + T)
    P в мм рт. ст., T в °C.
    Возвращает: МПа
    """
    log_p = a - b / (c + temperature)
    p_mmhg = 10.0 ** log_p
    return p_mmhg * 0.000133322  # мм рт. ст. → МПа


def crude_tbp_fractions(density_20: float) -> dict:
    """
    Возвращает типовые температуры выкипания и выходы фракций для нефти АВТ-5.
    Это таблица из технологического регламента (приближённая).
    """
    return {
        "gasoline":  {"tbp_start": 35,  "tbp_end": 180, "yield_pct": 15.0, "density": 730.0},
        "kerosene":  {"tbp_start": 180, "tbp_end": 240, "yield_pct": 10.0, "density": 790.0},
        "diesel":    {"tbp_start": 240, "tbp_end": 350, "yield_pct": 20.0, "density": 840.0},
        "mazut":     {"tbp_start": 350, "tbp_end": 500, "yield_pct": 55.0, "density": 950.0},
        "vgo_light": {"tbp_start": 350, "tbp_end": 420, "yield_pct": 12.0, "density": 890.0},
        "vgo_heavy": {"tbp_start": 420, "tbp_end": 500, "yield_pct": 10.0, "density": 920.0},
        "tar":       {"tbp_start": 500, "tbp_end": 700, "yield_pct": 33.0, "density": 1010.0},
    }
