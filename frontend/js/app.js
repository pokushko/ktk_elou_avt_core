// Основной файл SCADA системы
let latestState = null;
let lastRenderTime = 0;
const RENDER_THROTTLE_MS = 333; // ~3 Гц обновления UI

// Настройка графиков Chart.js
const ctx = document.getElementById('telemetryChart').getContext('2d');
const telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Т верха К-1 (°C)',
            borderColor: '#66fcf1',
            data: [],
            borderWidth: 1.5,
            tension: 0.1
        }, {
            label: 'Вакуум К-2 (МПа * 1000)',
            borderColor: '#a29bfe',
            data: [],
            borderWidth: 1.5,
            tension: 0.1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            x: { grid: { color: '#2c3e50' }, ticks: { display: false } },
            y: { grid: { color: '#2c3e50' }, ticks: { color: '#c5c6c7' } }
        },
        plugins: {
            legend: { labels: { color: '#c5c6c7', font: { size: 9 } } }
        }
    }
});

// WebSocket подключение
const wsUrl = window.location.host ? `ws://${window.location.host}/ws` : `ws://127.0.0.1:8000/ws`;
const ws = new WebSocket(wsUrl);
window.ws = ws;

ws.onopen = () => {
    console.log("WebSocket подключен к КТК Бэкенду.");
    const badge = document.querySelector('.status-badge');
    if (badge) {
        badge.textContent = 'АСУ ТП: ONLINE';
        badge.className = 'status-badge online';
    }
    addAlarmEvent("ИНФО", "Система", "Соединение с симулятором установлено.");
};

ws.onclose = () => {
    const badge = document.querySelector('.status-badge');
    if (badge) {
        badge.textContent = 'АСУ ТП: OFFLINE';
        badge.className = 'status-badge offline';
    }
    addAlarmEvent("КРИТ", "Система", "Потеряно соединение с симулятором!");
};

ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    const badge = document.querySelector('.status-badge');
    if (badge) {
        badge.textContent = 'АСУ ТП: ОШИБКА';
        badge.className = 'status-badge offline';
    }
};

ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.sim) {
        latestState = payload;
    }
    
    // Обновляем чат-бот Наставника, если пришел ответ
    if (payload.ai_feedback) {
        addCopilotMessage(payload.ai_feedback);
    }
};

// Слайдеры управления
const crudeSlider = document.getElementById('crude-feed-slider');
const fuelSlider = document.getElementById('fuel-gas-slider');

crudeSlider.addEventListener('input', function() {
    document.getElementById('crude-val').innerText = this.value;
    sendControlUpdate("crude_feed_valve", parseFloat(this.value));
});

fuelSlider.addEventListener('input', function() {
    document.getElementById('fuel-val').innerText = this.value;
    sendControlUpdate("fuel_gas_valve", parseFloat(this.value));
});

function sendControlUpdate(valveId, value) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "valve_update",
            id: valveId,
            value: value
        }));
    }
}

// Управление скоростью и паузой
let isPaused = false;
const pauseBtn = document.getElementById('pause-btn');
const speedSlider = document.getElementById('speed-slider');

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.innerText = isPaused ? "Продолжить" : "Пауза";
    pauseBtn.style.backgroundColor = isPaused ? "#2ecc71" : "#e74c3c";
    
    ws.send(JSON.stringify({
        type: "pause_toggle",
        paused: isPaused
    }));
});

speedSlider.addEventListener('input', function() {
    document.getElementById('speed-val').innerText = this.value;
    ws.send(JSON.stringify({
        type: "speed_update",
        speed: parseFloat(this.value)
    }));
});

// Интерактивность SVG-мнемосхемы
document.addEventListener("DOMContentLoaded", () => {
    const pumpH1 = document.getElementById('svg-pump-h1');
    const furnaceP1 = document.getElementById('svg-furnace-p1');

    if (pumpH1) {
        pumpH1.addEventListener('click', () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "equipment_toggle", id: "H-1" }));
                // Визуальный feedback до ответа сервера
                pumpH1.setAttribute('fill', pumpH1.getAttribute('fill') === '#1e272e' ? '#ff4c4c' : '#1e272e');
                
                if (window.OperatorTracker) {
                    window.OperatorTracker.logAction("equipment_toggle", "H-1", null);
                }
            }
        });
    }

    if (furnaceP1) {
        furnaceP1.addEventListener('click', () => {
            if (ws.readyState === WebSocket.OPEN) {
                // Имитация отсечки топлива кликом по печи
                sendControlUpdate("fuel_gas_valve", 0.0);
                document.getElementById('fuel-gas-slider').value = 0;
                document.getElementById('fuel-val').innerText = '0';
                
                if (window.OperatorTracker) {
                    window.OperatorTracker.logAction("valve_update", "fuel_gas_valve", 0.0);
                }
            }
        });
    }
    
    // Синхронизация логов с сервером каждые 5 секунд
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && window.OperatorTracker) {
            const report = window.OperatorTracker.getReport();
            ws.send(JSON.stringify({
                type: "operator_log_sync",
                logs: report.actionLog
            }));
        }
    }, 5000);
});

