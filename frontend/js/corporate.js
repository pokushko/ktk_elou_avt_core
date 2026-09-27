// Корпоративный модуль биржевых котировок (ПАО «Газпром нефть» / Мосбиржа)
let baseStockPrice = 620.00;
const INITIAL_STOCK_PRICE = 620.00;

function updateCorporateScreen(state, alarms, interlocks) {
    const priceHdr = document.getElementById('stock-price-hdr');
    const changeHdr = document.getElementById('stock-change-hdr');
    
    // Считаем технологические факторы риска
    const hasPazTrip = Array.isArray(interlocks) && interlocks.some(item => item && item.is_tripped);
    const hasEmergency = Boolean(window.activeEmergencyState);
    const hasActiveAlarms = Array.isArray(alarms) && alarms.length > 0;
    const hasEmissionViolation = Boolean(state?.furnace?.emissions?.is_violating);
    
    // Целевой дисконт цены в зависимости от аварийной обстановки на АВТ-5/5
    let targetChangePct = 0.08; // Нормальный штатный режим: +0.08% (стабильный бизнес)
    
    if (hasPazTrip || hasEmergency) {
        targetChangePct = -3.85; // Аварийная остановка / Срыв режима: падение на -3.85%
    } else if (hasEmissionViolation) {
        targetChangePct = -1.25; // Экологический штраф ПДК: падение на -1.25%
    } else if (hasActiveAlarms) {
        targetChangePct = -0.40; // Нештатное отклонение параметров: легкая просадка -0.40%
    }
    
    // Целевая цена с учетом случайного биржевого микрошума (+- 0.05%)
    const microNoise = (Math.random() - 0.5) * 0.08;
    const targetPrice = INITIAL_STOCK_PRICE * (1.0 + (targetChangePct + microNoise) / 100.0);
    
    // Плавное приближение к целевой цене (Mean-Reversion / фильтр первого порядка tau ~ 2 сек)
    baseStockPrice += (targetPrice - baseStockPrice) * 0.05;
    
    const pctChange = ((baseStockPrice - INITIAL_STOCK_PRICE) / INITIAL_STOCK_PRICE) * 100.0;
    const priceStr = `${baseStockPrice.toFixed(2)} RUB`;
    const changeStr = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`;
    const changeClass = pctChange >= 0 ? 'stock-change percent-up' : 'stock-change percent-down';
    
    // Обновляем виджет в шапке экрана
    if (priceHdr) priceHdr.innerText = priceStr;
    if (changeHdr) {
        changeHdr.innerText = changeStr;
        changeHdr.className = changeClass;
    }
}
