let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (isMuted) return null;
  if (!audioCtx) {
    // Lazy initialization of AudioContext to satisfy browser autoplay policies
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// İsteğe bağlı gerçek ses dosyaları: src/assets/sfx/ içine bir dosya koyarsan
// (örn. objection.mp3, gavel.mp3, desk-slam.mp3, verdict.mp3, blip.mp3)
// sentez yerine otomatik o çalınır. Dosya yoksa sentez devreye girer.
// NOT: Ace Attorney'in orijinal sesleri Capcom IP'sidir; kişisel kullanım
// senin tercihin, ama projeyi dağıtırsan telif sorunu olur.
const sfxUrls: Record<string, string> = {};
{
  const mods = import.meta.glob('../assets/sfx/*.{mp3,wav,ogg,m4a}', {
    eager: true, query: '?url', import: 'default',
  });
  for (const p in mods) {
    const name = p.split('/').pop()!.replace(/\.[^.]+$/, '');
    sfxUrls[name] = mods[p] as string;
  }
}
const decodedSamples: Record<string, AudioBuffer> = {};

function hasSample(name: string): boolean {
  return !!sfxUrls[name];
}

async function playSample(name: string, volume = 0.9, rate = 1): Promise<boolean> {
  const url = sfxUrls[name];
  if (!url) return false;
  const ctx = getAudioContext();
  if (!ctx) return true; // sessizdeyiz ama sample mevcut → sentez'e düşme
  try {
    if (!decodedSamples[name]) {
      const arr = await (await fetch(url)).arrayBuffer();
      decodedSamples[name] = await ctx.decodeAudioData(arr);
    }
    const src = ctx.createBufferSource();
    src.buffer = decodedSamples[name];
    src.playbackRate.value = rate; // perde (pitch) — karaktere göre farklılaştırma
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
    return true;
  } catch {
    return false;
  }
}

// Tek temiz "İTİRAZ!" klibinden 6 belirgin farklı ses üretmek için karaktere
// özgü perde (playbackRate). Daha gür/derin = düşük; daha tiz/parlak = yüksek.
const OBJECTION_RATE: Record<string, number> = {
  athena: 1.10,      // zarif, hafif tiz
  socrates: 1.04,    // keskin
  apollo: 1.18,      // parlak, yüksek enerji
  hephaestus: 0.90,  // ağır, mühendis
  atlas: 0.82,       // derin, gür
  themis: 0.96,      // yargıç, nötr-tok
};

async function preloadSamples() {
  const ctx = getAudioContext();
  if (!ctx) return;
  for (const name in sfxUrls) {
    if (decodedSamples[name]) continue;
    try {
      const arr = await (await fetch(sfxUrls[name])).arrayBuffer();
      decodedSamples[name] = await ctx.decodeAudioData(arr);
    } catch { /* yoksay */ }
  }
}

export const audioService = {
  isMuted() {
    return isMuted;
  },

  init() {
    getAudioContext();
    preloadSamples();
  },

  toggleMute() {
    isMuted = !isMuted;
    if (isMuted && audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    return isMuted;
  },

  playTextBlip() {
    if (hasSample('blip')) { playSample('blip', 0.5); return; }
    const ctx = getAudioContext();
    if (!ctx) return;

    // Yumuşak, tonsuz daktilo "tık"ı: kısa low-pass'li gürültü patlaması.
    // Tonal bip yerine warm bir tap — kulak tırmalamaz.
    const dur = 0.018;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // hızlı sönümlenen gürültü → "tık"
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1300 + Math.random() * 350; // hafif tını çeşitliliği

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + dur);
  },

  playDeskSlam() {
    if (hasSample('desk-slam')) { playSample('desk-slam', 0.9); return; }
    const ctx = getAudioContext();
    if (!ctx) return;

    // We combine a low frequency heavy sine wave with a burst of low-pass noise
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);

    // Create a low-passed noise burst for the impact
    const bufferSize = ctx.sampleRate * 0.2; // 0.2 seconds
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseNode.start();
    noiseNode.stop(ctx.currentTime + 0.2);
  },

  playGavel() {
    if (hasSample('gavel')) { playSample('gavel', 0.9); return; }
    const ctx = getAudioContext();
    if (!ctx) return;

    const playStrike = (timeOffset: number) => {
      const time = ctx.currentTime + timeOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Hollow double knock (wood-like sine wave)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.12);

      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.start(time);
      osc.stop(time + 0.15);

      // High frequency click for the transient strike
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.connect(clickGain);
      clickGain.connect(ctx.destination);

      click.type = 'triangle';
      click.frequency.setValueAtTime(1500, time);
      clickGain.gain.setValueAtTime(0.08, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

      click.start(time);
      click.stop(time + 0.03);
    };

    // Gavel is double hit!
    playStrike(0);
    playStrike(0.18);
  },

  // İkonik "İTİRAZ!" sting'i — Capcom klibi DEĞİL, tamamen sentez (IP-temiz).
  // Vurucu transient + sub impact + bağırış-benzeri formant sentezi (2 hece).
  playObjectionSting() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;

    // 1) Transient "crack" — highpass'li kısa gürültü patlaması
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const nhp = ctx.createBiquadFilter();
    nhp.type = 'highpass';
    nhp.frequency.value = 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.38, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    noise.connect(nhp); nhp.connect(ng); ng.connect(ctx.destination);
    noise.start(t0); noise.stop(t0 + 0.06);

    // 2) Sub impact — gövde için derin thump
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, t0);
    sub.frequency.exponentialRampToValueAtTime(48, t0 + 0.28);
    subG.gain.setValueAtTime(0.4, t0);
    subG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    sub.connect(subG); subG.connect(ctx.destination);
    sub.start(t0); sub.stop(t0 + 0.32);

    // 3) Bağırış-benzeri hece: sawtooth taşıyıcı + 3 formant bandpass (vokal hissi)
    const shout = (start: number, dur: number, pitch: number, peak: number) => {
      const carrier = ctx.createOscillator();
      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(pitch * 0.8, start);
      carrier.frequency.linearRampToValueAtTime(pitch * 1.15, start + dur * 0.25);
      carrier.frequency.linearRampToValueAtTime(pitch * 0.7, start + dur);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(peak, start + 0.03); // sert atak
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      // "a" sesine yakın formantlar
      const formants = [800, 1200, 2600];
      formants.forEach((f, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = 9 - i * 2;
        const fg = ctx.createGain();
        fg.gain.value = [1, 0.6, 0.35][i];
        carrier.connect(bp); bp.connect(fg); fg.connect(env);
      });
      env.connect(ctx.destination);
      carrier.start(start); carrier.stop(start + dur + 0.02);
    };

    // iki hece — "İ-TİRAZ" ritmi: kısa + uzun vurgulu
    shout(t0 + 0.02, 0.16, 300, 0.28);
    shout(t0 + 0.2, 0.34, 240, 0.32);
  },

  playObjection(characterId: string) {
    // 1) Karaktere özel dosya varsa (objection-athena.* gibi) onu çal.
    if (hasSample(`objection-${characterId}`)) { playSample(`objection-${characterId}`, 0.95); return; }
    // 2) Genel objection dosyası varsa, karaktere göre farklı perdeden çal.
    if (hasSample('objection')) { playSample('objection', 0.95, OBJECTION_RATE[characterId] ?? 1); return; }

    const ctx = getAudioContext();
    if (!ctx) return;

    // Aksi halde: ikonik sentez sting + karaktere özgü kısa renk.
    this.playObjectionSting();

    switch (characterId) {
      case 'socrates': {
        // Socrates: Sharp, descending, aggressive buzzer-like (triangle + sawtooth clash)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(320, ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.6);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(325, ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(142, ctx.currentTime + 0.6);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.6);
        osc2.stop(ctx.currentTime + 0.6);
        break;
      }
      case 'athena': {
        // Athena: Royal, elegant ascending arpeggio chime (sine + triangle)
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);

          gain.gain.setValueAtTime(0.1, ctx.currentTime + index * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.1 + 0.4);

          osc.start(ctx.currentTime + index * 0.1);
          osc.stop(ctx.currentTime + index * 0.1 + 0.45);
        });
        break;
      }
      case 'apollo': {
        // Apollo: Bright, wavy creative laser synth sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        
        // Modulate frequency to make it wavy
        for (let i = 0; i < 6; i++) {
          const t = ctx.currentTime + i * 0.08;
          osc.frequency.linearRampToValueAtTime(600, t + 0.04);
          osc.frequency.linearRampToValueAtTime(400, t + 0.08);
        }

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.start();
        osc.stop(ctx.currentTime + 0.55);
        break;
      }
      case 'hephaestus': {
        // Hephaestus: Metallic clank (square wave + quick feedback) + low hum
        const osc = ctx.createOscillator();
        const hum = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        hum.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4);

        hum.type = 'sawtooth';
        hum.frequency.setValueAtTime(90, ctx.currentTime);

        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

        osc.start();
        hum.start();
        osc.stop(ctx.currentTime + 0.6);
        hum.stop(ctx.currentTime + 0.6);
        break;
      }
      case 'atlas': {
        // Atlas: Heavy, low, powerful warning sound (deep square wave rumble)
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        subOsc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.setValueAtTime(80, ctx.currentTime + 0.15);

        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(55, ctx.currentTime);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);

        osc.start();
        subOsc.start();
        osc.stop(ctx.currentTime + 0.7);
        subOsc.stop(ctx.currentTime + 0.7);
        break;
      }
      case 'themis':
      default: {
        // Themis (Yargıç) or default: Clear double chime gavel slam
        this.playGavel();
        break;
      }
    }
  },

  playVerdictFanfare() {
    if (hasSample('verdict')) { playSample('verdict', 0.9); return; }
    const ctx = getAudioContext();
    if (!ctx) return;

    // retro 8-bit victorious arpeggio!
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    const tempo = 0.08;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // retro pulse/square sound
      osc.type = 'square';
      osc.frequency.value = freq;

      const time = ctx.currentTime + index * tempo;
      
      // If it is the last note, let it sustain!
      const duration = index === notes.length - 1 ? 0.8 : 0.1;

      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.08, time + 0.01);
      gain.gain.setValueAtTime(0.08, time + duration - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.start(time);
      osc.stop(time + duration + 0.1);
    });
  }
};