// Чат Копилота
const chatInput = document.getElementById('copilot-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('copilot-messages');

sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // Добавляем сообщение пользователя на экран
    const userDiv = document.createElement('div');
    userDiv.className = 'user-msg';
    userDiv.innerText = text;
    chatMessages.appendChild(userDiv);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Проверяем, активен ли аварийный сценарий — если да, даём контекстную помощь
    if (window.activeEmergencyState) {
        const scenarioAdvice = getScenarioAdvice(window.activeEmergencyState.type, text);
        setTimeout(() => { addCopilotMessage(scenarioAdvice); }, 600);
    } else {
        // Обычный режим — базовый ИИ-наставник
        const normalAdvice = getNormalAdvice(text);
        setTimeout(() => { addCopilotMessage(normalAdvice); }, 500);
        
        // Дополнительно отправляем на бэкенд если WS открыт
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "chat_request", message: text }));
        }
    }
}

/* ===== КОНТЕКСТНЫЕ СОВЕТЫ ИИ-НАСТАВНИКА ПО АВАРИЙНЫМ СЦЕНАРИЯМ ===== */
function getScenarioAdvice(scenarioType, question) {
    const q = question.toLowerCase();
    
    const advice = {
        overheat: {
            steps: [
                '1️⃣ НЕМЕДЛЕННО снизьте подачу топливного газа (задвижка П-1) до 20-25%. Это главная причина перегрева.',
                '2️⃣ Убедитесь, что подача сырья стабильна (≥ 100 м³/ч). Сырьё охлаждает змеевики печи.',
                '3️⃣ Контролируйте температуру на выходе печи — она должна снижаться к 360°C.',
                '4️⃣ Если температура не снижается за 30 сек — ПОЛНОСТЬЮ закройте газ (0%) и вызовите старшего оператора.'
            ],
            explanation: '🔬 Физика процесса: Перегрев печи П-1 выше 450°C ведёт к прогару змеевиков теплообменника, коксованию нефти внутри труб и риску взрыва паров. Змеевик рассчитан на макс. 420°C по проектной документации. При снижении подачи газа уменьшается теплоотдача от горелок, температура начинает падать с инерцией ~20 сек.',
            regulation: '📋 Регламент: Технологическая инструкция ТИ-001-2024, п. 5.3.2 — «При повышении температуры на выходе печи П-1 свыше 440°C оператор обязан снизить расход топливного газа до стабилизации параметра».'
        },
        vacuum_drop: {
            steps: [
                '1️⃣ Проверьте работу пароэжекторов вакуум-создающей системы (ВСС).',
                '2️⃣ Снизьте подачу топливного газа до 40-50% — уменьшите тепловую нагрузку на К-2.',
                '3️⃣ Снизьте подачу сырья до 60-70% — разгрузите вакуумную колонну.',
                '4️⃣ Контролируйте давление К-2 — оно должно вернуться к 0.015-0.025 МПа.'
            ],
            explanation: '🔬 Физика процесса: Вакуумная колонна К-2 работает при остаточном давлении 0.02 МПа (150 мм рт.ст.). При срыве вакуума испарение тяжёлых фракций прекращается, мазут уносится в дизельную фракцию, качество продукции падает. Кавитация в пароэжекторах вызвана недостатком рабочего пара.',
            regulation: '📋 Регламент: ТИ-001-2024, п. 6.2.1 — «При повышении давления К-2 свыше 0.04 МПа необходимо снизить нагрузку колонны».'
        },
        salt_breakthrough: {
            steps: [
                '1️⃣ Снизьте подачу сырья до 40-50% для стабилизации работы ЭЛОУ.',
                '2️⃣ Проверьте напряжение на электродегидраторах Э-101 (норма: 20-25 кВ).',
                '3️⃣ Увеличьте подачу промывочной воды в ЭЛОУ (норма: 5-7% от расхода нефти).',
                '4️⃣ Контролируйте солесодержание — оно должно снизиться ниже 5 мг/л.'
            ],
            explanation: '🔬 Физика процесса: Хлориды кальция и магния в сырой нефти при нагреве в печи гидролизуются до соляной кислоты (HCl). Эта кислота вызывает сильнейшую коррозию шлемовых труб и конденсаторов К-1. Электродегидратор создаёт электрическое поле 20-25 кВ, которое разрушает эмульсию «вода в нефти» и отделяет соли.',
            regulation: '📋 Регламент: ТИ-001-2024, п. 4.1.3 — «Солесодержание нефти после ЭЛОУ не более 3-5 мг/л».'
        },
        vibration_compaks: {
            steps: [
                '1️⃣ Система КОМПАКС автоматически отключила аварийный насос Н-1А.',
                '2️⃣ Убедитесь, что резервный насос Н-1Б запущен и подача сырья стабильна (≥ 80%).',
                '3️⃣ НЕ ПЫТАЙТЕСЬ перезапустить Н-1А — подшипник разрушен!',
                '4️⃣ Оформите заявку на ремонт и внесите запись в журнал дефектов.'
            ],
            explanation: '🔬 Физика процесса: Виброскорость > 11.2 мм/с (зона D по ISO 10816-3) означает разрушение тел качения подшипника. Осколки попадают в смазку и вызывают лавинное нарастание вибрации. Перезапуск насоса приведёт к заклиниванию вала и разгерметизации торцевого уплотнения — утечке нефти.',
            regulation: '📋 ГОСТ Р ИСО 10816-3:2002 — «Зона D: Вибрация опасна для оборудования. Немедленный останов.»'
        },
        k1_overpressure: {
            steps: [
                '1️⃣ Снизьте подачу топливного газа до ≤ 40% — уменьшите парообразование.',
                '2️⃣ Снизьте подачу сырья до ≤ 60% — разгрузите колонну.',
                '3️⃣ Откройте клапан сброса жирного газа на факел.',
                '4️⃣ Контролируйте давление — оно должно снизиться ниже 0.15 МПа.'
            ],
            explanation: '🔬 Физика процесса: Повышение давления в К-1 вызвано забивкой верхних тарелок или конденсатора. Паро-газовая смесь не может покинуть колонну, давление растёт. При превышении 0.4 МПа срабатывают предохранительные клапаны СППК с выбросом паров в атмосферу — ВЗРЫВООПАСНО!',
            regulation: '📋 Регламент: ТИ-001-2024, п. 5.1.4 — «Давление К-1 не более 0.15 МПа. При превышении 0.3 МПа — аварийный сброс на факел».'
        },
        gas_leak: {
            steps: [
                '1️⃣ НЕМЕДЛЕННО отсечь подачу сырья (задвижка Н-1 → 0%)!',
                '2️⃣ НЕМЕДЛЕННО отсечь подачу газа (задвижка П-1 → 0%)!',
                '3️⃣ НЕ ВКЛЮЧАТЬ электрооборудование — искра = взрыв!',
                '4️⃣ Включить систему аварийной вентиляции и орошения. Эвакуировать персонал из зоны 30м!'
            ],
            explanation: '🔬 Физика процесса: Бензиновые фракции (С5-С9) при температуре выше 40°C образуют взрывоопасную паровоздушную смесь (НКПР = 1.0%). Любая искра, включая статическое электричество, вызовет объёмный взрыв. Лафетные стволы распыляют воду для разбавления концентрации паров ниже НКПР.',
            regulation: '📋 ПМЛА (План мероприятий по локализации и ликвидации аварий), сценарий Г-3 — «Разгерметизация оборудования с выбросом горючих веществ».'
        },
        power_blackout: {
            steps: [
                '1️⃣ Снизьте подачу газа ≤ 20% — печь НЕЛЬЗЯ греть без подачи сырья!',
                '2️⃣ Дождитесь переключения АВР (автоматический ввод резерва) на секцию СШ-2.',
                '3️⃣ После восстановления питания — проверьте давление масла в подшипниках насосов.',
                '4️⃣ Запустите насосы в порядке: сначала Н-1Б (резерв), затем проверьте Н-1А.'
            ],
            explanation: '🔬 Физика процесса: При потере электропитания насосы останавливаются, подача сырья прекращается. Если печь П-1 продолжает работать без потока нефти через змеевики, остаточное тепло прогревает стоячую нефть внутри труб до коксования. Время до коксования — около 3-5 минут!',
            regulation: '📋 Инструкция по электроснабжению ИЭ-002-2024, п. 3.4 — «При посадке напряжения 6кВ — снизить нагрузку печей до минимума».'
        },
        esd_trip: {
            steps: [
                '1️⃣ Убедитесь, что все задвижки закрыты (сырьё = 0%, газ = 0%).',
                '2️⃣ Дождитесь разрешения от начальника смены на вывод из ESD.',
                '3️⃣ ПОСТЕПЕННО (!) подайте газ до 20-30% — прогрейте печь на малом огне.',
                '4️⃣ ПОСТЕПЕННО (!) подайте сырьё до 40-60% — не допускайте гидроудара.'
            ],
            explanation: '🔬 Физика процесса: Полный аварийный останов (ESD) — крайняя мера, при которой все подвижные среды отсекаются. Восстановление нужно вести постепенно, чтобы избежать термошока оборудования (перепад температур > 50°C/ч вызывает трещины в сварных швах) и гидроудара в трубопроводах.',
            regulation: '📋 Регламент ESD: ТИ-001-2024, Приложение Б — «Порядок вывода установки из аварийного останова».'
        }
    };

    const sc = advice[scenarioType];
    if (!sc) return 'Рекомендую проверить текущие параметры установки на мнемосхеме.';

    // Определяем, о чём спрашивает оператор
    const asksWhy = q.includes('почему') || q.includes('причин') || q.includes('зачем') || q.includes('физик');
    const asksReg = q.includes('регламент') || q.includes('инструкц') || q.includes('норм') || q.includes('гост') || q.includes('документ');
    
    let response = '🤖 ИИ-НАСТАВНИК:\n\n';
    response += '📌 Порядок действий:\n' + sc.steps.join('\n') + '\n\n';
    
    if (asksWhy) {
        response += sc.explanation + '\n\n';
    }
    if (asksReg) {
        response += sc.regulation + '\n\n';
    }
    
    // Если не спросил специфично — добавляем физику для обучения
    if (!asksWhy && !asksReg) {
        response += sc.explanation;
    }
    
    return response;
}

