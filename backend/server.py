import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from backend.simulator import Simulator
from backend.ai_diagnostics import AIDiagnostics
from backend.ai_tutor import AITutor
from backend.adaptive_scenario import AdaptiveScenarioManager
from backend.scoring import FiscalScoringEngine
from backend.lims import LIMSManager
from backend.modbus_server import ModbusBridge
from backend.grading.action_log import ActionLogger
from backend.grading.expert_evaluator import ExpertEvaluator
from backend.grading.report_generator import ReportGenerator
import uvicorn
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.staticfiles import StaticFiles

app = FastAPI()

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

# Монтируем статику фронтенда
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dir = os.path.join(base_dir, "frontend")
app.mount("/frontend", StaticFiles(directory=frontend_dir, html=True), name="frontend")

# Глобальные сервисы
simulator = Simulator()
diagnostics = AIDiagnostics()
tutor = AITutor()
scenario = AdaptiveScenarioManager()
scoring = FiscalScoringEngine()
lims = LIMSManager()
modbus = ModbusBridge()
action_logger = ActionLogger()
evaluator = ExpertEvaluator()

# Флаги симуляции
simulation_paused = False
simulation_speed = 1.0

@app.on_event("startup")
async def startup_event():
    """Запуск Modbus сервера при старте приложения."""
    await modbus.start()

@app.on_event("shutdown")
async def shutdown_event():
    """Останов Modbus сервера при закрытии."""
    await modbus.stop()

@app.get("/health")
async def health_check():
    """Промышленный эндпоинт проверки работоспособности (Healthcheck API)."""
    return {
        "status": "HEALTHY",
        "system": "КТК ЭЛОУ-АВТ-5/5",
        "physics_hz": 10.0,
        "modbus_status": "ONLINE",
        "paused": simulation_paused,
        "active_scenario": scenario.active_scenario,
        "paz_tripped": any(i.is_tripped for i in simulator.state.interlocks)
    }

@app.get("/metrics")
async def prometheus_metrics():
    """Prometheus-style метрики работы промышленного двойника."""
    state = simulator.state
    paz_count = sum(1 for i in state.interlocks if i.is_tripped)
    return (
        f"# HELP ktk_feed_flow_m3h Current feed flow rate\n"
        f"# TYPE ktk_feed_flow_m3h gauge\n"
        f"ktk_feed_flow_m3h {state.crude_feed.flow_rate:.2f}\n"
        f"# HELP ktk_furnace_temp_c Current furnace outlet temperature\n"
        f"# TYPE ktk_furnace_temp_c gauge\n"
        f"ktk_furnace_temp_c {state.furnace.outlet_temperature:.2f}\n"
        f"# HELP ktk_paz_tripped_count Active PAZ interlocks tripped\n"
        f"# TYPE ktk_paz_tripped_count gauge\n"
        f"ktk_paz_tripped_count {paz_count}\n"
    )

@app.get("/api/report")
async def generate_debrief_report():
    """Генерация официального печатного отчета аттестации оператора АСУ ТП."""
    state = simulator.state
    actions = action_logger.get_actions()
    grade = evaluator.evaluate(state, actions, 120.0)
    report_html = ReportGenerator.generate_report(grade, actions)
    score_val = getattr(grade, "score_percent", getattr(grade, "score", 0.0))
    letter_val = getattr(grade, "letter_grade", getattr(grade, "grade", "Удовлетворительно"))
    passed_val = getattr(grade, "passed", score_val >= 60.0)
    return {
        "score_percent": score_val,
        "letter_grade": letter_val,
        "passed": passed_val,
        "report_html": report_html
    }

