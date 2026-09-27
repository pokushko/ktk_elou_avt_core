// Виброакустический мониторинг «Компакс» — полнофункциональная система диагностики
// ISO 10816-3 / ГОСТ Р ИСО 10816 — нормы виброскорости вращающегося оборудования
let lastVoiceAlertTime = 0;
const VOICE_COOLDOWN_MS = 20000;

// Исторические данные вибрации (для трендов)
const vibHistory = {
    h1: [],
    h2: [],
    maxLen: 60
};

// Спектр вибрации (имитация реальных частотных составляющих)
let vibSpectrumCanvas = null;
let vibSpectrumCtx = null;

function initCompaksSpectrum() {
    vibSpectrumCanvas = document.getElementById('compaks-spectrum');
    if (vibSpectrumCanvas) {
        vibSpectrumCtx = vibSpectrumCanvas.getContext('2d');
        vibSpectrumCanvas.width = vibSpectrumCanvas.offsetWidth;
        vibSpectrumCanvas.height = vibSpectrumCanvas.offsetHeight;
    }

    const compaksPanel = document.querySelector('.compaks-panel');
    const ackBtn = document.getElementById('compaks-ack-btn');

    function acknowledgeCompaks() {
        window.compaksInspected = true;
        if (window.playBeep) window.playBeep(1200, 'sine', 0.15);
        if (ackBtn) {
            ackBtn.style.background = 'rgba(46, 204, 113, 0.3)';
            ackBtn.style.borderColor = '#2ecc71';
            ackBtn.style.color = '#2ecc71';
            ackBtn.textContent = '✓ Диагностика зафиксирована';
        }
        if (compaksPanel) {
            compaksPanel.style.borderColor = '#2ecc71';
            compaksPanel.style.boxShadow = '0 0 10px rgba(46, 204, 113, 0.4)';
        }
    }

    if (compaksPanel && !compaksPanel._inspectorHooked) {
        compaksPanel._inspectorHooked = true;
        compaksPanel.addEventListener('click', acknowledgeCompaks);
    }
    if (ackBtn && !ackBtn._ackHooked) {
        ackBtn._ackHooked = true;
        ackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            acknowledgeCompaks();
        });
    }
}

function updateCompaksPanel(state, alarms) {
    const cardH1 = document.getElementById('vib-h1');
    const cardH2 = document.getElementById('vib-h2');
    
    const h1 = (state && state.pumps && state.pumps[0]) ? state.pumps[0] : { wear_factor: 0.1, cavitation_risk: 0.0, is_running: true };
    const h2 = (state && state.pumps && state.pumps[1]) ? state.pumps[1] : { wear_factor: 0.1, cavitation_risk: 0.0, is_running: true };
    
    // Расчёт виброскорости по ISO 10816
    let vib1 = 2.5 + h1.wear_factor * 10.0 + h1.cavitation_risk * 5.0;
    let vib2 = 2.0 + h2.wear_factor * 8.0 + h2.cavitation_risk * 4.0;
    
    // При аварийном сценарии КОМПАКС (vibration_compaks)
    const isVibScenario = (window.activeEmergencyState && window.activeEmergencyState.type === 'vibration_compaks') ||
                          (window.activeScenarioId === 'vibration_compaks');
                          
    if (isVibScenario) {
        vib1 = 12.8 + Math.sin(Date.now() / 400) * 0.4;
        const compaksPanel = document.getElementById('compaks-main-panel');
        if (compaksPanel && !window.compaksInspected) {
            compaksPanel.style.borderColor = '#ff3838';
            compaksPanel.style.boxShadow = '0 0 15px rgba(255, 56, 56, 0.6)';
        }
    } else {
        if (!h1.is_running) vib1 = 0.0;
        if (!h2.is_running) vib2 = 0.0;
    }
    
    // Добавляем лёгкий шум для реалистичности
    if (vib1 > 0 && !isVibScenario) vib1 += (Math.random() - 0.5) * 0.3;
    if (vib2 > 0) vib2 += (Math.random() - 0.5) * 0.2;
    vib1 = Math.max(0, vib1);
    vib2 = Math.max(0, vib2);

    updateVibrationCard(cardH1, "Н-1А", vib1);
    updateVibrationCard(cardH2, "Н-2А", vib2);
    
    // Сохраняем в историю
    vibHistory.h1.push(vib1);
    vibHistory.h2.push(vib2);
    if (vibHistory.h1.length > vibHistory.maxLen) vibHistory.h1.shift();
    if (vibHistory.h2.length > vibHistory.maxLen) vibHistory.h2.shift();

    // Обновляем мини-тренд виброскорости
    drawVibTrend();

    // Обновляем спектр вибрации
    drawVibSpectrum(vib1, vib2, h1, h2);

    // Обновляем диагностику подшипников
    updateBearingDiag(vib1, vib2, h1, h2, isVibScenario);

    // Голосовые оповещения
    const voiceToggle = document.getElementById('voice-enable-toggle');
    const voiceEnabled = voiceToggle ? voiceToggle.checked : false;
    const now = Date.now();
    
    if (voiceEnabled && (now - lastVoiceAlertTime > VOICE_COOLDOWN_MS)) {
        if (vib1 > 7.1) {
            speakAlert("Внимание! Опасная вибрация подшипника насоса сырья Аш один А! Виброскорость " + vib1.toFixed(1) + " миллиметров в секунду! Перейдите на резерв.");
            lastVoiceAlertTime = now;
        } else if (vib2 > 7.1) {
            speakAlert("Внимание! Опасная вибрация подшипника печного насоса Аш два А! Требуется останов.");
            lastVoiceAlertTime = now;
        }
    }
}

