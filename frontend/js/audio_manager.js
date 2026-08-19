// Промышленный синтезатор звука Web Audio API (без внешних mp3/wav файлов)
let audioCtx = null;
let sirenOsc = null;
let isAudioEnabled = true;

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playBeep(freq = 440, type = 'sine', duration = 0.15) {
    if (!isAudioEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Audio play error:", e);
    }
}

function startPazSiren() {
    if (!isAudioEnabled || sirenOsc) return;
    initAudio();
    if (!audioCtx) return;

    try {
        sirenOsc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        sirenOsc.type = 'sawtooth';
        
        // Модуляция частоты от 600 до 900 Гц (промышленная рев-сирена)
        const now = audioCtx.currentTime;
        sirenOsc.frequency.setValueAtTime(600, now);
        sirenOsc.frequency.linearRampToValueAtTime(950, now + 0.4);
        
        gain.gain.setValueAtTime(0.05, now);
        
        sirenOsc.connect(gain);
        gain.connect(audioCtx.destination);
        sirenOsc.start();
        
        // Повторяем циклом
        setInterval(() => {
            if (sirenOsc && audioCtx) {
                const t = audioCtx.currentTime;
                sirenOsc.frequency.setValueAtTime(600, t);
                sirenOsc.frequency.linearRampToValueAtTime(950, t + 0.4);
            }
        }, 800);
    } catch (e) {
        console.warn("Siren error:", e);
    }
}

function stopPazSiren() {
    if (sirenOsc) {
        try {
            sirenOsc.stop();
            sirenOsc.disconnect();
        } catch (e) {}
        sirenOsc = null;
    }
}

window.playBeep = playBeep;
window.startPazSiren = startPazSiren;
window.stopPazSiren = stopPazSiren;
