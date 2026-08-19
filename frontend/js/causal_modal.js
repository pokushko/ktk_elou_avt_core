// Интерактивное модальное окно Графа Причинно-Следственных Связей (Causal Event Graph)
function openCausalModal(eventData) {
    let modal = document.getElementById('causal-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'causal-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(4, 8, 15, 0.85);
            backdrop-filter: blur(14px);
            display: flex; justify-content: center; align-items: center;
        `;
        document.body.appendChild(modal);
    }

    const title = eventData ? eventData.description : "Анализ причинно-следственных связей ИИ";
    const causeNode = eventData ? eventData.root_cause : "Отклонение технологического режима";

    modal.innerHTML = `
        <div style="
            background: #0a121e; border: 1px solid #00f2fe; border-radius: 14px;
            width: 600px; max-width: 90vw; padding: 1.5rem; color: #b0bec5;
            box-shadow: 0 0 30px rgba(0, 242, 254, 0.25);
            display: flex; flex-direction: column; gap: 1rem;
        ">
            <div style="display:flex; justify-shadow:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                <h3 style="color:#00f2fe; margin:0; font-size:1rem; text-transform:uppercase; letter-spacing:1px;">
                    🕸️ Causal DAG — Граф Причин Аварии (NetworkX)
                </h3>
                <button onclick="closeCausalModal()" style="background:none; border:none; color:#ff3c5a; font-size:1.4rem; cursor:pointer;">&times;</button>
            </div>
            
            <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; color:#546e7a; margin-bottom:0.5rem;">ПРИЧИННО-СЛЕДСТВЕННАЯ ЦЕПОЧКА (DAG):</div>
                <div style="display:flex; flex-direction:column; gap:8px; font-family:monospace; font-size:0.8rem;">
                    <div style="background:rgba(255,60,90,0.15); border-left:3px solid #ff3c5a; padding:6px 10px; color:#ff3c5a;">
                        1. Первопричина: ${causeNode}
                    </div>
                    <div style="text-align:center; color:#00f2fe;">↓</div>
                    <div style="background:rgba(255,209,102,0.15); border-left:3px solid #ffd166; padding:6px 10px; color:#ffd166;">
                        2. Каскадный эффект: Снижение теплосъема в змеевике П-1 → Рост Т стенки
                    </div>
                    <div style="text-align:center; color:#00f2fe;">↓</div>
                    <div style="background:rgba(0,242,254,0.15); border-left:3px solid #00f2fe; padding:6px 10px; color:#00f2fe;">
                        3. Инцидент: ${title}
                    </div>
                    <div style="text-align:center; color:#00f2fe;">↓</div>
                    <div style="background:rgba(155,93,229,0.15); border-left:3px solid #9b5de5; padding:6px 10px; color:#9b5de5;">
                        4. Финансовый эффект: Падение акций GAZP_NEFT → Простой 3.5М руб/ч
                    </div>
                </div>
            </div>

            <div style="font-size:0.75rem; color:#b0bec5; line-height:1.4;">
                <strong>Рекомендация ИИ-Наставника:</strong> Стравить давление в колонне К-1, приоткрыть задвижку сырья Н-1 и снизить подачу газа в печь П-1 на 15%.
            </div>

            <button onclick="closeCausalModal()" style="
                background: linear-gradient(135deg, #007a99 0%, #00f2fe 100%);
                color: #070d17; border: none; font-weight: bold; padding: 8px 16px;
                border-radius: 6px; cursor: pointer; align-self: flex-end;
            ">Закрыть</button>
        </div>
    `;
    modal.style.display = 'flex';
}

function closeCausalModal() {
    const modal = document.getElementById('causal-modal');
    if (modal) modal.style.display = 'none';
}

window.openCausalModal = openCausalModal;
window.closeCausalModal = closeCausalModal;
