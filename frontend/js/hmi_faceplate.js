/**
 * hmi_faceplate.js — Всплывающие стеклянные карточки управления (HMI Faceplates)
 * по стандарту ISA-101 для КТК ЭЛОУ-АВТ-5/5
 */

const EQUIPMENT_FACEDATA = {
    'H-1': {
        name: 'Насос сырьевой Н-1А/Б',
        type: 'Центробежный насос высокого давления',
        specs: 'Мощность: 400 кВт | Напор: 120 м | Расход: 150 м³/ч',
        paramLabel: 'Статус электродвигателя',
        controlType: 'toggle_pump',
        equipId: 'H-1'
    },
    'P-1': {
        name: 'Трубчатая печь нагрева П-1',
        type: 'Двухкамерная печь с шатровой радиацией',
        specs: 'Тепловая мощность: 5000 кВт | Расход топливного газа: 500 м³/ч',
        paramLabel: 'Задвижка топливного газа (%)',
        controlType: 'slider_fuel',
        equipId: 'fuel_gas_valve'
    },
    'K-1': {
        name: 'Атмосферная колонна К-1',
        type: 'Ректификационная колонна (28 клапанных тарелок)',
        specs: 'Давление верха: 0.12 МПа | Т верха: 120°C | Т куба: 280°C',
        paramLabel: 'Флегмовое число (Орошение К-1)',
        controlType: 'info_only',
        equipId: 'K-1'
    },
    'K-2': {
        name: 'Вакуумная колонна К-2',
        type: 'Колонна глубокого вакуума (43 тарелки)',
        specs: 'Остаточное давление: 0.008 МПа | Т куба: 360°C',
        paramLabel: 'Глубина вакуума',
        controlType: 'info_only',
        equipId: 'K-2'
    },
    'ELOU': {
        name: 'Электродегидратор ЭЛОУ (Э-1..Э-6)',
        type: '2-ступенчатый блок обессоливания нефти',
        specs: 'Напряжение 1 ст: 22 кВ | Напряжение 2 ст: 33 кВ | Содержание солей: 3.0 мг/л',
        paramLabel: 'Расход деэмульгатора (г/т)',
        controlType: 'info_only',
        equipId: 'ELOU'
    }
};

