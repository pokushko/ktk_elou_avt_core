// Панель Блокировок ПАЗ
function updatePAZBoard(interlocks) {
    const board = document.getElementById('paz-status-board');
    board.innerHTML = '';
    
    interlocks.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'paz-item';
        
        const isTripped = item.is_tripped;
        if (isTripped) {
            itemDiv.classList.add('tripped');
        }
        
        const badgeClass = isTripped ? 'paz-badge tripped' : 'paz-badge normal';
        const badgeText = isTripped ? 'БЛОКИРОВКА!' : 'НОРМА';
        
        const descText = item.name || item.description || 'Защита ПАЗ';
        itemDiv.innerHTML = `
            <div>
                <strong>${item.id}</strong>: ${descText}
            </div>
            <span class="${badgeClass}">${badgeText}</span>
        `;
        board.appendChild(itemDiv);
    });
}
