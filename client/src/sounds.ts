export type SoundSetKey = 'chesscom' | 'lichess' | 'wood' | 'synth' | 'bits';

export type SoundSetDef = {
  key: SoundSetKey;
  label: string;
};

export const SOUND_SETS: SoundSetDef[] = [
  { key: 'chesscom', label: 'Chess.com' },
  { key: 'lichess', label: 'Lichess' },
  { key: 'wood', label: 'Wood' },
  { key: 'synth', label: 'Synth' },
  { key: 'bits', label: '8-bit' },
];

const LS_KEY = 'bh_soundset';

export function loadSoundSet(): SoundSetKey {
  const v = localStorage.getItem(LS_KEY) as SoundSetKey | null;
  return SOUND_SETS.some((s) => s.key === v) ? v! : 'wood';
}

export function saveSoundSet(key: SoundSetKey) {
  localStorage.setItem(LS_KEY, key);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function noiseNode(ac: AudioContext, durationSec: number): AudioBufferSourceNode {
  const len = Math.floor(ac.sampleRate * durationSec);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

function woodImpact(
  ac: AudioContext,
  t: number,
  vol: number,
  freq0: number,
  freq1: number,
  dur: number,
) {
  // High-passed noise click
  const click = noiseNode(ac, 0.05);
  const hpf = ac.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 2500;
  const cg = ac.createGain();
  cg.gain.setValueAtTime(vol * 0.5, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  click.connect(hpf); hpf.connect(cg); cg.connect(ac.destination);
  click.start(t);

  // Resonant sine sweep for the body thud
  const osc = ac.createOscillator();
  const og = ac.createGain();
  osc.connect(og); og.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq0, t);
  osc.frequency.exponentialRampToValueAtTime(freq1, t + dur);
  og.gain.setValueAtTime(vol * 0.7, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t); osc.stop(t + dur + 0.01);
}

function chip(ac: AudioContext, t: number, freq: number, dur: number, vol: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.connect(g); g.connect(ac.destination);
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(0, t + dur);
  osc.start(t); osc.stop(t + dur + 0.005);
}

function fmBell(ac: AudioContext, t: number, freq: number, vol: number) {
  const mod = ac.createOscillator();
  const modGain = ac.createGain();
  modGain.gain.value = freq * 3;
  mod.frequency.value = freq * 2;
  mod.connect(modGain);

  const car = ac.createOscillator();
  car.frequency.setValueAtTime(freq, t);
  modGain.connect(car.frequency);

  const g = ac.createGain();
  car.connect(g); g.connect(ac.destination);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

  mod.start(t); mod.stop(t + 0.35);
  car.start(t); car.stop(t + 0.35);
}

// ─── Wood ──────────────────────────────────────────────────────────────────

function woodMove(ac: AudioContext) {
  woodImpact(ac, ac.currentTime, 0.5, 160, 55, 0.12);
}

function woodCapture(ac: AudioContext) {
  const t = ac.currentTime;
  woodImpact(ac, t, 0.85, 130, 38, 0.15);
  woodImpact(ac, t + 0.05, 0.45, 90, 28, 0.12);
}

function woodCheck(ac: AudioContext) {
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    woodImpact(ac, t + i * 0.09, 0.35 + i * 0.15, 160, 55, 0.08);
  }
}

function woodTick(ac: AudioContext, urgency: number) {
  const t = ac.currentTime;
  const click = noiseNode(ac, 0.02);
  const hpf = ac.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 4000;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  click.connect(hpf); hpf.connect(g); g.connect(ac.destination);
  click.start(t);

  const osc = ac.createOscillator();
  const og = ac.createGain();
  osc.connect(og); og.connect(ac.destination);
  osc.frequency.value = 900 + urgency * 500;
  og.gain.setValueAtTime(0.12, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.start(t); osc.stop(t + 0.05);
}

// ─── Synth ─────────────────────────────────────────────────────────────────

function synthMove(ac: AudioContext) {
  const t = ac.currentTime;
  for (const detune of [-7, 7]) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.value = 220;
    osc.detune.value = detune;
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t); osc.stop(t + 0.1);
  }
}

function synthCapture(ac: AudioContext) {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const ws = ac.createWaveShaper();
  const g = ac.createGain();

  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
  }
  ws.curve = curve;

  osc.connect(ws); ws.connect(g); g.connect(ac.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(210, t);
  osc.frequency.exponentialRampToValueAtTime(52, t + 0.16);
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.start(t); osc.stop(t + 0.18);
}

function synthCheck(ac: AudioContext) {
  const t = ac.currentTime;
  [392, 494, 587].forEach((freq, i) => fmBell(ac, t + i * 0.11, freq, 0.28));
}

function synthTick(ac: AudioContext, urgency: number) {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.connect(g); g.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.value = 600 + urgency * 600;
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  osc.start(t); osc.stop(t + 0.04);
}

// ─── 8-bit ─────────────────────────────────────────────────────────────────

function bitsMove(ac: AudioContext) {
  chip(ac, ac.currentTime, 440, 0.055, 0.18);
}

function bitsCapture(ac: AudioContext) {
  const t = ac.currentTime;
  [880, 587, 440].forEach((f, i) => chip(ac, t + i * 0.05, f, 0.045, 0.18));
}

function bitsCheck(ac: AudioContext) {
  const t = ac.currentTime;
  [262, 330, 392, 523].forEach((f, i) => chip(ac, t + i * 0.065, f, 0.06, 0.18));
}

function bitsTick(ac: AudioContext, urgency: number) {
  chip(ac, ac.currentTime, 800 + urgency * 600, 0.025, 0.16);
}

