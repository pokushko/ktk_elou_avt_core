"""
Модель теплообменной сети (Heat Train) Т-1 – Т-11, Т-17 – Т-27 на основе формулы Керна.
Использует реальные площади поверхности теплообмена из Таблицы 18 технологического регламента.
Рассчитывает LMTD, коэффициенты теплопередачи с учетом загрязнения (fouling factor) и энтальпийные балансы.
"""
import math

# Параметры теплообменников по Таблице 18 (Площадь A, м2)
EQUIPMENT_AREAS = {
    "T-1/1": 400.0,
    "T-1/2": 413.0,
    "T-1/3": 261.0,
    "T-2": 400.0,
    "T-3/1": 400.0,
    "T-3/2": 400.0,
    "T-4/1": 400.0,
    "T-4/2": 413.0,
    "T-5": 400.0,
    "T-6/1": 400.0,
    "T-6/2": 400.0,
    "T-7/1": 250.0,
    "T-7/2": 250.0,
    "T-8": 400.0,
    "T-9/1": 400.0,
    "T-9/2": 400.0,
    "T-10/1": 400.0,
    "T-10/2": 400.0,
    "T-11": 400.0,
    "T-17": 250.0,
    "T-18/1": 250.0,
    "T-18/2": 250.0,
    "T-19": 250.0,
    "T-20": 250.0,
    "T-21": 250.0,
    "T-22/1": 400.0,
    "T-22/2": 400.0,
    "T-22/3": 400.0,
    "T-22/4": 450.0,
    "T-22/5": 403.0,
    "T-22/6": 402.0,
    "T-23": 250.0,
    "T-24": 250.0,
    "T-25/2": 250.0,
    "T-26": 250.0,
    "T-27/1": 460.0
}

def calculate_lmtd(t_hot_in, t_hot_out, t_cold_in, t_cold_out):
    """
    Расчет среднелогарифмической разности температур (LMTD) для противотока.
    """
    dt1 = t_hot_in - t_cold_out
    dt2 = t_hot_out - t_cold_in
    
    if dt1 <= 0 or dt2 <= 0:
        return 0.0
        
    if abs(dt1 - dt2) < 1e-5:
        return dt1
        
    try:
        return (dt1 - dt2) / math.log(dt1 / dt2)
    except (ValueError, ZeroDivisionError):
        return (dt1 + dt2) / 2.0

def heat_exchanger_step(exchanger_id, t_hot_in, m_hot, cp_hot, t_cold_in, m_cold, cp_cold, fouling_factor):
    """
    Расчет шага теплообмена методом Керна (сведение баланса).
    Возвращает: Q (кВт), t_hot_out (°C), t_cold_out (°C), u_value, lmtd
    """
    area = EQUIPMENT_AREAS.get(exchanger_id, 400.0)
    
    # Базовый коэффициент теплопередачи чистой поверхности (Вт/м2*K)
    u_0 = 350.0 
    # Коэффициент теплопередачи с учетом загрязнения (Керн)
    u_value = u_0 / (1.0 + u_0 * fouling_factor * 0.001)
    
    # Переводим расходы в кг/с
    w_hot = m_hot / 3600.0 if m_hot > 0 else 0.0
    w_cold = m_cold / 3600.0 if m_cold > 0 else 0.0
    
    if w_hot <= 0.01 or w_cold <= 0.01:
        return 0.0, t_hot_in, t_cold_in, u_value, 0.0
        
    # NTU метод для быстрого и безвзрывного решения баланса температур
    c_hot = w_hot * cp_hot
    c_cold = w_cold * cp_cold
    
    c_min = min(c_hot, c_cold)
    c_max = max(c_hot, c_cold)
    
    # NTU = U * A / C_min
    ntu = (u_value * area / 1000.0) / c_min
    
    cr = c_min / c_max
    
    # Эффективность для противотока
    if abs(cr - 1.0) < 1e-5:
        effectiveness = ntu / (1.0 + ntu)
    else:
        try:
            effectiveness = (1.0 - math.exp(-ntu * (1.0 - cr))) / (1.0 - cr * math.exp(-ntu * (1.0 - cr)))
        except OverflowError:
            effectiveness = 1.0
            
    # Максимально возможный теплообмен
    q_max = c_min * (t_hot_in - t_cold_in)
    q_actual = effectiveness * q_max
    
    t_hot_out = t_hot_in - q_actual / c_hot
    t_cold_out = t_cold_in + q_actual / c_cold
    
    lmtd = calculate_lmtd(t_hot_in, t_hot_out, t_cold_in, t_cold_out)
    
    return q_actual, t_hot_out, t_cold_out, u_value, lmtd
