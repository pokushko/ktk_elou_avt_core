import math
import time
import numpy as np
from backend.schemas import (
    SimulatorState, CrudeOilFeed, DesalterState, PumpState,
    HeatExchangerState, FurnaceState, AtmosphericColumnState,
    VacuumColumnState, ValveState, OperatorPPE
)
from backend.physics_formulas import calculate_pump_head, check_cavitation
from backend.models.crude_oil import oil_density_at_temp, oil_viscosity, oil_specific_heat
from backend.models.desalter import desalter_efficiency, calculate_outlet_salt, calculate_outlet_water
from backend.models.furnace import furnace_duty, fuel_gas_consumption, tube_skin_temperature, coking_rate, furnace_efficiency, calculate_emissions
from backend.models.atmospheric_column import AtmosphericColumn
from backend.models.vacuum_column import VacuumColumn
from backend.models.heat_train import heat_exchanger_step
from backend.interlocks import PAZSystem

from collections import deque
import copy

class Simulator:
    def __init__(self):
        self.start_time = time.time()
        self.paz = PAZSystem()
        self.history_buffer = deque(maxlen=600)  # Буфер состояний за последние 60 секунд (10 Гц * 60)
        
        # Инстансы сложных физических моделей
        self.atm_col_phys = AtmosphericColumn()
        self.vac_col_phys = VacuumColumn()
        
        # Первоначальный стейт симулятора
        self.state = SimulatorState(
            timestamp=0.0,
            crude_feed=CrudeOilFeed(
                flow_rate=150.0,
                temperature=20.0,
                density=860.0,
                salt_content=50.0,
                water_content=0.5,
                sulfur_content=1.5
            ),
            desalter=DesalterState(
                stage1_voltage=22.0,
                stage2_voltage=33.0,
                outlet_salt_content=3.0,
                outlet_water_content=0.1,
                demulsifier_flow=5.0,
                wash_water_ratio=7.0,
                temperature=130.0,
                efficiency=0.94
            ),
            pumps=[
                PumpState(id="H-1", flow_rate=150.0, head=120.0, power=400.0, wear_factor=0.05, cavitation_risk=0.0, is_running=True),
                PumpState(id="H-2", flow_rate=150.0, head=130.0, power=315.0, wear_factor=0.02, cavitation_risk=0.0, is_running=True),
                PumpState(id="H-4", flow_rate=80.0, head=90.0, power=315.0, wear_factor=0.01, cavitation_risk=0.0, is_running=True),
                PumpState(id="H-6", flow_rate=80.0, head=110.0, power=110.0, wear_factor=0.03, cavitation_risk=0.0, is_running=True)
            ],
            heat_exchangers=[
                HeatExchangerState(id="T-1/1", duty=2500.0, lmtd=45.0, area=400.0, u_value=300.0, fouling_factor=0.01, hot_in=200.0, hot_out=150.0, cold_in=20.0, cold_out=50.0),
                HeatExchangerState(id="T-4/1", duty=3000.0, lmtd=50.0, area=400.0, u_value=290.0, fouling_factor=0.015, hot_in=250.0, hot_out=180.0, cold_in=50.0, cold_out=85.0),
                HeatExchangerState(id="T-17", duty=1500.0, lmtd=35.0, area=250.0, u_value=280.0, fouling_factor=0.02, hot_in=180.0, hot_out=140.0, cold_in=85.0, cold_out=110.0)
            ],
            furnace=FurnaceState(
                outlet_temperature=360.0,
                fuel_gas_flow=500.0,
                efficiency=0.88,
                excess_air=1.15,
                flue_gas_temp=280.0,
                tube_skin_temp=420.0,
                coking_factor=0.01,
                duty=5000.0
            ),
            atm_column=AtmosphericColumnState(
                feed_temperature=360.0,
                top_temperature=120.0,
                bottom_temperature=280.0,
                top_pressure=0.12,
                reflux_ratio=2.5,
                reflux_flow=80.0,
                flooding_risk=0.05,
                pressure_drop=0.02,
                gasoline_flow=25.0,
                kerosene_flow=15.0,
                diesel_flow=30.0,
                mazut_flow=80.0
            ),
            vac_column=VacuumColumnState(
                feed_temperature=390.0,
                top_pressure=0.008,
                bottom_temperature=360.0,
                residual_pressure=0.008,
                vacuum_system_load=0.5,
                flooding_risk=0.01,
                vgo_light_flow=20.0,
                vgo_heavy_flow=15.0,
                tar_flow=40.0
            ),
            valves=[
                ValveState(id="crude_feed_valve", position="OPEN", opening_percent=100.0),
                ValveState(id="fuel_gas_valve", position="OPEN", opening_percent=100.0)
            ],
            operator_ppe=OperatorPPE(has_helmet=True, has_goggles=True, has_gas_mask_bkf=False, has_fire_suit=True)
        )
        
        # Динамические кастомные поля для SCADA и LIMS
        setattr(self.state.desalter, "phase_level_mm", 4000.0)
        setattr(self.state.atm_column, "e1_water_level_pct", 50.0)
        setattr(self.state.atm_column, "gasoline_t_end", 185.0)
        setattr(self.state.atm_column, "kerosene_viscosity", 1.30)
        setattr(self.state.atm_column, "mazut_viscosity", 6.8)

    def step(self, dt: float = 0.1) -> SimulatorState:
        """
        Основной шаг симуляции (вызывается на частоте 10 Гц).
        """
        self.state.timestamp = time.time() - self.start_time
        
        # 1. Считываем состояния клапанов
        feed_valve = next(v for v in self.state.valves if v.id == "crude_feed_valve")
        fuel_valve = next(v for v in self.state.valves if v.id == "fuel_gas_valve")
        
        # 2. Моделируем динамику сырья на входе
        # Расход зависит от задвижки сырья и работы насоса H-1
        h1_pump = next(p for p in self.state.pumps if p.id == "H-1")
        if h1_pump.is_running:
            self.state.crude_feed.flow_rate = 150.0 * (feed_valve.opening_percent / 100.0)
        else:
            self.state.crude_feed.flow_rate = 0.0
            
        # Плотность зависит от температуры по формуле Менделеева
        self.state.crude_feed.density = oil_density_at_temp(860.0, self.state.crude_feed.temperature)
        
        # 3. Моделируем теплообменную сеть (Т-1/1 -> ЭЛОУ -> Т-17 -> Печь)
        # T-1/1 нагревает нефть перед ЭЛОУ горячим потоком фракции 140-240°С
        q1, t_hot1, t_cold1, u1, lmtd1 = heat_exchanger_step(
            "T-1/1",
            t_hot_in=200.0, m_hot=100.0, cp_hot=2.3,
            t_cold_in=self.state.crude_feed.temperature, m_cold=self.state.crude_feed.flow_rate, cp_cold=2.0,
            fouling_factor=self.state.heat_exchangers[0].fouling_factor
        )
        self.state.heat_exchangers[0].duty = q1
        self.state.heat_exchangers[0].lmtd = lmtd1
        self.state.heat_exchangers[0].cold_out = t_cold1
        
        # Температура в ЭЛОУ определяется выходом первого теплообменника
        self.state.desalter.temperature = t_cold1
        
        # 4. Блок ЭЛОУ обессоливания
        # КПД зависит от напряжения, температуры, деэмульгатора
        eff1 = desalter_efficiency(
            self.state.desalter.stage1_voltage, self.state.desalter.temperature,
            self.state.desalter.wash_water_ratio, self.state.desalter.demulsifier_flow,
            self.state.crude_feed.salt_content
        )
        eff2 = desalter_efficiency(
            self.state.desalter.stage2_voltage, self.state.desalter.temperature,
            self.state.desalter.wash_water_ratio, self.state.desalter.demulsifier_flow,
            self.state.crude_feed.salt_content
        )
        self.state.desalter.efficiency = (eff1 + eff2) / 2.0
        
        self.state.desalter.outlet_salt_content = calculate_outlet_salt(
            self.state.crude_feed.salt_content, eff1, eff2
        )
        self.state.desalter.outlet_water_content = calculate_outlet_water(
            self.state.crude_feed.water_content, eff1, eff2
        )
        
        # Динамика раздела фаз в дегидраторах (условно падает при высоком расходе воды)
        phase_level = getattr(self.state.desalter, "phase_level_mm", 4000.0)
        phase_level += (4000.0 - phase_level) * 0.1 * dt
        if self.state.desalter.wash_water_ratio > 9.0:
            phase_level -= 50.0 * dt  # Риск падения уровня и КЗ
        setattr(self.state.desalter, "phase_level_mm", max(0.0, phase_level))
        
        # T-17 нагревает обессоленную нефть перед печью
        q3, t_hot3, t_cold3, u3, lmtd3 = heat_exchanger_step(
            "T-17",
            t_hot_in=240.0, m_hot=90.0, cp_hot=2.4,
            t_cold_in=t_cold1, m_cold=self.state.crude_feed.flow_rate, cp_cold=2.1,
            fouling_factor=self.state.heat_exchangers[2].fouling_factor
        )
        self.state.heat_exchangers[2].duty = q3
        self.state.heat_exchangers[2].cold_out = t_cold3
        
        # 5. Печь П-1
        # Расход газа зависит от заслонки топливного газа
        self.state.furnace.fuel_gas_flow = 500.0 * (fuel_valve.opening_percent / 100.0)
        
        # Расчет КПД и нагрузки печи
        self.state.furnace.efficiency = furnace_efficiency(
            self.state.furnace.flue_gas_temp, self.state.furnace.excess_air
        )
        # Тепловая нагрузка
        self.state.furnace.duty = (self.state.furnace.fuel_gas_flow * 35000.0 * self.state.furnace.efficiency) / 3600.0
        
        # Рост температуры на выходе зависит от тепловой нагрузки и расхода нефти
        flow_factor = (self.state.crude_feed.flow_rate / 150.0) if self.state.crude_feed.flow_rate > 1.0 else 0.01
        target_outlet_temp = t_cold3 + (self.state.furnace.duty / (flow_factor * 100.0))
        self.state.furnace.outlet_temperature += (target_outlet_temp - self.state.furnace.outlet_temperature) * 0.05 * dt
        
        # Температура стенки труб и закоксованность
        self.state.furnace.tube_skin_temp = tube_skin_temperature(
            self.state.furnace.outlet_temperature, self.state.furnace.duty * 10.0, self.state.furnace.coking_factor
        )
        self.state.furnace.coking_factor = coking_rate(
            self.state.furnace.tube_skin_temp, dt, self.state.furnace.coking_factor
        )
        
        # Расчет вредных выбросов в печи П-1
        em_dict = calculate_emissions(
            self.state.furnace.fuel_gas_flow,
            self.state.furnace.excess_air,
            self.state.crude_feed.sulfur_content
        )
        self.state.furnace.emissions.co_mg_m3 = em_dict["co_mg_m3"]
        self.state.furnace.emissions.no2_mg_m3 = em_dict["no2_mg_m3"]
        self.state.furnace.emissions.so2_mg_m3 = em_dict["so2_mg_m3"]
        self.state.furnace.emissions.is_violating = em_dict["is_violating"]
        
        # 6. Атмосферная колонна К-1 (шаг RK4)
        self.state.atm_column.feed_temperature = self.state.furnace.outlet_temperature
        
        self.atm_col_phys.step(
            dt=dt,
            feed_rate=self.state.crude_feed.flow_rate,
            feed_temp=self.state.atm_column.feed_temperature,
            feed_comp=None,
            reflux_rate=self.state.atm_column.reflux_flow,
            reflux_temp=self.state.atm_column.top_temperature - 20.0,
            steam_flow=1000.0 # условная подача водяного пара
        )
        
        # Синхронизация физического стейта колонны К-1 с Pydantic схемой
        self.state.atm_column.bottom_temperature = self.atm_col_phys.temperatures[0]
        self.state.atm_column.top_temperature = self.atm_col_phys.temperatures[-1]
        
        # Запись лабораторных свойств LIMS
        specs = self.atm_col_phys.get_product_specs()
        setattr(self.state.atm_column, "gasoline_t_end", specs["gasoline_t_end"])
        setattr(self.state.atm_column, "kerosene_viscosity", specs["kerosene_viscosity"])
        setattr(self.state.atm_column, "mazut_viscosity", specs["mazut_viscosity"])
        
        # Уровень в Е-1 падает при отключенных насосах орошения
        e1_level = getattr(self.state.atm_column, "e1_water_level_pct", 50.0)
        h6_pump = next(p for p in self.state.pumps if p.id == "H-6")
        if h6_pump.is_running:
            e1_level += (50.0 - e1_level) * 0.1 * dt
        else:
            e1_level -= 4.0 * dt  # вода падает
        setattr(self.state.atm_column, "e1_water_level_pct", max(0.0, e1_level))

        # 7. Вакуумная колонна К-2 (шаг RK4)
        # Питание К-2 - это мазут с низа К-1
        self.state.vac_column.feed_temperature = self.state.atm_column.bottom_temperature + 30.0 # нагрев в печи перед К-2
        
        self.vac_col_phys.step(
            dt=dt,
            feed_rate=self.state.atm_column.mazut_flow,
            feed_temp=self.state.vac_column.feed_temperature,
            reflux_rate=self.state.vac_column.vgo_light_flow * 0.2,
            steam_flow=800.0,
            ejector_steam_flow=4000.0 # Пар на эжекторы вакуум-системы
        )
        
        # Синхронизация физического стейта К-2
        k2_data = self.vac_col_phys.get_column_state()
        self.state.vac_column.top_pressure = k2_data["top_pressure"]
        self.state.vac_column.bottom_temperature = k2_data["bottom_temperature"]
        self.state.vac_column.vacuum_system_load = k2_data["vacuum_system_load"]
        self.state.vac_column.flooding_risk = k2_data["flooding_risk"]
        self.state.vac_column.tar_flow = k2_data["tar_level_m3"]
        
        # 8. Проверка ПАЗ (противоаварийная защита)
        self.state.interlocks = self.paz.evaluate_and_trip(self.state)
        
        # 9. Расчет параметров насосов (напоры и кавитация)
        for pump in self.state.pumps:
            if pump.is_running:
                pump.head = calculate_pump_head(pump.flow_rate, 130.0, pump.wear_factor)
                # Риск кавитации растет при высокой температуре на всасе
                pump.cavitation_risk = check_cavitation(pump.flow_rate, 1.5, 2.0)
            else:
                pump.head = 0.0
                pump.flow_rate = 0.0

        # Сохранение снимка состояния в историю (10 Гц)
        self.history_buffer.append(copy.deepcopy(self.state))
        return self.state

    def rewind(self, seconds_back: float = 15.0) -> SimulatorState:
        """
        Функция перемотки состояния назад во времени (Time-Travel Replay ISA-108).
        """
        steps_back = int(seconds_back * 10)  # 10 Гц
        if not self.history_buffer:
            return self.state

        idx = max(0, len(self.history_buffer) - steps_back - 1)
        target_snapshot = self.history_buffer[idx]
        self.state = copy.deepcopy(target_snapshot)
        print(f"[TIME-TRAVEL] Симуляция перемотана на {seconds_back} сек назад к timestamp {self.state.timestamp:.1f}s.")
        return self.state
