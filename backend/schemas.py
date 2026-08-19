"""
Pydantic schemas for the full AVT-5/5 Computer Training Complex.
Covers: crude oil feed, ELOU desalter, heat train, furnace,
atmospheric column K-1, vacuum column K-2, pumps, and operator actions.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────
class SeverityLevel(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    EMERGENCY = "EMERGENCY"

class AlarmState(str, Enum):
    NORMAL = "NORMAL"
    LOW = "LOW"
    HIGH = "HIGH"
    LOW_LOW = "LOW_LOW"
    HIGH_HIGH = "HIGH_HIGH"

class ValvePosition(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    THROTTLED = "THROTTLED"

class ScenarioStatus(str, Enum):
    IDLE = "IDLE"
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    FAILED = "FAILED"

class LabAnalysisResult(BaseModel):
    timestamp: float
    product_name: str
    property_name: str
    measured_value: float
    target_value: float
    is_spec: bool

class FurnaceEmissions(BaseModel):
    co_mg_m3: float = Field(default=0.0)
    no2_mg_m3: float = Field(default=0.0)
    so2_mg_m3: float = Field(default=0.0)
    is_violating: bool = Field(default=False)

class InterlockState(BaseModel):
    id: str
    description: str
    condition_met: bool = Field(default=False)
    is_tripped: bool = Field(default=False)

class OperatorPPE(BaseModel):
    has_helmet: bool = Field(default=False)
    has_goggles: bool = Field(default=False)
    has_gas_mask_bkf: bool = Field(default=False)
    has_fire_suit: bool = Field(default=False)


# ─── Process Equipment States ────────────────────────────────────────
class CrudeOilFeed(BaseModel):
    """Модель сырой нефти на входе ЭЛОУ."""
    flow_rate: float = Field(default=150.0, description="Расход сырья, м3/ч")
    temperature: float = Field(default=120.0, description="Температура, °C")
    density: float = Field(default=860.0, description="Плотность при 20°C, кг/м3")
    salt_content: float = Field(default=50.0, description="Содержание солей, мг/л")
    water_content: float = Field(default=0.5, description="Содержание воды, % масс.")
    sulfur_content: float = Field(default=1.5, description="Содержание серы, % масс.")

class DesalterState(BaseModel):
    """ЭЛОУ — электродегидратор (1-я и 2-я ступени)."""
    id: str = "ELOU"
    stage1_voltage: float = Field(default=22.0, description="Напряжение 1-й ступени, кВ")
    stage2_voltage: float = Field(default=33.0, description="Напряжение 2-й ступени, кВ")
    outlet_salt_content: float = Field(default=3.0, description="Остаточные соли, мг/л")
    outlet_water_content: float = Field(default=0.1, description="Остаточная вода, %")
    demulsifier_flow: float = Field(default=5.0, description="Расход деэмульгатора, г/т")
    wash_water_ratio: float = Field(default=7.0, description="Расход промывной воды, % на сырьё")
    temperature: float = Field(default=130.0, description="Температура в дегидраторе, °C")
    efficiency: float = Field(default=0.94, ge=0.0, le=1.0, description="КПД обессоливания")
    phase_level_mm: float = Field(default=4000.0, description="Уровень раздела фаз нефть-вода, мм")

class PumpState(BaseModel):
    id: str
    flow_rate: float = Field(default=0.0, description="Расход (Q), м3/ч")
    head: float = Field(default=0.0, description="Напор (H), м")
    power: float = Field(default=0.0, description="Потребляемая мощность, кВт")
    wear_factor: float = Field(default=0.0, ge=0.0, le=1.0)
    cavitation_risk: float = Field(default=0.0, ge=0.0, le=1.0)
    is_running: bool = Field(default=True)
    is_standby: bool = Field(default=False)

class HeatExchangerState(BaseModel):
    id: str
    duty: float = Field(default=0.0, description="Тепловая нагрузка, кВт")
    lmtd: float = Field(default=0.0, description="Среднелогарифмический температурный напор, °C")
    area: float = Field(default=400.0, description="Площадь теплообмена, м2 (Таблица 18)")
    u_value: float = Field(default=300.0, description="Коэффициент теплопередачи, Вт/(м2*K)")
    fouling_factor: float = Field(default=0.0, ge=0.0)
    hot_in: float = Field(default=0.0, description="Вход горячего потока, °C")
    hot_out: float = Field(default=0.0, description="Выход горячего потока, °C")
    cold_in: float = Field(default=0.0, description="Вход холодного потока, °C")
    cold_out: float = Field(default=0.0, description="Выход холодного потока, °C")
    alarm: AlarmState = AlarmState.NORMAL

class FurnaceState(BaseModel):
    """Трубчатая печь П-1."""
    id: str = "P-1"
    outlet_temperature: float = Field(default=360.0, description="Температура на выходе, °C")
    fuel_gas_flow: float = Field(default=500.0, description="Расход топливного газа, нм3/ч")
    efficiency: float = Field(default=0.88, ge=0.0, le=1.0, description="КПД печи")
    excess_air: float = Field(default=1.15, description="Коэффициент избытка воздуха")
    flue_gas_temp: float = Field(default=280.0, description="Температура дымовых газов, °C")
    tube_skin_temp: float = Field(default=420.0, description="Температура стенки труб, °C")
    max_tube_skin_temp: float = Field(default=500.0, description="Максимально допустимая, °C")
    coking_factor: float = Field(default=0.0, ge=0.0, le=1.0, description="Степень закоксованности")
    duty: float = Field(default=0.0, description="Тепловая нагрузка, кВт")
    emissions: FurnaceEmissions = Field(default_factory=FurnaceEmissions)

class ColumnTrayData(BaseModel):
    tray_number: int
    temperature: float
    pressure: float
    liquid_flow: float
    vapor_flow: float

class AtmosphericColumnState(BaseModel):
    """Атмосферная колонна К-1."""
    id: str = "K-1"
    feed_temperature: float = Field(default=360.0, description="Температура питания, °C")
    top_temperature: float = Field(default=120.0, description="Температура верха, °C")
    bottom_temperature: float = Field(default=350.0, description="Температура куба, °C")
    top_pressure: float = Field(default=0.12, description="Давление верха, МПа")
    reflux_ratio: float = Field(default=2.5, ge=0.0)
    reflux_flow: float = Field(default=80.0, description="Расход орошения, м3/ч")
    flooding_risk: float = Field(default=0.0, ge=0.0, le=1.0)
    pressure_drop: float = Field(default=0.02, ge=0.0, description="Перепад давления, МПа")
    # Product streams
    gasoline_flow: float = Field(default=25.0, description="Выход бензина, м3/ч")
    kerosene_flow: float = Field(default=15.0, description="Выход керосина, м3/ч")
    diesel_flow: float = Field(default=30.0, description="Выход ДТ, м3/ч")
    mazut_flow: float = Field(default=80.0, description="Выход мазута, м3/ч")
    e1_water_level_pct: float = Field(default=50.0, description="Уровень воды в Е-1, %")
    gasoline_t_end: float = Field(default=185.0, description="Конец перегонки бензина, °С")
    kerosene_viscosity: float = Field(default=1.30, description="Вязкость керосина при 20°С, сСт")
    mazut_viscosity: float = Field(default=6.8, description="Вязкость мазута при 100°С, ВУ")

class VacuumColumnState(BaseModel):
    """Вакуумная колонна К-2."""
    id: str = "K-2"
    feed_temperature: float = Field(default=390.0, description="Температура питания, °C")
    top_pressure: float = Field(default=0.008, description="Давление верха, МПа (вакуум)")
    bottom_temperature: float = Field(default=360.0, description="Температура куба, °C")
    residual_pressure: float = Field(default=0.008, description="Остаточное давление, МПа")
    vacuum_system_load: float = Field(default=0.7, ge=0.0, le=1.0)
    flooding_risk: float = Field(default=0.0, ge=0.0, le=1.0)
    # Vacuum products
    vgo_light_flow: float = Field(default=20.0, description="Лёгкий ВГО, м3/ч")
    vgo_heavy_flow: float = Field(default=15.0, description="Тяжёлый ВГО, м3/ч")
    tar_flow: float = Field(default=40.0, description="Гудрон, м3/ч")

class ValveState(BaseModel):
    id: str
    position: ValvePosition = ValvePosition.OPEN
    opening_percent: float = Field(default=100.0, ge=0.0, le=100.0)
    is_manual: bool = Field(default=False)


# ─── Full Simulator State ────────────────────────────────────────────
class SimulatorState(BaseModel):
    timestamp: float
    crude_feed: CrudeOilFeed = Field(default_factory=CrudeOilFeed)
    desalter: DesalterState = Field(default_factory=DesalterState)
    pumps: List[PumpState] = Field(default_factory=list)
    heat_exchangers: List[HeatExchangerState] = Field(default_factory=list)
    furnace: FurnaceState = Field(default_factory=FurnaceState)
    atm_column: AtmosphericColumnState = Field(default_factory=AtmosphericColumnState)
    vac_column: VacuumColumnState = Field(default_factory=VacuumColumnState)
    valves: List[ValveState] = Field(default_factory=list)
    lab_analysis: List[LabAnalysisResult] = Field(default_factory=list)
    interlocks: List[InterlockState] = Field(default_factory=list)
    operator_ppe: OperatorPPE = Field(default_factory=OperatorPPE)


# ─── Diagnostic & AI Events ─────────────────────────────────────────
class DiagnosticEvent(BaseModel):
    timestamp: float
    equipment_id: str
    anomaly_type: str
    severity: SeverityLevel
    cause: str
    recommendation: str
    cascade_risk: Optional[str] = None

class AlarmEvent(BaseModel):
    timestamp: float
    tag: str
    equipment_id: str
    description: str
    severity: SeverityLevel
    value: float
    limit: float
    acknowledged: bool = False


# ─── Operator Action Tracking ────────────────────────────────────────
class OperatorAction(BaseModel):
    timestamp: float
    action_type: str
    target_equipment: str
    parameter: str
    old_value: float
    new_value: float

class ScenarioDefinition(BaseModel):
    id: str
    name_ru: str
    name_en: str
    description: str
    difficulty: int = Field(ge=1, le=5)
    expected_actions: List[str]
    max_response_time_s: float
    cascade_effects: List[str] = Field(default_factory=list)


# ─── Fiscal / Scoring ────────────────────────────────────────────────
class FiscalState(BaseModel):
    operator_cost_string: str = Field(..., description="Краткая строка затрат для SCADA")
    downtime_cost: float = Field(..., description="Стоимость простоя при 3.5M руб/ч")
    lost_met_subsidy: float = Field(..., description="Потерянные субсидии НДПИ")
    flaring_cost: float = Field(default=0.0, description="Потери от факельного сжигания")
    startup_energy_cost: float = Field(default=0.0, description="Затраты на пусковую энергию")
    repair_cost: float = Field(default=0.0, description="Стоимость ремонта")
    corporate_tax_shield: float = Field(default=0.0, description="Налоговый щит")
    total_cost_of_ownership: float = Field(default=0.0)

class OperatorGrade(BaseModel):
    scenario_id: str
    reaction_time_s: float
    actions_correct: int
    actions_total: int
    accuracy_percent: float
    economic_loss: float
    score: float = Field(ge=0.0, le=100.0)
    grade: str  # "Отлично", "Хорошо", "Удовлетворительно", "Неудовлетворительно"

    @property
    def score_percent(self) -> float:
        return self.score

    @property
    def letter_grade(self) -> str:
        return self.grade

    @property
    def passed(self) -> bool:
        return self.score >= 60.0


# ─── WebSocket Payload ───────────────────────────────────────────────
class WSPayload(BaseModel):
    sim: SimulatorState
    fiscal: FiscalState
    alarms: List[AlarmEvent] = Field(default_factory=list)
    diagnostics: List[DiagnosticEvent] = Field(default_factory=list)
    ai_feedback: Optional[str] = None
    active_scenario: Optional[str] = None
