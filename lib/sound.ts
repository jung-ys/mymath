"use client";

// 승급 시험 화면에 쓰는 효과음 모음. 외부 음원 파일 없이 Web Audio API로 그 자리에서
// 소리를 합성한다(짧은 톤/노이즈 조합). 브라우저가 AudioContext를 지원하지 않거나
// 자동재생이 막혀있으면 조용히 무시한다(예외를 던지지 않음).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, durationMs: number, type: OscillatorType, volume: number, delaySec = 0) {
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = c.currentTime + delaySec;
    const end = start + durationMs / 1000;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0008, end);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  } catch {
    // 오디오 실패는 무시 — 시험 진행에는 영향 없어야 함
  }
}

// 승급 시험 시작 — 밝은 상승 3음.
export function playStartChime() {
  tone(523.25, 120, "sine", 0.12, 0);
  tone(659.25, 150, "sine", 0.12, 0.12);
  tone(783.99, 220, "sine", 0.14, 0.26);
}

// 시간이 얼마 안 남았을 때 나는 "똑" 소리. urgent일수록(막판일수록) 더 높고 급박하게.
export function playTick(urgent: boolean) {
  tone(urgent ? 1150 : 880, 90, "square", urgent ? 0.13 : 0.09);
}

// 시간 초과 — 저음 "쿵" + 화이트노이즈로 폭발 느낌을 근사.
export function playExplosion() {
  const c = getCtx();
  if (!c) return;
  try {
    const dur = 0.6;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(70, c.currentTime + dur);
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.35, c.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0008, c.currentTime + dur);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(c.destination);
    noise.start();

    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.4);
    const oGain = c.createGain();
    oGain.gain.setValueAtTime(0.5, c.currentTime);
    oGain.gain.exponentialRampToValueAtTime(0.0008, c.currentTime + 0.5);
    osc.connect(oGain);
    oGain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.55);
  } catch {
    // 무시
  }
}

// 승급 성공 — 밝은 팡파르.
export function playPassFanfare() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 220, "sine", 0.14, i * 0.11));
}

// 승급 실패 — 부드럽게 내려가는 두 음.
export function playFailTone() {
  tone(392, 220, "sine", 0.11, 0);
  tone(311.13, 320, "sine", 0.11, 0.18);
}
