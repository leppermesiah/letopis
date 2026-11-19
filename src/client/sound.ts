// Sounds of the place under the camera, from real recordings (public/sounds, all CC0, see CREDITS.md):
// a river or the sea, birds by day and crickets at night, a hammer in the villages and the fire at night,
// people talking in the villages, the calls of the animals nearby. Close to the ground they are clear; the higher the camera goes,
// the more they blur together and fade away.

import type { WorldRenderer } from './render';
import { TW, TH } from './render';
import { Biome, isWater, RIVER_WATER } from '../shared/types';

const BEDS = ['river', 'sea', 'birds', 'crickets', 'fire', 'crowd'] as const;
type Bed = (typeof BEDS)[number];
const HAMMERS = ['hammer1', 'hammer2', 'hammer3', 'hammer4'];

/** the animals we have a real recording of; the others stay quiet rather than sound fake */
const CALLS: Record<string, string> = {
  owl: 'owl', lion: 'growl', bear: 'growl', cavebear: 'growl',
  cow: 'cow', aurochs: 'cow', bison: 'cow',
  sheep: 'sheep', goat: 'goat',
  dog: 'dog', wolf: 'wolf',
  horse: 'horse', wildhorse: 'horse', donkey: 'donkey',
  pig: 'pig', boar: 'pig',
  hen: 'hen', cat: 'cat',
  crow: 'crow', duck: 'duck',
  elephant: 'elephant', mammoth: 'elephant',
};
const NIGHT_CALLS = new Set(['owl', 'wolf']);
/** how loud each call is next to the others: the dog and the donkey would wake the house */
const CALL_GAIN: Record<string, number> = { dog: 0.6, donkey: 0.5, elephant: 0.6, wolf: 0.7, hen: 0.8, crow: 0.7 };

export class Soundscape {
  on = false;
  /** 0..1, from the slider in the sound panel */
  volume = 1;
  private a: AudioContext | null = null;
  private master!: GainNode;
  private beds: Partial<Record<Bed, GainNode>> = {};
  private clips: Record<string, AudioBuffer> = {};
  private next = { animal: 0, village: 0 };
  private mix = { water: 0, sea: 0, crowd: 0, forest: 0, land: 0 };
  private lastLook = 0;
  constructor(private r: WorldRenderer) {}

  private async load(name: string): Promise<AudioBuffer | null> {
    try {
      const data = await fetch(`sounds/${name}.ogg`).then((res) => res.arrayBuffer());
      return await this.a!.decodeAudioData(data);
    } catch { return null; } // a sound that will not load is just not heard
  }

  /** browsers only let sound start after a click */
  start() {
    if (this.a) { void this.a.resume(); return; }
    const a = (this.a = new AudioContext());
    this.master = a.createGain();
    this.master.gain.value = 0;
    this.master.connect(a.destination);
    for (const name of BEDS) {
      void this.load(name).then((buf) => {
        if (!buf) return;
        const s = a.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        const g = a.createGain();
        g.gain.value = 0;
        s.connect(g).connect(this.master);
        s.start(0, Math.random() * buf.duration);
        this.beds[name] = g;
      });
    }
    for (const name of [...HAMMERS, ...new Set(Object.values(CALLS))]) {
      void this.load(name).then((buf) => { if (buf) this.clips[name] = buf; });
    }
  }

  stop() { void this.a?.suspend(); }

  private play(name: string, gain: number, pan: number) {
    const a = this.a!, buf = this.clips[name];
    if (!buf || gain < 0.01) return;
    const s = a.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = 0.92 + Math.random() * 0.16;
    const g = a.createGain();
    g.gain.value = gain;
    const p = a.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    s.connect(g).connect(p).connect(this.master);
    s.start();
  }

