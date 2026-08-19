import sys
import win32com.client

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def main():
    print("Воспроизведение аварийного сигнала КОМПАКС через динамики...")
    speaker = win32com.client.Dispatch("SAPI.SpVoice")
    phrase = "Внимание! Опасная вибрация подшипника насоса сырья Аш один А! Восемь целых четыре десятых миллиметра в секунду! Перейдите на резерв!"
    speaker.Speak(phrase)
    print("Готово!")

if __name__ == "__main__":
    main()
