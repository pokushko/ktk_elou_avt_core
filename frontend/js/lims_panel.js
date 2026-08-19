/**
 * lims_panel.js — Экспресс-Лаборатория LIMS (Лабораторный информационный модуль)
 * Интерактивный анализ качества нефти и фракций по ГОСТ в реальном времени.
 */

let limsAnalysisHistory = [];
let pendingAnalyses = new Set();

document.addEventListener('DOMContentLoaded', () => {
    initLimsButtons();
    seedInitialLimsData();
});

function initLimsButtons() {
    const buttons = document.querySelectorAll('.lims-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const product = btn.getAttribute('data-product');
            runLimsAnalysis(product);
        });
    });
}

function runLimsAnalysis(productKey) {
    window.limsLastTested = productKey;
    window.limsTestedCount = (window.limsTestedCount || 0) + 1;
    if (pendingAnalyses.has(productKey)) return;
    pendingAnalyses.add(productKey);

    const btn = document.querySelector(`.lims-btn[data-product="${productKey}"]`);
    if (btn) {
        btn.classList.add('analyzing');
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
    }

    if (window.playBeep) window.playBeep(900, 'sine', 0.1);
    showLimsPendingRow(productKey);

    setTimeout(() => {
        pendingAnalyses.delete(productKey);
        if (btn) {
            btn.classList.remove('analyzing');
            btn.style.opacity = '1.0';
            btn.style.pointerEvents = 'auto';
        }

        const result = calculateLimsParameters(productKey);
        
        const pendingRow = document.getElementById(`lims-pending-${productKey}`);
        if (pendingRow) pendingRow.remove();

        addLimsRecord(result);

        if (!result.is_spec) {
            if (window.playBeep) window.playBeep(400, 'sawtooth', 0.3);
            if (window.addAlarmEvent) {
                window.addAlarmEvent("ПРЕД", "LIMS", `🚨 БРАК ФРАКЦИИ: ${result.product_name} — ${result.property_name}: ${result.measured_value.toFixed(2)} (Норма: ${result.target_value.toFixed(2)})`);
            }
            if (window.addCopilotMessage) {
                window.addCopilotMessage(`⚠️ LIMS ЛАБОРАТОРИЯ: Проба "${result.product_name}" отбракована! ${result.property_name} = ${result.measured_value.toFixed(2)} (вне ГОСТ). Причина: откланение технологического режима.`);
            }
        } else {
            if (window.playBeep) window.playBeep(1200, 'sine', 0.15);
        }

        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            window.ws.send(JSON.stringify({ type: "lims_request", product: productKey }));
        }

    }, 1200);
}

function calculateLimsParameters(productKey) {
    const timeStr = new Date().toLocaleTimeString();
    const timestamp = Math.floor(Date.now() / 1000);
    const em = (window.activeEmergencyState && window.activeEmergencyState.type) || window.activeScenarioId || null;
    const fuelVal = parseFloat(document.getElementById('fuel-gas-slider')?.value || 50);
    const crudeVal = parseFloat(document.getElementById('crude-feed-slider')?.value || 100);

    let productName = translateProduct(productKey);
    let propertyName = "Плотность при 20°C (кг/м³)";
    let measuredValue = 850.0;
    let targetValue = 850.0;
    let isSpec = true;

    if (productKey === 'crude_oil') {
        propertyName = "Содержимое воды и солей (%)";
        targetValue = 0.5;
        if (em === 'gas_leak' || em === 'salt_breakthrough' || em === 'vibration_compaks' || em === 'esd_trip') {
            measuredValue = 4.8;
            isSpec = false;
        } else {
            measuredValue = 0.2 + (Math.random() - 0.5) * 0.1;
            isSpec = true;
        }
    } 
    else if (productKey === 'desalted_oil') {
        propertyName = "Соли после ЭЛОУ (мг/л)";
        targetValue = 5.0;
        if (em === 'salt_breakthrough' || em === 'esd_trip' || crudeVal > 95) {
            measuredValue = 58.4;
            isSpec = false;
        } else {
            measuredValue = 3.2 + (Math.random() - 0.5) * 0.5;
            isSpec = true;
        }
    } 
    else if (productKey === 'gasoline') {
        propertyName = "Конец кипения КК (°C)";
        targetValue = 180.0;
        if (em === 'overheat' || em === 'k1_overpressure' || em === 'gas_leak' || em === 'esd_trip' || fuelVal > 85) {
            measuredValue = 208.5;
            isSpec = false;
        } else {
            measuredValue = 176.4 + (Math.random() - 0.5) * 2;
            isSpec = true;
        }
    } 
    else if (productKey === 'kerosene') {
        propertyName = "Температура вспышки (°C)";
        targetValue = 38.0;
        if (em === 'vacuum_drop' || em === 'k1_overpressure' || em === 'overheat' || em === 'esd_trip' || fuelVal > 90) {
            measuredValue = 31.2;
            isSpec = false;
        } else {
            measuredValue = 42.5 + (Math.random() - 0.5) * 2;
            isSpec = true;
        }
    } 
    else if (productKey === 'mazut') {
        propertyName = "Вязкость условная ВУ (80°C)";
        targetValue = 8.5;
        if (em === 'vacuum_drop' || em === 'power_blackout' || em === 'esd_trip') {
            measuredValue = 4.2;
            isSpec = false;
        } else {
            measuredValue = 9.4 + (Math.random() - 0.5) * 0.5;
            isSpec = true;
        }
    }

    return {
        timestamp,
        timeStr,
        product_name: productName,
        property_name: propertyName,
        measured_value: measuredValue,
        target_value: targetValue,
        is_spec: isSpec
    };
}