/* ===== ОБЫЧНЫЙ РЕЖИМ (БЕЗ АВАРИИ) ===== */
function getNormalAdvice(question) {
    const q = question.toLowerCase();
    
    if (q.includes('температур') || q.includes('печ') || q.includes('п-1')) {
        return '🤖 Температура на выходе печи П-1 должна быть 350-380°C (по ТИ-001-2024, п. 5.3.1). Регулируется задвижкой топливного газа. При превышении 420°C — снизить подачу газа. При превышении 450°C — аварийная отсечка.';
    }
    if (q.includes('давлен') || q.includes('к-1') || q.includes('колонн')) {
        return '🤖 Давление в К-1 (атмосферная колонна) — норма до 0.15 МПа. Рабочее давление 0.10-0.13 МПа. Регулируется расходом рефлюкса и сбросом газа на факел. К-2 (вакуумная) — норма 0.015-0.025 МПа (остаточное давление).';
    }
    if (q.includes('соле') || q.includes('элоу') || q.includes('обессол') || q.includes('хлорид')) {
        return '🤖 Солесодержание нефти после ЭЛОУ — норма ≤ 5 мг/л. Регулируется напряжением на электродегидраторах (20-25 кВ) и расходом промывочной воды (5-7% от расхода нефти). Повышение солей ведёт к коррозии шлемовых труб К-1.';
    }
    if (q.includes('вибр') || q.includes('компакс') || q.includes('насос') || q.includes('подшипник')) {
        return '🤖 Нормы виброскорости по ISO 10816-3: Зона A (< 2.8 мм/с) — отлично. Зона B (2.8-7.1) — допустимо. Зона C (7.1-11.2) — опасно, план замены. Зона D (> 11.2) — АВАРИЙНЫЙ ОСТАНОВ. При срабатывании КОМПАКС — не перезапускать насос, перейти на резерв.';
    }
    if (q.includes('паз') || q.includes('блокиров') || q.includes('защит')) {
        return '🤖 Система ПАЗ (Противоаварийная защита): Б-101 — перегрев печи П-1 (> 450°C). Б-102 — срыв вакуума К-2. Б-103 — давление К-1 (> 0.35 МПа). Б-104 — вибрация насоса Н-1 (> 11.2 мм/с). При срабатывании ПАЗ — сообщить начальнику смены.';
    }
    
    return '🤖 Рекомендую проверить текущие параметры установки на мнемосхеме SCADA. Основные контролируемые параметры: температура печи П-1 (350-380°C), давление К-1 (< 0.15 МПа), вакуум К-2 (0.015-0.025 МПа), солесодержание ЭЛОУ (< 5 мг/л). Задайте конкретный вопрос — я дам точный ответ по регламенту.';
}