function updateVibrationCard(element, name, value) {
    if (!element) return;
    const valSpan = element.querySelector('.vib-val');
    if (!valSpan) return;
    
    // ISO 10816-3 Group 2 (Medium machines 15-75 kW)
    // Zone A: < 2.8 мм/с (Отлично) 
    // Zone B: 2.8-7.1 мм/с (Допустимо)
    // Zone C: 7.1-11.2 мм/с (Предупреждение/Ограниченная эксплуатация)  
    // Zone D: > 11.2 мм/с (Авария/Недопустимо)
    let statusClass = 'green';
    let statusText = 'Норма';
    let isoZone = 'A';
    
    if (value === 0.0) {
        statusText = 'Остановлен';
        statusClass = 'grey';
        isoZone = '—';
    } else if (value > 11.2) {
        statusClass = 'red';
        statusText = 'АВАРИЯ';
        isoZone = 'D';
    } else if (value > 7.1) {
        statusClass = 'red';
        statusText = 'Опасно';
        isoZone = 'C';
    } else if (value > 4.5) {
        statusClass = 'yellow';
        statusText = 'Предупр.';
        isoZone = 'B+';
    } else if (value > 2.8) {
        statusClass = 'green';
        statusText = 'Допустимо';
        isoZone = 'B';
    }
    
    valSpan.className = `vib-val ${statusClass}`;
    valSpan.innerHTML = `${value.toFixed(1)} мм/с <small style="opacity:0.6">(${statusText} | ISO ${isoZone})</small>`;
    
    // Анимация пульсации при аварии
    if (value > 7.1) {
        element.style.animation = 'vibPulse 0.5s ease-in-out infinite';
    } else {
        element.style.animation = 'none';
    }
}

// Мини-тренд виброскорости (графические полоски)
function drawVibTrend() {
    const canvas = document.getElementById('compaks-trend');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, w, h);
    
    // Фон
    ctx.fillStyle = 'rgba(10, 16, 29, 0.8)';
    ctx.fillRect(0, 0, w, h);
    
    // Зоны ISO 10816
    const maxVib = 15;
    const zoneA = (2.8 / maxVib) * h;
    const zoneB = (7.1 / maxVib) * h;
    const zoneC = (11.2 / maxVib) * h;
    
    ctx.fillStyle = 'rgba(46, 204, 113, 0.06)';
    ctx.fillRect(0, h - zoneA, w, zoneA);
    ctx.fillStyle = 'rgba(241, 196, 15, 0.06)';
    ctx.fillRect(0, h - zoneB, w, zoneB - zoneA);
    ctx.fillStyle = 'rgba(231, 76, 60, 0.06)';
    ctx.fillRect(0, h - zoneC, w, zoneC - zoneB);
    
    // Линии порогов
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h - zoneB);
    ctx.lineTo(w, h - zoneB);
    ctx.stroke();
    ctx.setLineDash([]);

    // Тренд Н-1А
    drawTrendLine(ctx, vibHistory.h1, w, h, maxVib, '#00f2fe');
    // Тренд Н-2А
    drawTrendLine(ctx, vibHistory.h2, w, h, maxVib, '#a29bfe');
}

