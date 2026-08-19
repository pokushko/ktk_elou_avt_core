// Дополнительные визуальные эффекты и кастомный рендеринг SVG мнемосхемы
function animateEquipmentStatus(state) {
    // Насос Н-1 статус (зеленый при работе, красный при останове)
    const pumpH1 = document.querySelector('circle[cx="50"][cy="150"]');
    if (pumpH1) {
        const isRunning = state.pumps && state.pumps[0] && state.pumps[0].is_running;
        pumpH1.setAttribute('fill', isRunning ? '#10ac84' : '#ff3838');
        pumpH1.setAttribute('stroke', isRunning ? '#00f2fe' : '#ffffff');
    }
    
    // ЭЛОУ напряжение предупреждение
    const elouBorder = document.querySelector('rect[x="250"][y="100"]');
    if (elouBorder) {
        const hasLowVoltage = state.desalter.stage1_voltage < 10.0;
        elouBorder.setAttribute('stroke', hasLowVoltage ? '#ff3838' : '#0097a7');
    }

    // Включение анимаций потоков (трубопроводов)
    const isFlowing = state.crude_feed && state.crude_feed.flow_rate > 10.0;
    const isHot = state.atm_column && state.atm_column.feed_temperature > 200.0;
    const isVacuumActive = state.vac_column && state.vac_column.top_pressure < 0.05;

    const lines = {
        '#flow-raw': isFlowing,
        '#flow-des': isFlowing,
        '#flow-out': isFlowing,
        '#flow-furn': isFlowing,
        '#flow-hot': isFlowing && isHot,
        '#flow-vac': isFlowing && isVacuumActive
    };

    for (const [selector, active] of Object.entries(lines)) {
        const path = document.querySelector(selector);
        if (path) {
            if (active) {
                path.classList.add('active');
            } else {
                path.classList.remove('active');
            }
        }
    }
    
    // Анимация пламени печи П-1 (регулировка высоты пламени от расхода газа)
    const flame = document.querySelector('#svg-flame');
    if (flame) {
        const fuelGas = state.furnace ? state.furnace.fuel_gas_flow : 0;
        if (fuelGas > 50) {
            flame.style.display = 'block';
            flame.style.transform = `scaleY(${0.5 + fuelGas / 1000.0})`;
        } else {
            flame.style.display = 'none';
        }
    }
}

// Переключатель визуальных режимов (WebGL 3D HMI vs Classic 2D P&ID)
let is3DMode = false;

function toggleHmiMode() {
    is3DMode = !is3DMode;
    const btn = document.querySelector('.hmi-mode-toggle-btn');
    const svgWrapper = document.getElementById('hmi-svg-wrapper');
    const svgElement = document.getElementById('pid-svg');
    const threeCanvas = document.getElementById('three-canvas');
    
    if (btn) {
        btn.innerText = is3DMode ? "🌐 Режим: WebGL 3D HMI" : "📐 Режим: Classic 2D P&ID";
    }
    
    if (is3DMode) {
        if (svgElement) svgElement.style.display = 'none';
        if (threeCanvas) {
            threeCanvas.style.display = 'block';
            threeCanvas.style.height = '310px';
            threeCanvas.style.width = '100%';
        }
        if (svgWrapper) {
            svgWrapper.style.minHeight = '330px';
            svgWrapper.style.height = '330px';
            svgWrapper.style.boxShadow = "0 0 25px rgba(0, 242, 254, 0.35)";
        }
        
        if (window.initThreeScene && svgWrapper) {
            window.initThreeScene(svgWrapper);
            if (window.resumeThreeScene) window.resumeThreeScene();
        }
    } else {
        if (threeCanvas) threeCanvas.style.display = 'none';
        if (svgElement) {
            svgElement.style.display = 'block';
            svgElement.style.height = '310px';
            svgElement.style.width = '100%';
        }
        if (svgWrapper) {
            svgWrapper.style.minHeight = '330px';
            svgWrapper.style.height = '330px';
            svgWrapper.style.boxShadow = "0 0 15px rgba(0, 242, 254, 0.15)";
        }
        
        if (window.stopThreeScene) window.stopThreeScene();
    }
}

window.toggleHmiMode = toggleHmiMode;
window.animateEquipmentStatus = animateEquipmentStatus;