function openFaceplate(equipKey) {
    const data = EQUIPMENT_FACEDATA[equipKey];
    if (!data) return;

    let modal = document.getElementById('hmi-faceplate-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'hmi-faceplate-modal';
        modal.className = 'hmi-modal-backdrop';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="hmi-faceplate-card">
            <div class="hmi-card-header">
                <div class="hmi-title-group">
                    <span class="hmi-icon">⚙️</span>
                    <div>
                        <h3>${data.name}</h3>
                        <span class="hmi-subtitle">${data.type}</span>
                    </div>
                </div>
                <button class="hmi-close-btn" onclick="closeFaceplate()">✕</button>
            </div>
            <div class="hmi-card-body">
                <div class="hmi-specs">${data.specs}</div>
                <div class="hmi-live-status">
                    <span class="status-dot green"></span>
                    <span id="faceplate-live-val">Система работает в штатном режиме ISA-101</span>
                </div>
                ${getControlMarkup(data)}
            </div>
            <div class="hmi-card-footer">
                <span>АСУ ТП ИНТЕРФЕЙС • КТК ЭЛОУ-АВТ-5/5</span>
                <button class="hmi-action-btn" onclick="closeFaceplate()">Закрыть</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    if (window.OperatorTracker) {
        window.OperatorTracker.logAction('open_faceplate', equipKey, null);
    }
}

function setPidMode(mode, equipName) {
    window.currentPidModes = window.currentPidModes || {};
    window.currentPidModes[equipName] = mode;

    document.querySelectorAll(`.pid-mode-btn-${equipName}`).forEach(btn => {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.borderColor = '#444';
        btn.style.color = '#aaa';
    });

    const activeBtn = document.getElementById(`pid-btn-${equipName}-${mode}`);
    if (activeBtn) {
        activeBtn.style.background = 'rgba(0, 242, 254, 0.2)';
        activeBtn.style.borderColor = '#00f2fe';
        activeBtn.style.color = '#00f2fe';
    }

    const modeText = mode === 'MAN' ? 'РУЧНОЙ (MAN)' : (mode === 'AUTO' ? 'АВТОМАТИЧЕСКИЙ (AUTO)' : 'КАСКАДНЫЙ (CAS)');
    const statusEl = document.getElementById('faceplate-live-val');
    if (statusEl) {
        statusEl.textContent = `ПИД-регулятор [${equipName}]: ${modeText}`;
    }

    if (window.OperatorTracker) {
        window.OperatorTracker.logAction('set_pid_mode', equipName, mode);
    }
}

function getControlMarkup(data) {
    const activeMode = (window.currentPidModes && window.currentPidModes[data.equipId]) || 'MAN';

    let pidMarkup = `
        <div style="margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;">
            <div style="font-size: 11px; color: #888; margin-bottom: 6px; font-weight: bold;">РЕЖИМ ПИД-РЕГУЛЯТОРА (ISA-108 / ISA-101):</div>
            <div style="display: flex; gap: 6px;">
                <button id="pid-btn-${data.equipId}-MAN" class="pid-mode-btn-${data.equipId}" onclick="setPidMode('MAN', '${data.equipId}')" style="flex: 1; padding: 5px; font-size: 10px; border-radius: 4px; cursor: pointer; border: 1px solid ${activeMode === 'MAN' ? '#00f2fe' : '#444'}; background: ${activeMode === 'MAN' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${activeMode === 'MAN' ? '#00f2fe' : '#aaa'}; font-weight: bold;">РУЧН (MAN)</button>
                <button id="pid-btn-${data.equipId}-AUTO" class="pid-mode-btn-${data.equipId}" onclick="setPidMode('AUTO', '${data.equipId}')" style="flex: 1; padding: 5px; font-size: 10px; border-radius: 4px; cursor: pointer; border: 1px solid ${activeMode === 'AUTO' ? '#00f2fe' : '#444'}; background: ${activeMode === 'AUTO' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${activeMode === 'AUTO' ? '#00f2fe' : '#aaa'}; font-weight: bold;">АВТО (AUTO)</button>
                <button id="pid-btn-${data.equipId}-CAS" class="pid-mode-btn-${data.equipId}" onclick="setPidMode('CAS', '${data.equipId}')" style="flex: 1; padding: 5px; font-size: 10px; border-radius: 4px; cursor: pointer; border: 1px solid ${activeMode === 'CAS' ? '#00f2fe' : '#444'}; background: ${activeMode === 'CAS' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${activeMode === 'CAS' ? '#00f2fe' : '#aaa'}; font-weight: bold;">КАСКАД (CAS)</button>
            </div>
        </div>
    `;

    if (data.controlType === 'toggle_pump') {
        return `
            <div class="hmi-control-group">
                <label>Управление питающим насосом Н-1:</label>
                <button class="hmi-toggle-btn" onclick="togglePumpH1FromFaceplate()">
                    🔄 Переключить режим Н-1 (ПУСК / СТОП)
                </button>
            </div>
            ${pidMarkup}
        `;
    } else if (data.controlType === 'slider_fuel') {
        return `
            <div class="hmi-control-group">
                <label>Регулятор подачи топлива в Печь П-1:</label>
                <input type="range" id="faceplate-fuel-slider" min="0" max="100" value="${document.getElementById('fuel-gas-slider')?.value || 100}" oninput="syncFuelSlider(this.value)">
                <span class="hmi-val-display"><span id="faceplate-fuel-val">${document.getElementById('fuel-gas-slider')?.value || 100}</span> %</span>
            </div>
            ${pidMarkup}
        `;
    } else {
        return `
            <div class="hmi-control-group">
                <label>${data.paramLabel}:</label>
                <div class="hmi-info-badge">Автоматическое регулирование АСУ ТП</div>
            </div>
            ${pidMarkup}
        `;
    }
}

function togglePumpH1FromFaceplate() {
    const pumpH1 = document.getElementById('svg-pump-h1');
    if (pumpH1) pumpH1.click();
    closeFaceplate();
}

function syncFuelSlider(val) {
    const mainSlider = document.getElementById('fuel-gas-slider');
    if (mainSlider) {
        mainSlider.value = val;
        mainSlider.dispatchEvent(new Event('input'));
    }
    const valDisp = document.getElementById('faceplate-fuel-val');
    if (valDisp) valDisp.innerText = val;
}

function closeFaceplate() {
    const modal = document.getElementById('hmi-faceplate-modal');
    if (modal) modal.style.display = 'none';
}

// Экспорт глобально
window.openFaceplate = openFaceplate;
window.closeFaceplate = closeFaceplate;
