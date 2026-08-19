"""
Модель вакуумной колонны К-2 (43 тарелки) на основе RK4 (Runge-Kutta 4th order).
Моделирует поведение колонны при остаточном давлении (вакууме), температурный профиль,
риск срыва вакуумной системы и уровни жидких фракций.
"""
import numpy as np

class VacuumColumn:
    def __init__(self):
        self.num_trays = 43
        self.feed_tray = 8  # Ввод сырья снизу (мазут после печи)
        
        # Профиль температур К-2: от 350°С (куб) до 120°С (верх)
        self.temperatures = np.linspace(350.0, 120.0, self.num_trays)
        self.liquid_holdup = np.ones(self.num_trays) * 20.0  # Уровень жидкости на тарелках, м3
        
        # Остаточное давление (вакуум), МПа. Норма: 0.008 МПа.
        self.top_pressure = 0.008
        self.vacuum_system_load = 0.5

    def derivatives(self, state, feed_rate, feed_temp, reflux_rate, steam_flow, ejector_steam_flow):
        """
        Расчет производных dT/dt, dL/dt.
        state: одномерный массив [T_0..T_42, L_0..L_42]
        """
        T = state[:self.num_trays]
        L = state[self.num_trays:2*self.num_trays]
        
        dT_dt = np.zeros(self.num_trays)
        dL_dt = np.zeros(self.num_trays)
        
        # Расчет профиля вакуума
        # Эжекторы откачивают газ. Недостаток пара на эжектор -> ухудшение вакуума (рост давления)
        target_pressure = 0.008
        pressure_loss = max(0.0, 0.05 - (ejector_steam_flow / 5000.0) * 0.042)
        current_pressure = target_pressure + pressure_loss
        
        # Расчет скоростей испарения и перелива
        vapor_flows = np.zeros(self.num_trays)
        liquid_flows = np.zeros(self.num_trays)
        
        # Под воздействием вакуума и пара температура кипения снижается
        base_vapor = 40.0 + (steam_flow / 1500.0) * 25.0
        pressure_factor = current_pressure / 0.008  # рост давления -> хуже испарение
        
        for i in range(self.num_trays):
            vapor_flows[i] = (base_vapor / pressure_factor) * (1.0 + 0.008 * (T[i] - 120.0))
            liquid_flows[i] = 1.6 * max(0.0, (L[i] - 12.0)) ** 1.5
            
        for i in range(self.num_trays):
            L_in = liquid_flows[i+1] if i < self.num_trays - 1 else reflux_rate
            L_out = liquid_flows[i]
            
            V_in = vapor_flows[i-1] if i > 0 else 0.0
            V_out = vapor_flows[i]
            
            F = feed_rate if i == self.feed_tray else 0.0
            
            # Баланс массы
            dL_dt[i] = L_in - L_out + V_in - V_out + F
            
            # Тепловой баланс
            h_L_in = (T[i+1] if i < self.num_trays - 1 else 110.0) * 2.3
            h_L_out = T[i] * 2.3
            h_V_in = (T[i-1] if i > 0 else T[0]) * 1.9
            h_V_out = T[i] * 1.9
            
            heat_in = L_in * h_L_in + V_in * h_V_in + F * feed_temp * 2.3
            heat_out = L_out * h_L_out + V_out * h_V_out
            
            dT_dt[i] = (heat_in - heat_out) / (L[i] * 2.3 + 0.1)
            
        return np.concatenate([dT_dt, dL_dt])

    def step(self, dt, feed_rate, feed_temp, reflux_rate, steam_flow, ejector_steam_flow):
        """
        Интегрирование методом Рунге-Кутты 4-го порядка.
        """
        state = np.concatenate([self.temperatures, self.liquid_holdup])
        
        k1 = self.derivatives(state, feed_rate, feed_temp, reflux_rate, steam_flow, ejector_steam_flow)
        k2 = self.derivatives(state + 0.5 * dt * k1, feed_rate, feed_temp, reflux_rate, steam_flow, ejector_steam_flow)
        k3 = self.derivatives(state + 0.5 * dt * k2, feed_rate, feed_temp, reflux_rate, steam_flow, ejector_steam_flow)
        k4 = self.derivatives(state + dt * k3, feed_rate, feed_temp, reflux_rate, steam_flow, ejector_steam_flow)
        
        new_state = state + (dt / 6.0) * (k1 + 2.0*k2 + 2.0*k3 + k4)
        
        self.temperatures = np.clip(new_state[:self.num_trays], 40.0, 420.0)
        self.liquid_holdup = np.clip(new_state[self.num_trays:], 0.1, 100.0)
        
        # Обновление давлений и нагрузок эжекторов
        self.vacuum_system_load = min(1.0, max(0.1, 0.5 + (feed_rate / 200.0) * 0.3))
        self.top_pressure = max(0.005, min(0.1, 0.008 + max(0.0, 0.05 - (ejector_steam_flow / 5000.0) * 0.042)))

    def get_column_state(self):
        """
        Возвращает параметры вакуумной колонны К-2 для SCADA
        """
        # Кубовый продукт - гудрон (уровень куба)
        tar_level = self.liquid_holdup[0]
        
        # Легкий вакуумный газойль (ЛВГО) отбирается из середины (28 тарелка)
        vgo_light_temp = self.temperatures[28]
        
        # Тяжелый вакуумный газойль (ТВГО) отбирается ниже (15 тарелка)
        vgo_heavy_temp = self.temperatures[15]
        
        return {
            "top_pressure": self.top_pressure,
            "bottom_temperature": self.temperatures[0],
            "top_temperature": self.temperatures[-1],
            "vacuum_system_load": self.vacuum_system_load,
            "tar_level_m3": tar_level,
            "vgo_light_temp": vgo_light_temp,
            "vgo_heavy_temp": vgo_heavy_temp,
            "flooding_risk": float(max(0.0, (self.liquid_holdup[-1] - 40.0) / 60.0))
        }
