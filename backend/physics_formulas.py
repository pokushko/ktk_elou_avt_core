import math

def calculate_pump_head(flow_rate: float, nominal_head: float, wear_factor: float) -> float:
    """
    Deterministic pump head curve incorporating wear.
    H = H0 - k * Q^2 (Simplified)
    Wear factor decreases nominal head.
    """
    effective_nominal_head = nominal_head * (1.0 - wear_factor * 0.2)
    k = 0.005 # empirical constant for the curve
    head = effective_nominal_head - k * (flow_rate ** 2)
    return max(0.0, head)

def check_cavitation(flow_rate: float, vapor_pressure: float, suction_pressure: float) -> float:
    """
    Returns a cavitation risk between 0 and 1 based on suction pressure and vapor pressure.
    NPSHa must be greater than NPSHr.
    """
    if suction_pressure <= vapor_pressure:
        return 1.0
    margin = suction_pressure - vapor_pressure
    return max(0.0, 1.0 - (margin / 2.0))

def calculate_lmtd(t_hot_in: float, t_hot_out: float, t_cold_in: float, t_cold_out: float) -> float:
    """
    Log Mean Temperature Difference for a counter-current heat exchanger.
    """
    dt1 = t_hot_in - t_cold_out
    dt2 = t_hot_out - t_cold_in
    if dt1 <= 0 or dt2 <= 0 or dt1 == dt2:
        return (dt1 + dt2) / 2.0
    return (dt1 - dt2) / math.log(dt1 / dt2)

def calculate_column_flooding_risk(vapor_velocity: float, max_velocity: float) -> float:
    """
    Deterministic flooding risk based on F-factor and Souders-Brown.
    Simplified to ratio of vapor velocity to maximum allowable velocity.
    """
    if vapor_velocity >= max_velocity:
        return 1.0
    return max(0.0, (vapor_velocity / max_velocity) ** 4)
