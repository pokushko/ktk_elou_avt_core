// Корпоративный экран Совета Директоров
let baseStockPrice = 620.00;
let initialStockPrice = 620.00;

function updateCorporateScreen(state, alarms, interlocks) {
    const priceEl = document.getElementById('stock-price');
    const changeEl = document.getElementById('stock-change');
    const tickerEl = document.getElementById('news-ticker');
    
    // Считаем негативные факторы
    const hasPazTrip = interlocks.some(item => item.is_tripped);
    const hasActiveAlarms = alarms.length > 0;
    const hasEmissionViolation = state.furnace.emissions.is_violating;
    
    let changeRate = 0.05; // Рост на 0.05% по умолчанию (стабильность)
    let newsText = "Установка АВТ-5/5 работает в штатном режиме. Показатели стабильны.";
    
    if (hasPazTrip) {
        changeRate = -2.5; // Падение акций при аварии
        newsText = "ЧП НА НПЗ: Сработала автоматическая система защиты ПАЗ! Проводится аварийный останов оборудования.";
    } else if (hasEmissionViolation) {
        changeRate = -1.2; // Штрафы экологов
        newsText = "ЭКОЛОГИЧЕСКИЙ ИНЦИДЕНТ: Превышение ПДК по выбросам вредных газов печи П-1 в атмосферу!";
    } else if (hasActiveAlarms) {
        changeRate = -0.3; // Незначительное падение при отклонениях
        newsText = "ВНИМАНИЕ: На мнемосхеме зафиксировано отклонение рабочих параметров. Оператор устраняет неполадку.";
    }
    
    // Рассчитываем случайные рыночные флуктуации
    const marketFluctuation = (Math.random() - 0.45) * 0.2; // небольшой тренд
    
    // Обновляем цену
    baseStockPrice += (baseStockPrice * (changeRate / 100.0) + marketFluctuation);
    if (baseStockPrice < 100.0) baseStockPrice = 100.0; // дно акций
    
    const pctChange = ((baseStockPrice - initialStockPrice) / initialStockPrice) * 100.0;
    
    priceEl.innerText = `${baseStockPrice.toFixed(2)} RUB`;
    changeEl.innerText = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`;
    
    if (pctChange >= 0) {
        changeEl.className = 'stock-change percent-up';
    } else {
        changeEl.className = 'stock-change percent-down';
    }
    
    // Обновляем бегущую строку новостей
    if (tickerEl.innerText !== newsText) {
        tickerEl.innerText = newsText;
    }
}