function drawTrendLine(ctx, data, w, h, maxVal, color) {
    if (data.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = w / (vibHistory.maxLen - 1);
    for (let i = 0; i < data.length; i++) {
        const x = i * step;
        const y = h - (data[i] / maxVal) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// Спектр вибрации (FFT-подобная визуализация)
function drawVibSpectrum(vib1, vib2, pump1, pump2) {
    const canvas = document.getElementById('compaks-spectrum');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10, 16, 29, 0.9)';
    ctx.fillRect(0, 0, w, h);
    
    // Заголовок
    ctx.fillStyle = '#888';
    ctx.font = '9px Inter, Arial';
    ctx.fillText('Спектр вибрации Н-1А (Гц)', 4, 10);
    
    // Генерация спектральных линий (частоты)
    const rpm = pump1.is_running ? 2970 : 0;
    const fRot = rpm / 60; // Частота вращения (~49.5 Гц)
    const fBPF = fRot * 7;  // Лопастная (Ball Pass Frequency)
    
    const numBars = 40;
    const barW = (w - 10) / numBars;
    const freqStep = 500 / numBars;
    
    for (let i = 0; i < numBars; i++) {
        const freq = i * freqStep;
        let amplitude = 0;
        
        if (vib1 > 0) {
            // Базовый шум
            amplitude += Math.random() * vib1 * 0.05;
            
            // 1x (частота вращения ~50 Гц) — дисбаланс ротора
            if (Math.abs(freq - fRot) < freqStep) amplitude += vib1 * 0.6;
            // 2x — расцентровка
            if (Math.abs(freq - fRot * 2) < freqStep) amplitude += vib1 * 0.3 * pump1.wear_factor;
            // 3x — повреждение подшипника
            if (Math.abs(freq - fRot * 3) < freqStep) amplitude += vib1 * 0.2 * pump1.wear_factor;
            // BPF — лопастная частота
            if (Math.abs(freq - fBPF) < freqStep * 2) amplitude += vib1 * 0.15;
            // Высокочастотный шум при износе
            if (pump1.wear_factor > 0.5 && freq > 300) amplitude += vib1 * 0.1 * Math.random();
        }
        
        const barH = (amplitude / 15) * h;
        const x = 5 + i * barW;
        
        // Цвет по амплитуде
        let color;
        if (amplitude > 7.1) color = '#ff3838';
        else if (amplitude > 4.5) color = '#ffa500';
        else color = '#00f2fe';
        
        ctx.fillStyle = color;
        ctx.fillRect(x, h - barH, barW - 1, barH);
    }
    
    // Подписи частот
    ctx.fillStyle = '#555';
    ctx.font = '8px monospace';
    ctx.fillText('0', 5, h - 2);
    ctx.fillText('250 Гц', w / 2 - 15, h - 2);
    ctx.fillText('500', w - 20, h - 2);
}

// Диагностика подшипников
function updateBearingDiag(vib1, vib2, pump1, pump2, isVibScenario = false) {
    const diagEl = document.getElementById('compaks-diag');
    if (!diagEl) return;
    
    let diag1 = 'Подшипник исправен';
    let diag1Color = '#2ecc71';
    if (isVibScenario || vib1 > 11.2) { 
        diag1 = '⛔ РАЗРУШЕНИЕ ПОДШИПНИКА! Немедленная замена!'; 
        diag1Color = '#ff3838'; 
    }
    else if (vib1 > 7.1) { diag1 = '🔴 Дефект наружного кольца. Замена при ТО.'; diag1Color = '#ff3838'; }
    else if (vib1 > 4.5) { diag1 = '🟡 Начальный износ. Мониторинг каждые 4ч.'; diag1Color = '#ffa500'; }
    
    let diag2 = 'Подшипник исправен';
    let diag2Color = '#2ecc71';
    if (vib2 > 11.2) { diag2 = '⛔ РАЗРУШЕНИЕ! Немедленный останов!'; diag2Color = '#ff0000'; }
    else if (vib2 > 7.1) { diag2 = '🔴 Дефект внутреннего кольца.'; diag2Color = '#ff3838'; }
    else if (vib2 > 4.5) { diag2 = '🟡 Повышенный зазор. Контроль.'; diag2Color = '#ffa500'; }

    diagEl.innerHTML = `
        <div style="display:flex;gap:6px;flex-direction:column;">
            <div style="font-size:11px;">
                <span style="color:#00f2fe;">Н-1А:</span>
                <span style="color:${diag1Color};">${diag1}</span>
            </div>
            <div style="font-size:11px;">
                <span style="color:#a29bfe;">Н-2А:</span>
                <span style="color:${diag2Color};">${diag2}</span>
            </div>
        </div>
    `;
}

function speakAlert(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// CSS-анимация пульсации при аварии
if (!document.getElementById('compaks-css')) {
    const style = document.createElement('style');
    style.id = 'compaks-css';
    style.textContent = `
        @keyframes vibPulse {
            0%, 100% { box-shadow: 0 0 5px rgba(255,56,56,0.4); }
            50% { box-shadow: 0 0 18px rgba(255,56,56,0.9); }
        }
    `;
    document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', () => {
    initCompaksSpectrum();
});
