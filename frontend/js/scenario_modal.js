/**
 * scenario_modal.js — Симуляция 8 комплексных промышленно-аварийных сценариев КТК ЭЛОУ-АВТ-5/5 (Инструктор)
 * v4: Полная визуальная обратная связь — красный баннер, мигание экрана, звуковая сирена
 */

function openScenarioModal() {
    let modal = document.getElementById('scenario-modal');
    if (modal) { modal.remove(); }

    modal = document.createElement('div');
    modal.id = 'scenario-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = `
        <div style="width:95%;max-width:820px;border:1px solid #ff3838;background:#0c1017;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(255,0,0,0.4);">
            <div style="background:rgba(255,56,56,0.18);border-bottom:1px solid #ff3838;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="color:#ff3838;margin:0;font-size:16px;">🚨 ПАНЕЛЬ ИНСТРУКТОРА: 8 ПРОМЫШЛЕННЫХ АВАРИЙНЫХ СЦЕНАРИЕВ</h3>
                <button onclick="closeScenarioModal()" style="background:none;border:none;color:#ff3838;font-size:20px;cursor:pointer;font-weight:bold;">✕</button>
            </div>
            <div style="padding:18px;color:#c5c6c7;max-height:75vh;overflow-y:auto;">
                <p style="font-size:13px;margin-top:0;color:#aaa;">Выберите аварийный сценарий. Произойдёт мгновенная симуляция с визуальной, звуковой и текстовой обратной связью:</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px;">
                    <button onclick="triggerScenario('overheat')" style="background:rgba(255,56,56,0.12);border:1px solid #ff3838;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#ff3838;font-size:12px;">🔥 1. Перегрев Печи П-1 (> 450 °C)</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Избыток топливного газа, прогар змеевиков, риск взрыва.</div>
                    </button>
                    <button onclick="triggerScenario('vacuum_drop')" style="background:rgba(255,165,0,0.12);border:1px solid #ffa500;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#ffa500;font-size:12px;">📉 2. Срыв Вакуума в Колонне К-2</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Падение глубины вакуума, кавитация, унос мазута в солярку.</div>
                    </button>
                    <button onclick="triggerScenario('salt_breakthrough')" style="background:rgba(0,242,254,0.12);border:1px solid #00f2fe;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#00f2fe;font-size:12px;">💧 3. Прорыв Солей в ЭЛОУ (> 50 мг/л)</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Отказ электродегидратора Э-101, вынос хлоридов в К-1.</div>
                    </button>
                    <button onclick="triggerScenario('vibration_compaks')" style="background:rgba(156,136,255,0.15);border:1px solid #9c88ff;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#9c88ff;font-size:12px;">🔊 4. Авария насоса Н-1А (КОМПАКС > 11.2 мм/с)</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Разрушение подшипника, заклинивание вала насоса сырья.</div>
                    </button>
                    <button onclick="triggerScenario('k1_overpressure')" style="background:rgba(251,197,49,0.15);border:1px solid #fbc531;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#fbc531;font-size:12px;">⚠️ 5. Давление Колонны К-1 (> 0.35 МПа)</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Забивание верха атмосферной колонны, угроза подрыва.</div>
                    </button>
                    <button onclick="triggerScenario('gas_leak')" style="background:rgba(232,65,24,0.15);border:1px solid #e84118;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#e84118;font-size:12px;">⛽ 6. Утечка и Загазованность Установки</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Прорыв фланца бензинового фракционирования К-1.</div>
                    </button>
                    <button onclick="triggerScenario('power_blackout')" style="background:rgba(74,105,189,0.15);border:1px solid #4a69bd;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#6a89cc;font-size:12px;">⚡ 7. Просадка Электроэнергии (Останов Н-1А/Б)</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Отказ ГПП, просадка питания насосов сырья Н-1А/Б.</div>
                    </button>
                    <button onclick="triggerScenario('esd_trip')" style="background:rgba(235,47,6,0.25);border:1px solid #eb2f06;padding:10px;border-radius:6px;text-align:left;cursor:pointer;">
                        <div style="font-weight:bold;color:#ff4d4d;font-size:12px;">🛡️ 8. Полный Аварийный Останов ПАЗ (ESD)</div>
                        <div style="font-size:11px;color:#888;margin-top:3px;">Срабатывание систем блокировок, отсечение сырья и газа.</div>
                    </button>
                </div>

                <div style="margin-top:16px;padding:10px;background:rgba(0,0,0,0.4);border-radius:6px;border:1px solid #222;font-size:12px;color:#888;">
                    💡 <strong style="color:#00f2fe;">Ручное моделирование:</strong> используйте ползунки «Задвижка топливного газа» и «Задвижка сырой нефти» на мнемосхеме.
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeScenarioModal() {
    const modal = document.getElementById('scenario-modal');
    if (modal) modal.remove();
}

/* ===== ВИЗУАЛЬНЫЙ АВАРИЙНЫЙ БАННЕР (немедленно видимый поверх всего экрана) ===== */
function showEmergencyBanner(title, details, color) {
    // Удалить предыдущий баннер, если есть
    let old = document.getElementById('emergency-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'emergency-banner';
    banner.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; z-index: 999999;
        background: linear-gradient(180deg, ${color}dd 0%, ${color}88 100%);
        border-bottom: 3px solid ${color};
        padding: 14px 20px; text-align: center;
        animation: emergencyFlash 0.6s ease-in-out 4;
        box-shadow: 0 5px 30px ${color}88;
    `;
    banner.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.5);">
            ${title}
        </div>
        <div style="font-size: 13px; color: rgba(255,255,255,0.85); margin-top: 4px;">
            ${details}
        </div>
        <button onclick="dismissBanner()" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.3);color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">✕ ЗАКРЫТЬ</button>
    `;

    // Добавляем CSS анимацию мигания, если ещё нет
    if (!document.getElementById('emergency-css')) {
        const style = document.createElement('style');
        style.id = 'emergency-css';
        style.textContent = `
            @keyframes emergencyFlash {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            @keyframes screenShake {
                0%, 100% { transform: translateX(0); }
                10% { transform: translateX(-4px); }
                30% { transform: translateX(4px); }
                50% { transform: translateX(-3px); }
                70% { transform: translateX(3px); }
                90% { transform: translateX(-2px); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    // Эффект тряски экрана
    document.body.style.animation = 'screenShake 0.3s ease-in-out 3';
    setTimeout(() => { document.body.style.animation = ''; }, 1000);

    // Автоматически скрыть баннер через 12 секунд
    setTimeout(() => { dismissBanner(); }, 12000);
}

function dismissBanner() {
    const banner = document.getElementById('emergency-banner');
    if (banner) banner.remove();
}

/* ===== ЗВУКОВАЯ СИРЕНА (Web Audio API) ===== */
function playEmergencySiren() {
    // Используем уже экспортированную функцию из audio_manager.js
    if (window.startPazSiren) {
        window.startPazSiren();
        // Автоматически остановить через 5 секунд
        setTimeout(() => {
            if (window.stopPazSiren) window.stopPazSiren();
        }, 5000);
    } else if (window.playBeep) {
        // Фоллбек: 3 быстрых громких бипа
        window.playBeep(880, 'square', 0.3);
        setTimeout(() => window.playBeep(660, 'square', 0.3), 400);
        setTimeout(() => window.playBeep(880, 'square', 0.3), 800);
    }
}

/* ===== ЗАПИСЬ В ЖУРНАЛ АВАРИЙ ===== */
function addEmergencyAlarm(severity, tag, desc) {
    if (window.addAlarmEvent) {
        window.addAlarmEvent(severity, tag, desc);
    }
    // Дублируем в console для отладки
    console.log(`[СЦЕНАРИЙ] [${severity}] [${tag}] ${desc}`);
}

/* ===== СООБЩЕНИЕ ИИ-НАСТАВНИКА ===== */
function addEmergencyCopilot(text) {
    if (window.addCopilotMessage) {
        window.addCopilotMessage(text);
    }
    console.log(`[ИИ-НАСТАВНИК] ${text}`);
}

/* ===== УПРАВЛЕНИЕ ЗАДВИЖКАМИ ===== */
function setValve(id, value) {
    const slider = document.getElementById(id === 'fuel' ? 'fuel-gas-slider' : 'crude-feed-slider');
    const label = document.getElementById(id === 'fuel' ? 'fuel-val' : 'crude-val');
    if (slider) slider.value = value;
    if (label) label.innerText = String(value);

    if (window.sendControlUpdate) {
        window.sendControlUpdate(id === 'fuel' ? 'fuel_gas_valve' : 'crude_feed_valve', value);
    }
}

/* ===== ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА АВАРИЙНОГО СЦЕНАРИЯ ===== */
function triggerScenario(type) {
    closeScenarioModal();
    window.activeEmergencyState = { type: type, startTime: Date.now() };
    window.activeScenarioId = type;

    // Если запущен НЕ сценарий КОМПАКС, сбрасываем вибродиагностику в норму
    if (type !== 'vibration_compaks') {
        const vibValH1 = document.querySelector('#vib-h1 .vib-val');
        if (vibValH1) {
            vibValH1.className = 'vib-val green';
            vibValH1.innerHTML = '3.2 мм/с <small style="opacity:0.6">(Норма | ISO A)</small>';
        }
        const diagEl = document.getElementById('compaks-diag');
        if (diagEl) {
            diagEl.innerHTML = `
                <div style="display:flex;gap:6px;flex-direction:column;">
                    <div style="font-size:11px;">
                        <span style="color:#00f2fe;">Н-1А:</span>
                        <span style="color:#2ecc71;">Подшипник исправен</span>
                    </div>
                    <div style="font-size:11px;">
                        <span style="color:#a29bfe;">Н-2А:</span>
                        <span style="color:#2ecc71;">Подшипник исправен</span>
                    </div>
                </div>
            `;
        }
        const compaksPanel = document.getElementById('compaks-main-panel');
        if (compaksPanel) {
            compaksPanel.style.borderColor = '#2ecc71';
            compaksPanel.style.boxShadow = 'none';
        }
        const ackBtn = document.getElementById('compaks-ack-btn');
        if (ackBtn) {
            ackBtn.textContent = '🔍 Квитировать диагностику';
            ackBtn.style.background = 'rgba(0,242,254,0.1)';
            ackBtn.style.borderColor = '#00f2fe';
            ackBtn.style.color = '#00f2fe';
        }
    }

    if (type === 'overheat') {
        setValve('fuel', 100); // Авария: газ открыт на максимум (100%), требует снижения
        showEmergencyBanner(
            '🔥 КРИТИЧЕСКИЙ ПЕРЕГРЕВ ПЕЧИ П-1 — 452 °C!',
            'Превышение подачи топливного газа. Угроза прогара змеевиков и взрыва. ПАЗ Б-101 АКТИВИРОВАНА.',
            '#ff2222'
        );
        playEmergencySiren();
        addEmergencyAlarm("КРИТ", "Печь П-1", "🚨 ПРЕВЫШЕНИЕ ТЕМПЕРАТУРЫ ПЕЧИ (452°C)! ВЗРЫВООПАСНОСТЬ!");
        addEmergencyAlarm("ПАЗ", "Блокировка Б-101", "АВТОМАТИЧЕСКАЯ БЛОКИРОВКА ПАЗ: СБРОС ТОПЛИВНОГО ГАЗА!");
        addEmergencyCopilot("🚨 ИИ-НАСТАВНИК: Критический перегрев печи П-1! Срочно прикройте задвижку топливного газа до 25% и проведите анализ бензина в LIMS!");

    } else if (type === 'vacuum_drop') {
        setValve('fuel', 80); // Аварийный перегрев низа
        setValve('crude', 90);
        showEmergencyBanner(
            '📉 СРЫВ ВАКУУМА В КОЛОННЕ К-2!',
            'Давление К-2 поднялось до 0.08 МПа. Кавитация пароэжекторов. Унос мазута в солярку. ПАЗ Б-102 АКТИВИРОВАНА.',
            '#ff8800'
        );
        playEmergencySiren();
        addEmergencyAlarm("КРИТ", "Колонна К-2", "🚨 СРЫВ ВАКУУМА! ДАВЛЕНИЕ К-2 ПОДНЯЛОСЬ ДО 0.08 МПа!");
        addEmergencyAlarm("ПАЗ", "Блокировка Б-102", "СРАБАТЫВАНИЕ ЗАЩИТЫ ПО ВАКУУМУ К-2!");
        addEmergencyCopilot("🚨 ИИ-НАСТАВНИК: Критический срыв вакуума в К-2! Снизьте нагрев печи (газ ≤ 40%), разгрузите сырье (≤ 60%) и сделайте анализ мазута в LIMS!");

    } else if (type === 'salt_breakthrough') {
        setValve('crude', 90); // Высокий расход сырья провоцирует прорыв солей
        showEmergencyBanner(
            '💧 ПРОРЫВ СОЛЕЙ ПОСЛЕ ЭЛОУ — 58.4 мг/л!',
            'Отказ электродегидратора Э-101. Вынос хлоридов в атмосферную колонну К-1. Угроза коррозии шлемовых труб.',
            '#00c9db'
        );
        addEmergencyAlarm("ТРЕВОГА", "ЭЛОУ-2", "💧 ПРЕВЫШЕНИЕ СОЛЕСОДЕРЖАНИЯ (58.4 мг/л)! УНОС ХЛОРИДОВ!");
        addEmergencyCopilot("⚠️ ИИ-НАСТАВНИК: Прорыв солей после обессоливания. Снизьте подачу сырья ≤ 50% и выполните экспресс-анализ обессоленной нефти в LIMS!");

    } else if (type === 'vibration_compaks') {
        setValve('crude', 0); // Останов насоса Н-1А сбрасывает подачу сырья до 0%
        window.compaksInspected = false;
        window.backupPumpStarted = false;
        window.activeScenarioId = 'vibration_compaks';
        window.activeEmergencyState = { type: 'vibration_compaks', startTime: Date.now() };

        // Мгновенно обновляем модуль КОМПАКС в интерфейсе SCADA
        const vibValH1 = document.querySelector('#vib-h1 .vib-val');
        if (vibValH1) {
            vibValH1.className = 'vib-val red';
            vibValH1.innerHTML = '12.8 мм/с <small style="opacity:0.6">(АВАРИЯ | ISO D)</small>';
        }
        const diagEl = document.getElementById('compaks-diag');
        if (diagEl) {
            diagEl.innerHTML = `
                <div style="display:flex;gap:6px;flex-direction:column;">
                    <div style="font-size:11px;">
                        <span style="color:#00f2fe;">Н-1А:</span>
                        <span style="color:#ff3838;font-weight:bold;">⛔ РАЗРУШЕНИЕ ПОДШИПНИКА! Немедленная замена!</span>
                    </div>
                    <div style="font-size:11px;">
                        <span style="color:#a29bfe;">Н-2А:</span>
                        <span style="color:#2ecc71;">Подшипник исправен</span>
                    </div>
                </div>
            `;
        }
        const compaksPanel = document.getElementById('compaks-main-panel');
        if (compaksPanel) {
            compaksPanel.style.borderColor = '#ff3838';
            compaksPanel.style.boxShadow = '0 0 18px rgba(255, 56, 56, 0.7)';
        }

        showEmergencyBanner(
            '🔊 АВАРИЯ ПОДШИПНИКА НАСОСА Н-1А — ВИБРАЦИЯ 12.8 мм/с!',
            'Система КОМПАКС зафиксировала критический уровень вибрации. Аварийный останов Н-1А! Запустите резервный насос Н-1Б и восстановите подачу сырья.',
            '#9c88ff'
        );
        playEmergencySiren();
        addEmergencyAlarm("КРИТ", "КОМПАКС", "🔊 АВАРИЯ ПОДШИПНИКА НАСОСА Н-1А! Виброскорость 12.8 мм/с > 11.2 мм/с!");
        addEmergencyAlarm("ПАЗ", "Блокировка Б-104", "АВТОМАТИЧЕСКИЙ ОСТАНОВ НАСОСА Н-1А! ТРЕБУЕТСЯ ВВОД РЕЗЕРВА Н-1Б.");
        addEmergencyCopilot("🔊 ИИ-НАСТАВНИК: КОМПАКС зафиксировал разрушение подшипника на Н-1А (12.8 мм/с). Нажмите на панель КОМПАКС, запустите резерв Н-1Б и откройте задвижку сырья ≥ 80%!");

    } else if (type === 'k1_overpressure') {
        setValve('fuel', 75);
        setValve('crude', 85);
        showEmergencyBanner(
            '⚠️ ПРЕВЫШЕНИЕ ДАВЛЕНИЯ В КОЛОННЕ К-1 — 0.38 МПа!',
            'Забивание верха атмосферной колонны. Угроза подрыва предохранительных клапанов СППК.',
            '#fbc531'
        );
        playEmergencySiren();
        addEmergencyAlarm("КРИТ", "Колонна К-1", "⚠️ ПРЕВЫШЕНИЕ ДАВЛЕНИЯ К-1 (0.38 МПа)! Угроза подрыва клапанов СППК!");
        addEmergencyCopilot("⚠️ ИИ-НАСТАВНИК: Рост давления в К-1! Снизьте нагрев (газ ≤ 35%), уменьшите подачу сырья (≤ 55%) и проверьте пробу бензина в LIMS!");

    } else if (type === 'gas_leak') {
        showEmergencyBanner(
            '⛽ ЗАГАЗОВАННОСТЬ УСТАНОВКИ — УТЕЧКА БЕНЗИНОВОЙ ФРАКЦИИ!',
            'Прорыв фланца на К-1. Срабатывание датчиков загазованности. Лафетная система орошения ВКЛЮЧЕНА. ВЗРЫВООПАСНО!',
            '#e84118'
        );
        playEmergencySiren();
        addEmergencyAlarm("КРИТ", "Газозащита", "⛽ УТЕЧКА БЕНЗИНОВОЙ ФРАКЦИИ! ЗАГАЗОВАННОСТЬ УСТАНОВКИ (ВЗРЫВООПАСНО!)");
        addEmergencyCopilot("⛽ ИИ-НАСТАВНИК: Датчики загазованности зафиксировали утечку на К-1. Немедленно закройте подачу сырья и газа в 0%!");

    } else if (type === 'power_blackout') {
        setValve('crude', 0); // Потеря питания останавливает насосы
        showEmergencyBanner(
            '⚡ ПРОСАДКА ЭЛЕКТРОЭНЕРГИИ 6 кВ — ОСТАНОВ НАСОСОВ Н-1А/Б!',
            'Отказ ГПП, питание переключено на АВР. Подача сырья прекращена.',
            '#4a69bd'
        );
        playEmergencySiren();
        addEmergencyAlarm("КРИТ", "Энергоснабжение", "⚡ ПРОСАДКА НАПРЯЖЕНИЯ 6кВ! ОСТАНОВ ОСНОВНЫХ НАСОСОВ СЫРЬЯ Н-1А/Б!");
        addEmergencyCopilot("⚡ ИИ-НАСТАВНИК: Посадка электроэнергии! Снизьте подачу газа до 15%, сделайте анализ мазута в LIMS и восстановите сырье после АВР!");

    } else if (type === 'esd_trip') {
        setValve('crude', 0);
        setValve('fuel', 0);
        showEmergencyBanner(
            '🛡️ ПОЛНЫЙ АВАРИЙНЫЙ ОСТАНОВ УСТАНОВКИ (ESD TRIP)!',
            'ВСЕ ЗАТВОРЫ ЗАКРЫТЫ. Подача сырья и газа ОТСЕЧЕНА. Установка переведена в режим безопасной циркуляции.',
            '#cc0000'
        );
        playEmergencySiren();
        addEmergencyAlarm("КРИТ", "ПАЗ", "🚨 АВАРИЙНЫЙ ОСТАНОВ УСТАНОВКИ (ESD TRIP)! ВСЕ ЗАТВОРЫ ЗАКРЫТЫ!");
        addEmergencyCopilot("🛡️ ИИ-НАСТАВНИК: Сработал аварийный останов ESD. Запросите у наставника регламент пуска, плавно подайте газ (20-30%) и затем сырье (40-60%)!");
    }

    // Запускаем тренажёр с заданиями и оценкой для оператора
    if (window.ScenarioTrainer) {
        setTimeout(() => {
            window.ScenarioTrainer.startTraining(type);
        }, 1500); // Даём 1.5 сек на прочтение аварийного баннера
    }
}

/* ===== ISA-108 TIME-TRAVEL REPLAY (Перемотка времени физики назад) ===== */
function rewindTime(sec = 15) {
    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
        window.ws.send(JSON.stringify({ type: 'rewind_time', seconds: sec }));
        if (window.addAlarmEvent) {
            window.addAlarmEvent("ИНФО", "Инструктор", `⏪ Время симуляции перемотано на ${sec} сек назад (Time-Travel Replay ISA-108).`);
        }
    } else {
        alert("Нет соединения с бэкендом симулятора!");
    }
}

/* ===== ISA-108 AUTHORING TOOL (Конструктор Сценариев Инструктора) ===== */
function openScenarioBuilderModal() {
    let modal = document.getElementById('scenario-builder-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'scenario-builder-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = `
        <div style="width:95%;max-width:650px;border:1px solid #9c88ff;background:#0c1017;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(156,136,255,0.4);">
            <div style="background:rgba(156,136,255,0.18);border-bottom:1px solid #9c88ff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="color:#9c88ff;margin:0;font-size:15px;">✍️ ИНСТРУКТОР: КОНСТРУКТОР СЦЕНАРИЕВ (ISA-108 AUTHORING TOOL)</h3>
                <button onclick="document.getElementById('scenario-builder-modal').remove()" style="background:none;border:none;color:#9c88ff;font-size:20px;cursor:pointer;font-weight:bold;">✕</button>
            </div>
            <div style="padding:18px;color:#c5c6c7;font-size:13px;">
                <p style="margin-top:0;color:#aaa;">Скомпонуйте кастомную цепочку неисправностей для проверки ученика:</p>

                <div style="margin-bottom:12px;">
                    <label style="display:block;margin-bottom:4px;color:#00f2fe;font-weight:bold;">1. Первичная аномалия (T = 0s):</label>
                    <select id="builder-fault-1" style="width:100%;padding:8px;background:#141e30;border:1px solid #333;color:#fff;border-radius:4px;">
                        <option value="overheat">🔥 Перегрев печи П-1 (Превышение газа)</option>
                        <option value="vacuum_drop">📉 Срыв вакуума в К-2</option>
                        <option value="salt_breakthrough">💧 Прорыв солей в ЭЛОУ</option>
                        <option value="vibration_compaks">🔊 Заклинивание вала Н-1А (КОМПАКС)</option>
                    </select>
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;margin-bottom:4px;color:#ffa500;font-weight:bold;">2. Вторичная аномалия (Каскад через T = 30s):</label>
                    <select id="builder-fault-2" style="width:100%;padding:8px;background:#141e30;border:1px solid #333;color:#fff;border-radius:4px;">
                        <option value="k1_overpressure">⚠️ Рост давления верха К-1</option>
                        <option value="gas_leak">⛽ Утечка бензинового фракционирования</option>
                        <option value="power_blackout">⚡ Просадка питания 6 кВ</option>
                    </select>
                </div>

                <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="document.getElementById('scenario-builder-modal').remove()" style="padding:8px 16px;background:none;border:1px solid #555;color:#ccc;border-radius:4px;cursor:pointer;">Отмена</button>
                    <button onclick="runCustomScenario()" style="padding:8px 16px;background:linear-gradient(135deg,#9c88ff,#00f2fe);border:none;color:#000;font-weight:bold;border-radius:4px;cursor:pointer;">🚀 Запустить Комплексный Сценарий</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function runCustomScenario() {
    const f1 = document.getElementById('builder-fault-1')?.value || 'overheat';
    const f2 = document.getElementById('builder-fault-2')?.value || 'k1_overpressure';
    const modal = document.getElementById('scenario-builder-modal');
    if (modal) modal.remove();

    triggerScenario(f1);
    setTimeout(() => {
        if (window.addAlarmEvent) {
            window.addAlarmEvent("КРИТ", "Инструктор", `⚡ КАСКАДНЫЙ СЦЕНАРИЙ: Активирована вторичная аномалия (${f2})!`);
        }
        triggerScenario(f2);
    }, 15000);
}