function addCopilotMessage(text) {
    const botDiv = document.createElement('div');
    botDiv.className = 'bot-msg';
    
    // Форматируем переносы строк и выделения для красивого отображения в чате
    const formatted = text
        .replace(/\n/g, '<br>')
        .replace(/(🤖 ИИ-НАСТАВНИК:)/g, '<strong style="color:#00f2fe;font-size:13px;">$1</strong>')
        .replace(/(📌 Порядок действий:)/g, '<strong style="color:#ffd700;">$1</strong>')
        .replace(/(🔬 Физика процесса:)/g, '<strong style="color:#a29bfe;">$1</strong>')
        .replace(/(📋 Регламент:)/g, '<strong style="color:#2ecc71;">$1</strong>');
        
    botDiv.innerHTML = formatted;
    chatMessages.appendChild(botDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Обновление Журнала Аварий
function addAlarmEvent(severity, tag, desc) {
    const feed = document.getElementById('alarm-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'event-item';
    if (severity === 'КРИТ' || severity === 'ПАЗ') item.classList.add('critical');
    if (severity === 'ПРЕД' || severity === 'ТРЕВОГА') item.classList.add('high');
    
    item.innerText = `[${new Date().toLocaleTimeString()}] [${severity}] [${tag}] ${desc}`;
    feed.prepend(item);
    
    while (feed.children.length > 50) {
        feed.removeChild(feed.lastChild);
    }
}

// Экспорт функций в window для сценариев и инспектора
window.sendControlUpdate = sendControlUpdate;
window.addCopilotMessage = addCopilotMessage;
window.addAlarmEvent = addAlarmEvent;

// Главный цикл рендеринга (Throttled)
function renderLoop(timestamp) {
    if (latestState && (timestamp - lastRenderTime >= RENDER_THROTTLE_MS)) {
        updateSCADA(latestState);
        lastRenderTime = timestamp;
    }
    requestAnimationFrame(renderLoop);
}

function updateSCADA(payload) {
    const state = payload.sim;
    
    // Индикатор аварии прямо на мнемосхеме SCADA
    const overlay = document.getElementById('mnemo-alarm-overlay');
    const overlayMsg = document.getElementById('mnemo-alarm-msg');
    const overlayBadge = document.getElementById('mnemo-alarm-badge');

    if (window.activeEmergencyState) {
        const em = window.activeEmergencyState;
        if (overlay) overlay.style.display = 'flex';
        
        if (em.type === 'overheat') {
            if (overlayMsg) overlayMsg.textContent = `🚨 АВАРИЯ: ПЕРЕГРЕВ ПЕЧИ П-1 (${state.furnace.outlet_temperature.toFixed(0)} °C > 450°C)`;
            if (overlayBadge) overlayBadge.textContent = `ПАЗ Б-101`;
        } else if (em.type === 'vacuum_drop') {
            if (overlayMsg) overlayMsg.textContent = `🚨 АВАРИЯ: СРЫВ ВАКУУМА К-2 (${state.vac_column.top_pressure.toFixed(3)} МПа)`;
            if (overlayBadge) overlayBadge.textContent = `ПАЗ Б-102`;
        } else if (em.type === 'salt_breakthrough') {
            if (overlayMsg) overlayMsg.textContent = `🚨 АВАРИЯ: ПРОРЫВ СОЛЕЙ ЭЛОУ (${state.desalter.outlet_salt_content.toFixed(1)} мг/л)`;
            if (overlayBadge) overlayBadge.textContent = `ЭЛОУ-2`;
        } else if (em.type === 'vibration_compaks') {
            if (overlayMsg) overlayMsg.textContent = `🚨 АВАРИЯ: ВИБРАЦИЯ ПОДШИПНИКА Н-1А (КОМПАКС 12.8 мм/с)`;
            if (overlayBadge) overlayBadge.textContent = `КОМПАКС`;
        } else if (em.type === 'k1_overpressure') {
            if (overlayMsg) overlayMsg.textContent = `🚨 АВАРИЯ: ПРЕВЫШЕНИЕ ДАВЛЕНИЯ К-1 (${state.atm_column.top_temperature.toFixed(0)} °C)`;
            if (overlayBadge) overlayBadge.textContent = `ПАЗ Б-103`;
        } else if (em.type === 'gas_leak') {
            if (overlayMsg) overlayMsg.textContent = `🚨 АВАРИЯ: УТЕЧКА И ЗАГАЗОВАННОСТЬ УСТАНОВКИ`;
            if (overlayBadge) overlayBadge.textContent = `ГАЗОЗАЩИТА`;
        } else if (em.type === 'power_blackout') {
            if (overlayMsg) overlayMsg.textContent = `🚨 АВАРИЯ: ПРОСАДКА ЭЛЕКТРОЭНЕРГИИ 6кВ (ОСТАНОВ НАСОСОВ)`;
            if (overlayBadge) overlayBadge.textContent = `ЭНЕРГОСНАБЖЕНИЕ`;
        } else if (em.type === 'esd_trip') {
            if (overlayMsg) overlayMsg.textContent = `🚨 ПОЛНЫЙ АВАРИЙНЫЙ ОСТАНОВ УСТАНОВКИ (ESD TRIP)`;
            if (overlayBadge) overlayBadge.textContent = `ESD TRIP`;
        }
    } else {
        if (overlay) overlay.style.display = 'none';
    }

    // Динамическая симуляция аварийных физических параметров в реальном времени
    if (window.activeEmergencyState) {
        const em = window.activeEmergencyState;
        const fuelVal = parseFloat(document.getElementById('fuel-gas-slider')?.value || 50);
        const crudeVal = parseFloat(document.getElementById('crude-feed-slider')?.value || 100);

        if (em.type === 'overheat') {
            const targetT = fuelVal > 30 ? 452.0 : 360.0;
            state.furnace.outlet_temperature += (targetT - state.furnace.outlet_temperature) * 0.3;
            state.furnace.fuel_gas_flow = fuelVal * 2.0;

            const furnSvg = document.getElementById('svg-furnace-p1');
            const kpiFurnCard = document.getElementById('kpi-furnace');
            if (state.furnace.outlet_temperature > 400) {
                if (furnSvg) { furnSvg.setAttribute('fill', '#ff2222'); furnSvg.setAttribute('stroke', '#ff0000'); furnSvg.style.filter = 'drop-shadow(0 0 14px #ff0000)'; }
                if (kpiFurnCard) kpiFurnCard.className = 'kpi-card alarm';
            } else {
                if (furnSvg) { furnSvg.setAttribute('fill', 'url(#furnace-grad)'); furnSvg.setAttribute('stroke', '#ff4c4c'); furnSvg.style.filter = 'none'; }
                if (kpiFurnCard) kpiFurnCard.className = 'kpi-card ok';
            }
        }
        else if (em.type === 'vacuum_drop') {
            const targetP = (fuelVal > 50 || crudeVal > 70) ? 0.080 : 0.020;
            state.vac_column.top_pressure += (targetP - state.vac_column.top_pressure) * 0.3;

            const k2Svg = document.querySelector('rect[x="750"][y="60"]');
            const kpiK2Card = document.getElementById('kpi-k2');
            if (state.vac_column.top_pressure > 0.045) {
                if (k2Svg) { k2Svg.setAttribute('stroke', '#ff3838'); k2Svg.style.filter = 'drop-shadow(0 0 14px #ff0000)'; }
                if (kpiK2Card) kpiK2Card.className = 'kpi-card alarm';
            } else {
                if (k2Svg) { k2Svg.setAttribute('stroke', '#a29bfe'); k2Svg.style.filter = 'none'; }
                if (kpiK2Card) kpiK2Card.className = 'kpi-card ok';
            }
        }
        else if (em.type === 'salt_breakthrough') {
            const targetSalt = crudeVal > 50 ? 58.4 : 3.2;
            state.desalter.outlet_salt_content += (targetSalt - state.desalter.outlet_salt_content) * 0.3;

            const elouSvg = document.querySelector('rect[x="250"][y="100"]');
            if (state.desalter.outlet_salt_content > 20) {
                if (elouSvg) { elouSvg.setAttribute('stroke', '#ff0000'); elouSvg.style.filter = 'drop-shadow(0 0 14px #ff0000)'; }
            } else {
                if (elouSvg) { elouSvg.setAttribute('stroke', '#45a29e'); elouSvg.style.filter = 'none'; }
            }
        }
        else if (em.type === 'vibration_compaks') {
            const pumpSvg = document.getElementById('svg-pump-h1');
            if (pumpSvg) { pumpSvg.setAttribute('fill', '#ff0000'); pumpSvg.setAttribute('stroke', '#ffffff'); pumpSvg.style.filter = 'drop-shadow(0 0 12px #ff0000)'; }
        }
        else if (em.type === 'k1_overpressure') {
            const targetT = fuelVal > 40 ? 175.0 : 120.0;
            state.atm_column.top_temperature += (targetT - state.atm_column.top_temperature) * 0.3;

            const k1Svg = document.querySelector('rect[x="530"][y="80"]');
            const kpiK1Card = document.getElementById('kpi-k1');
            if (state.atm_column.top_temperature > 145) {
                if (k1Svg) { k1Svg.setAttribute('stroke', '#ff0000'); k1Svg.style.filter = 'drop-shadow(0 0 14px #ff0000)'; }
                if (kpiK1Card) kpiK1Card.className = 'kpi-card alarm';
            } else {
                if (k1Svg) { k1Svg.setAttribute('stroke', '#66fcf1'); k1Svg.style.filter = 'none'; }
                if (kpiK1Card) kpiK1Card.className = 'kpi-card ok';
            }
        }
        else if (em.type === 'gas_leak') {
            const k1Svg = document.querySelector('rect[x="530"][y="80"]');
            if (crudeVal > 5 || fuelVal > 5) {
                if (k1Svg) { k1Svg.setAttribute('stroke', '#ff4d4d'); k1Svg.style.filter = 'drop-shadow(0 0 15px #ff0000)'; }
            } else {
                if (k1Svg) { k1Svg.setAttribute('stroke', '#66fcf1'); k1Svg.style.filter = 'none'; }
            }
        }
        else if (em.type === 'power_blackout') {
            state.crude_feed.flow_rate += (0.0 - state.crude_feed.flow_rate) * 0.4;
            const kpiCrudeCard = document.getElementById('kpi-crude');
            if (kpiCrudeCard) kpiCrudeCard.className = 'kpi-card alarm';
        }
        else if (em.type === 'esd_trip') {
            const isZero = (crudeVal <= 5 && fuelVal <= 5);
            const targetT = isZero ? 150.0 : 360.0;
            state.furnace.outlet_temperature += (targetT - state.furnace.outlet_temperature) * 0.2;
            state.crude_feed.flow_rate += ((isZero ? 0.0 : 150.0) - state.crude_feed.flow_rate) * 0.3;
        }
    }

    // 1. Анимации и тексты SVG мнемосхемы
    document.getElementById('svg-elou-salt').textContent = `Соли: ${state.desalter.outlet_salt_content.toFixed(1)} мг/л`;
    document.getElementById('svg-elou-volt').textContent = `U1: ${state.desalter.stage1_voltage.toFixed(0)} кВ | U2: ${state.desalter.stage2_voltage.toFixed(0)} кВ`;
    document.getElementById('svg-furnace-temp').textContent = `${state.furnace.outlet_temperature.toFixed(0)} °C`;
    document.getElementById('svg-k1-top').textContent = `Т: ${state.atm_column.top_temperature.toFixed(0)} °C`;
    document.getElementById('svg-k1-bot').textContent = `Т: ${state.atm_column.bottom_temperature.toFixed(0)} °C`;
    document.getElementById('svg-k2-press').textContent = `Р: ${state.vac_column.top_pressure.toFixed(3)} МПа`;
    document.getElementById('svg-k2-bot').textContent = `Т: ${state.vac_column.bottom_temperature.toFixed(0)} °C`;
    
    // KPI карточки телеметрии
    const kpiFeed = document.getElementById('val-kpi-feed');
    const kpiFurnace = document.getElementById('val-kpi-furnace');
    const kpiK1 = document.getElementById('val-kpi-k1');
    const kpiK2 = document.getElementById('val-kpi-k2');
    if (kpiFeed) kpiFeed.textContent = state.crude_feed.flow_rate.toFixed(1);
    if (kpiFurnace) kpiFurnace.textContent = state.furnace.outlet_temperature.toFixed(1);
    if (kpiK1) kpiK1.textContent = state.atm_column.top_temperature.toFixed(1);
    if (kpiK2) kpiK2.textContent = state.vac_column.top_pressure.toFixed(3);
    
    // Включение/выключение пламени и дыма
    const flame = document.getElementById('svg-flame');
    const smoke = document.getElementById('svg-smoke');
    if (state.furnace.fuel_gas_flow > 10.0) {
        flame.style.display = 'block';
        smoke.style.display = 'block';
    } else {
        flame.style.display = 'none';
        smoke.style.display = 'none';
    }
    
    // Пульсации труб в зависимости от расходов насосов
    toggleFlowLine('flow-raw', state.pumps[0].is_running);
    toggleFlowLine('flow-des', state.pumps[0].is_running);
    toggleFlowLine('flow-out', state.pumps[0].is_running);
    toggleFlowLine('flow-furn', state.pumps[1].is_running);
    toggleFlowLine('flow-hot', state.pumps[1].is_running);
    toggleFlowLine('flow-vac', state.pumps[2].is_running);

    // 2. Обновление подпанелей
    if (typeof updatePAZBoard === 'function') updatePAZBoard(state.interlocks);
    if (typeof updateCorporateScreen === 'function') updateCorporateScreen(state, payload.alarms, state.interlocks);
    if (typeof updateCompaksPanel === 'function') updateCompaksPanel(state, payload.alarms);
    if (typeof updateLimsTable === 'function') updateLimsTable(state.lab_analysis);
    if (typeof animateEquipmentStatus === 'function') animateEquipmentStatus(state);
    if (typeof updateThreeTelemetry === 'function') updateThreeTelemetry(state);
    
    // Обновление ИИ-трекинга оператора
    if (window.OperatorTracker) {
        const report = window.OperatorTracker.getReport();
        const risk = window.OperatorTracker.predictRisk(state);
        
        const accEl = document.getElementById('ai-accuracy');
        const scoreEl = document.getElementById('ai-score');
        const diffEl = document.getElementById('ai-difficulty');
        const riskEl = document.getElementById('ai-risk');
        const riskMsgEl = document.getElementById('ai-risk-message');
        const recEl = document.getElementById('ai-recommendation');
        
        if (accEl) accEl.textContent = `${report.accuracy}%`;
        if (scoreEl) scoreEl.textContent = `${report.correctActions} / ${report.errors}`;
        if (diffEl) diffEl.textContent = report.adaptiveDifficulty;
        if (riskEl) riskEl.textContent = `${risk.level} ${risk.score}%`;
        if (riskMsgEl) riskMsgEl.textContent = risk.message;
        if (recEl) recEl.textContent = report.adaptiveRecommendation;
    }
    
    // Проверка срабатывания ПАЗ для звуковой сирены
    const hasPazTrip = state.interlocks.some(i => i.is_tripped);
    if (hasPazTrip && typeof window.startPazSiren === 'function') {
        window.startPazSiren();
    } else if (typeof window.stopPazSiren === 'function') {
        window.stopPazSiren();
    }
    
    // 3. Обновление системного времени
    document.getElementById('system-time').innerText = new Date().toLocaleTimeString();

    // 4. Тренды и графики
    telemetryChart.data.labels.push('');
    telemetryChart.data.datasets[0].data.push(state.atm_column.top_temperature);
    telemetryChart.data.datasets[1].data.push(state.vac_column.top_pressure * 1000); // шкалируем
    
    if (telemetryChart.data.labels.length > 50) {
        telemetryChart.data.labels.shift();
        telemetryChart.data.datasets[0].data.shift();
        telemetryChart.data.datasets[1].data.shift();
    }
    telemetryChart.update();
    
    // 5. Обработка входящих аварий из бэкенда
    if (payload.alarms && payload.alarms.length > 0) {
        const lastAlarm = payload.alarms[0];
        addAlarmEvent(
            lastAlarm.severity === 'CRITICAL' ? 'КРИТ' : 'ПРЕД',
            lastAlarm.equipment_id,
            lastAlarm.description
        );
    }
}

function toggleFlowLine(elementId, isRunning) {
    const el = document.getElementById(elementId);
    if (el) {
        if (isRunning) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    }
}

// Запуск цикла рендеринга
requestAnimationFrame(renderLoop);
