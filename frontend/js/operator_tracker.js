/**
 * operator_tracker.js — Модуль ИИ-трекинга действий оператора
 * 
 * Реализует 5 уровней ИИ-анализа по критериям CASE-IN:
 * 1. Фиксация действий оператора и сравнение с эталонным сценарием
 * 2. Идентификация и классификация типовых ошибок
 * 3. Локализация ошибок во времени с причинно-следственными связями
 * 4. Интерпретированная обратная связь оператору
 * 5. Адаптивный сценарий повторного обучения + прогноз риска ошибки
 */

const OperatorTracker = (() => {
    // === ХРАНИЛИЩЕ ДЕЙСТВИЙ ОПЕРАТОРА ===
    const actionLog = [];
    let sessionStartTime = Date.now();
    let currentScenarioId = null;
    let errorCount = 0;
    let correctCount = 0;
    let riskWarningCount = 0;

    // === ЭТАЛОННЫЕ СЦЕНАРИИ (правильная последовательность действий) ===
    const REFERENCE_SCENARIOS = {
        'CRUDE_LOSS': {
            name: 'Упуск сырья',
            steps: [
                { action: 'check_feed_flow', description: 'Проверить расход сырья на входе', timeLimit: 15 },
                { action: 'reduce_fuel_gas', description: 'Снизить подачу топливного газа в П-1', timeLimit: 30 },
                { action: 'close_crude_valve', description: 'Закрыть задвижку на сырьевой линии', timeLimit: 45 },
                { action: 'activate_cooling', description: 'Включить аварийное охлаждение змеевика', timeLimit: 60 },
                { action: 'notify_supervisor', description: 'Уведомить начальника смены', timeLimit: 90 }
            ]
        },
        'WATER_REFLUX': {
            name: 'Вода в орошении',
            steps: [
                { action: 'check_k1_pressure', description: 'Проверить давление К-1', timeLimit: 10 },
                { action: 'reduce_reflux', description: 'Снизить орошение Е-1', timeLimit: 25 },
                { action: 'open_safety_valve', description: 'Открыть предохранительный клапан', timeLimit: 40 },
                { action: 'reduce_fuel_gas', description: 'Снизить подачу топлива в П-1', timeLimit: 55 },
                { action: 'drain_water', description: 'Дренировать воду из Е-1', timeLimit: 70 }
            ]
        },
        'COIL_RUPTURE': {
            name: 'Прогар змеевика П-1',
            steps: [
                { action: 'emergency_stop_fuel', description: 'Аварийная отсечка топливного газа', timeLimit: 5 },
                { action: 'stop_crude_pump', description: 'Остановить насос сырья Н-1', timeLimit: 15 },
                { action: 'activate_steam_purge', description: 'Подача пара для продувки', timeLimit: 30 },
                { action: 'isolate_furnace', description: 'Изолировать печь от трубопроводов', timeLimit: 45 },
                { action: 'call_emergency', description: 'Вызвать пожарную бригаду', timeLimit: 60 }
            ]
        },
        'ELOU_SHORT': {
            name: 'Пробой трансформатора ЭЛОУ',
            steps: [
                { action: 'disconnect_power', description: 'Отключить питание электродегидратора', timeLimit: 10 },
                { action: 'check_salt_level', description: 'Проверить содержание солей', timeLimit: 25 },
                { action: 'increase_demulsifier', description: 'Увеличить подачу деэмульгатора', timeLimit: 40 },
                { action: 'bypass_desalter', description: 'Перевести на байпас ЭЛОУ', timeLimit: 55 },
                { action: 'notify_lab', description: 'Запросить экспресс-анализ у лаборатории', timeLimit: 70 }
            ]
        },
        'VACUUM_COLLAPSE': {
            name: 'Вакуумное схлопывание Е-2',
            steps: [
                { action: 'check_vacuum', description: 'Проверить уровень вакуума К-2', timeLimit: 10 },
                { action: 'open_nitrogen', description: 'Подать азот для выравнивания давления', timeLimit: 25 },
                { action: 'stop_vacuum_pump', description: 'Остановить вакуум-насос', timeLimit: 40 },
                { action: 'equalize_pressure', description: 'Выровнять давление до атмосферного', timeLimit: 55 },
                { action: 'inspect_vessel', description: 'Визуальная проверка целостности Е-2', timeLimit: 70 }
            ]
        },
        'GAS_LEAK': {
            name: 'Прорыв бензина в канализацию',
            steps: [
                { action: 'activate_gas_alarm', description: 'Подтвердить газовую тревогу', timeLimit: 10 },
                { action: 'isolate_source', description: 'Изолировать источник утечки (закрыть задвижки)', timeLimit: 25 },
                { action: 'stop_nearby_equipment', description: 'Остановить ближнее оборудование', timeLimit: 40 },
                { action: 'ventilate_area', description: 'Включить аварийную вентиляцию', timeLimit: 55 },
                { action: 'evacuate_personnel', description: 'Эвакуация персонала из зоны', timeLimit: 70 }
            ]
        }
    };

    // === КЛАССИФИКАЦИЯ ТИПОВЫХ ОШИБОК ===
    const ERROR_TYPES = {
        'LATE_REACTION': {
            name: 'Запоздалая реакция',
            description: 'Оператор выполнил действие позже допустимого времени',
            recommendation: 'Ускорьте реакцию: при аварии критично выполнять действия в первые секунды'
        },
        'WRONG_SEQUENCE': {
            name: 'Нарушение последовательности',
            description: 'Оператор выполнил действие не по порядку эталонного сценария',
            recommendation: 'Следуйте строгой последовательности: сначала защитные действия, затем диагностика'
        },
        'MISSED_STEP': {
            name: 'Пропуск критического шага',
            description: 'Оператор пропустил обязательный шаг аварийного протокола',
            recommendation: 'Не пропускайте шаги — каждый элемент протокола критически важен'
        },
        'WRONG_PARAMETER': {
            name: 'Неверная уставка параметра',
            description: 'Оператор задал неправильное значение на регуляторе',
            recommendation: 'Проверяйте значения по технологическому регламенту перед изменением уставок'
        },
        'IGNORED_ALARM': {
            name: 'Игнорирование тревоги',
            description: 'Оператор не отреагировал на срабатывание аварийной сигнализации',
            recommendation: 'Каждый сигнал тревоги требует немедленного внимания и подтверждения'
        }
    };

    // === ПРЕДИКТИВНАЯ МОДЕЛЬ РИСКА ОШИБКИ ===
    function calculateRiskScore(state, operatorHistory) {
        let riskScore = 0;
        const factors = [];

        // Фактор 1: Время без действий (бездействие оператора)
        const lastActionTime = actionLog.length > 0
            ? actionLog[actionLog.length - 1].timestamp
            : sessionStartTime;
        const inactivitySec = (Date.now() - lastActionTime) / 1000;
        if (inactivitySec > 30) {
            riskScore += Math.min(inactivitySec / 60 * 25, 30);
            factors.push(`Бездействие ${inactivitySec.toFixed(0)} сек`);
        }

        // Фактор 2: Количество предыдущих ошибок в сессии
        if (errorCount > 0) {
            riskScore += Math.min(errorCount * 10, 25);
            factors.push(`Уже допущено ${errorCount} ошибок`);
        }

        // Фактор 3: Критические параметры процесса
        if (state) {
            if (state.furnace && state.furnace.outlet_temperature > 370) {
                riskScore += 15;
                factors.push(`Т выхода печи ${state.furnace.outlet_temperature.toFixed(0)}°C > 370°C`);
            }
            if (state.atm_column && state.atm_column.top_pressure > 0.4) {
                riskScore += 15;
                factors.push(`Давление К-1 ${state.atm_column.top_pressure.toFixed(3)} МПа > 0.4`);
            }
            if (state.desalter && state.desalter.outlet_salt_content > 30) {
                riskScore += 10;
                factors.push(`Соли ЭЛОУ ${state.desalter.outlet_salt_content.toFixed(0)} мг/л > 30`);
            }
        }

        // Фактор 4: Время суток (усталость)
        const hour = new Date().getHours();
        if (hour >= 22 || hour <= 6) {
            riskScore += 10;
            factors.push('Ночная смена (повышенная усталость)');
        }

        return { score: Math.min(riskScore, 100), factors };
    }

    // === АДАПТИВНЫЙ МЕХАНИЗМ ===
    let adaptiveDifficulty = 'NORMAL'; // EASY, NORMAL, HARD

    function adjustDifficulty() {
        const total = errorCount + correctCount;
        if (total < 3) return;

        const errorRate = errorCount / total;
        if (errorRate > 0.5) {
            adaptiveDifficulty = 'EASY';
        } else if (errorRate < 0.15) {
            adaptiveDifficulty = 'HARD';
        } else {
            adaptiveDifficulty = 'NORMAL';
        }
        return adaptiveDifficulty;
    }

    function getAdaptiveRecommendation() {
        if (adaptiveDifficulty === 'EASY') {
            return '🟡 Рекомендация ИИ: Повторите текущий сценарий с подсказками. Сложность снижена.';
        } else if (adaptiveDifficulty === 'HARD') {
            return '🟢 Рекомендация ИИ: Вы готовы к усложнённому сценарию с сокращёнными временными лимитами.';
        }
        return '🔵 Рекомендация ИИ: Продолжайте в обычном режиме.';
    }

    // === ПУБЛИЧНЫЙ API ===
    return {
        /** Зафиксировать действие оператора */
        logAction(actionId, parameters = {}) {
            const entry = {
                timestamp: Date.now(),
                elapsedSec: (Date.now() - sessionStartTime) / 1000,
                action: actionId,
                parameters,
                scenarioId: currentScenarioId
            };
            actionLog.push(entry);

            // Сравниваем с эталоном
            if (currentScenarioId && REFERENCE_SCENARIOS[currentScenarioId]) {
                const ref = REFERENCE_SCENARIOS[currentScenarioId];
                const stepIdx = actionLog.filter(a => a.scenarioId === currentScenarioId).length - 1;

                if (stepIdx < ref.steps.length) {
                    const expectedStep = ref.steps[stepIdx];
                    if (actionId !== expectedStep.action) {
                        errorCount++;
                        entry.error = 'WRONG_SEQUENCE';
                        entry.feedback = ERROR_TYPES['WRONG_SEQUENCE'].recommendation;
                    } else if (entry.elapsedSec > expectedStep.timeLimit) {
                        errorCount++;
                        entry.error = 'LATE_REACTION';
                        entry.feedback = ERROR_TYPES['LATE_REACTION'].recommendation;
                    } else {
                        correctCount++;
                        entry.correct = true;
                    }
                }
            }
            adjustDifficulty();
            return entry;
        },

        /** Начать новый аварийный сценарий */
        startScenario(scenarioId) {
            currentScenarioId = scenarioId;
            sessionStartTime = Date.now();
            errorCount = 0;
            correctCount = 0;
            console.log(`[OperatorTracker] Сценарий ${scenarioId} запущен`);
        },

        /** Получить текущий отчёт */
        getReport() {
            const total = errorCount + correctCount;
            return {
                scenario: currentScenarioId,
                scenarioName: currentScenarioId ? (REFERENCE_SCENARIOS[currentScenarioId]?.name || currentScenarioId) : 'Свободный режим',
                totalActions: actionLog.length,
                correctActions: correctCount,
                errors: errorCount,
                accuracy: total > 0 ? ((correctCount / total) * 100).toFixed(1) : '0.0',
                adaptiveDifficulty,
                adaptiveRecommendation: getAdaptiveRecommendation(),
                sessionDurationSec: ((Date.now() - sessionStartTime) / 1000).toFixed(0),
                actionLog: actionLog.slice(-20) // последние 20 действий
            };
        },

        /** Предиктивный прогноз риска ошибки */
        predictRisk(currentState) {
            const risk = calculateRiskScore(currentState, actionLog);

            if (risk.score > 60 && riskWarningCount < 3) {
                riskWarningCount++;
                return {
                    level: 'HIGH',
                    score: risk.score,
                    message: `⚠️ ПРОГНОЗ ИИ: Вероятность ошибки ${risk.score}%. Обратите внимание!`,
                    factors: risk.factors
                };
            } else if (risk.score > 35) {
                return {
                    level: 'MEDIUM',
                    score: risk.score,
                    message: `🟡 Внимание: Уровень риска ${risk.score}%`,
                    factors: risk.factors
                };
            }
            return { level: 'LOW', score: risk.score, message: '', factors: [] };
        },

        /** Получить полный лог для отчёта дебрифинга */
        getFullLog() { return [...actionLog]; },

        /** Получить классификацию ошибок */
        getErrorClassification() {
            const classified = {};
            actionLog.forEach(entry => {
                if (entry.error) {
                    if (!classified[entry.error]) classified[entry.error] = { count: 0, details: ERROR_TYPES[entry.error] };
                    classified[entry.error].count++;
                }
            });
            return classified;
        },

        /** Получить эталонные сценарии */
        getScenarios() { return REFERENCE_SCENARIOS; },

        /** Сброс */
        reset() {
            actionLog.length = 0;
            sessionStartTime = Date.now();
            currentScenarioId = null;
            errorCount = 0;
            correctCount = 0;
            riskWarningCount = 0;
            adaptiveDifficulty = 'NORMAL';
        }
    };
})();

// Делаем глобально доступным
window.OperatorTracker = OperatorTracker;
