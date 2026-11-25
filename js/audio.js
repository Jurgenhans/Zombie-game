import { settings } from './config.js';
import { rr } from './core.js';
import { sp } from './environment.js';

/* ---------------- Audio (synthetisiert) ---------------- */
export let actx = null;
export let master = null;
export const audioOff = () => !actx || !settings.sound;
export function applyVolume() { if (master) master.gain.value = settings.sound ? Math.pow(settings.volume / 100, 2) : 0; }
export function initAudio() {
  try { if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.connect(actx.destination); applyVolume(); } if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
}
export let _nb = null;
export function noiseStart(src, t0, dur) { // gemeinsamer Rauschpuffer, zufälliger Startpunkt (spart Speicher)
  if (!_nb) { _nb = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate); const d = _nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  src.buffer = _nb; src.start(t0, Math.random() * 0.8, dur + 0.05);
}
export function outNode(pan) { // Stereo-Position (-1 links … +1 rechts)
  if (!pan || !actx.createStereoPanner) return master;
  const p = actx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p;
}
export function sfxNoise(dur, freq, vol, type = 'lowpass', q = 0.7, pan = 0, delay = 0, attack = 0) {
  if (audioOff()) return; const t0 = actx.currentTime + delay, s = actx.createBufferSource();
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain();
  if (attack > 0) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); } else g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(outNode(pan)); noiseStart(s, t0, dur);
}
export function sfxTone(freq, dur, vol, type = 'sine', slide = 0, pan = 0, delay = 0) {
  if (audioOff()) return; const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(outNode(pan)); o.start(t0); o.stop(t0 + dur);
}
// Metallisch/hölzern klingender Anschlag: mehrere kurze, abklingende Obertöne
export function sfxPing(freqs, dur, vol, pan = 0, delay = 0) {
  if (audioOff()) return; const t0 = actx.currentTime + delay, out = outNode(pan);
  freqs.forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain(), d = dur * (1 - i * 0.12);
    o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.03);
    g.gain.setValueAtTime(vol / (1 + i * 0.7), t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + d + 0.02);
  });
}
// Stimme (Zombie-Stöhnen): Sägezahn mit Vibrato, starker Verzerrung, Knarz-Amplitudenmodulation, Formantfiltern, kratzigem Atem – kurz & trocken (kein Nachhall)
export const _curves = {};
export function sfxVoice({ f0 = 80, glide = -20, dur = 1.0, vol = 0.2, pan = 0, form = [[500, 7], [1100, 8], [2400, 9]], rasp = 18, breath = 0.45, vib = 6, delay = 0, attack = 0.06, growl = 0.6 } = {}) {
  if (audioOff() || vol < 0.004) return; const t0 = actx.currentTime + delay, t1 = t0 + dur, out = outNode(pan);
  const osc = actx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f0, t0); osc.frequency.linearRampToValueAtTime(Math.max(30, f0 + glide), t1);
  const lfo = actx.createOscillator(), lg = actx.createGain(); lfo.frequency.value = vib + Math.random() * 2; lg.gain.value = f0 * 0.06; lfo.connect(lg); lg.connect(osc.frequency);
  const sh = actx.createWaveShaper();
  if (!_curves[rasp]) { const c = new Float32Array(257); for (let i = 0; i < 257; i++) c[i] = Math.tanh(rasp * (i / 128 - 1)); _curves[rasp] = c; }
  sh.curve = _curves[rasp]; osc.connect(sh);
  // Knarzen: schnelle Amplitudenmodulation (Stimmbandflattern)
  const am = actx.createGain(); am.gain.value = 1 - growl * 0.5; const amL = actx.createOscillator(), amG = actx.createGain();
  amL.type = 'square'; amL.frequency.value = 28 + Math.random() * 30; amG.gain.value = growl * 0.5; amL.connect(amG); amG.connect(am.gain);
  // Hüllkurve: schneller Einsatz, kurzer Abfall, KEIN langer Ausklang
  const env = actx.createGain(); env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(vol, t0 + attack);
  env.gain.linearRampToValueAtTime(vol * 0.75, Math.max(t0 + attack + 0.01, t1 - 0.12)); env.gain.linearRampToValueAtTime(0.0001, t1);
  const mix = actx.createGain(); mix.gain.value = 1;
  for (const [fr, q] of form) {
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q * 0.5; bp.frequency.setValueAtTime(fr, t0); bp.frequency.linearRampToValueAtTime(fr * 0.88, t1);
    const fg = actx.createGain(); fg.gain.value = 2.6; sh.connect(bp); bp.connect(fg); fg.connect(mix);
  }
  mix.connect(am); am.connect(env); env.connect(out);
  if (breath > 0) { // kratziger Atem (hohes Rauschen)
    const n = actx.createBufferSource(), bf = actx.createBiquadFilter(), bg = actx.createGain();
    bf.type = 'bandpass'; bf.frequency.value = 2600; bf.Q.value = 0.6; bg.gain.setValueAtTime(0.0001, t0); bg.gain.linearRampToValueAtTime(breath * vol, t0 + attack); bg.gain.linearRampToValueAtTime(0.0001, t1);
    n.connect(bf); bf.connect(bg); bg.connect(out); noiseStart(n, t0, dur);
  }
  osc.start(t0); lfo.start(t0); amL.start(t0); osc.stop(t1 + 0.05); lfo.stop(t1 + 0.05); amL.stop(t1 + 0.05);
}
export const VOWELS = [[[700, 8], [1200, 9], [2600, 10]], [[350, 7], [800, 8], [2400, 10]], [[450, 7], [900, 8], [2500, 10]], [[500, 8], [1700, 9], [2500, 10]]];
export const SFX = {
  shot(k) { const big = k === 3 ? 1 : k === 2 ? 0.8 : 0.6; sfxNoise(0.25 + big * 0.15, k === 3 ? 1400 : 3000, 0.9 * big, 'lowpass'); sfxTone(k === 3 ? 90 : 140, 0.18, 0.6 * big, 'sine', -80); },
  empty() { sfxPing([2600, 4100], 0.03, 0.25); sfxNoise(0.015, 3500, 0.2, 'highpass'); },
  // Nachlade-Bausteine: mechanisch – kurze, trockene Metall-Transienten, Ratschen, Federn; keine Töne mit Ausklang
  tick(f, v, d = 0) { sfxNoise(0.012, f, v, 'bandpass', 3, 0, d); sfxPing([f * 1.4], 0.015, v * 0.6, 0, d); },
  rattle(n, sp, f, v, d = 0) { for (let i = 0; i < n; i++) SFX.tick(f * (1 + i * 0.04), v, d + i * sp); },
  rClick() { SFX.tick(3800, 0.35); SFX.tick(2600, 0.2, 0.012); },                                                                   // Magazinhalter-Knopf
  rOut()   { sfxNoise(0.14, 1800, 0.25, 'bandpass', 1.4, 0, 0, 0.01); SFX.rattle(4, 0.03, 2200, 0.12); SFX.tick(3000, 0.25, 0.13); }, // Magazin gleitet heraus
  rRustle() { SFX.rattle(2, 0.03, 3000, 0.12); },                                                                                   // Fummeln
  rThunk() { sfxNoise(0.03, 1400, 0.6, 'bandpass', 1.2); sfxPing([900, 1700], 0.035, 0.35); sfxPing([120], 0.06, 0.55); SFX.tick(3200, 0.3, 0.045); }, // Magazin rastet ein
  rScrape() { sfxNoise(0.2, 2400, 0.2, 'bandpass', 1, 0, 0, 0.03); SFX.rattle(7, 0.026, 2800, 0.22); },                              // Spannschieber zurück (Ratsche)
  rClack() { sfxNoise(0.035, 2200, 0.7, 'bandpass', 1.5); sfxPing([1400, 2300, 3300], 0.045, 0.4); sfxPing([160], 0.05, 0.5); SFX.rattle(2, 0.02, 3500, 0.12, 0.05); }, // Verschluss schnappt vor
  rShell() { SFX.tick(2400, 0.3); sfxPing([180], 0.05, 0.3, 0, 0.01); SFX.tick(3200, 0.2, 0.04); },                                  // Patrone in Magazinrohr
  // Treffer & Zombie-Geräusche
  hit(vol = 1, pan = 0) { sfxNoise(0.09, 450, 0.65 * vol, 'lowpass', 0.7, pan); sfxNoise(0.05, 1100, 0.3 * vol, 'bandpass', 1.2, pan, 0.01); sfxPing([95], 0.1, 0.4 * vol, pan); },
  zhurt(vol = 1, pan = 0) { sfxVoice({ f0: 130, glide: -40, dur: 0.3, vol: 0.2 * vol, pan, form: VOWELS[0], attack: 0.02, rasp: 20, breath: 0.5, vib: 7 }); },
  groan(vol, pan) { sfxVoice({ f0: rr(60, 95), glide: rr(-28, -6), dur: rr(0.7, 1.2), vol: 0.17 * vol, pan, form: VOWELS[(Math.random() * VOWELS.length) | 0], rasp: rr(14, 24), breath: 0.5, growl: rr(0.5, 0.8) }); },
  step(vol, pan, run) {
    sfxNoise(run ? 0.06 : 0.09, run ? 520 : 380, 0.7 * vol, 'lowpass', 0.8, pan);                              // Ferse
    sfxPing([run ? 85 : 62], 0.1, 0.55 * vol, pan);                                                            // Körper-Dump
    sfxNoise(0.1, 2600, 0.18 * vol, 'highpass', 0.7, pan, run ? 0.025 : 0.045, 0.01);                          // Schleifen/Kiesel
  },
  death(vol = 1, pan = 0) {
    sfxVoice({ f0: 110, glide: -55, dur: 1.1, vol: 0.24 * vol, pan, form: VOWELS[0], rasp: 20, breath: 0.5, attack: 0.04, growl: 0.7 });
    sfxNoise(0.2, 260, 0.6 * vol, 'lowpass', 0.7, pan, 0.7); sfxPing([55], 0.25, 0.5 * vol, pan, 0.7);        // Aufprall
  },
  pain() { sfxNoise(0.12, 500, 0.8); sfxPing([70], 0.18, 0.6); sfxNoise(0.35, 1200, 0.22, 'bandpass', 0.8, 0, 0.08, 0.06); },
  pickup(ammo) {
    if (ammo) { sfxPing([1800, 2800, 4200], 0.07, 0.3); sfxPing([1500, 2400, 3600], 0.08, 0.28, 0, 0.06); sfxNoise(0.05, 900, 0.2, 'lowpass', 0.7, 0, 0.02); }
    else { sfxNoise(0.06, 3200, 0.18, 'highpass'); sfxPing([1300, 1950], 0.09, 0.22, 0, 0.05); sfxPing([1700, 2550], 0.12, 0.22, 0, 0.12); }
  },
};

