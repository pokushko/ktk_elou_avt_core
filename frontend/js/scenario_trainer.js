/**
 * scenario_trainer.js — Тренажёрная система оценки действий оператора при аварийных сценариях
 * Отслеживает: время реакции, правильность действий, последовательность, итоговый балл
 */

const ScenarioTrainer = (function () {

    let activeScenario = null;
    let startTime = null;
    let timerInterval = null;
    let completedSteps = [];
    let panelEl = null;

    /* ===== БАЗА СЦЕНАРИЕВ С ЗАДАНИЯМИ ===== */
    const SCENARIOS = {
        overheat: {
            title: '🔥 ПЕРЕГРЕВ ПЕЧИ П-1 (> 450 °C)',
            situation: 'Температура на выходе печи П-1 превысила 450°C из-за избытка топливного газа (100%). Угроза прогара змеевиков и взрыва.',
            timeLimit: 60,
            steps: [
                { id: 'fuel_down', text: 'Снизить задвижку топливного газа (П-1) ≤ 30%', check: () => getValveValue('fuel') <= 30 },
                { id: 'lims_check', text: 'Провести экспресс-анализ LIMS по пробе «Бензин» (проверка ГОСТ 2177)', check: () => window.limsTestedProducts && window.limsTestedProducts.includes('gasoline') },
                { id: 'crude_check', text: 'Убедиться в стабильной подаче сырья (ползунок нефти ≥ 80%)', check: () => getValveValue('crude') >= 80 },
                { id: 'copilot_ask', text: 'Запросить рекомендацию у ИИ-Наставника (написать в чат)', check: () => checkCopilotUsed() },
            ],
            perfectScore: 100,
            hints: [
                '💡 Переместите ползунок «Задвижка топливного газа» влево до 20-30%.',
                '💡 Выполните анализ «Бензин» в панели Экспресс-Лаборатории LIMS.',
                '💡 Убедитесь что подача сырья ≥ 80%.',
                '💡 Напишите вопрос ИИ-Наставнику внизу страницы.'
            ]
        },
        vacuum_drop: {
            title: '📉 СРЫВ ВАКУУМА В КОЛОННЕ К-2',
            situation: 'Давление в вакуумной колонне К-2 выросло до 0.08 МПа. Кавитация пароэжекторов, унос мазута в дизельную фракцию.',
            timeLimit: 60,
            steps: [
                { id: 'fuel_reduce', text: 'Уменьшить нагрев — задвижка газа (П-1) ≤ 40%', check: () => getValveValue('fuel') <= 40 },
                { id: 'crude_reduce', text: 'Снизить подачу сырья (Н-1) ≤ 60% для разгрузки вакуумной колонны', check: () => getValveValue('crude') <= 60 },
                { id: 'lims_check', text: 'Провести экспресс-анализ LIMS по пробе «Мазут» (проверка вязкости/вспышки)', check: () => window.limsTestedProducts && window.limsTestedProducts.includes('mazut') },
                { id: 'copilot_ask', text: 'Сообщить ИИ-Наставнику о ситуации в чат', check: () => checkCopilotUsed() },
            ],
            perfectScore: 100,
            hints: [
                '💡 Снизьте подачу газа до 30-40% ползунком топливного газа.',
                '💡 Уменьшите подачу сырья до 50-60% ползунком сырой нефти.',
                '💡 Запросите экспресс-анализ LIMS для «Мазут».',
                '💡 Напишите ИИ-Наставнику о ситуации.'
            ]
        },
        salt_breakthrough: {
            title: '💧 ПРОРЫВ СОЛЕЙ В ЭЛОУ (> 50 мг/л)',
            situation: 'Электродегидратор Э-101 потерял эффективность. Солесодержание нефти выросло до 58.4 мг/л. Угроза коррозии шлемовых труб К-1.',
            timeLimit: 60,
            steps: [
                { id: 'crude_reduce', text: 'Снизить подачу сырья ≤ 50% для разгрузки и стабилизации ЭЛОУ', check: () => getValveValue('crude') <= 50 },
                { id: 'lims_check', text: 'Выполнить экспресс-анализ LIMS по пробе «Обессоленная нефть» (соли/вода)', check: () => window.limsTestedProducts && window.limsTestedProducts.includes('desalted_oil') },
                { id: 'copilot_ask', text: 'Запросить у ИИ-Наставника порядок восстановления Э-101 (написать в чат)', check: () => checkCopilotUsed() },
            ],
            perfectScore: 100,
            hints: [
                '💡 Снизьте ползунок подачи сырья до 40-50%.',
                '💡 Нажмите кнопку «Обессоленная нефть» в панели Экспресс-Лаборатории LIMS.',
                '💡 Спросите ИИ-Наставника о порядке восстановления.'
            ]
        },
        vibration_compaks: {
            title: '🔊 АВАРИЯ НАСОСА Н-1А (КОМПАКС)',
            situation: 'Система КОМПАКС зафиксировала вибрацию 12.8 мм/с на подшипнике насоса Н-1А. Произошел аварийный останов Н-1А. Требуется подтвердить аварию в КОМПАКС, ввести резерв и восстановить подачу сырья.',
            timeLimit: 45,
            steps: [
                { id: 'compaks_check', text: 'Подтвердить аварию: кликнуть на панель «КОМПАКС» для фиксации виброскорости 12.8 мм/с', check: () => window.compaksInspected === true },
                { id: 'crude_check', text: 'Восстановить подачу сырья на резервном насосе Н-1Б: ползунок задвижки ≥ 80%', check: () => getValveValue('crude') >= 80 },
                { id: 'copilot_ask', text: 'Запросить рекомендацию по проверке Н-1Б у ИИ-Наставника (написать в чат)', check: () => checkCopilotUsed() },
            ],
            perfectScore: 100,
            hints: [
                '💡 Кликните мышкой на панель вибромониторинга «КОМПАКС» слева внизу.',
                '💡 Передвиньте ползунок «Задвижка сырой нефти» вправо до 80-100%.',
                '💡 Напишите вопрос ИИ-Наставнику в окне чата внизу страницы.'
            ]
        },
        k1_overpressure: {
            title: '⚠️ ДАВЛЕНИЕ КОЛОННЫ К-1 (> 0.35 МПа)',
            situation: 'Забивание верха атмосферной колонны. Давление выросло до 0.38 МПа. Угроза подрыва предохранительных клапанов СППК.',
            timeLimit: 60,
            steps: [
                { id: 'fuel_down', text: 'Снизить нагрев печи — задвижка газа ≤ 35%', check: () => getValveValue('fuel') <= 35 },
                { id: 'crude_reduce', text: 'Уменьшить подачу сырья ≤ 55% для снижения парообразования', check: () => getValveValue('crude') <= 55 },
                { id: 'lims_check', text: 'Выполнить экспресс-анализ LIMS по пробе «Бензин» (проверка обводнения)', check: () => window.limsTestedProducts && window.limsTestedProducts.includes('gasoline') },
                { id: 'copilot_ask', text: 'Запросить ИИ-Наставника о сбросе давления на факел', check: () => checkCopilotUsed() },
            ],
            perfectScore: 100,
            hints: [
                '💡 Снизьте подачу газа до 30-35%.',
                '💡 Уменьшите подачу сырья до 50%.',
                '💡 Нажмите «Бензин» в панели LIMS.',
                '💡 Напишите ИИ-Наставнику о сбросе давления.'
            ]
        },
        gas_leak: {
            title: '⛽ УТЕЧКА И ЗАГАЗОВАННОСТЬ',
            situation: 'Прорыв фланца на К-1. Датчики загазованности сработали. Угроза взрыва парогазового облака.',
            timeLimit: 45,
            steps: [
                { id: 'crude_off', text: 'НЕМЕДЛЕННО отсечь подачу сырья (= 0%)', check: () => getValveValue('crude') <= 5 },
                { id: 'fuel_off', text: 'НЕМЕДЛЕННО отсечь подачу газа (= 0%)', check: () => getValveValue('fuel') <= 5 },
                { id: 'lims_check', text: 'Запросить экспресс-анализ LIMS по пробе «Сырая нефть»', check: () => window.limsTestedProducts && window.limsTestedProducts.includes('crude_oil') },
                { id: 'copilot_ask', text: 'Сообщить наставнику о загазованности (написать в чат)', check: () => checkCopilotUsed() },
            ],
            perfectScore: 100,
            hints: [
                '💡 КРИТИЧНО! Переведите оба ползунка в 0% немедленно!',
                '💡 Нажмите «Сырая нефть» в LIMS.',
                '💡 Напишите в чат о загазованности.'
            ]
        },
        power_blackout: {
            title: '⚡ ПРОСАДКА ЭЛЕКТРОЭНЕРГИИ',
            situation: 'Отказ ГПП, просадка питания 6 кВ. Насосы Н-1А/Б остановлены. Подача сырья прекращена.',
            timeLimit: 60,
            steps: [
                { id: 'fuel_down', text: 'Снизить газ ≤ 15% (чтобы не перегреть пустую печь П-1)', check: () => getValveValue('fuel') <= 15 },
                { id: 'lims_check', text: 'Запросить экспресс-анализ LIMS по пробе «Мазут» (контроль куба)', check: () => window.limsTestedProducts && window.limsTestedProducts.includes('mazut') },
                { id: 'crude_restore', text: 'После ввода АВР поднять задвижку сырья до 50-70%', check: () => getValveValue('crude') >= 50 && getValveValue('crude') <= 75 },
                { id: 'copilot_ask', text: 'Запросить наставника о порядке переключения АВР (написать в чат)', check: () => checkCopilotUsed() },
            ],
            perfectScore: 100,
            hints: [
                '💡 Снизьте подачу газа до 10-15%, пустую печь греть нельзя!',
                '💡 Нажмите «Мазут» в LIMS.',
                '💡 Поднимите сырье до 50-70% после перехода на АВР.',
                '💡 Напишите наставнику.'
            ]
        },
        esd_trip: {
            title: '🛡️ ПОЛНЫЙ АВАРИЙНЫЙ ОСТАНОВ ПАЗ (ESD)',
            situation: 'Сработала система противоаварийной защиты. Все затворы автоматически закрыты. Установка в режиме циркуляции.',
            timeLimit: 90,
            steps: [
                { id: 'copilot_ask', text: 'Запросить наставника о регламенте вывода из ESD (написать в чат)', check: () => checkCopilotUsed() },
                { id: 'gradual_fuel', text: 'Постепенно подать газ до 20-30% для мягкого прогрева', check: () => getValveValue('fuel') >= 20 && getValveValue('fuel') <= 35 },
                { id: 'gradual_crude', text: 'Постепенно восстановить подачу сырья до 40-60%', check: () => getValveValue('crude') >= 40 && getValveValue('crude') <= 65 },
                { id: 'lims_check', text: 'Выполнить контрольный анализ LIMS по пробе «Бензин»', check: () => window.limsTestedProducts && window.limsTestedProducts.includes('gasoline') },
            ],
            perfectScore: 100,
            hints: [
                '💡 Спросите наставника о регламенте пуска.',
                '💡 Постепенно (!) подайте газ до 20-30%.',
                '💡 Затем постепенно подайте сырьё до 40-60%.',
                '💡 Проведите анализ «Бензин» в LIMS.'
            ]
        }
    };

    /* ===== УТИЛИТЫ ===== */
    function getValveValue(type) {
        const slider = document.getElementById(type === 'fuel' ? 'fuel-gas-slider' : 'crude-feed-slider');
        return slider ? parseFloat(slider.value) : 50;
    }

    let copilotUsedFlag = false;
    function checkCopilotUsed() { return copilotUsedFlag; }

    // Перехватываем отправку сообщений в чат наставника
    function hookCopilotChat() {
        copilotUsedFlag = false;
        const sendBtn = document.getElementById('send-chat-btn');
        const input = document.getElementById('copilot-input');
        if (sendBtn && !sendBtn._trainerHooked) {
            sendBtn._trainerHooked = true;
            sendBtn.addEventListener('click', () => { copilotUsedFlag = true; });
        }
        if (input && !input._trainerHooked) {
            input._trainerHooked = true;
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') copilotUsedFlag = true; });
        }
    }

    /* ===== ЗАПУСК ТРЕНИРОВОЧНОГО СЦЕНАРИЯ ===== */
    function startTraining(scenarioId) {
        const scenario = SCENARIOS[scenarioId];
        if (!scenario) return;

        activeScenario = { ...scenario, id: scenarioId };
        window.activeScenarioId = scenarioId;
        window.activeEmergencyState = { type: scenarioId, startTime: Date.now() };
        window.compaksInspected = false;
        window.limsLastTested = null;
        window.limsTestedProducts = [];
        window.limsTestedCount = 0;

        startTime = Date.now();
        completedSteps = [];
        copilotUsedFlag = false;
        hookCopilotChat();

        createTrainerPanel();
        startCheckLoop();
    }

    /* ===== ПАНЕЛЬ ЗАДАНИЙ ОПЕРАТОРА ===== */
    function createTrainerPanel() {
        if (panelEl) panelEl.remove();

        panelEl = document.createElement('div');
        panelEl.id = 'trainer-panel';
        panelEl.style.cssText = `
            position: fixed; top: 120px; right: 20px; width: 400px;
            background: #0d1117; border: 2px solid #ffd700;
            border-radius: 10px; z-index: 999998; overflow: hidden;
            box-shadow: 0 8px 32px rgba(255, 215, 0, 0.4);
            font-family: 'Segoe UI', Arial, sans-serif;
            user-select: none;
        `;

        panelEl.innerHTML = `
            <div id="trainer-drag-header" style="background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; cursor: move;">
                <div style="font-weight: bold; color: #000; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <span>✋</span>
                    <span>ЗАДАНИЕ ОПЕРАТОРУ</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div id="trainer-timer" style="background: #000; color: #ffd700; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: bold;">00:00</div>
                    <button onclick="ScenarioTrainer.toggleMinimize()" id="trainer-min-btn" style="background: rgba(0,0,0,0.3); border: none; color: #000; font-weight: bold; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 14px;" title="Свернуть/Развернуть">_</button>
                </div>
            </div>
            <div id="trainer-body" style="padding: 12px 14px;">
                <div style="font-size: 13px; font-weight: bold; color: #ffd700; margin-bottom: 6px;">${activeScenario.title}</div>
                <div style="font-size: 12px; color: #aaa; margin-bottom: 12px; line-height: 1.4;">${activeScenario.situation}</div>
                <div style="font-size: 11px; color: #888; margin-bottom: 8px;">⏱️ Лимит времени: <strong style="color: #ffd700;">${activeScenario.timeLimit} сек</strong> | Выполните все шаги:</div>
                <div id="trainer-steps" style="display: flex; flex-direction: column; gap: 6px;"></div>
                <div id="trainer-hint" style="margin-top: 10px; padding: 8px; background: rgba(255,215,0,0.08); border: 1px solid #333; border-radius: 4px; font-size: 11px; color: #888; display: none;"></div>
            </div>
            <div id="trainer-result" style="display: none; padding: 14px; text-align: center;"></div>
        `;

        document.body.appendChild(panelEl);
        makeDraggable(panelEl, document.getElementById('trainer-drag-header'));
        renderSteps();
    }

    /* ===== ДВИЖЕНИЕ ПАНЕЛИ ПО ЭКРАНУ (DRAG & DROP) ===== */
    function makeDraggable(el, handle) {
        let posX = 0, posY = 0, initialX = 0, initialY = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            initialX = e.clientX;
            initialY = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            posX = initialX - e.clientX;
            posY = initialY - e.clientY;
            initialX = e.clientX;
            initialY = e.clientY;
            el.style.top = (el.offsetTop - posY) + "px";
            el.style.left = (el.offsetLeft - posX) + "px";
            el.style.right = 'auto'; // Сбрасываем правый край при перетаскивании
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    let isMinimized = false;
    function toggleMinimize() {
        const body = document.getElementById('trainer-body');
        const btn = document.getElementById('trainer-min-btn');
        if (!body || !btn) return;

        isMinimized = !isMinimized;
        if (isMinimized) {
            body.style.display = 'none';
            btn.textContent = '🗖';
            panelEl.style.width = '240px';
        } else {
            body.style.display = 'block';
            btn.textContent = '_';
            panelEl.style.width = '400px';
        }
    }

    function renderSteps() {
        const container = document.getElementById('trainer-steps');
        if (!container || !activeScenario) return;

        container.innerHTML = '';
        activeScenario.steps.forEach((step, idx) => {
            const done = completedSteps.includes(step.id);
            const stepEl = document.createElement('div');
            stepEl.style.cssText = `
                display: flex; align-items: center; gap: 8px; padding: 6px 8px;
                background: ${done ? 'rgba(46, 204, 113, 0.12)' : 'rgba(255,255,255,0.03)'};
                border: 1px solid ${done ? '#2ecc71' : '#333'};
                border-radius: 5px; transition: all 0.3s;
            `;
            stepEl.innerHTML = `
                <div style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid ${done ? '#2ecc71' : '#555'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: ${done ? '#2ecc71' : '#555'}; background: ${done ? 'rgba(46,204,113,0.2)' : 'transparent'};">
                    ${done ? '✓' : (idx + 1)}
                </div>
                <div style="font-size: 12px; color: ${done ? '#2ecc71' : '#c5c6c7'}; ${done ? 'text-decoration: line-through;' : ''}">${step.text}</div>
            `;
            container.appendChild(stepEl);
        });
    }

    /* ===== ЦИКЛ ПРОВЕРКИ ВЫПОЛНЕНИЯ ===== */
    function startCheckLoop() {
        let hintShown = false;

        timerInterval = setInterval(() => {
            if (!activeScenario) { clearInterval(timerInterval); return; }

            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const timerEl = document.getElementById('trainer-timer');
            if (timerEl) {
                const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
                const secs = String(elapsed % 60).padStart(2, '0');
                timerEl.textContent = `${mins}:${secs}`;

                if (elapsed > activeScenario.timeLimit) {
                    timerEl.style.color = '#ff4444';
                    timerEl.style.background = '#330000';
                }
            }

            // Показать подсказку через 15 секунд
            if (elapsed >= 15 && !hintShown) {
                hintShown = true;
                const hintEl = document.getElementById('trainer-hint');
                if (hintEl && activeScenario.hints) {
                    const nextUndone = activeScenario.steps.find(s => !completedSteps.includes(s.id));
                    const hintIdx = activeScenario.steps.indexOf(nextUndone);
                    if (hintIdx >= 0 && activeScenario.hints[hintIdx]) {
                        hintEl.style.display = 'block';
                        hintEl.textContent = activeScenario.hints[hintIdx];
                    }
                }
            }

            // Проверяем каждый шаг
            let changed = false;
            activeScenario.steps.forEach(step => {
                if (!completedSteps.includes(step.id) && step.check()) {
                    completedSteps.push(step.id);
                    changed = true;
                    // Звуковой сигнал успеха
                    if (window.playBeep) window.playBeep(1200, 'sine', 0.1);
                    if (window.OperatorTracker && typeof window.OperatorTracker.logAction === 'function') {
                        window.OperatorTracker.logAction('SUCCESS_ACTION', `Выполнен шаг: ${step.text}`, { scenario: activeScenario.id, stepId: step.id });
                    }
                }
            });

            if (changed) {
                renderSteps();
                // Обновить подсказку для следующего шага
                const hintEl = document.getElementById('trainer-hint');
                if (hintEl && activeScenario.hints) {
                    const nextUndone = activeScenario.steps.find(s => !completedSteps.includes(s.id));
                    const hintIdx = activeScenario.steps.indexOf(nextUndone);
                    if (hintIdx >= 0 && activeScenario.hints[hintIdx]) {
                        hintEl.style.display = 'block';
                        hintEl.textContent = activeScenario.hints[hintIdx];
                    }
                }
            }

            // Все шаги выполнены?
            if (completedSteps.length === activeScenario.steps.length) {
                clearInterval(timerInterval);
                showResult(elapsed);
            }

            // Таймаут
            if (elapsed > activeScenario.timeLimit + 30) {
                clearInterval(timerInterval);
                showResult(elapsed, true);
            }

        }, 500);
    }

    /* ===== ИТОГОВЫЙ РЕЗУЛЬТАТ И ОЦЕНКА ===== */
    function showResult(elapsedSec, timeout = false) {
        const scenario = activeScenario;
        if (!scenario) return;

        const stepsTotal = scenario.steps.length;
        const stepsDone = completedSteps.length;
        const stepScore = Math.round((stepsDone / stepsTotal) * 60);

        let timeScore = 0;
        if (elapsedSec <= scenario.timeLimit * 0.5) timeScore = 40;
        else if (elapsedSec <= scenario.timeLimit) timeScore = 30;
        else if (elapsedSec <= scenario.timeLimit * 1.5) timeScore = 15;
        else timeScore = 5;

        const totalScore = stepScore + timeScore;

        let grade, gradeColor, gradeEmoji;
        if (totalScore >= 90) { grade = 'ОТЛИЧНО'; gradeColor = '#2ecc71'; gradeEmoji = '🏆'; }
        else if (totalScore >= 75) { grade = 'ХОРОШО'; gradeColor = '#27ae60'; gradeEmoji = '✅'; }
        else if (totalScore >= 55) { grade = 'УДОВЛЕТВОРИТЕЛЬНО'; gradeColor = '#f39c12'; gradeEmoji = '⚠️'; }
        else { grade = 'НЕУДОВЛЕТВОРИТЕЛЬНО'; gradeColor = '#e74c3c'; gradeEmoji = '❌'; }

        if (timeout && stepsDone < stepsTotal) {
            grade = 'ВРЕМЯ ВЫШЛО'; gradeColor = '#e74c3c'; gradeEmoji = '⏰';
        }

        // Сохраняем глобальный результат для выгрузки отчёта аттестации
        window.lastTrainerResult = {
            scenarioId: scenario.id,
            title: scenario.title,
            score: totalScore,
            grade: grade,
            stepsDone: stepsDone,
            stepsTotal: stepsTotal,
            elapsedSec: elapsedSec,
            timeLimit: scenario.timeLimit,
            isPassed: totalScore >= 60,
            timestamp: Date.now()
        };

        // Если авария успешно ликвидирована (или завершена) -> возвращаем технологический режим в норму
        if (totalScore >= 60 || stepsDone === stepsTotal) {
            window.activeEmergencyState = null;
            window.activeScenarioId = null;
            
            // Скрываем аварийный оверлей на мнемосхеме
            const overlay = document.getElementById('mnemo-alarm-overlay');
            if (overlay) overlay.style.display = 'none';
            
            // Восстанавливаем КОМПАКС в штатный зеленый режим
            window.compaksInspected = true;
            const vibVal1 = document.getElementById('vib-h1');
            const vibVal2 = document.getElementById('vib-h2');
            if (vibVal1) vibVal1.innerHTML = '<span class="vib-label">Н-1А:</span> <span class="vib-val green">3.2 мм/с <small style="opacity:0.6">(Норма | ISO A)</small></span>';
            if (vibVal2) vibVal2.innerHTML = '<span class="vib-label">Н-2А:</span> <span class="vib-val green">2.8 мм/с <small style="opacity:0.6">(Норма | ISO A)</small></span>';
            const compaksDiag = document.getElementById('compaks-diag');
            if (compaksDiag) compaksDiag.innerHTML = '<div style="font-size:10px;"><span style="color:#00f2fe;">Н-1А:</span> <span style="color:#2ecc71;">Подшипник исправен</span></div><div style="font-size:10px;"><span style="color:#a29bfe;">Н-2А:</span> <span style="color:#2ecc71;">Подшипник исправен</span></div>';
            const compaksMain = document.getElementById('compaks-main-panel');
            if (compaksMain) {
                compaksMain.style.borderColor = '#2ecc71';
                compaksMain.style.boxShadow = 'none';
            }
        }

        const resultEl = document.getElementById('trainer-result');
        if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = `
                <div style="font-size: 40px; margin-bottom: 6px;">${gradeEmoji}</div>
                <div style="font-size: 20px; font-weight: bold; color: ${gradeColor}; margin-bottom: 8px;">${grade}</div>
                <div style="font-size: 28px; font-weight: bold; color: #ffd700; margin-bottom: 10px;">${totalScore} / 100 баллов</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: left; margin: 10px 0;">
                    <div style="background: rgba(255,255,255,0.04); padding: 8px; border-radius: 4px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: #888;">Выполнено шагов</div>
                        <div style="font-size: 16px; font-weight: bold; color: ${stepsDone === stepsTotal ? '#2ecc71' : '#e74c3c'};">${stepsDone} / ${stepsTotal}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); padding: 8px; border-radius: 4px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: #888;">Время реакции</div>
                        <div style="font-size: 16px; font-weight: bold; color: ${elapsedSec <= scenario.timeLimit ? '#2ecc71' : '#e74c3c'};">${elapsedSec} сек (лимит ${scenario.timeLimit})</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); padding: 8px; border-radius: 4px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: #888;">Баллы за действия</div>
                        <div style="font-size: 16px; font-weight: bold; color: #ffd700;">${stepScore} / 60</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); padding: 8px; border-radius: 4px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: #888;">Баллы за скорость</div>
                        <div style="font-size: 16px; font-weight: bold; color: #ffd700;">${timeScore} / 40</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: center; margin-top: 10px;">
                    <button onclick="exportDebriefReport()" style="background: rgba(0,242,254,0.15); border: 1px solid #00f2fe; color: #00f2fe; padding: 8px 14px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                        📜 Скачать Отчет
                    </button>
                    <button onclick="ScenarioTrainer.close()" style="background: linear-gradient(135deg, #ffd700, #ff8c00); border: none; color: #000; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                        ✅ Завершить
                    </button>
                </div>
            `;
        }

        // Записываем в журнал
        if (window.addAlarmEvent) {
            window.addAlarmEvent("ИНФО", "Тренажёр", `Сценарий "${scenario.title}" завершён. Оценка: ${grade} (${totalScore}/100). Авария успешно ликвидирована.`);
        }

        activeScenario = null;
    }

    function close() {
        if (timerInterval) clearInterval(timerInterval);
        if (panelEl) panelEl.remove();
        panelEl = null;
        activeScenario = null;
        window.activeEmergencyState = null;
        window.activeScenarioId = null;
        const overlay = document.getElementById('mnemo-alarm-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    return { startTraining, close, toggleMinimize, SCENARIOS };
})();

window.ScenarioTrainer = ScenarioTrainer;
