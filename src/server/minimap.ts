// A small picture of one map for the "Maps" window: the land in its colours, seen from the same isometric
// angle as the game, the unexplored parts dark, and every village a dot in its colour. Made on the server as a
// PNG and kept for five minutes, so the window costs nothing however many maps there are.

import { deflateSync, crc32 } from 'node:zlib';
import type { Simulation } from './sim/sim';
import { RIVER_WATER } from '../shared/types';

export const MINI_W = 320;
export const MINI_H = 160;
const KEEP_MS = 5 * 60 * 1000;

// deep sea, sea, beach, grassland, plains, forest, taiga, hills, mountain, snow, desert, tundra, marsh, lake
const COLORS: [number, number, number][] = [
  [28, 58, 112], [44, 92, 160], [222, 206, 150], [118, 168, 84], [160, 176, 96], [62, 120, 58], [72, 112, 86],
  [140, 136, 96], [128, 122, 116], [236, 240, 246], [222, 196, 128], [176, 186, 170], [96, 130, 92], [58, 110, 178],
];
const FOG: [number, number, number, number] = [30, 42, 68, 255];

function png(w: number, h: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

/** the picture of map (gx, gy) of this world; null when that map is not open */
function draw(sm: Simulation, gx: number, gy: number): Buffer | null {
  if (!sm.isOpen(gx, gy)) return null;
  const S = sm.mapSize, t = sm.t, W = t.w;
  const g = sm.s.grid;
  const x0 = (gx - (g?.gx0 ?? 0)) * S, y0 = (gy - (g?.gy0 ?? 0)) * S;
  const out = new Uint8Array(MINI_W * MINI_H * 4);
  const hw = MINI_W / 2, hh = MINI_H / 2;
  for (let py = 0; py < MINI_H; py++) for (let px = 0; px < MINI_W; px++) {
    // back from the screen to the tile: the top corner of the diamond is tile (0, 0)
    const a = (px + 0.5 - hw) / hw, b = (py + 0.5) / hh;
    const u = (a + b) / 2, v = (b - a) / 2;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const tx = Math.floor(u * S), ty = Math.floor(v * S);
    const i = (y0 + ty) * W + x0 + tx;
    const o = (py * MINI_W + px) * 4;
    if (!t.explored[i]) { out.set(FOG, o); continue; }
    const bi = t.biome[i];
    let [r, gg, bb] = t.river[i] >= RIVER_WATER ? COLORS[13] : COLORS[bi] ?? COLORS[3];
    // a little light on the slopes that face the sun
    const hgt = Math.max(0, t.height[i]);
    const left = t.explored[i - 1] !== undefined ? Math.max(0, t.height[i - 1] ?? 0) : hgt;
    const shade = 1 + Math.max(-0.18, Math.min(0.18, (hgt - left) * 6)) + hgt * 0.12;
    r = Math.min(255, r * shade); gg = Math.min(255, gg * shade); bb = Math.min(255, bb * shade);
    if (sm.roads[i] & 3) { r = 150; gg = 120; bb = 84; }
    out[o] = r; out[o + 1] = gg; out[o + 2] = bb; out[o + 3] = 255;
  }
  // every village a dot in its colour, bigger for bigger places
  const size = new Map<number, number>();
  for (const p of sm.s.people) size.set(p.bandId, (size.get(p.bandId) ?? 0) + 1);
  for (const b of sm.s.bands) {
    const u = (b.cx - x0) / S, v = (b.cy - y0) / S;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const cx = Math.round((u - v) * hw + hw), cy = Math.round((u + v) * hh);
    const rad = Math.min(4, 1.5 + Math.sqrt(size.get(b.id) ?? 0) / 8);
    const col = [(b.color >> 16) & 255, (b.color >> 8) & 255, b.color & 255];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > rad + 1) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= MINI_W || y >= MINI_H) continue;
      const o = (y * MINI_W + x) * 4;
      if (d > rad) { out[o] = 20; out[o + 1] = 20; out[o + 2] = 28; out[o + 3] = 255; } else { out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255; }
    }
  }
  return png(MINI_W, MINI_H, out);
}

const cache = new Map<string, { at: number; png: Buffer | null }>();

/** the picture, made again at most every five minutes */
export function minimap(sm: Simulation, gx: number, gy: number): Buffer | null {
  const key = `${sm.s.worldId}|${gx},${gy}`;
  const c = cache.get(key);
  if (c && Date.now() - c.at < KEEP_MS && c.png) return c.png;
  const img = draw(sm.use(), gx, gy);
  cache.set(key, { at: Date.now(), png: img });
  return img;
}