  /** what is under the camera: once in a while, it is cheap but not free */
  private look(cx: number, cy: number, R: number) {
    const { w, h } = this.r.info;
    let n = 0, water = 0, sea = 0, forest = 0;
    const step = Math.max(1, Math.round(R / 4));
    for (let y = Math.round(cy - R); y <= cy + R; y += step) for (let x = Math.round(cx - R); x <= cx + R; x += step) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x, b = this.r.biome[i];
      n++;
      if (isWater(b)) { sea++; water++; } else if (this.r.river[i] >= RIVER_WATER) water++;
      else if (b === Biome.Forest || b === Biome.Taiga || b === Biome.Marsh) forest++;
    }
    let crowd = 0;
    for (const c of this.r.camps.values()) {
      const d = Math.hypot(c.tx - cx, c.ty - cy);
      if (d < R + 3) crowd += Math.min(1, (2 + c.homes.children.length) / 10) * (1 - d / (R + 3));
    }
    this.mix = { water: n ? (water - sea) / n : 0, sea: n ? sea / n : 0, crowd: Math.min(1, crowd), forest: n ? forest / n : 0, land: n ? 1 - water / n : 1 };
  }

  frame(camX: number, camY: number, zoom: number, halfW: number) {
    const a = this.a;
    if (!a || !this.on || !this.r.info) return;
    const now = a.currentTime;
    // screen point to tile (ground level is close enough)
    const cx = (camX / (TW / 2) + camY / (TH / 2)) / 2, cy = (camY / (TH / 2) - camX / (TW / 2)) / 2;
    // the camera up high hears nothing; close down everything is clear
    const near = Math.max(0, Math.min(1, (zoom - 0.6) / 2.4));
    const R = Math.max(3, Math.min(10, 8 / Math.max(0.4, zoom) + 2));
    if (performance.now() - this.lastLook > 400) { this.lastLook = performance.now(); this.look(cx, cy, R); }
    const m = this.mix, night = this.r.nightNow, mars = this.r.mars;
    // up high the sounds blur: the clear calls go first, the soft beds last
    const bed = near ** 0.7, clear = near ** 1.6;
    const set = (name: Bed, v: number) => this.beds[name]?.gain.setTargetAtTime(v, now, 0.6);
    this.master.gain.setTargetAtTime(0.8 * this.volume, now, 0.5);
    set('river', Math.min(1, m.water * 2) * 0.35 * bed);
    set('sea', Math.min(1, m.sea * 1.5) * 0.3 * bed);
    const green = mars ? 0 : m.land * (0.4 + 0.6 * m.forest);
    set('birds', night ? 0 : green * 0.35 * bed);
    set('crickets', night ? green * 0.18 * bed : 0);
    set('fire', night ? m.crowd * 0.35 * clear : 0);
    // people talking in the village by day, soft and only close down
    set('crowd', night ? 0 : m.crowd * 0.12 * clear);
    if (clear < 0.05) return;
    // the village by day: a hammer now and then
    if (now > this.next.village && m.crowd > 0.15 && !night) {
      this.next.village = now + 1.5 + Math.random() * 4;
      this.play(HAMMERS[Math.floor(Math.random() * HAMMERS.length)], clear * m.crowd * 0.25, Math.random() * 1.2 - 0.6);
    }
    // an animal nearby calls now and then, from where it stands
    if (now > this.next.animal && !mars) {
      this.next.animal = now + 4 + Math.random() * 8;
      const f = this.r.fauna;
      const all = [...f.wild, ...[...f.tame.values()].flat()]
        .filter((x) => CALLS[x.sp.id] && (night === NIGHT_CALLS.has(x.sp.id)) && Math.hypot(x.x - cx, x.y - cy) < R);
      const pick = all[Math.floor(Math.random() * all.length)];
      if (pick) {
        const d = Math.hypot(pick.x - cx, pick.y - cy);
        const sx = ((pick.x - pick.y) * (TW / 2) - camX) * zoom;
        const name = CALLS[pick.sp.id];
        this.play(name, clear * (1 - d / R) * 0.4 * (CALL_GAIN[name] ?? 1), sx / halfW);
      }
    }
  }
}
