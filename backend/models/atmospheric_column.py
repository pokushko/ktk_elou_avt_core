"""
Модель атмосферной колонны К-1 (28 тарелок) на основе RK4 (Runge-Kutta 4th order).
Моделирует динамику температурного профиля, жидкого орошения и фракционного состава.
"""
import numpy as np

class AtmosphericColumn:
    def __init__(self):
        self.num_trays = 28
        self.feed_tray = 16
        
        # Начальные профили (стационарное состояние)
        # Куб (тарелка 1) -> Верх (тарелка 28)
        self.temperatures = np.linspace(280.0, 120.0, self.num_trays)
        self.liquid_holdup = np.ones(self.num_trays) * 15.0  # Уровень жидкости на тарелках, м3
        
        # Мольные/массовые доли фракций на тарелках (бензин, керосин, дизель, мазут)
        self.compositions = np.zeros((self.num_trays, 4))
        for i in range(self.num_trays):
            if i < 8:
                self.compositions[i] = [0.0, 0.0, 0.1, 0.9]  # Больше мазута в кубе
            elif i < 16:
                self.compositions[i] = [0.0, 0.1, 0.7, 0.2]  # Дизельная зона
            elif i < 24:
                self.compositions[i] = [0.1, 0.7, 0.2, 0.0]  # Керосиновая зона
            else:
                self.compositions[i] = [0.9, 0.1, 0.0, 0.0]  # Бензиновая зона (верх)

    def derivatives(self, state, feed_rate, feed_temp, feed_comp, reflux_rate, reflux_temp, steam_flow):
        """
        Расчет производных dT/dt, dL/dt, dx/dt.
        state: одномерный массив [T_0..T_27, L_0..L_27]
        """
        T = state[:self.num_trays]
        L = state[self.num_trays:2*self.num_trays]
        
        dT_dt = np.zeros(self.num_trays)
        dL_dt = np.zeros(self.num_trays)
        
        # Расчет профиля паров и переливов жидкости
        vapor_flows = np.zeros(self.num_trays)
        liquid_flows = np.zeros(self.num_trays)
        
        # Эмпирическое распределение паров снизу вверх (учитываем подачу пара в куб)
        base_vapor = 50.0 + (steam_flow / 1200.0) * 20.0
        for i in range(self.num_trays):
            vapor_flows[i] = base_vapor * (1.0 + 0.01 * (T[i] - 100.0))
            # Уравнение Фрэнсиса для сливных перегородок
            liquid_flows[i] = 1.84 * max(0.0, (L[i] - 10.0)) ** 1.5
            
        # Уравнения баланса для каждой тарелки
        for i in range(self.num_trays):
            # Входные и выходные потоки
            L_in = liquid_flows[i+1] if i < self.num_trays - 1 else reflux_rate
            L_out = liquid_flows[i]
            
            V_in = vapor_flows[i-1] if i > 0 else 0.0
            V_out = vapor_flows[i]
            
            # Ввод питания на 16-й тарелке
            F = feed_rate if i == self.feed_tray else 0.0
            
            # Баланс массы
            dL_dt[i] = L_in - L_out + V_in - V_out + F
            
            # Тепловой баланс (dT/dt)
            h_L_in = (reflux_temp if i == self.num_trays - 1 else T[i+1]) * 2.2
            h_L_out = T[i] * 2.2
            h_V_in = (T[i-1] if i > 0 else T[0]) * 1.8
            h_V_out = T[i] * 1.8
            
            heat_in = L_in * h_L_in + V_in * h_V_in + F * feed_temp * 2.2
            heat_out = L_out * h_L_out + V_out * h_V_out
            
            # Динамика температуры: стремится к равновесному профилю с учетом расходов и температур
            T_target = (280.0 + (feed_temp - 360.0) * 0.4) - i * ((160.0 + (feed_temp - 360.0) * 0.2 - (reflux_temp - 100.0) * 0.5) / (self.num_trays - 1))
            dT_dt[i] = 0.5 * (T_target - T[i])
            
        return np.concatenate([dT_dt, dL_dt])

    def step(self, dt, feed_rate, feed_temp, feed_comp, reflux_rate, reflux_temp, steam_flow):
        """
        Шаг интегрирования методом Рунге-Кутты 4-го порядка (RK4).
        """
        state = np.concatenate([self.temperatures, self.liquid_holdup])
        
        # Коэффициенты RK4
        k1 = self.derivatives(state, feed_rate, feed_temp, feed_comp, reflux_rate, reflux_temp, steam_flow)
        k2 = self.derivatives(state + 0.5 * dt * k1, feed_rate, feed_temp, feed_comp, reflux_rate, reflux_temp, steam_flow)
        k3 = self.derivatives(state + 0.5 * dt * k2, feed_rate, feed_temp, feed_comp, reflux_rate, reflux_temp, steam_flow)
        k4 = self.derivatives(state + dt * k3, feed_rate, feed_temp, feed_comp, reflux_rate, reflux_temp, steam_flow)
        
        new_state = state + (dt / 6.0) * (k1 + 2.0*k2 + 2.0*k3 + k4)
        
        # Обновление состояния
        self.temperatures = np.clip(new_state[:self.num_trays], 80.0, 420.0)
        self.liquid_holdup = np.clip(new_state[self.num_trays:], 0.1, 100.0)
        
        # Расчет фазового равновесия (VLE) по векторизованному уравнению Антуана:
        # P_sat_i = 10^(A_i - B_i / (T + C_i)) (в бар)
        # Коэффициенты Антуана для 4 фракций [бензин, керосин, дизель, мазут]
        antoine_A = np.array([4.05, 4.15, 4.25, 4.35])
        antoine_B = np.array([1350.0, 1650.0, 1950.0, 2400.0])
        antoine_C = np.array([215.0, 200.0, 185.0, 160.0])

        for i in range(self.num_trays):
            T_c = self.temperatures[i]
            # Давления насыщенного пара фракций (бар)
            p_sat = 10.0 ** (antoine_A - (antoine_B / (T_c + antoine_C)))
            # Константы равновесия K_i = P_sat_i / P_col (P_col ~ 1.2 бар)
            K_vals = p_sat / 1.2
            # Мольные доли пара y_i = K_i * x_i
            y_comp = K_vals * self.compositions[i]
            y_sum = np.sum(y_comp) + 1e-9
            y_norm = y_comp / y_sum

            if i > 0 and i < self.num_trays - 1:
                # Динамическое межтарелочное массобмененое равновесие
                self.compositions[i] = 0.94 * self.compositions[i] + 0.03 * y_norm + 0.03 * self.compositions[i-1]
                self.compositions[i] /= np.sum(self.compositions[i]) # Нормировка

    def get_product_specs(self):
        """
        Возвращает параметры выходящих продуктов для LIMS/SCADA
        """
        # Бензин отбирается с верха (28 тарелка)
        gasoline_t_end = 170.0 + (self.temperatures[-1] - 120.0) * 1.5
        
        # Керосин отбирается из бокового стриппинга (ориентир 20 тарелка)
        kerosene_visc = 1.30 - (self.temperatures[20] - 190.0) * 0.005
        
        # Мазут выходит снизу (куб, 1 тарелка)
        mazut_visc = 6.8 + (self.temperatures[0] - 280.0) * 0.02
        
        return {
            "gasoline_t_end": max(150.0, min(220.0, gasoline_t_end)),
            "kerosene_viscosity": max(0.8, min(2.5, kerosene_visc)),
            "mazut_viscosity": max(3.0, min(12.0, mazut_visc))
        }
