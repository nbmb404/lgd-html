import type { Material } from "./game";

let audio: AudioContext | undefined;

export function playImpact(material: Material, complete: boolean, volume: number) {
  if (volume <= 0) return;

  try {
    audio ??= new AudioContext();
    void audio.resume();
    const duration = complete ? 0.45 : 0.13;
    const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = (Math.random() * 2 - 1) * Math.exp((-i / samples.length) * 5);
    }

    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = material === "glass" ? "highpass" : "lowpass";
    filter.frequency.value = { glass: 2400, wood: 650, paper: 3800, metal: 1600, ceramic: 1100, soft: 350 }[material];
    const gain = audio.createGain();
    gain.gain.value = volume * (complete ? 0.006 : 0.003);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();

    if (material === "metal" || material === "glass" || material === "soft") {
      const oscillator = audio.createOscillator();
      const tone = audio.createGain();
      oscillator.frequency.setValueAtTime(material === "soft" ? 300 : 1600, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(70, audio.currentTime + duration);
      tone.gain.setValueAtTime(volume * 0.001, audio.currentTime);
      tone.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(tone).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    }
  } catch {
    // 오디오가 막힌 환경에서도 게임은 계속됩니다.
  }
}