// ─── Chess.com ─────────────────────────────────────────────────────────────
// Characteristic "snap": dominant high-frequency click, very short dry body.

function chesscomMove(ac: AudioContext) {
  const t = ac.currentTime;
  // Crisp click transient
  const click = noiseNode(ac, 0.025);
  const hpf = ac.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 2800;
  const cg = ac.createGain();
  cg.gain.setValueAtTime(0.45, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  click.connect(hpf); hpf.connect(cg); cg.connect(ac.destination);
  click.start(t);
  // Short dry tone
  const osc = ac.createOscillator();
  const og = ac.createGain();
  osc.connect(og); og.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.07);
  og.gain.setValueAtTime(0.28, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.start(t); osc.stop(t + 0.08);
}

function chesscomCapture(ac: AudioContext) {
  const t = ac.currentTime;
  // Two quick snaps in rapid succession (lift + place)
  for (let i = 0; i < 2; i++) {
    const ti = t + i * 0.038;
    const click = noiseNode(ac, 0.03);
    const hpf = ac.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 2200;
    const cg = ac.createGain();
    cg.gain.setValueAtTime(i === 0 ? 0.35 : 0.55, ti);
    cg.gain.exponentialRampToValueAtTime(0.001, ti + 0.03);
    click.connect(hpf); hpf.connect(cg); cg.connect(ac.destination);
    click.start(ti);

    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.connect(og); og.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(i === 0 ? 600 : 850, ti);
    osc.frequency.exponentialRampToValueAtTime(150, ti + 0.08);
    og.gain.setValueAtTime(i === 0 ? 0.2 : 0.32, ti);
    og.gain.exponentialRampToValueAtTime(0.001, ti + 0.08);
    osc.start(ti); osc.stop(ti + 0.09);
  }
}

function chesscomCheck(ac: AudioContext) {
  const t = ac.currentTime;
  // Two clean notification tones (ascending)
  [660, 880].forEach((freq, i) => {
    const ti = t + i * 0.12;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ti);
    g.gain.linearRampToValueAtTime(0.3, ti + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, ti + 0.1);
    osc.start(ti); osc.stop(ti + 0.12);
  });
}

function chesscomTick(ac: AudioContext, urgency: number) {
  const t = ac.currentTime;
  const click = noiseNode(ac, 0.015);
  const hpf = ac.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 5000;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.3 + urgency * 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
  click.connect(hpf); hpf.connect(g); g.connect(ac.destination);
  click.start(t);
}

// ─── Lichess ───────────────────────────────────────────────────────────────
// Real audio files from lichess-org/lila (AGPL), bundled in public/sounds/lichess/.
// Check.mp3 is silence in the standard set so we use GenericNotify for check.
// Tick uses synthesis since GenericNotify is too long to repeat every second.

let _lichess: { move: HTMLAudioElement; capture: HTMLAudioElement; check: HTMLAudioElement } | null = null;

function getLichess() {
  if (!_lichess) {
    _lichess = {
      move: new Audio('/sounds/lichess/Move.mp3'),
      capture: new Audio('/sounds/lichess/Capture.mp3'),
      check: new Audio('/sounds/lichess/GenericNotify.mp3'),
    };
    Object.values(_lichess).forEach((a) => { a.preload = 'auto'; });
  }
  return _lichess;
}

function playAudio(a: HTMLAudioElement) {
  a.currentTime = 0;
  void a.play();
}

function lichessMove() { playAudio(getLichess().move); }
function lichessCapture() { playAudio(getLichess().capture); }
function lichessCheck() { playAudio(getLichess().check); }

function lichessTick(ac: AudioContext, urgency: number) {
  const t = ac.currentTime;
  const knock = noiseNode(ac, 0.02);
  const bpf = ac.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 2000 + urgency * 1000;
  bpf.Q.value = 2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  knock.connect(bpf); bpf.connect(g); g.connect(ac.destination);
  knock.start(t);
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

export type SoundEvent = 'move' | 'capture' | 'check' | 'tick';

export function playSound(
  ac: AudioContext,
  set: SoundSetKey,
  event: SoundEvent,
  urgency = 0,
) {
  try {
    if (set === 'chesscom') {
      if (event === 'move') chesscomMove(ac);
      else if (event === 'capture') chesscomCapture(ac);
      else if (event === 'check') chesscomCheck(ac);
      else chesscomTick(ac, urgency);
    } else if (set === 'lichess') {
      if (event === 'move') lichessMove();
      else if (event === 'capture') lichessCapture();
      else if (event === 'check') lichessCheck();
      else lichessTick(ac, urgency);
    } else if (set === 'wood') {
      if (event === 'move') woodMove(ac);
      else if (event === 'capture') woodCapture(ac);
      else if (event === 'check') woodCheck(ac);
      else woodTick(ac, urgency);
    } else if (set === 'synth') {
      if (event === 'move') synthMove(ac);
      else if (event === 'capture') synthCapture(ac);
      else if (event === 'check') synthCheck(ac);
      else synthTick(ac, urgency);
    } else {
      if (event === 'move') bitsMove(ac);
      else if (event === 'capture') bitsCapture(ac);
      else if (event === 'check') bitsCheck(ac);
      else bitsTick(ac, urgency);
    }
  } catch {
    // Audio context may be in a bad state; ignore
  }
}

let _previewCtx: AudioContext | null = null;

export function previewSoundSet(key: SoundSetKey) {
  if (!_previewCtx) _previewCtx = new AudioContext();
  if (_previewCtx.state === 'suspended') void _previewCtx.resume();
  playSound(_previewCtx, key, 'move');
}