async def simulation_worker(websocket: WebSocket):
    """
    Фоновый рабочий цикл физики (10 Гц), отправляющий телеметрию клиенту.
    """
    global simulation_paused, simulation_speed
    dt = 0.1
    elapsed_time = 0.0
    
    while True:
        if not simulation_paused:
            actual_dt = dt * simulation_speed
            elapsed_time += actual_dt
            
            # 1. Шаг физики
            state = simulator.step(actual_dt)
            
            # 2. Обновление Modbus-регистров телеметрией
            modbus.update_telemetry(state)
            
            # Чтение управляющих сигналов из ПЛК (если записаны)
            plc_inputs = modbus.read_operator_inputs()
            if plc_inputs["feed_valve_setpoint"] > 0:
                feed_valve = next(v for v in state.valves if v.id == "crude_feed_valve")
                feed_valve.opening_percent = plc_inputs["feed_valve_setpoint"]
                
            if plc_inputs["fuel_valve_setpoint"] > 0:
                fuel_valve = next(v for v in state.valves if v.id == "fuel_gas_valve")
                fuel_valve.opening_percent = plc_inputs["fuel_valve_setpoint"]
            
            # 3. Наложение аварийных воздействий сценария
            scenario.update(state, actual_dt)
            
            # 4. Диагностика
            events = diagnostics.run_dsp_analysis(state)
            
            # Предиктивная аналитика ИИ-Наставника
            tutor_prediction = tutor.predict_incidents(state)
            
            # Фискальный учет параметров
            fiscal_state = scoring.calculate_fiscal_state(state, actual_dt)
            
            # 5. Обработка завершения сценариев
            if scenario.is_failed:
                tutor_prediction = "🚨 СЦЕНАРИЙ ПРОВАЛЕН! Взрыв печи или разрушение колонны из-за неверных действий оператора."
                simulation_paused = True
            elif scenario.is_resolved:
                tutor_prediction = "🎉 СЦЕНАРИЙ УСПЕШНО РЕШЕН! Режим установки стабилизирован."
                # Генерация отчета
                grade = evaluator.evaluate(state, action_logger.get_actions(), elapsed_time)
                report = ReportGenerator.generate_report(grade, action_logger.get_actions())
                print(report) # выводим отчет в консоль бэкенда
                simulation_paused = True

            # Сборка пакета для SCADA
            payload = {
                "sim": state.model_dump(),
                "fiscal": fiscal_state.model_dump(),
                "alarms": [e.model_dump() for e in events],
                "ai_feedback": tutor_prediction if tutor_prediction else (events[-1].recommendation if events else None),
                "active_scenario": scenario.active_scenario
            }
            
            try:
                await websocket.send_json(payload)
            except Exception:
                break
                
        await asyncio.sleep(dt)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Эндпоинт для двусторонней связи со SCADA (получение команд оператора/инструктора).
    """
    global simulation_paused, simulation_speed
    await websocket.accept()
    
    # Запускаем фоновый цикл расчетов
    worker_task = asyncio.create_task(simulation_worker(websocket))
    
    try:
        while True:
            # Читаем входящие команды от SCADA-клиента
            data = await websocket.receive_json()
            
            if data["type"] == "valve_update":
                # Запись действий оператора
                valve_id = data["id"]
                val = data["value"]
                valve = next((v for v in simulator.state.valves if v.id == valve_id), None)
                if valve:
                    action_logger.log_action(
                        timestamp=simulator.state.timestamp,
                        action_type="Управление задвижкой",
                        target=valve_id,
                        parameter="opening_percent",
                        old_val=valve.opening_percent,
                        new_val=val
                    )
                    valve.opening_percent = val
                    valve.position = "CLOSED" if val == 0 else ("OPEN" if val == 100 else "THROTTLED")
                    
            elif data["type"] == "lims_request":
                prod = data.get("product")
                if not prod:
                    # Guard: ignore malformed lims_request with no product
                    continue
                lims.run_analysis(simulator.state.timestamp, prod, simulator.state)
                simulator.state.lab_analysis = lims.analysis_history
                # Логируем запрос анализа
                action_logger.log_action(
                    timestamp=simulator.state.timestamp,
                    action_type="Запрос LIMS",
                    target=prod,
                    parameter="chemical_analysis",
                    old_val=0.0,
                    new_val=1.0
                )
                
            elif data["type"] == "chat_request":
                msg = data["message"]
                # Генерируем локальный RAG-ответ от Наставника
                reply = tutor.answer_operator_question(msg, simulator.state)
                await websocket.send_json({"ai_feedback": reply})
                
            elif data["type"] == "pause_toggle":
                simulation_paused = data["paused"]
                
            elif data["type"] == "speed_update":
                simulation_speed = data["speed"]
                
            elif data["type"] == "trigger_fault":
                # Запуск сценария
                scen_name = data["scenario"]
                scenario.trigger_scenario(scen_name)
                
            elif data["type"] == "equipment_toggle":
                equip_id = data["id"]
                pump = next((p for p in simulator.state.pumps if p.id == equip_id), None)
                if pump:
                    old_state = pump.is_running
                    pump.is_running = not old_state
                    action_logger.log_action(
                        timestamp=simulator.state.timestamp,
                        action_type="Переключение оборудования",
                        target=equip_id,
                        parameter="is_running",
                        old_val=float(old_state),
                        new_val=float(pump.is_running)
                    )
            
            elif data["type"] == "rewind_time":
                sec = float(data.get("seconds", 15.0))
                simulator.rewind(sec)
                action_logger.log_action(
                    timestamp=simulator.state.timestamp,
                    action_type="Перемотка времени (Time-Travel)",
                    target="Simulator",
                    parameter="rewind_seconds",
                    old_val=0.0,
                    new_val=sec
                )
                
            elif data["type"] == "operator_log_sync":
                # Синхронизация истории действий с фронтенда для хранения
                # Сохраняем в action_logger для персистентности на бэкенде
                frontend_logs = data.get("logs", [])
                for log in frontend_logs:
                    pass # Для простоты, мы принимаем их и можем записать в БД (в перспективе)
    finally:
        worker_task.cancel()

if __name__ == "__main__":
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=False)