function showLimsPendingRow(productKey) {
    const log = document.getElementById('lims-tbody') || document.getElementById('lims-log');
    if (!log) return;
    
    const old = document.getElementById(`lims-pending-${productKey}`);
    if (old) old.remove();

    const tr = document.createElement('tr');
    tr.id = `lims-pending-${productKey}`;
    tr.style.background = 'rgba(0, 242, 254, 0.08)';
    tr.innerHTML = `
        <td style="color:#00f2fe;font-family:monospace;">${new Date().toLocaleTimeString()}</td>
        <td style="font-weight:bold;color:#00f2fe;">${translateProduct(productKey)}</td>
        <td colspan="4" style="color:#ffd700;font-style:italic;">
            ⏳ Выполняется фотометрический и титрометрический экспресс-анализ ЦЗЛ...
        </td>
    `;
    log.prepend(tr);
}

function addLimsRecord(record) {
    limsAnalysisHistory.unshift(record);
    if (limsAnalysisHistory.length > 20) limsAnalysisHistory.pop();
    renderLimsTable();
}

function renderLimsTable() {
    const log = document.getElementById('lims-tbody') || document.getElementById('lims-log');
    if (!log) return;
    
    log.innerHTML = '';
    limsAnalysisHistory.forEach(item => {
        const tr = document.createElement('tr');
        const isPass = item.is_spec;
        const specClass = isPass ? 'spec-pass' : 'spec-fail';
        const specText = isPass ? '✅ ГОСТ (СООТВЕТСТВУЕТ)' : '❌ БРАК (НЕКОНДИЦИЯ)';
        
        tr.style.borderBottom = '1px solid #1a2332';
        tr.innerHTML = `
            <td style="font-family:monospace;color:#aaa;">${item.timeStr || new Date(item.timestamp * 1000).toLocaleTimeString()}</td>
            <td style="font-weight:bold;color:#c5c6c7;">${item.product_name}</td>
            <td style="color:#888;font-size:11px;">${item.property_name}</td>
            <td style="font-weight:bold;font-family:monospace;color:${isPass ? '#00f2fe' : '#ff3838'};">${item.measured_value.toFixed(2)}</td>
            <td style="font-family:monospace;color:#666;">${item.target_value.toFixed(2)}</td>
            <td><span class="${specClass}" style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;display:inline-block;">${specText}</span></td>
        `;
        log.appendChild(tr);
    });
}

function seedInitialLimsData() {
    const now = Math.floor(Date.now() / 1000);
    limsAnalysisHistory = [
        { timestamp: now - 120, timeStr: new Date((now - 120)*1000).toLocaleTimeString(), product_name: 'Обессоленная нефть', property_name: 'Соли после ЭЛОУ (мг/л)', measured_value: 3.10, target_value: 5.0, is_spec: true },
        { timestamp: now - 300, timeStr: new Date((now - 300)*1000).toLocaleTimeString(), product_name: 'Бензин', property_name: 'Конец кипения КК (°C)', measured_value: 176.80, target_value: 180.0, is_spec: true },
        { timestamp: now - 600, timeStr: new Date((now - 600)*1000).toLocaleTimeString(), product_name: 'Керосин', property_name: 'Температура вспышки (°C)', measured_value: 42.10, target_value: 38.0, is_spec: true },
        { timestamp: now - 900, timeStr: new Date((now - 900)*1000).toLocaleTimeString(), product_name: 'Мазут', property_name: 'Вязкость условная ВУ (80°C)', measured_value: 9.80, target_value: 8.50, is_spec: true }
    ];
    renderLimsTable();
}

function translateProduct(prod) {
    const mapping = {
        "crude_oil": "Сырая нефть",
        "desalted_oil": "Обессоленная нефть",
        "gasoline": "Бензин",
        "kerosene": "Керосин",
        "mazut": "Мазут"
    };
    return mapping[prod] || prod;
}

window.updateLimsTable = function(externalList) {
    if (externalList && externalList.length > 0) {
        externalList.forEach(item => {
            addLimsRecord({
                timestamp: item.timestamp,
                timeStr: new Date(item.timestamp * 1000).toLocaleTimeString(),
                product_name: item.product_name,
                property_name: item.property_name,
                measured_value: item.measured_value,
                target_value: item.target_value,
                is_spec: item.is_spec
            });
        });
    }
};
