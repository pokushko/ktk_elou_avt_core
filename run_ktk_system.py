import os
import sys
import time
import webbrowser
import subprocess

# Настройка кодировки для Windows консоли
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def main():
    print("=" * 65)
    print("  === ЗАПУСК ЕДИНОГО КОМПЛЕКСА КТК ЭЛОУ-АВТ-5/5 (CASE-IN 2026) ===")
    print("  Команда «Два плюс ИИ»: Роман Покушко & Ангелина Глотова")
    print("=" * 65)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, base_dir)
    os.chdir(base_dir)
    
    print("\n[1/3] Запуск бэкенда (FastAPI, Modbus TCP, Physics 10Hz, LIMS)...")
    port = 8080
    cmd = [sys.executable, "-m", "uvicorn", "backend.server:app", "--host", "127.0.0.1", "--port", str(port)]
    proc = subprocess.Popen(cmd, cwd=base_dir)
    
    print("[2/3] Инициализация физического движка RK4 и Modbus сервера (2 сек)...")
    time.sleep(2.0)
    
    timestamp = int(time.time())
    dashboard_url = f"http://127.0.0.1:{port}/frontend/index.html?t={timestamp}"
    presentation_url = f"http://127.0.0.1:{port}/frontend/presentation.html?t={timestamp}"
    
    print("\n[3/3] Автоматический запуск браузера...")
    print(f" -> Панель Управления и Симулятора: {dashboard_url}")
    print(f" -> Интерактивная веб-презентация: {presentation_url}")
    
    webbrowser.open(dashboard_url)
    
    print("\n" + "=" * 65)
    print("   СИСТЕМА УСПЕШНО РАБОТАЕТ!")
    print("  Все панели (Оператор, Наставник, LIMS, ПАЗ) доступны в браузере.")
    print("  Чтобы остановить сервер, нажмите Ctrl+C в этом окне.")
    print("=" * 65 + "\n")
    
    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\n[ОСТАНОВ] Завершение процессов симулятора...")
        proc.terminate()

if __name__ == "__main__":
    main()
