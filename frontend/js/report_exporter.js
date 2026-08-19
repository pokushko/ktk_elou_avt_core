// Модуль выгрузки и печати официального Отчёта Аттестации Оператора
async function exportDebriefReport() {
    try {
        const resp = await fetch('/api/report');
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Сервер вернул ошибку (${resp.status}): ${errText}`);
        }
        const data = await resp.json();
        
        const win = window.open('', '_blank');
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Официальный Отчет Аттестации — КТК ЭЛОУ-АВТ-5/5</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 2rem; color: #1e272e; background: #ffffff; }
                    .header { text-align: center; border-bottom: 3px solid #00d68f; padding-bottom: 1rem; }
                    .score-box { background: #f1f2f6; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; font-size: 1.2rem; }
                    .grade-pass { color: #00d68f; font-weight: bold; }
                    .grade-fail { color: #ff3c5a; font-weight: bold; }
                    .report-body { font-family: 'Consolas', 'Courier New', monospace; font-size: 1.0rem; background: #f8f9fa; padding: 1.2rem; border-radius: 6px; border: 1px solid #dcdde1; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
                    .btn-print { background: #00d68f; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 1.1rem; margin-top: 1.5rem; font-weight: bold; }
                    @media print { .btn-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>КТК ЭЛОУ-АВТ-5/5 — СЕРТИФИКАТ АТТЕСТАЦИИ ОПЕРАТОРА</h2>
                    <p>Промышленный цифровой двойник установки первичной переработки нефти</p>
                </div>
                <div class="score-box">
                    <div>Оценка квалификации: <span class="${data.passed ? 'grade-pass' : 'grade-fail'}">${data.letter_grade} (${Number(data.score_percent).toFixed(1)}%)</span></div>
                    <div>Статус аттестации: <strong>${data.passed ? 'СДАНО (Допущен к смене)' : 'НЕ СДАНО (Направление на переподготовку)'}</strong></div>
                    <div>Нормативный НДС 2026: <strong>22%</strong> | Налог на прибыль: <strong>25%</strong></div>
                </div>
                <div class="report-body">${data.report_html}</div>
                <button class="btn-print" onclick="window.print()">🖨️ Распечатать / Сохранить в PDF</button>
            </body>
            </html>
        `);
        win.document.close();
    } catch (e) {
        alert("Ошибка генерации отчёта: " + e.message);
    }
}

window.exportDebriefReport = exportDebriefReport;
