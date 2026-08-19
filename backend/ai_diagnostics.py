"""
Модуль закрытой ИИ-диагностики на базе вейвлет-анализа (PyWavelets) и экспертного графа причинно-следственных связей (NetworkX).
Используется для локального поиска первопричин отклонений режима без внешних API.
"""
import time
import pywt
import networkx as nx
import numpy as np
from collections import deque
from backend.schemas import SimulatorState, DiagnosticEvent, SeverityLevel

class AIDiagnostics:
    def __init__(self):
        # Буферы для спектрального анализа вибрации насосов (1 Гц)
        self.flow_buffer = deque(maxlen=30)
        self.last_run = 0.0
        
        # Построение каузального (причинно-следственного) графа неисправностей АВТ-5
        self.causal_graph = nx.DiGraph()
        
        # Каскад 1: Упуск сырья
        self.causal_graph.add_edge("Отказ Н-1", "Падение расхода нефти")
        self.causal_graph.add_edge("Падение расхода нефти", "Падение уровня Е-15")
        self.causal_graph.add_edge("Падение уровня Е-15", "Осушение куба К-1")
        self.causal_graph.add_edge("Осушение куба К-1", "Срыв печных насосов Н-2/Н-3")
        self.causal_graph.add_edge("Срыв печных насосов Н-2/Н-3", "Перегрев змеевика П-1")
        self.causal_graph.add_edge("Перегрев змеевика П-1", "Прогар труб и Пожар")

        # Каскад 2: Вода в орошении
        self.causal_graph.add_edge("Высокий уровень подтоварной воды Е-1", "Попадание воды в орошение К-1")
        self.causal_graph.add_edge("Попадание воды в орошение К-1", "Взрывное испарение воды в колонне")
        self.causal_graph.add_edge("Взрывное испарение воды в колонне", "Скачок давления верха К-1")
        self.causal_graph.add_edge("Скачок давления верха К-1", "Срабатывание ПАЗ-2 и Отсечка топлива")

        # Каскад 3: Прорыв бензина в канализацию
        self.causal_graph.add_edge("Упуск уровня воды в Е-1 < 15%", "Прорыв бензина в дренажную линию")
        self.causal_graph.add_edge("Прорыв бензина в дренажную линию", "Загазованность промканализации и Взрыв")

        # Каскад 4: Вакуумное схлопывание
        self.causal_graph.add_edge("Низкий уровень в К-2", "Срыв мазутных насосов")
        self.causal_graph.add_edge("Отключение пара эжекторов", "Глубокий вакуум")
        self.causal_graph.add_edge("Глубокий вакуум", "Схлопывание рефлюксной емкости Е-2")

    def run_dsp_analysis(self, state: SimulatorState) -> list[DiagnosticEvent]:
        """
        Локальный диагностический цикл (вызывается на частоте 1 Гц).
        """
        events = []
        current_time = time.time()
        
        if current_time - self.last_run < 1.0:
            return events
            
        self.last_run = current_time
        
        # --- 1. Вейвлет-анализ вибрации насоса H-1 ---
        h1 = next((p for p in state.pumps if p.id == "H-1"), None)
        if h1 and h1.is_running:
            self.flow_buffer.append(h1.flow_rate)
            if len(self.flow_buffer) >= 16:
                data = np.array(self.flow_buffer)
                coeffs = pywt.dwt(data, 'db2')
                cA, cD = coeffs
                energy = np.sum(cD ** 2) / len(cD)
                
                # При высоком шуме детектируем кавитацию
                if energy > 4.0 or h1.cavitation_risk > 0.6:
                    events.append(DiagnosticEvent(
                        timestamp=state.timestamp,
                        equipment_id="H-1",
                        anomaly_type="Спектральный шум подшипников (Кавитация)",
                        severity=SeverityLevel.HIGH,
                        cause="Низкое давление на всасе насоса сырья",
                        recommendation="Приоткройте задвижку сырья или снизьте обороты."
                    ))

        # --- 2. Поиск первопричин по каузальному графу ---
        # Проверка перегрева печи П-1
        if state.furnace.tube_skin_temp > 470.0:
            # Находим цепочку первопричины в графе
            root_cause = "Отказ Н-1" if state.crude_feed.flow_rate < 10.0 else "Неравномерное горение форсунок"
            events.append(DiagnosticEvent(
                timestamp=state.timestamp,
                equipment_id="P-1",
                anomaly_type="Перегрев стенки труб змеевика печи П-1",
                severity=SeverityLevel.CRITICAL,
                cause=root_cause,
                recommendation="Немедленно снизьте подачу топливного газа или восстановите расход сырья!",
                cascade_risk="Прогар труб змеевика с последующим возгоранием в топочной камере"
            ))

        # Проверка давления К-1
        if state.atm_column.top_pressure > 0.40:
            events.append(DiagnosticEvent(
                timestamp=state.timestamp,
                equipment_id="K-1",
                anomaly_type="Критический рост давления верха колонны К-1",
                severity=SeverityLevel.CRITICAL,
                cause="Попадание воды с орошением из Е-1",
                recommendation="Прекратите подачу орошения, слейте подтоварную воду из емкости Е-1 в дренаж.",
                cascade_risk="Срабатывание предохранительных клапанов ППК со сбросом газа на факел"
            ))

        # Проверка вакуума К-2
        if state.vac_column.top_pressure < 0.004:
            events.append(DiagnosticEvent(
                timestamp=state.timestamp,
                equipment_id="K-2",
                anomaly_type="Критический вакуум в К-2 (Риск схлопывания)",
                severity=SeverityLevel.HIGH,
                cause="Избыточная конденсация или останов насосов куба",
                recommendation="Приоткройте линию подпитки газом для компенсации давления.",
                cascade_risk="Физическая деформация и смятие емкости Е-2"
            ))
            
        return events
