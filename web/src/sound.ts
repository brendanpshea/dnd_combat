/**
 * Asset-free sound effects via WebAudio synthesis. Deliberately retro.
 * The AudioContext is created lazily on the first user gesture (init()).
 */

export type Sfx =
  | 'melee' | 'ranged' | 'miss'
  | 'fire' | 'lightning' | 'radiant' | 'force' | 'poison' | 'necrotic' | 'thunder' | 'cold' | 'acid' | 'psychic'
  | 'heal' | 'death' | 'victory' | 'condition';

let ctx: AudioContext | undefined;
let muted = localStorage.getItem('dnd-muted') === '1';

export function initAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  localStorage.setItem('dnd-muted', m ? '1' : '0');
}

interface Note {
  freq: number;
  /** seconds */
  dur: number;
  type?: OscillatorType;
  /** start offset in seconds */
  at?: number;
  vol?: number;
  /** linear frequency glide target */
  glide?: number;
}

function play(notes: Note[], noise?: { at?: number; dur: number; vol?: number }): void {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.type ?? 'square';
    const start = t0 + (n.at ?? 0);
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.glide !== undefined) osc.frequency.linearRampToValueAtTime(n.glide, start + n.dur);
    const v = n.vol ?? 0.12;
    gain.gain.setValueAtTime(v, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
  if (noise) {
    const len = Math.ceil(ctx.sampleRate * noise.dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = noise.vol ?? 0.1;
    src.connect(gain).connect(ctx.destination);
    src.start(t0 + (noise.at ?? 0));
  }
}

export function sfx(kind: Sfx): void {
  switch (kind) {
    case 'melee':
      play([{ freq: 140, dur: 0.09, type: 'triangle', vol: 0.2, glide: 60 }], { dur: 0.06, vol: 0.12 });
      break;
    case 'ranged':
      play([{ freq: 900, dur: 0.1, type: 'sawtooth', vol: 0.06, glide: 300 }], { dur: 0.05, vol: 0.05 });
      break;
    case 'miss':
      play([{ freq: 400, dur: 0.12, type: 'sine', vol: 0.06, glide: 250 }]);
      break;
    case 'fire':
      play([{ freq: 220, dur: 0.25, type: 'sawtooth', vol: 0.08, glide: 90 }], { dur: 0.28, vol: 0.14 });
      break;
    case 'lightning':
      play([
        { freq: 1600, dur: 0.05, type: 'square', vol: 0.09, glide: 200 },
        { freq: 90, dur: 0.15, at: 0.04, type: 'sawtooth', vol: 0.12 },
      ], { dur: 0.1, vol: 0.12 });
      break;
    case 'thunder':
      play([{ freq: 70, dur: 0.4, type: 'sawtooth', vol: 0.16, glide: 40 }], { dur: 0.35, vol: 0.18 });
      break;
    case 'radiant':
      play([
        { freq: 880, dur: 0.12, type: 'triangle', vol: 0.09 },
        { freq: 1320, dur: 0.15, at: 0.06, type: 'triangle', vol: 0.08 },
      ]);
      break;
    case 'force':
      play([
        { freq: 620, dur: 0.08, type: 'square', vol: 0.07, glide: 780 },
        { freq: 780, dur: 0.08, at: 0.05, type: 'square', vol: 0.07, glide: 940 },
      ]);
      break;
    case 'poison':
    case 'acid':
      play([{ freq: 300, dur: 0.2, type: 'sawtooth', vol: 0.06, glide: 180 }]);
      break;
    case 'necrotic':
    case 'psychic':
      play([{ freq: 240, dur: 0.3, type: 'sine', vol: 0.1, glide: 110 }]);
      break;
    case 'cold':
      play([{ freq: 1200, dur: 0.18, type: 'triangle', vol: 0.06, glide: 700 }]);
      break;
    case 'heal':
      play([
        { freq: 523, dur: 0.1, type: 'triangle', vol: 0.09 },
        { freq: 784, dur: 0.14, at: 0.08, type: 'triangle', vol: 0.09 },
      ]);
      break;
    case 'condition':
      play([{ freq: 460, dur: 0.1, type: 'square', vol: 0.05, glide: 520 }]);
      break;
    case 'death':
      play([
        { freq: 220, dur: 0.18, type: 'triangle', vol: 0.12, glide: 150 },
        { freq: 150, dur: 0.3, at: 0.14, type: 'triangle', vol: 0.12, glide: 70 },
      ]);
      break;
    case 'victory':
      play([
        { freq: 523, dur: 0.12, type: 'square', vol: 0.09 },
        { freq: 659, dur: 0.12, at: 0.12, type: 'square', vol: 0.09 },
        { freq: 784, dur: 0.12, at: 0.24, type: 'square', vol: 0.09 },
        { freq: 1047, dur: 0.3, at: 0.36, type: 'square', vol: 0.1 },
      ]);
      break;
  }
}
