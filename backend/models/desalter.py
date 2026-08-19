"""
Модель ЭЛОУ (электрообессоливающей установки) — 2 ступени.
Рассчитывает остаточное содержание солей и воды после электродегидраторов.
"""
import math


def desalter_efficiency(voltage: float, temperature: float,
                        wash_water_ratio: float, demulsifier_dose: float,
                        inlet_salt: float) -> float:
    """
    КПД ступени обессоливания.
    Зависит от напряжения, температуры, расхода промывной воды
    и дозировки деэмульгатора.
    Возвращает: коэффициент от 0 до 1.
    """
    # Оптимальные параметры
    v_opt = 25.0   # кВ
    t_opt = 130.0  # °C
    w_opt = 7.0    # %
    d_opt = 5.0    # г/т

    # Нормализованные отклонения
    f_voltage = 1.0 - 0.3 * abs(voltage - v_opt) / v_opt
    f_temp = 1.0 - 0.2 * abs(temperature - t_opt) / t_opt
    f_water = min(1.0, wash_water_ratio / w_opt)
    f_demul = min(1.0, demulsifier_dose / d_opt)

    base_eff = 0.95
    eff = base_eff * max(0.1, f_voltage) * max(0.1, f_temp) * max(0.1, f_water) * max(0.1, f_demul)

    # Высокое содержание солей снижает КПД
    if inlet_salt > 200.0:
        eff *= max(0.5, 1.0 - (inlet_salt - 200.0) / 1000.0)

    return min(max(eff, 0.0), 1.0)


def calculate_outlet_salt(inlet_salt: float, stage1_eff: float, stage2_eff: float) -> float:
    """
    Содержание солей на выходе 2-ступенчатого ЭЛОУ.
    """
    after_stage1 = inlet_salt * (1.0 - stage1_eff)
    after_stage2 = after_stage1 * (1.0 - stage2_eff)
    return max(0.5, after_stage2)


def calculate_outlet_water(inlet_water: float, stage1_eff: float, stage2_eff: float) -> float:
    """
    Содержание воды на выходе (% масс.).
    """
    after_stage1 = inlet_water * (1.0 - stage1_eff * 0.8)
    after_stage2 = after_stage1 * (1.0 - stage2_eff * 0.8)
    return max(0.05, after_stage2)


def corrosion_risk_from_salt(outlet_salt: float) -> float:
    """
    Риск коррозии верха атмосферной колонны в зависимости от
    остаточного содержания солей (хлоридов → HCl).
    Норма: < 5 мг/л. При > 20 мг/л — критическая коррозия.
    Возвращает: 0..1
    """
    if outlet_salt <= 3.0:
        return 0.0
    elif outlet_salt <= 10.0:
        return (outlet_salt - 3.0) / 7.0 * 0.3
    elif outlet_salt <= 20.0:
        return 0.3 + (outlet_salt - 10.0) / 10.0 * 0.4
    else:
        return min(1.0, 0.7 + (outlet_salt - 20.0) / 30.0 * 0.3)
