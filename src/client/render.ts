import {
  ColorMatrixFilter,
  AlphaFilter, Application, BlurFilter, Container, Filter, Geometry, GlProgram, Graphics, ImageSource, Mesh, Rectangle, Shader, Sprite, Text, Texture,
} from 'pixi.js';
import { Simplex } from '../shared/noise';
import { Fauna } from './animals';
import { Fleet } from './ships';
import { Canoes } from './canoes';
import { Trains } from './trains';
import { SECRET_KINDS, SecretSpot, secretSpots } from '../shared/secrets';
import { B, LANG, VILLAGE } from './lang';
import { Rng } from '../shared/rng';
import { CONIFERS, TREE_KINDS } from '../shared/trees';
import { shortNum } from '../shared/people';
import { BandView, Biome, PersonRow, TASKS, WorldInfo, b64decode, isWater, RIVER_WATER } from '../shared/types';

export const TW = 32; // tile width
export const TH = 16; // tile height
export const ELEV = 5;
type Role = 'guard' | 'bodyguard' | 'teller' | 'listener';
/** most people of one band drawn on the map */
const PER_BAND = 36; // pixels per height level
const CHUNK = 16;
/** from this much flow a river fills its tile; below it is a thin stream */
const BIG_RIVER = 120;

export function iso(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) };
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** light stripes across the rim of a kingdom town's name tag (a pill w x h, its bottom at 0) */
function stripes(g: Graphics, w: number, h: number) {
  const r = h / 2, straight = w - h;
  const len = 2 * straight + 2 * Math.PI * r;
  const at = (d: number): [number, number] => {
    d = ((d % len) + len) % len;
    if (d < straight) return [-straight / 2 + d, -h];
    d -= straight;
    if (d < Math.PI * r) { const a = -Math.PI / 2 + d / r; return [straight / 2 + Math.cos(a) * r, -r + Math.sin(a) * r]; }
    d -= Math.PI * r;
    if (d < straight) return [straight / 2 - d, 0];
    d -= straight;
    const a = Math.PI / 2 + d / r;
    return [-straight / 2 + Math.cos(a) * r, -r + Math.sin(a) * r];
  };
  const n = Math.max(8, Math.round(len / 7));
  for (let k = 0; k < n; k++) {
    const d0 = (k / n) * len, d1 = d0 + len / n / 2;
    const p0 = at(d0), pm = at((d0 + d1) / 2), p1 = at(d1);
    g.moveTo(p0[0], p0[1]).lineTo(pm[0], pm[1]).lineTo(p1[0], p1[1]);
  }
  g.stroke({ color: 0xffffff, width: 3, alpha: 0.75 });
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

function pick<T>(list: T[], n: number): T {
  return list[Math.min(list.length - 1, Math.floor(n * list.length))];
}

// ---------- sprite atlas (made by tools/build_atlas.py from the AI sheets in art/) ----------

/** one tile of the sloped ground mesh */
interface GroundQuad {
  x: number; y: number; name: string; tint: number; blend?: boolean; snow?: number;
  /** own corner heights (water surfaces, sea and river beds), colours and transparency instead of the ground's */
  h?: number[]; tints?: number[]; alpha?: number[]; flat?: boolean;
  /** a sprite laid over the tile instead of a ground square: its page and the diamond's corners on it */
  page?: number; uv?: number[][];
  /** a see-through square laid over the tile (stream, shore): no face down at the map's edge */
  over?: boolean;
  /** the ragged mask (on the ground page) that cuts this ground where it reaches into a neighbour */
  mask?: string;
  /** the ground square turned a quarter (roads along y: their ruts and rows of stones go along the road) */
  rot?: boolean;
}

const GROUND_VERT = `
in vec2 aPosition;
in vec2 aUV;
in vec4 aColor;
in vec2 aMask;
out vec2 vUV;
out vec4 vColor;
out vec2 vMask;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vColor = aColor;
  vMask = aMask;
}`;
const GROUND_FRAG = `
in vec2 vUV;
in vec4 vColor;
in vec2 vMask;
uniform sampler2D uTexture;
uniform vec4 uColor;
uniform vec4 uWorldColorAlpha;
void main() {
  vec4 c = texture2D(uTexture, vUV);
  // a ground reaching over the edge into the tile next to it shows only where its mask is white
  // (red: how much shows, green: how bright, for the darker edges of a road)
  if (vMask.x >= 0.0) { vec4 m = texture2D(uTexture, vMask); c *= m.r; c.rgb *= m.g; }
  // the colours come premultiplied by their alpha
  float a = uColor.a * uWorldColorAlpha.a * vColor.a;
  gl_FragColor = vec4(c.rgb * vColor.rgb * vColor.a * uColor.rgb * uWorldColorAlpha.rgb, a * c.a);
}`;

interface Frame { x: number; y: number; w: number; h: number; ax: number; ay: number; s: number; p?: number; dt?: number }

export class Atlas {
  tex: Record<string, Texture> = {};
  frames: Record<string, Frame> = {};
  /** ground tops unwarped into squares (u: top->right corner, v: top->left corner), for the sloped ground mesh */
  ground: { source: ImageSource; size: number; cells: Record<string, [number, number, number]> } | null = null;
  private pages: { url: string; size: [number, number] }[] = [];
  /** the atlas pages as textures, for meshes that lay a sprite over the sloped ground */
  sources: ImageSource[] = [];

  /** a sprite as a small picture for the page (a span with the atlas as background), fitted into size px */
  html(name: string, size: number, cls = 'sprite-ico'): string {
    const f = this.frames[name], pg = f && this.pages[f.p ?? 0];
    if (!f || !pg) return '';
    const k = size / Math.max(f.w, f.h);
    return `<span class="${cls}" style="width:${Math.round(f.w * k)}px;height:${Math.round(f.h * k)}px;background:url(${pg.url}) -${(f.x * k).toFixed(1)}px -${(f.y * k).toFixed(1)}px/${(pg.size[0] * k).toFixed(1)}px ${(pg.size[1] * k).toFixed(1)}px no-repeat"></span>`;
  }

  static async load(base: string, version = ''): Promise<Atlas> {
    const a = new Atlas();
    const v = version ? `?v=${version}` : '';
    const meta = await fetch(`${base}/atlas.json${v}`).then((r) => r.json());
    const files: string[] = meta.pages ? meta.pages.map((p: { file: string }) => p.file) : ['atlas.webp'];
    const sources = await Promise.all(files.map(async (file) => {
      // a plain <img> with premultiply-on-upload: the one path every browser handles fast. Firefox treats
      // premultiplied ImageBitmap uploads as a deprecated slow path (up to a minute, even a lost WebGL context)
      const img = new Image();
      img.decoding = 'async';
      img.src = `${base}/${file}${v}`;
      await img.decode();
      return new ImageSource({
        resource: img,
        alphaMode: 'premultiply-alpha-on-upload',
        autoGenerateMipmaps: true,
        scaleMode: 'linear',
        mipmapFilter: 'linear',
        maxAnisotropy: 4,
      });
    }));
    if (meta.ground) {
      const img = new Image();
      img.decoding = 'async';
      img.src = `${base}/${meta.ground.file}${v}`;
      await img.decode();
      const source = new ImageSource({ resource: img, autoGenerateMipmaps: true, scaleMode: 'linear', mipmapFilter: 'linear', maxAnisotropy: 4, addressMode: 'clamp-to-edge' });
      a.ground = { source, size: meta.ground.size[0], cells: meta.ground.cells };
    }
    a.sources = sources;
    a.frames = meta.frames;
    a.pages = files.map((file, i) => ({ url: `${base}/${file}${v}`, size: meta.pages?.[i]?.size ?? meta.size ?? [2048, 2048] }));
    for (const [name, f] of Object.entries(a.frames)) {
      a.tex[name] = new Texture({ source: sources[f.p ?? 0], frame: new Rectangle(f.x, f.y, f.w, f.h) });
    }
    return a;
  }

  /** where the diamond of a tile frame lies on its page: top, right, bottom, left corner in pixels */
  diamond(name: string): { page: number; uv: number[][] } | null {
    const f = this.frames[name];
    if (!f || f.dt === undefined) return null;
    const cy = f.y + f.ay * f.h, top = f.y + f.dt;
    return { page: f.p ?? 0, uv: [[f.x + f.w / 2, top], [f.x + f.w, cy], [f.x + f.w / 2, 2 * cy - top], [f.x, cy]] };
  }

  has(name: string): boolean {
    return name in this.frames;
  }

  sprite(name: string): Sprite {
    const s = new Sprite();
    this.set(s, name);
    return s;
  }

  /** world units per texture pixel */
  scale(name: string): number {
    return this.frames[name].s;
  }

  set(s: Sprite, name: string, mul = 1) {
    const f = this.frames[name];
    if (!f) return; // a missing frame must never stop the drawing
    s.texture = this.tex[name];
    s.anchor.set(f.ax, f.ay);
    s.scale.set(f.s * mul);
  }
}

// Totem in the band name -> symbol in the atlas (sym0..sym99: sheets AQ then AR, row by row).
// Only the totem is matched ("Родът на Белия Вълк от Ледения Хълм" -> "Вълк").
const TOTEM_SYMBOL: [RegExp, number][] = [
  [/Вълчиц/, 2], [/Вълк/, 2], [/Орел|Орл|Сокол|Ястреб|Лястовиц/, 13], [/Елен|Сърн|Кошут/, 5], [/Глиган/, 24],
  [/Бизон/, 6], [/Бухал|Сов|Кукумявк/, 14], [/Дъб|Чинар|Явор|Лип|Върб/, 47], [/Камък|Скал/, 54],
  [/Огн|Огън|Пламъч/, 32], [/Вят|Вихр|Вихър/, 75], [/Гарван|Сойк|Кълвач/, 15], [/Рис|Лъв/, 8], [/Бобър|Бобр/, 43],
  [/Бор|Гор/, 86], [/Облак/, 76], [/Щъркел|Жерав|Чапл|Лебед/, 60], [/Мамут/, 0], [/Тур|Зубър|Зубр/, 1],
  [/Гръм|Гром|Мълни|Бур/, 74], [/Кремък|Кремък/, 37], [/Изгрев|Зор[аи]|Здрач/, 56], [/Залез/, 71],
  [/Руче|Рек/, 31], [/Водопад|Дъг/, 79], [/Козирог/, 22], [/Скорпион|Пчел|Мравк|Калинк/, 19], [/Бръшлян/, 46],
  [/Мечк/, 4], [/Лисиц/, 61], [/Риб/, 9], [/Звезд|Зорниц/, 72], [/Лун/, 29], [/Змия|Змий/, 16], [/Планин/, 30],
  [/Рос/, 81], [/Пеперуд/, 88], [/Видр/, 10], [/Катериц/, 48], [/Костенурк/, 11], [/Слън/, 28], [/Езер/, 89],
  [/Ехо/, 58], [/Небе/, 73], [/Кон/, 62], [/Таралеж/, 3], [/Сърц/, 96],
];
// the clan names of today: the first word that fits wins, so the order matters
const CLAN_SYMBOL: [RegExp, number][] = [
  [/мамут/i, 0], [/бивол/i, 1], [/рисов/i, 8], [/огнена лапа/i, 32], [/вълч|вълк|вълци/i, 2], [/мечк/i, 4], [/северен елен/i, 23],
  [/елен/i, 5], [/лисич/i, 61], [/гарван/i, 15], [/небесен орел/i, 13], [/орел|орлов/i, 13], [/змия|змийск/i, 16],
  [/глиган/i, 24], [/сов/i, 14], [/бобров/i, 43], [/кон/i, 62], [/заек/i, 18], [/лебед/i, 60], [/звяр/i, 59],
  [/зъб|зъби/i, 43], [/нокът|нокти/i, 49], [/рог|рогат/i, 68], [/риба|рибар/i, 9], [/лапа/i, 3], [/кожа/i, 12],
  [/грива/i, 98], [/сърц/i, 96], [/ око$/i, 96], [/пророц/i, 96],
  [/копи/i, 36], [/стрел/i, 39], [/юмру|ръка/i, 25], [/удар/i, 38], [/остър камък/i, 40], [/камък|скал|каменн|камен/i, 54],
  [/кръг/i, 55], [/пещер/i, 58], [/връх|планин/i, 30], [/хълм/i, 30], [/долин/i, 56], [/земя|земн|земята/i, 34],
  [/следа|следи|стъпки/i, 60], [/скок/i, 60], [/скитал|бродниц/i, 33],
  [/река|речн|речен|поток|брод|извор/i, 31], [/вълна|пяна|вода|водна|вир/i, 79], [/езеро|бряг/i, 89], [/мъгл/i, 76],
  [/тръстик|блат/i, 81], [/огън|огъня|огнен|пламт|пламъч/i, 32], [/искра/i, 73], [/пепел|дим/i, 57],
  [/слънч|лъч|светлин/i, 28], [/залез/i, 71], [/лун/i, 29], [/звезд/i, 72], [/нощ/i, 70],
  [/жълъд/i, 48], [/дъб/i, 85], [/ягод|плод/i, 83], [/лист/i, 47], [/трън|бодлив/i, 46], [/бор|бреза|гора|горск/i, 86],
  [/цвет/i, 88], [/семена|поляна/i, 80], [/корен|филиз/i, 82], [/дух|души|сенки|сянка|забрав|безимен/i, 91],
  [/кръв|кървав/i, 99], [/ловци|ловн/i, 37],
];
const USED = new Set(TOTEM_SYMBOL.map(([, s]) => s));
const FREE = Array.from({ length: 100 }, (_, i) => i).filter((i) => !USED.has(i));
export function bandSymbol(name: string, id: number): number {
  if (!name.startsWith('Родът на ')) {
    for (const [re, s] of CLAN_SYMBOL) if (re.test(name)) return s;
    return FREE[Math.floor(hash(id, 3) * FREE.length)];
  }
  const totem = name.replace(/^Родът на /, '').split(' от ')[0].split(' ').pop() ?? '';
  for (const [re, s] of TOTEM_SYMBOL) if (re.test(totem)) return s;
  return FREE[Math.floor(hash(id, 3) * FREE.length)];
}

// Own GLSL: gentle moving light on the water surface.
const WATER_VERT = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vTexel;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); vTexel = uInputSize.zw; }
`;
const WATER_FRAG = `
in vec2 vTextureCoord;
in vec2 vTexel;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform vec4 uCam; // x, y offset, scale, unused
// the water moves: a few slow swells, crossing each other, bend the picture of the water and the sea
// floor a little (as light does through real water) and lighten their crests faintly
void main(void) {
  vec2 p = (gl_FragCoord.xy - uCam.xy) / uCam.z;
  float t = uTime * 0.25; // slow, like a calm sea seen from far above
  float a = sin(p.x * 0.050 + p.y * 0.090 + t * 1.30);
  float b = sin(p.x * -0.080 + p.y * 0.060 + t * 0.95);
  float d = sin(p.x * 0.140 - p.y * 0.030 - t * 1.70);
  vec2 off = vec2(a + 0.5 * d, b + 0.5 * a) * 0.6 * uCam.z;
  vec4 c = texture(uTexture, vTextureCoord + off * vTexel);
  float crest = (a * b + 0.6 * d) * 0.5;
  c.rgb += c.a * vec3(0.03, 0.045, 0.055) * crest;
  // light under the water: a net of soft caustics drifting the other way than the swells
  vec2 q = p * 0.11 - vec2(t * 0.9, -t * 0.6);
  float k = abs(sin(q.x + sin(q.y * 1.3)) + sin(q.y * 0.9 + sin(q.x * 1.1 + t * 0.7)));
  float caustic = pow(clamp(1.0 - k * 0.5, 0.0, 1.0), 6.0);
  // and the white crests shimmer, the glint running against the swell
  float lum = dot(c.rgb, vec3(0.3, 0.5, 0.2)) / max(c.a, 0.001);
  float white = smoothstep(0.55, 0.85, lum);
  float run = 0.5 + 0.5 * sin(p.x * -0.12 + p.y * 0.08 - t * 2.4);
  c.rgb += c.a * (vec3(0.07, 0.09, 0.1) * caustic + vec3(0.12, 0.13, 0.14) * white * run * run);
  finalColor = c;
}
`;

type ObjKind = 'tree' | 'other';
/** tk: kind of tree (TREE_KINDS) for the trees the simulation grows */
interface WorldObject { s: Sprite; i: number; kind: ObjKind; base: string; n: number; size: number; flip: number; tk?: number; stump?: WorldObject; isStump?: boolean }

export class WorldRenderer {
  app: Application;
  atlas: Atlas;
  world = new Container(); // camera moves this
  terrainLayer = new Container();
  waterLayer = new Container();
  snowLayer = new Container();
  objLayer = new Container();
  /** roads, drawn over the ground (inside the terrain layer) */
  roadLayer = new Container();
  roads = new Uint8Array(0);
  roadSprites = new Map<number, Sprite>();
  /** the roads of a chunk, laid over the sloped ground as meshes */
  roadChunks = new Map<number, Container>();
  /** railway tracks, over the roads and the snow */
  railLayer = new Container();
  railSprites = new Map<number, Sprite>();
  roadVersion = 0;
  /** what every band knows (tech ids), for the work people show */
  bandTech = new Map<number, Set<string>>();
  /** capitals of kingdoms: their chief walks as a king */
  capitals = new Set<number>();
  fogLayer = new Container();
  campLayer = new Container();
  /** kept empty: kingdoms are shown by the colour of the name tags, not on the map */
  realmLayer = new Container();
  peopleLayer = new Container();
  glowLayer = new Container();
  labelLayer = new Container();
  /** the night veil: a small 2D canvas (a quarter of the screen) stretched over everything */
  nightCanvas = document.createElement('canvas');
  nightSprite!: Sprite;
  nightAt = 0;
  /** zoomed far out: the whole map is one ready picture instead of tens of thousands of sprites */
  farLayer = new Container();
  farSprite: Sprite | null = null;
  farKey = '';
  farAt = 0;
  far = false;
  info!: WorldInfo;
  level!: Uint8Array;
  /** height of every tile corner ((w+1)*(h+1), in levels): the ground is one smooth sloped surface over them */
  vh!: Float32Array;
  private meshShaders = new Map<ImageSource, Shader>();
  /** depth of the sea floor at every corner, in levels below the water */
  private wd = new Float32Array(0);
  private cutDone = new Set<number>();
  /** colour of every tile's ground (forest darker, desert warmer...), blended at the corners */
  private tints: Uint32Array | null = null;
  biome!: Uint8Array;
  river!: Uint8Array;
  temp!: Uint8Array;
  explored: Uint8Array = new Uint8Array(0);
  cleared = new Set<number>();
  /** what tree can grow on each tile and how big it is now (from the server) */
  treeKind: Uint8Array = new Uint8Array(0);
  treeStage: Uint8Array = new Uint8Array(0);
  treeObjs = new Map<number, WorldObject>();
  fogChunks = new Map<number, Graphics>();
  objChunks = new Map<number, WorldObject[]>();
  chunkViews: { area: Rectangle; parts: Container[] }[] = [];
  clumps = new Simplex(new Rng(20261101));
  fogReady = false;
  waterFilter: Filter | null = null;
  snowCold!: Container;
  snowCool!: Container;
  people = new Map<number, PersonSprite>();
  selectedId: number | null = null;
  lastPeople: { rows: PersonRow[]; bandColors: Map<number, number>; tickMs: number } | null = null;
  camps = new Map<number, CampSprite>();
  fauna = new Fauna(this);
  fleet = new Fleet(this);
  canoes = new Canoes(this);
  trains = new Trains(this);
  /** the 100 hidden secrets: tiny, half see-through, buried by snow in winter */
  secrets: { spot: SecretSpot; s: Sprite; i: number; found: boolean; rim: Sprite[] }[] = [];
  tex!: Record<string, Texture>;
  time = 0;
  month = 0;
  seasonKey = '';
  zoom = 1;
  night = true;
  /** zoomed out to half or less: no animations */
  still = false;
  /** it is night right now (updated every frame) */
  nightNow = false;
  /** the second world: red dust, no animals */
  mars = false;
  /** real people for each one living in the game: the page shows numbers like the real world's */
  popScale = 1;

  constructor(app: Application, atlas: Atlas) {
    this.app = app;
    this.atlas = atlas;
    this.world.addChild(this.farLayer, this.waterLayer, this.terrainLayer, this.snowLayer, this.realmLayer, this.objLayer, this.campLayer, this.peopleLayer, this.fogLayer, this.glowLayer, this.labelLayer);
    // the ground, water, snow, trees and fog are render groups of their own: Pixi sorts their tens of thousands
    // of sprites only when they change, not again every frame because somebody walked or an animal moved
    for (const l of [this.waterLayer, this.terrainLayer, this.snowLayer, this.objLayer, this.fogLayer]) l.isRenderGroup = true;
    this.nightCanvas.width = 8;
    this.nightCanvas.height = 8;
    this.nightSprite = new Sprite(Texture.from(this.nightCanvas));
    this.nightSprite.eventMode = 'none';
    app.stage.addChild(this.world, this.nightSprite);
    this.snowCold = new Container();
    this.snowCool = new Container();
    this.snowLayer.addChild(this.snowCool, this.snowCold);
    this.glowLayer.blendMode = 'add';
    // one soft veil over the unknown lands
    this.fogLayer.filters = [new BlurFilter({ strength: 6, quality: 3 }), new AlphaFilter({ alpha: 0.9 })];
    this.makeTextures();
  }

  private makeTextures() {
    const r = this.app.renderer;
    const g = (draw: (g: Graphics) => void) => {
      const gr = new Graphics();
      draw(gr);
      const t = r.generateTexture({ target: gr, resolution: 3 });
      gr.destroy();
      return t;
    };
    this.tex = {
      ground: g((x) => {
        for (let i = 6; i > 0; i--) x.ellipse(52, 26, 24 + i * 4, 12 + i * 2).fill({ color: 0x7a5a36, alpha: 0.12 });
        x.ellipse(52, 26, 26, 13).fill({ color: 0x8c6b44, alpha: 0.5 });
      }),
      // gold star over the heads of those who lived to 70
      star: g((x) => {
        x.star(8, 8, 5, 7, 3).fill(0xffd34d).stroke({ color: 0x6b4a10, width: 1.2 });
      }),
      // red star over the famous people of the real world
      redstar: g((x) => {
        x.star(9, 9, 5, 8, 3.4).fill(0xff2a2a).stroke({ color: 0x5a0a0a, width: 1.4 });
      }),
      glow: g((x) => {
        for (let i = 10; i > 0; i--) x.circle(40, 40, i * 4).fill({ color: 0xff8a2a, alpha: 0.035 });
      }),
    };
    // railway tracks, one texture for every way the neighbours can join (same mask as the roads)
    for (let mask = 0; mask < 16; mask++) {
      const gr = new Graphics();
      // to the middle of the edge towards -x, -y, +x, +y
      const dirs: [number, number, number][] = [[1, -8, -4], [2, 8, -4], [4, 8, 4], [8, -8, 4]];
      let ends = dirs.filter(([m]) => mask & m);
      if (!ends.length) ends = dirs.filter(([m]) => m & 10);
      else if (ends.length === 1) ends = dirs.filter(([m]) => m === ends[0][0] || m === ((ends[0][0] << 2) | (ends[0][0] >> 2)) % 16);
      for (const [, ex, ey] of ends) {
        gr.moveTo(0, 0).lineTo(ex, ey).stroke({ width: 4.2, color: 0x7d7264, cap: 'round' });
      }
      for (const [, ex, ey] of ends) {
        // sleepers lie across the track: the other axis, a little shorter
        const px = -ex, py = ey;
        const k = 0.28;
        for (const t of [0.2, 0.55, 0.9]) {
          const cx = ex * t, cy = ey * t;
          gr.moveTo(cx - px * k, cy - py * k).lineTo(cx + px * k, cy + py * k).stroke({ width: 1.1, color: 0x6b4a2b });
        }
      }
      for (const side of [-0.17, 0.17]) {
        for (const [, ex, ey] of ends) {
          const px = -ex * side, py = ey * side;
          gr.moveTo(px, py).lineTo(ex + px, ey + py).stroke({ width: 0.7, color: 0xb9c0c6 });
        }
      }
      this.tex[`rail${mask}`] = r.generateTexture({ target: gr, resolution: 3, frame: new Rectangle(-16, -8, 32, 16) });
      gr.destroy();
    }
  }

  setWorld(info: WorldInfo) {
    this.info = info;
    this.mars = info.planet === 'mars';
    // Mars: the same sand and rocks, but rusty red
    const red = this.mars ? (() => {
      const f = new ColorMatrixFilter();
      f.matrix = [0.85, 0.35, 0.05, 0, 0.04, 0.3, 0.45, 0.05, 0, 0, 0.12, 0.15, 0.3, 0, 0, 0, 0, 0, 1, 0];
      return [f];
    })() : [];
    // the Mars rocks and machines are drawn in their own colours; only the Earth ground is turned red
    for (const l of [this.terrainLayer, this.farLayer, this.snowLayer]) l.filters = red;
    this.objLayer.filters = [];
    const h = b64decode(info.height);
    this.biome = b64decode(info.biome);
    this.river = b64decode(info.river);
    this.temp = b64decode(info.temp);
    this.level = new Uint8Array(h.length);
    for (let i = 0; i < h.length; i++) {
      const v = h[i] / 127.5 - 1;
      this.level[i] = isWater(this.biome[i]) ? 0 : 1 + Math.floor(Math.max(0, v) * 14);
    }
    this.vh = this.cornerHeights();
    this.tints = null;
    this.explored = new Uint8Array(info.w * info.h);
    this.treeKind = info.treeKinds ? b64decode(info.treeKinds) : new Uint8Array(info.w * info.h);
    this.treeStage = new Uint8Array(info.w * info.h);
    this.treeObjs.clear();
    this.cleared.clear();
    for (const l of [this.terrainLayer, this.waterLayer, this.snowCold, this.snowCool, this.fogLayer, this.objLayer]) l.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.fogChunks.clear();
    this.objChunks.clear();
    this.chunkViews = [];
    this.fogReady = false;
    this.seasonKey = '';
    this.buildTerrain();
    this.roads = new Uint8Array(info.w * info.h);
    this.roadSprites.clear();
    this.roadChunks.clear();
    this.roadLayer = new Container();
    this.terrainLayer.addChild(this.roadLayer);
    this.railSprites.clear();
    this.railLayer.destroy({ children: true });
    // the tracks are kept clear of snow, so they lie over it
    this.railLayer = new Container();
    this.snowLayer.addChild(this.railLayer);
    this.setupWaterFilter();
  }

  private lv(x: number, y: number): number {
    const { w, h } = this.info;
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return this.level[y * w + x];
  }

  /** small streams stay hidden; from a real river on, the tile is water */
  private isRiver(i: number): boolean {
    return this.river[i] >= RIVER_WATER && !isWater(this.biome[i]);
  }

  /** a river big enough to fill its tile with water; a smaller one runs as a thin stream through the grass */
  private bigRiver(i: number): boolean {
    return this.river[i] >= BIG_RIVER && !isWater(this.biome[i]);
  }

  private isStream(i: number): boolean {
    return this.isRiver(i) && this.river[i] < BIG_RIVER;
  }

  /** where the water of a river tile flows on: into the sea or a big river next to it, or else to the
   * neighbour carrying the most water (more than this one); -1 at none */
  private downstream(i: number): number {
    const { w, h } = this.info;
    const x = i % w, y = (i - x) / w;
    let best = -1, flow = this.river[i];
    for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h) continue;
      const j = i + dy * w + dx;
      if (isWater(this.biome[j]) || this.bigRiver(j)) return j;
      if (this.river[j] > flow) { flow = this.river[j]; best = j; }
    }
    return best;
  }

  /** neighbours (1 = -x, 2 = -y, 4 = +x, 8 = +y) for which ok() holds */
  private sides(x: number, y: number, ok: (j: number) => boolean): number {
    const { w, h } = this.info;
    let m = 0;
    if (x > 0 && ok(y * w + x - 1)) m |= 1;
    if (y > 0 && ok((y - 1) * w + x)) m |= 2;
    if (x < w - 1 && ok(y * w + x + 1)) m |= 4;
    if (y < h - 1 && ok((y + 1) * w + x)) m |= 8;
    return m;
  }

  /** land reaching into a water tile: broken shore pieces over its edges */
  private shoreQuads(x: number, y: number, H: number[] | undefined, out: GroundQuad[]) {
    const dry = (j: number) => !isWater(this.biome[j]) && !this.bigRiver(j);
    this.blendQuads(x, y, out, H ?? [0, 0, 0, 0]);
    for (const k of this.edgeKeys(x, y, dry)) {
      out.push({ x, y, name: `shore_${k}`, tint: 0xffffff, flat: true, over: true, h: H ?? [0, 0, 0, 0] });
    }
  }

  /** the pieces (as on the shore and mask sheets) that cover the edges and corners of a tile where ok() holds next to it */
  private edgeKeys(x: number, y: number, ok: (j: number) => boolean): string[] {
    const { w, h } = this.info;
    const dry = ok;
    const m = this.sides(x, y, dry);
    const keys: string[] = [];
    if (m === 3 || m === 6 || m === 12 || m === 9) keys.push(String(m));
    else for (const bit of [1, 2, 4, 8]) if (m & bit) keys.push(`${bit}${hash(x * 5 + bit, y * 3) < 0.5 ? 'a' : 'b'}`);
    // a point of land at a corner whose two edges are water
    const at = (dx: number, dy: number) => x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && dry((y + dy) * w + x + dx);
    if (!(m & 3) && at(-1, -1)) keys.push('t');
    if (!(m & 6) && at(1, -1)) keys.push('r');
    if (!(m & 12) && at(1, 1)) keys.push('b');
    if (!(m & 9) && at(-1, 1)) keys.push('l');
    return keys;
  }

  /** which grounds reach into which at their edges: the higher reaches into the lower */
  private static RANK: Record<string, number> = { marsh: 1, sand: 2, steppe: 3, grass: 4, meadow: 4.5, tundra: 5, hill: 6, rock: 7, crag: 7, snow: 8 };

  private groundFamily(j: number): { fam: string; rank: number; name: string; tint: number } | null {
    const { w } = this.info;
    if (isWater(this.biome[j]) || this.bigRiver(j)) return null;
    const x = j % w, y = (j - x) / w;
    const g = this.groundOf(this.biome[j], x, y, hash(x, y));
    const fam = g.name.replace(/\d+$/, '');
    const rank = WorldRenderer.RANK[fam];
    return rank ? { fam, rank, name: g.name, tint: g.tint } : null;
  }

  /** stronger grounds next to this tile reach into it through ragged masks, so tiles of two grounds do not meet in a straight line */
  private blendQuads(x: number, y: number, out: GroundQuad[], h0?: number[]) {
    if (this.mars) return;
    const { w, h } = this.info;
    // a water tile is the weakest of all: the land around reaches into it (under its shore)
    const own = h0 ? { fam: 'water', rank: 0, name: '' } : this.groundFamily(y * w + x);
    if (!own) return;
    // each ground is drawn in a few unlike pictures: they also reach into each other
    const over = (f: { fam: string; rank: number; name: string }) =>
      f.rank > own.rank ? f.fam !== own.fam : f.fam === own.fam && f.name > own.name;
    const found = new Map<string, { rank: number; name: string; tint: number }>();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h) continue;
      const f = this.groundFamily((y + dy) * w + x + dx);
      if (f && over(f) && !found.has(f.name)) found.set(f.name, f);
    }
    for (const [name, f] of [...found].sort((a, b) => a[1].rank - b[1].rank || (a[0] < b[0] ? -1 : 1))) {
      for (const k of this.edgeKeys(x, y, (j) => this.groundFamily(j)?.name === name)) {
        out.push({ x, y, name, tint: f.tint, blend: true, h: h0, over: true, mask: `mask_${k}` });
      }
    }
  }

  private buildTerrain() {
    const { w, h } = this.info;
    const nch = Math.ceil(w / CHUNK);
    for (let s = 0; s <= 2 * (nch - 1); s++) {
      for (let cx = 0; cx < nch; cx++) {
        const cy = s - cx;
        if (cy < 0 || cy >= nch) continue;
        const land = new Container();
        const water = new Container();
        const cold = new Container();
        const cool = new Container();
        const objs = new Container();
        const list: WorldObject[] = [];
        const ground: GroundQuad[] = [], snowC: GroundQuad[] = [], snowW: GroundQuad[] = [], seabed: GroundQuad[] = [], sea: GroundQuad[] = [];
        for (let d = 0; d <= 2 * (CHUNK - 1); d++) {
          for (let lx = 0; lx < CHUNK; lx++) {
            const ly = d - lx;
            if (ly < 0 || ly >= CHUNK) continue;
            const x = cx * CHUNK + lx, y = cy * CHUNK + ly;
            if (x >= w || y >= h) continue;
            this.placeTile(x, y, seabed, sea, ground, snowC, snowW);
            this.placeObjects(x, y, objs, list);
          }
        }
        for (const [q, c] of [[seabed, water], [sea, water], [ground, land], [snowC, cold], [snowW, cool]] as [GroundQuad[], Container][]) {
          const m = this.groundMesh(q);
          if (m) c.addChild(m);
        }
        objs.sortableChildren = true;
        // bounds of the chunk in world space, so the culler skips chunks off screen
        const p0 = iso(cx * CHUNK, cy * CHUNK);
        const area = new Rectangle(p0.x - CHUNK * TW / 2 - TW, p0.y - 15 * ELEV - 40, CHUNK * TW + 2 * TW, CHUNK * TH + 15 * ELEV + 80);
        for (const [c, layer] of [[land, this.terrainLayer], [water, this.waterLayer], [cold, this.snowCold], [cool, this.snowCool], [objs, this.objLayer]] as [Container, Container][]) {
          layer.addChild(c);
        }
        const key = cy * nch + cx;
        this.objChunks.set(key, list);
        const fog = new Graphics();
        this.fogLayer.addChild(fog);
        this.fogChunks.set(key, fog);
        this.chunkViews.push({ area, parts: [land, water, cold, cool, objs, fog] });
      }
    }
    for (const list of this.objChunks.values()) for (const o of list) o.s.visible = false;
  }

  private groundOf(b: number, x: number, y: number, n: number): { name: string; tint: number } {
    const v = Math.floor(hash(x * 3 + 1, y * 5 + 2) * 4);
    let tint = 0xffffff;
    let name: string;
    switch (b) {
      case Biome.DeepWater: name = `deep${hash(x, y + 9) < 0.85 ? 0 : 1}`; break;
      case Biome.Water: {
        let coast = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.lv(x + dx, y + dy) > 0) coast = true;
        name = coast ? `shallow${v}` : `deep${hash(x, y + 9) < 0.7 ? 0 : 1}`;
        break;
      }
      case Biome.Lake: name = n < 0.35 ? `lily${v}` : `shallow${v % 2}`; break;
      case Biome.Beach: name = `sand${v}`; break;
      case Biome.Desert: name = this.mars ? 'sand0' : `sand${v % 2}`; tint = 0xf2d6a8; break; // no sea shells on Mars
      case Biome.Grassland: name = n < 0.22 ? `meadow${v}` : `grass${v}`; break;
      case Biome.Plains: name = `steppe${v}`; break;
      case Biome.Forest: name = `grass${v}`; tint = 0xd6e8c8; break;
      case Biome.Taiga: name = `grass${v}`; tint = 0xa9c4b0; break;
      case Biome.Hills: name = n < 0.5 ? `hill${v}` : `grass${v}`; break;
      case Biome.Mountain: name = n < 0.55 ? `rock${v}` : `crag${v}`; break;
      case Biome.Snow: name = `snow${v}`; break;
      case Biome.Tundra: name = `tundra${v}`; break;
      case Biome.Marsh: name = `marsh${v}`; break;
      default: name = `grass${v}`;
    }
    return { name, tint };
  }

  private placeTile(x: number, y: number, seabed: GroundQuad[], sea: GroundQuad[], ground: GroundQuad[], cold: GroundQuad[], cool: GroundQuad[]) {
    const { w } = this.info;
    const i = y * w + x;
    const b = this.biome[i];
    const p = iso(x, y);
    const n = hash(x, y);
    let { name, tint } = this.groundOf(b, x, y, n);
    // rivers are strips of shallow water on the land
    if (this.bigRiver(i)) { name = `shallow${hash(x, y + 3) < 0.7 ? 0 : 1}`; tint = 0xe8f4ff; }
    if (isWater(b)) {
      // a sandy floor that sinks away from the shore, and over it a level, see-through water surface
      const W1 = this.info.w + 1;
      const D = [y * W1 + x, y * W1 + x + 1, (y + 1) * W1 + x + 1, (y + 1) * W1 + x].map((k) => this.wd[k]);
      seabed.push({ x, y, name: 'sand1', tint: 0xffffff, flat: true, h: D.map((d) => -d), tints: D.map((d) => mixColor(0xe4d4ac, 0x3c5a66, Math.min(1, d / 2.4))) });
      const alpha = D.map((d) => Math.min(0.92, 0.45 + d * 0.2));
      sea.push({ x, y, name, tint: 0xffffff, flat: true, h: [0, 0, 0, 0], alpha });
      // deep water reaches into the shallows with a ragged edge, as the grounds do
      // and the unlike pictures of the same water reach into each other, so no diamonds show
      const W0 = this.info.w;
      const waterName = (j: number) => isWater(this.biome[j]) ? this.groundOf(this.biome[j], j % W0, Math.floor(j / W0), hash(j % W0, Math.floor(j / W0))).name : '';
      const rank = (n: string) => (n.startsWith('deep') ? 2 : 1);
      const names = new Set<string>();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= W0 || y + dy >= this.info.h) continue;
        const n = waterName((y + dy) * W0 + x + dx);
        if (n && n !== name && (rank(n) > rank(name) || (rank(n) === rank(name) && n > name))) names.add(n);
      }
      for (const n of [...names].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))) {
        for (const key of this.edgeKeys(x, y, (j) => waterName(j) === n)) {
          sea.push({ x, y, name: n, tint: 0xffffff, flat: true, over: true, h: [0, 0, 0, 0], alpha, mask: `mask_${key}` });
        }
      }
      this.shoreQuads(x, y, undefined, ground);
      return;
    }
    if (this.bigRiver(i)) {
      // the river bed follows the slope; the water lies level in it and steps down in small falls
      // the water at each corner lies as low as the lowest water touching it: level where the river is level,
      // a sloping rapid on the tile where it comes down
      const H = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([cx, cy]) => {
        let t = Infinity;
        for (let ty = cy - 1; ty <= cy; ty++) for (let tx = cx - 1; tx <= cx; tx++) {
          if (tx < 0 || ty < 0 || tx >= this.info.w || ty >= this.info.h) continue;
          const j = ty * this.info.w + tx;
          if (isWater(this.biome[j])) t = Math.min(t, 0);
          else if (this.bigRiver(j)) t = Math.min(t, this.riverTop(tx, ty));
        }
        // at the banks the water meets the ground exactly, so no strip of the bed shows under its edge
        return Math.min(t, this.cornerH(cx, cy) + 0.02);
      });
      const rapid = Math.max(...H) - Math.min(...H) > 0.3;
      ground.push({ x, y, name: 'sand0', tint: 0x6f7860 });
      ground.push({ x, y, name, tint: rapid ? 0xf2fbff : 0xd4e8f2, flat: true, h: H, alpha: H.map(() => (rapid ? 0.88 : 0.78)) });
      this.shoreQuads(x, y, H, ground);
      return;
    }
    // the ground: one sloped quad over the heights of its four corners
    ground.push({ x, y, name, tint, blend: true });
    this.blendQuads(x, y, ground);
    // a ragged strip of the shore's sand on the land along the water, so the shore does not end in the tile's straight edge
    const CH = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, c]) => this.cornerH(a, c));
    if (!this.mars && b !== Biome.Beach && b !== Biome.Desert && b !== Biome.Marsh && Math.max(...CH) - Math.min(...CH) < 1.2) {
      for (const k of this.edgeKeys(x, y, (j) => isWater(this.biome[j]) || this.bigRiver(j))) {
        ground.push({ x, y, name: 'sand0', tint: 0xeedcb8, blend: false, over: true, mask: `mask_${k}` });
      }
    }
    if (this.isStream(i)) {
      // a thin stream through the grass, joined to the streams, rivers and sea next to it
      // joined only along its own course: downstream, and to the streams that flow into it
      const down = this.downstream(i);
      ground.push({ x, y, name: `stream_${this.sides(x, y, (j) => j === down || (this.isStream(j) && this.downstream(j) === i)) || 4}`, tint: 0xffffff, over: true });
    }
    // winter snow, faded in by season
    const t = this.temp[i] / 255;
    const own = this.snowClass(i);
    if (own) (own === 2 ? cold : cool).push({ x, y, name: `snow${Math.floor(hash(x + 5, y) * 4)}`, tint: 0xffffff });
    // and it ends in a ragged edge, reaching into the warmer tiles next to it
    for (const k of [1, 2]) {
      if (k <= own) continue;
      for (const key of this.edgeKeys(x, y, (j) => this.snowClass(j) === k)) {
        (k === 2 ? cold : cool).push({ x, y, name: `snow${Math.floor(hash(x + 7, y + key.length) * 4)}`, tint: 0xffffff, over: true, mask: `mask_${key}` });
      }
    }
  }

  /** winter snow on a tile: 2 in the cold (every winter), 1 in the cool lands (only in deep winter), 0 none */
  private snowClass(j: number): number {
    const b = this.biome[j];
    if (b === Biome.Snow || isWater(b) || this.bigRiver(j)) return 0;
    const t = this.temp[j] / 255;
    return t < 0.33 ? 2 : t < 0.5 ? 1 : 0;
  }

  /** corner heights: the mean of the (up to) four tiles that meet there; next to water the ground comes down to it */
  private cornerHeights(): Float32Array {
    const { w, h } = this.info;
    const W = w + 1;
    const vh = new Float32Array(W * (h + 1));
    for (let vy = 0; vy <= h; vy++) {
      for (let vx = 0; vx <= w; vx++) {
        let sum = 0, n = 0, wet = false;
        for (let ty = vy - 1; ty <= vy; ty++) {
          for (let tx = vx - 1; tx <= vx; tx++) {
            if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
            const i = ty * w + tx;
            if (isWater(this.biome[i])) wet = true;
            sum += this.level[i];
            n++;
          }
        }
        vh[vy * W + vx] = wet || !n ? 0 : sum / n;
      }
    }
    // rivers cut a shallow channel: the corners around them come down a little
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      // (streams too: the big river's water then lies level where the streams run into it)
      if (!this.isRiver(ty * w + tx)) continue;
      for (const [vx, vy] of [[tx, ty], [tx + 1, ty], [tx + 1, ty + 1], [tx, ty + 1]]) {
        const k = vy * W + vx;
        if (!this.cutDone.has(k)) { this.cutDone.add(k); vh[k] = Math.max(0, vh[k] - 0.4); }
        // and never above the water lying on it
        vh[k] = Math.min(vh[k], Math.max(0, this.riverTop(tx, ty) - 0.25));
      }
    }
    this.cutDone.clear();
    // depth of the sea floor at every corner out in the water (0 at the shore)
    const depthOf = (i: number) => {
      const b = this.biome[i];
      if (b === Biome.DeepWater) return 2.6;
      if (b === Biome.Lake) return 1.1;
      return this.groundOf(b, i % w, Math.floor(i / w), 0).name.startsWith('deep') ? 2.2 : 0.9;
    };
    this.wd = new Float32Array(W * (h + 1));
    for (let vy = 0; vy <= h; vy++) {
      for (let vx = 0; vx <= w; vx++) {
        let sum = 0, n = 0, dry = false;
        for (let ty = vy - 1; ty <= vy; ty++) for (let tx = vx - 1; tx <= vx; tx++) {
          if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
          const i = ty * w + tx;
          if (!isWater(this.biome[i])) { dry = true; break; }
          sum += depthOf(i); n++;
        }
        this.wd[vy * W + vx] = dry || !n ? 0 : sum / n;
      }
    }
    return vh;
  }

  private cornerH(vx: number, vy: number): number {
    const { w, h } = this.info;
    vx = Math.max(0, Math.min(w, vx));
    vy = Math.max(0, Math.min(h, vy));
    return this.vh[vy * (w + 1) + vx];
  }

  /** a river lies level on its tile, a little under the tile's own height; it runs down in rapids where the land does */
  private riverTop(x: number, y: number): number {
    return Math.max(0.05, this.level[y * this.info.w + x] - 0.2);
  }

  /** height of the ground (in levels) at a point of the grid, between the corners */
  surfaceAt(gx: number, gy: number): number {
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const a = this.cornerH(x0, y0), b = this.cornerH(x0 + 1, y0), c = this.cornerH(x0, y0 + 1), d = this.cornerH(x0 + 1, y0 + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  private tintAt(x: number, y: number): number {
    const { w, h } = this.info;
    if (!this.tints) {
      this.tints = new Uint32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const tx = i % w, ty = (i - tx) / w;
        this.tints[i] = this.groundOf(this.biome[i], tx, ty, hash(tx, ty)).tint;
      }
    }
    return this.tints[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  }

  /** the tile colours around a corner, mixed, so a forest darkens the grass gradually */
  private cornerTint(vx: number, vy: number, own: number): number {
    let r = 0, g = 0, b = 0, n = 0;
    for (let ty = vy - 1; ty <= vy; ty++) {
      for (let tx = vx - 1; tx <= vx; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.info.w || ty >= this.info.h || !this.level[ty * this.info.w + tx]) continue;
        const c = this.tintAt(tx, ty);
        r += c >> 16; g += (c >> 8) & 255; b += c & 255; n++;
      }
    }
    return n ? (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n) : own;
  }

  /** winter snow thins out towards the corners where the tiles around are warmer, so its edge is soft */
  private snowCover(vx: number, vy: number, below: number): number {
    const { w, h } = this.info;
    let k = 0, n = 0;
    for (let ty = vy - 1; ty <= vy; ty++) {
      for (let tx = vx - 1; tx <= vx; tx++) {
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        const i = ty * w + tx;
        n++;
        if (this.biome[i] === Biome.Snow || (this.level[i] && this.temp[i] / 255 < below)) k++;
      }
    }
    return n ? k / n : 1;
  }

  /** light from the north-west: slopes facing it are brighter, the far sides darker */
  private cornerLight(vx: number, vy: number): number {
    const g = (this.cornerH(vx + 1, vy) - this.cornerH(vx - 1, vy) + this.cornerH(vx, vy + 1) - this.cornerH(vx, vy - 1)) / 2;
    return Math.max(0.68, Math.min(1.18, 1 + g * 0.075));
  }

  private shaderFor(src: ImageSource): Shader {
    let sh = this.meshShaders.get(src);
    if (!sh) {
      sh = Shader.from({ gl: { vertex: GROUND_VERT, fragment: GROUND_FRAG }, resources: { uTexture: src, uSampler: src.style } });
      this.meshShaders.set(src, sh);
    }
    return sh;
  }

  /** the sprites laid over the ground (streams, shores), one mesh per atlas page */
  private overlayMeshes(quads: GroundQuad[], into: Container) {
    const pages = new Map<number, GroundQuad[]>();
    for (const q of quads) (pages.get(q.page!) ?? pages.set(q.page!, []).get(q.page!)!).push(q);
    for (const [pg, list] of pages) {
      const m = this.groundMesh(list, this.atlas.sources[pg]);
      if (m) into.addChild(m);
    }
  }

  private groundMesh(quads: GroundQuad[], page?: ImageSource): Mesh<Geometry, Shader> | null {
    const G0 = this.atlas.ground;
    if (!G0 || !quads.length) return null;
    const src = page ?? G0.source;
    const G = { size: page ? page.width : G0.size, cells: G0.cells };
    const sizeV = page ? page.height : G0.size;
    const { w, h } = this.info;
    const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [], mk: number[] = [];
    let v = 0;
    let MK: number[][] | null = null;
    let mj = 0;
    const vert = (px: number, py: number, u: number, t: number, c: number, l: number, a = 1) => {
      pos.push(px, py);
      uv.push(u / G.size, t / sizeV);
      if (MK) mk.push(MK[mj][0] / G.size, MK[mj][1] / sizeV); else mk.push(-1, -1);
      col.push(((c >> 16) & 255) / 255 * l, ((c >> 8) & 255) / 255 * l, (c & 255) / 255 * l, a);
      v++;
    };
    const quad = (a: number, diag02: boolean) => {
      for (const o of diag02 ? [0, 1, 2, 0, 2, 3] : [0, 1, 3, 1, 2, 3]) idx.push(a + o);
    };
    for (const q of quads) {
      let UV = q.uv;
      if (!UV) {
        const cell = G.cells[q.name] ?? G.cells[q.name.replace(/\d+$/, '0')];
        if (!cell) continue;
        const [u0, v0, c] = cell;
        UV = [[u0, v0], [u0 + c, v0], [u0 + c, v0 + c], [u0, v0 + c]];
        if (q.rot) UV = [UV[3], UV[0], UV[1], UV[2]];
      }
      MK = null;
      const mc = q.mask ? G.cells[q.mask] : undefined;
      if (mc) {
        const [m0, n0, mcs] = mc;
        MK = [[m0, n0], [m0 + mcs, n0], [m0 + mcs, n0 + mcs], [m0, n0 + mcs]];
      }
      // top, right, bottom, left corner of the tile
      const C = [[q.x, q.y], [q.x + 1, q.y], [q.x + 1, q.y + 1], [q.x, q.y + 1]];
      const H = q.h ?? C.map(([cx, cy]) => this.cornerH(cx, cy));
      const a = v;
      for (let j = 0; j < 4; j++) {
        const p = iso(C[j][0], C[j][1]);
        const tint = q.tints ? q.tints[j] : q.blend ? this.cornerTint(C[j][0], C[j][1], q.tint) : q.tint;
        const al = q.alpha ? q.alpha[j] : q.snow ? Math.min(1, this.snowCover(C[j][0], C[j][1], q.snow) * 1.25) : 1;
        mj = j;
        vert(p.x, p.y - H[j] * ELEV, UV[j][0], UV[j][1], tint, q.flat ? 1 : this.cornerLight(C[j][0], C[j][1]), al);
      }
      // fold the quad along the flatter diagonal
      quad(a, Math.abs(H[0] - H[2]) <= Math.abs(H[1] - H[3]));
      // a face down from the front edge: the map's edge, or a little waterfall where a river steps down
      const skirt = (j0: number, j1: number, to: number[], l0: number, l1: number, al = 1) => {
        const b = v;
        for (const j of [j0, j1]) {
          const p = iso(C[j][0], C[j][1]);
          vert(p.x, p.y - H[j] * ELEV, UV[j][0], UV[j][1], q.tint, l0, al);
        }
        for (const j of [j1, j0]) {
          const p = iso(C[j][0], C[j][1]);
          vert(p.x, p.y - to[j] * ELEV, UV[j][0], UV[j][1], q.tint, l1, al);
        }
        quad(b, true);
      };
      const ground = [-1, -1, -1, -1];
      MK = null;
      const edgeFace = !q.uv && !q.over && (!q.h || q.alpha); // a sea floor needs none, the water over it has it
      if (edgeFace && q.x === w - 1) skirt(1, 2, ground, 0.5, 0.4, q.alpha ? 0.9 : 1);
      if (edgeFace && q.y === h - 1) skirt(2, 3, ground, 0.5, 0.4, q.alpha ? 0.9 : 1);
    }
    const geometry = new Geometry({
      attributes: { aPosition: new Float32Array(pos), aUV: new Float32Array(uv), aColor: new Float32Array(col), aMask: new Float32Array(mk) },
      indexBuffer: new Uint32Array(idx),
    });
    return new Mesh({ geometry, shader: this.shaderFor(src) });
  }

  private placeObjects(x: number, y: number, objs: Container, list: WorldObject[]) {
    const { w } = this.info;
    const i = y * w + x;
    const b = this.biome[i];
    const n = hash(x + 11, y + 7);
    const n2 = hash(x + 31, y + 17);
    if (b === Biome.Lake && !this.mars && n < 0.12 && this.atlas.has('w_lily0')) {
      // water lilies on still lakes
      const p = iso(x, y);
      const ln = n < 0.06 ? 'w_lily0' : 'w_lily1';
      const s = this.atlas.sprite(ln);
      const sc = this.atlas.scale('w_lily0') * (0.8 + n2 * 0.3);
      s.scale.set(n2 < 0.5 ? -sc : sc, sc);
      s.position.set(p.x + (n2 - 0.5) * 12, p.y + TH / 2 + 2);
      s.zIndex = s.y;
      objs.addChild(s);
      list.push({ s, i, kind: 'other', base: ln, n, size: 1, flip: 1 });
    }
    if (isWater(b) || this.isRiver(i)) return;
    const t = this.temp[i] / 255;
    // groves and clearings: smooth noise decides how dense the trees are here (0..1)
    const dense = 0.5 + 0.55 * this.clumps.noise(x * 0.11, y * 0.11);
    const add = (name: string, kind: ObjKind, ox: number, oy: number, size = 1) => {
      const p = iso(x, y);
      const s = this.atlas.sprite(name);
      const mul = size * (0.85 + hash(x + ox * 7, y + oy * 3) * 0.3);
      const flip = hash(x * 7 + ox, y) < 0.5 ? -1 : 1;
      const sc = this.atlas.scale(name) * mul;
      s.scale.set(flip * sc, sc);
      s.position.set(p.x + ox, p.y - this.surfaceAt(x + 0.5 + (ox / TW + oy / TH), y + 0.5 + (oy / TH - ox / TW)) * ELEV + TH / 2 + oy);
      s.zIndex = s.y;
      objs.addChild(s);
      list.push({ s, i, kind, base: name, n: hash(x + 3, y + 77), size: mul, flip });
    };
    if (this.mars) {
      // red rocks, wind-carved pillars, small craters and boulders; a stone cairn now and then
      const rocky = b === Biome.Mountain || b === Biome.Hills;
      if (n < (rocky ? 0.07 : 0.025) && this.atlas.has('mrocks')) add(pick(['mrocks', 'mboulders', 'mpillar', 'mrocks'], n / (rocky ? 0.07 : 0.025)), 'other', (n2 - 0.5) * 8, 0);
      else if (n > 0.985 && b === Biome.Desert && this.atlas.has('mcrater')) add('mcrater', 'other', 0, 0);
      else if (n > 0.9975 && this.atlas.has('mcairn')) add('mcairn', 'other', 0, 0);
      return;
    }
    // stones, reeds and ferns right on the waterline, so the bank does not run as one straight edge
    const wet = this.sides(x, y, (j) => isWater(this.biome[j]) || this.bigRiver(j));
    const CH = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, c]) => this.cornerH(a, c));
    if (wet && this.atlas.has('w_stones') && Math.max(...CH) - Math.min(...CH) < 1.2) {
      const cold = this.temp[i] / 255 < 0.4;
      const set = cold ? ['w_stones', 'w_boulder', 'w_sedge', 'w_stones'] : ['w_stones', 'w_reeds', 'w_sedge', 'w_fern0', 'w_horsetail', 'w_stones', 'w_boulder', 'w_fern2'];
      // the middle of each edge (in screen px from the tile's middle) and the way along it
      const EDGE: Record<number, [number, number, number, number]> = { 1: [-8, -4, -8, 4], 2: [8, -4, 8, 4], 4: [8, 4, -8, 4], 8: [-8, 4, 8, 4] };
      for (const bit of [1, 2, 4, 8]) {
        if (!(wet & bit)) continue;
        for (let k = 0; k < 2; k++) {
          const hh = hash(x * 13 + bit * 7 + k, y * 5 + k * 31);
          if (hh > 0.55) continue;
          const [mx, my, ax, ay] = EDGE[bit];
          const t = (hash(x + k * 17, y * 3 + bit) - 0.5) * 0.8;
          add(pick(set, hh / 0.55), 'other', mx * 0.8 + ax * t, my * 0.8 + ay * t, 0.75);
        }
      }
    }
    // trees: where they can grow comes from the server, their size from every tick
    const tk = this.treeKind[i];
    if (tk) {
      const forest = b === Biome.Forest || b === Biome.Taiga;
      const ox = forest ? (n2 - 0.5) * 10 : 0, oy = forest ? (hash(x, y + 41) - 0.5) * 4 : 0;
      const name = `g_${TREE_KINDS[tk]}3`;
      if (this.atlas.has(name)) {
        add(name, 'tree', ox, oy);
        const o = list[list.length - 1];
        o.tk = tk;
        o.s.visible = false;
        this.treeObjs.set(i, o);
        // the stump left when the tree is cut (old and grey, or fresh with chips)
        const kind = TREE_KINDS[tk];
        const sk = kind === 'birch' ? 'birch' : kind === 'oakOld' ? 'old' : CONIFERS.has(tk) ? 'pine' : 'oak';
        const sn = `stump_${sk}${hash(x + 2, y + 13) < 0.5 ? 0 : 1}`;
        if (this.atlas.has(sn)) {
          add(sn, 'other', ox, oy);
          const st = list[list.length - 1];
          st.isStump = true;
          st.s.visible = false;
          o.stump = st;
        }
      }
      return;
    }
    void dense;
    // ferns, reeds, stones and the like along the water
    if (!this.mars && this.sides(x, y, (j) => this.isRiver(j) || isWater(this.biome[j])) && hash(x + 5, y + 61) < 0.3 && this.atlas.has('w_fern0')) {
      const t = this.temp[i] / 255;
      const set = t < 0.4 ? ['w_sedge', 'w_horsetail', 'w_stones', 'w_boulder', 'w_sedge']
        : b === Biome.Marsh ? ['w_cattail', 'w_reeds', 'w_iris', 'w_marigold', 'w_sedge', 'w_horsetail']
        : ['w_fern0', 'w_fern1', 'w_fern2', 'w_fern3', 'w_reeds', 'w_cattail', 'w_iris', 'w_sedge', 'w_marigold', 'w_stones', 'w_boulder', 'w_willow', 'w_log', 'w_horsetail', 'w_fern1', 'w_reeds'];
      add(pick(set, hash(x + 9, y + 23)), 'other', (n2 - 0.5) * 10, (hash(x, y + 5) - 0.5) * 3);
      return;
    }
    switch (b) {
      case Biome.Forest:
        if (n > 0.93) add(pick(['fern', 'mushroom', 'log', 'stump', 'berries', 'bush0'], (n - 0.93) / 0.07), 'other', (n2 - 0.5) * 8, 2);
        break;
      case Biome.Taiga:
        if (n > 0.95) add(pick(['fern', 'boulder0', 'stump', 'log'], (n - 0.95) / 0.05), 'other', (n2 - 0.5) * 8, 2);
        break;
      case Biome.Grassland:
        if (n >= 0.03 && n < 0.07) add(pick(['bush0', 'bush1', 'berries', 'flowerbush', 'flowers', 'tuft'], (n - 0.03) / 0.04), 'other', (n2 - 0.5) * 10, 0);
        break;
      case Biome.Plains:
        if (n >= 0.015 && n < 0.05) add(pick(['tuft', 'stones', 'bush1', 'flowers'], (n - 0.015) / 0.035), 'other', (n2 - 0.5) * 10, 0);
        break;
      case Biome.Hills:
        if (n >= 0.04 && n < 0.08) add(pick(['boulder0', 'boulder1', 'tuft', 'stones'], (n - 0.04) / 0.04), 'other', (n2 - 0.5) * 10, 0);
        break;
      case Biome.Mountain:
        if (n < 0.06) add(pick(['boulder0', 'boulder1', 'boulder2', 'boulder3'], n / 0.06), 'other', (n2 - 0.5) * 8, 0);
        break;
      case Biome.Marsh:
        if (n < 0.2) add('reeds', 'other', (n2 - 0.5) * 12, 0);
        break;
      case Biome.Tundra:
        if (n < 0.07) add(pick(['stones', 'boulder3', 'tuft'], n / 0.07), 'other', (n2 - 0.5) * 8, 0);
        break;
      case Biome.Beach:
        if (n < 0.03) add('stones', 'other', 0, 0, 0.8);
        break;
      default:
    }
  }

  /** the sprite of a tree for its size and the season: bare or snowy in winter, red or yellow in autumn, blossom in spring */
  private treeName(o: WorldObject): string {
    const stage = Math.max(1, this.treeStage[o.i]);
    const kind = TREE_KINDS[o.tk!];
    const key = this.seasonKey;
    const t = this.temp[o.i] / 255;
    let k: string = kind;
    if (CONIFERS.has(o.tk!)) {
      if (key === 'winter' && t < 0.5 && kind.startsWith('spruce')) k = 'spruceS';
    } else if (key === 'winter' && t < 0.7) {
      k = t < 0.5 ? 'bareS' : 'bare';
    } else if (key === 'autumn') {
      if (kind === 'birch') k = o.n < 0.7 ? 'birchY' : kind;
      else if (kind === 'fruit') k = 'apple';
      else if (o.n < 0.35) k = 'autumn';
    } else if (key === 'spring' && (kind === 'oak' || kind === 'oakL' || kind === 'fruit') && o.n < 0.35) {
      k = 'blossom';
    }
    return `g_${k}${stage - 1}`;
  }

  private drawTree(o: WorldObject) {
    this.atlas.set(o.s, this.treeName(o), o.size);
    o.s.scale.x *= o.flip;
    o.s.visible = !!this.explored[o.i] && this.treeStage[o.i] > 0;
    if (o.stump) o.stump.s.visible = this.stumpVisible(o.i);
  }

  private stumpVisible(i: number): boolean {
    return !!this.explored[i] && this.treeStage[i] === 0 && !this.cleared.has(i);
  }

  /** all the roads at once (snapshot) */
  setRoads(b64: string) {
    if (!this.info) return;
    const r = b64decode(b64);
    if (r.length !== this.roads.length) return;
    const ch: number[] = [];
    for (let i = 0; i < r.length; i++) if (r[i] !== this.roads[i]) ch.push(i, r[i]);
    this.updateRoads(ch);
  }

  /** roads built since the last tick: [tile, level, ...]; the tile and its neighbours are redrawn */
  updateRoads(ch: number[]) {
    if (!this.info || !ch.length) return;
    const { w, h } = this.info;
    const redo = new Set<number>();
    for (let k = 0; k + 1 < ch.length; k += 2) {
      const i = ch[k];
      this.roads[i] = ch[k + 1];
      redo.add(i);
      const x = i % w, y = (i - x) / w;
      if (x > 0) redo.add(i - 1);
      if (x < w - 1) redo.add(i + 1);
      if (y > 0) redo.add(i - w);
      if (y < h - 1) redo.add(i + w);
    }
    const chunks = new Set<number>();
    const nch = Math.ceil(w / CHUNK);
    for (const i of redo) {
      this.drawRoad(i);
      this.drawRail(i);
      const x = i % w, y = (i - x) / w;
      chunks.add(Math.floor(y / CHUNK) * nch + Math.floor(x / CHUNK));
    }
    for (const c of chunks) this.drawRoadChunk(c);
    // bushes and stones do not stand on a road
    for (const list of this.objChunks.values()) for (const o of list) if (o.kind === 'other' && !o.isStump && this.roads[o.i]) o.s.visible = false;
    // keep the road sprites in drawing order (back to front)
    this.roadLayer.children.sort((a, b) => a.y - b.y);
    this.railLayer.children.sort((a, b) => a.y - b.y);
    this.roadVersion++;
  }

  /** is there a road (dirt or paved) on this tile */
  isRoad(x: number, y: number): boolean {
    const { w, h } = this.info;
    return x >= 0 && y >= 0 && x < w && y < h && (this.roads[y * w + x] & 3) > 0;
  }

  /** is there a railway on this tile */
  isRail(x: number, y: number): boolean {
    const { w, h } = this.info;
    return x >= 0 && y >= 0 && x < w && y < h && (this.roads[y * w + x] & 4) > 0;
  }

  private drawRail(i: number) {
    const { w } = this.info;
    const old = this.railSprites.get(i);
    if (!(this.roads[i] & 4)) { if (old) { old.destroy(); this.railSprites.delete(i); } return; }
    const x = i % w, y = (i - x) / w;
    const mask = (this.isRail(x - 1, y) ? 1 : 0) | (this.isRail(x, y - 1) ? 2 : 0) | (this.isRail(x + 1, y) ? 4 : 0) | (this.isRail(x, y + 1) ? 8 : 0);
    const tex = this.tex[`rail${mask}`];
    if (!tex) return;
    const s = old ?? new Sprite(tex);
    s.texture = tex;
    s.anchor.set(0.5);
    const p = this.tileTop(x, y);
    s.position.set(p.x, p.y);
    if (!old) { this.railLayer.addChild(s); this.railSprites.set(i, s); }
  }

  private roadMask(x: number, y: number): number {
    const { w } = this.info;
    const has = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < this.info.h && (this.roads[yy * w + xx] & 3) > 0;
    // 1 upper-left (-x), 2 upper-right (-y), 4 lower-right (+x), 8 lower-left (+y)
    return (has(x - 1, y) ? 1 : 0) | (has(x, y - 1) ? 2 : 0) | (has(x + 1, y) ? 4 : 0) | (has(x, y + 1) ? 8 : 0);
  }

  /** bridges stand as sprites; the roads on land follow the slopes (drawRoadChunk) */
  private drawRoad(i: number) {
    const { w } = this.info;
    const lvl = this.roads[i] & 3;
    const old = this.roadSprites.get(i);
    if (!lvl || !this.isRiver(i)) { if (old) { old.destroy(); this.roadSprites.delete(i); } return; }
    const x = i % w, y = (i - x) / w;
    const mask = this.roadMask(x, y);
    const name = `bridge${lvl}`;
    const flip = (mask & 10) === 0; // the drawn bridge goes along y; along x it is mirrored
    if (!this.atlas.has(name)) return;
    const s = old ?? this.atlas.sprite(name);
    if (old) this.atlas.set(s, name);
    if (flip) s.scale.x = -Math.abs(s.scale.x);
    const p = this.tileTop(x, y);
    s.position.set(p.x, p.y);
    if (!old) { this.roadLayer.addChild(s); this.roadSprites.set(i, s); }
  }

  private drawRoadChunk(c: number) {
    const { w, h } = this.info;
    const nch = Math.ceil(w / CHUNK);
    const cx = (c % nch) * CHUNK, cy = Math.floor(c / nch) * CHUNK;
    this.roadChunks.get(c)?.destroy({ children: true });
    this.roadChunks.delete(c);
    const quads: GroundQuad[] = [];
    for (let y = cy; y < Math.min(h, cy + CHUNK); y++) {
      for (let x = cx; x < Math.min(w, cx + CHUNK); x++) {
        const i = y * w + x;
        const lvl = this.roads[i] & 3;
        if (!lvl || this.isRiver(i)) continue;
        const m = this.roadMask(x, y);
        quads.push({ x, y, name: `road_tex${lvl}`, tint: 0xffffff, over: true, mask: `rmask_${m}`, rot: (m & 5) === 0 && m !== 0 });
      }
    }
    if (!quads.length) return;
    const box = new Container();
    const mesh = this.groundMesh(quads);
    if (mesh) box.addChild(mesh);
    this.roadLayer.addChildAt(box, 0);
    this.roadChunks.set(c, box);
  }

  /** all the trees at once (snapshot), base64 bytes 0..4 */
  setTrees(b64: string) {
    if (!this.info) return;
    this.treeStage = b64decode(b64);
    for (const o of this.treeObjs.values()) this.drawTree(o);
  }

  /** trees that grew or were cut this month: [tile, stage, ...] */
  updateTrees(ch: number[]) {
    for (let k = 0; k + 1 < ch.length; k += 2) {
      const i = ch[k];
      this.treeStage[i] = ch[k + 1];
      const o = this.treeObjs.get(i);
      if (o) this.drawTree(o);
    }
  }

  private applySeason() {
    const m = this.month;
    const key = m === 11 || m <= 1 ? 'winter' : m >= 9 ? 'autumn' : m === 3 || m === 4 ? 'spring' : 'summer';
    if (key === this.seasonKey || !this.info) return;
    this.seasonKey = key;
    for (const o of this.treeObjs.values()) this.drawTree(o);
  }

  private setupWaterFilter() {
    try {
      const f = new Filter({
        glProgram: GlProgram.from({ vertex: WATER_VERT, fragment: WATER_FRAG, name: 'letopis-water' }),
        resources: {
          waterUniforms: {
            uTime: { value: 0, type: 'f32' },
            uCam: { value: new Float32Array([0, 0, 1, 0]), type: 'vec4<f32>' },
          },
        },
      });
      this.waterLayer.filters = [f];
      this.waterFilter = f;
    } catch (e) {
      console.warn('water shader off', e);
    }
  }

  setExplored(bits: Uint8Array) {
    const { w, h } = this.info;
    const n = w * h;
    const next = new Uint8Array(n);
    for (let i = 0; i < n; i++) next[i] = (bits[i >> 3] >> (i & 7)) & 1;
    const nch = Math.ceil(w / CHUNK);
    const dirty = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (next[i] !== this.explored[i] || !this.fogReady) {
        const x = i % w, y = Math.floor(i / w);
        dirty.add(Math.floor(y / CHUNK) * nch + Math.floor(x / CHUNK));
      }
    }
    this.explored = next;
    this.fogReady = true;
    for (const c of dirty) {
      this.drawFog(c);
      this.refreshObjects(c);
    }
  }

  private refreshObjects(chunk: number) {
    for (const o of this.objChunks.get(chunk) ?? []) {
      o.s.visible = o.isStump ? this.stumpVisible(o.i) : !!this.explored[o.i] && (o.tk ? this.treeStage[o.i] > 0 : !this.cleared.has(o.i));
    }
  }

  /** bands clear the trees around their camp */
  private updateCleared() {
    const { w, h } = this.info;
    const next = new Set<number>();
    for (const c of this.camps.values()) {
      const R = c.townR ? c.townR + 1 : c.settled ? 4 : 2;
      const bx = Math.round(c.tx), by = Math.round(c.ty);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R + 1) continue;
          const x = bx + dx, y = by + dy;
          if (x >= 0 && y >= 0 && x < w && y < h) next.add(y * w + x);
        }
      }
    }
    const nch = Math.ceil(w / CHUNK);
    const dirty = new Set<number>();
    for (const i of next) if (!this.cleared.has(i)) dirty.add(Math.floor(Math.floor(i / w) / CHUNK) * nch + Math.floor((i % w) / CHUNK));
    for (const i of this.cleared) if (!next.has(i)) dirty.add(Math.floor(Math.floor(i / w) / CHUNK) * nch + Math.floor((i % w) / CHUNK));
    this.cleared = next;
    for (const c of dirty) this.refreshObjects(c);
  }

  private drawFog(chunk: number) {
    const { w, h } = this.info;
    const nch = Math.ceil(w / CHUNK);
    const cx = chunk % nch, cy = Math.floor(chunk / nch);
    const g = this.fogChunks.get(chunk)!;
    g.clear();
    for (let d = 0; d <= 2 * (CHUNK - 1); d++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const ly = d - lx;
        if (ly < 0 || ly >= CHUNK) continue;
        const x = cx * CHUNK + lx, y = cy * CHUNK + ly;
        if (x >= w || y >= h) continue;
        const i = y * w + x;
        if (this.explored[i]) continue;
        // cover the sloped tile, a little wider so no seam shows between hidden neighbours
        const p = iso(x, y);
        const t = p.y - this.cornerH(x, y) * ELEV, r = p.y + TH / 2 - this.cornerH(x + 1, y) * ELEV;
        const bt = p.y + TH - this.cornerH(x + 1, y + 1) * ELEV, l = p.y + TH / 2 - this.cornerH(x, y + 1) * ELEV;
        g.poly([p.x, t - 3, p.x + TW / 2 + 3, r, p.x + TW / 2 + 3, r + 3, p.x, bt + 3, p.x - TW / 2 - 3, l + 3, p.x - TW / 2 - 3, l])
          .fill(0x0d1424);
      }
    }
  }

  tileTop(x: number, y: number): { x: number; y: number } {
    const xi = Math.max(0, Math.min(this.info.w - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(this.info.h - 1, Math.round(y)));
    const p = iso(x, y);
    return { x: p.x, y: p.y - this.surfaceAt(Math.max(0, Math.min(this.info.w - 1, x)) + 0.5, Math.max(0, Math.min(this.info.h - 1, y)) + 0.5) * ELEV + TH / 2 };
  }

  tempAt(x: number, y: number): number {
    const xi = Math.max(0, Math.min(this.info.w - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(this.info.h - 1, Math.round(y)));
    return this.temp[yi * this.info.w + xi] / 255;
  }

  private secretFound = new Set<number>();
  /** the year of the May the secrets were last moved in, and whether the villages were known then */
  secretRound: number | null = null;
  private secretWithCamps = false;
  private secretShown: number | null = null;

  setSecrets(found: number[]) {
    this.secretFound = new Set(found);
    if (this.secretRound !== null) this.placeSecrets(this.secretRound);
  }

  /** every May the secrets move to clean ground: no water, snow, houses, walls or fields */
  placeSecrets(round: number) {
    this.secretRound = round;
    this.secretWithCamps = this.camps.size > 0;
    const camps = [...this.camps.values()];
    const taken = (x: number, y: number) => camps.some((c) => Math.hypot(c.tx - x, c.ty - y) <= (c.townR || 2) + 4);
    const { seed, w, h } = this.info;
    // last year's places: the ones on the map, or worked out again after a reload
    const before = this.secrets.length && this.secretShown !== round ? this.secrets.map((x) => x.spot) : secretSpots(seed, w, h, this.biome, this.river, round - 1, taken);
    for (const x of this.secrets) { x.s.destroy(); for (const q of x.rim) q.destroy(); }
    this.secretShown = round;
    this.secrets = secretSpots(seed, w, h, this.biome, this.river, round, taken, before).map((spot) => {
      const s = this.atlas.sprite(this.secretSprite(spot));
      const p = this.tileTop(spot.x, spot.y);
      s.position.set(p.x, p.y);
      s.zIndex = p.y;
      s.eventMode = 'none';
      s.visible = false;
      // a found one gets a thin soft green rim: four green copies a hair to each side, behind it
      const rim = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => {
        const q = this.atlas.sprite(this.secretSprite(spot));
        q.position.set(p.x + dx * 0.45, p.y + dy * 0.45);
        q.zIndex = p.y - 0.01;
        q.eventMode = 'none';
        q.tint = 0x8fdc8a;
        q.visible = false;
        this.peopleLayer.addChild(q);
        return q;
      });
      this.peopleLayer.addChild(s);
      return { spot, s, i: Math.round(spot.y) * this.info.w + Math.round(spot.x), found: this.secretFound.has(spot.k), rim };
    });
  }

  /** the picture of secret k: its fairy tale hero, or the old kinds while the heroes are not drawn */
  secretSprite(spot: SecretSpot, frame = 0): string {
    return this.atlas.has(`hero${spot.k}`) ? `hero${spot.k}` : `sec_${SECRET_KINDS[spot.kind].id}${frame}`;
  }

  /** called with the time of every month */
  secretTime(year: number, month: number) {
    if (!this.info || !this.biome) return;
    const round = Math.floor(year) - (month < 4 ? 1 : 0);
    if (round !== this.secretRound || (!this.secretWithCamps && this.camps.size > 0)) this.placeSecrets(round);
  }

  markSecret(k: number) {
    this.secretFound.add(k);
    const x = this.secrets.find((q) => q.spot.k === k);
    if (x) x.found = true;
  }

  /** a secret under the click (world coordinates), if one shows there */
  pickSecret(wx: number, wy: number): SecretSpot | null {
    for (const x of this.secrets) {
      if (!x.s.visible || x.s.alpha < 0.25) continue;
      if (Math.hypot(x.s.x - wx, x.s.y - 2.75 - wy) < 5) return x.spot;
    }
    return null;
  }

  private secretFrame(nowMs: number, zoom: number, winter: number) {
    for (const x of this.secrets) {
      const on = zoom > 0.75 && this.explored[x.i] === 1;
      x.s.visible = on;
      for (const q of x.rim) q.visible = on && x.found;
      if (!on) continue;
      // snow covers them on cold ground, the same way it covers the tiles
      const t = this.temp[x.i] / 255;
      const snow = t < 0.33 ? Math.min(1, winter * 1.2) : t < 0.5 && winter >= 1 ? 0.7 : 0;
      x.s.alpha = (x.found ? 0.95 : 0.6) * (1 - snow * 0.97);
      const f = Math.floor(nowMs / 1600 + x.spot.k * 0.37) % 2;
      const name = this.secretSprite(x.spot, f);
      this.atlas.set(x.s, name);
      if (x.found) for (const q of x.rim) { this.atlas.set(q, name); q.alpha = x.s.alpha * 0.5; }
    }
  }

  /** sea or lake, not a river */
  isSea(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.info.w || y >= this.info.h) return false;
    return isWater(this.biome[y * this.info.w + x]);
  }

  /** dry land people can walk on (water and wide rivers block them) */
  walkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.info.w || y >= this.info.h) return false;
    const i = y * this.info.w + x;
    return !isWater(this.biome[i]) && this.river[i] < RIVER_WATER;
  }

  /** a walk around the water from one tile to another, as tile points; null if there is none nearby */
  landPath(ax: number, ay: number, bx: number, by: number): { x: number; y: number }[] | null {
    const sx = Math.round(ax), sy = Math.round(ay), tx = Math.round(bx), ty = Math.round(by);
    if (!this.walkable(sx, sy) || !this.walkable(tx, ty)) return null;
    const pad = 14;
    const x0 = Math.min(sx, tx) - pad, y0 = Math.min(sy, ty) - pad;
    const bw = Math.abs(sx - tx) + pad * 2 + 1, bh = Math.abs(sy - ty) + pad * 2 + 1;
    const prev = new Int32Array(bw * bh).fill(-2);
    const key = (x: number, y: number) => (y - y0) * bw + (x - x0);
    const start = key(sx, sy), goal = key(tx, ty);
    prev[start] = -1;
    const queue = [start];
    for (let q = 0; q < queue.length && prev[goal] === -2; q++) {
      const k = queue[q];
      const x = (k % bw) + x0, y = Math.floor(k / bw) + y0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < x0 || ny < y0 || nx >= x0 + bw || ny >= y0 + bh) continue;
        const nk = key(nx, ny);
        if (prev[nk] !== -2 || !this.walkable(nx, ny)) continue;
        prev[nk] = k;
        queue.push(nk);
      }
    }
    if (prev[goal] === -2) return null;
    const tiles: { x: number; y: number }[] = [];
    for (let k = goal; k !== -1; k = prev[k]) tiles.push({ x: (k % bw) + x0, y: Math.floor(k / bw) + y0 });
    tiles.reverse();
    // straighten: keep only the corners needed to stay on land
    const out = [{ x: ax, y: ay }];
    let from = out[0];
    for (let i = 1; i < tiles.length; i++) {
      if (!this.dryLine(from.x, from.y, tiles[i].x, tiles[i].y)) {
        from = tiles[i - 1];
        out.push(from);
      }
    }
    out.push({ x: bx, y: by });
    return out;
  }

  /** does a straight walk stay on dry land? */
  dryLine(ax: number, ay: number, bx: number, by: number): boolean {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4) + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!this.walkable(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t))) return false;
    }
    return true;
  }

  /** height level of a tile (0 outside the map) */
  levelAt(x: number, y: number): number {
    return this.lv(Math.round(x), Math.round(y));
  }

  landAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.info.w || y >= this.info.h) return false;
    return !isWater(this.biome[y * this.info.w + x]);
  }

  // ---------- living things ----------

  updateBands(bands: BandView[], kids: boolean) {
    const seen = new Set<number>();
    this.bandTech.clear();
    this.capitals.clear();
    for (const b of bands) {
      seen.add(b.id);
      if (b.kingdom?.capital) this.capitals.add(b.id);
      this.bandTech.set(b.id, new Set(b.techIds));
      let c = this.camps.get(b.id);
      if (!c) {
        c = new CampSprite(this, b);
        this.camps.set(b.id, c);
      }
      c.update(b, kids);
    }
    for (const [id, c] of this.camps) if (!seen.has(id)) { c.destroy(); this.camps.delete(id); }
    if (this.info) this.updateCleared();
    if (!this.mars) this.fauna.updateBands(bands);
    this.fleet.updateBands(bands);
    this.canoes.updateBands(bands);
    this.trains.updateBands(bands);
  }

  /** red outline around the chosen person (null clears it) */
  select(id: number | null) {
    if (this.selectedId !== null) this.people.get(this.selectedId)?.setSelected(false);
    this.selectedId = id;
    // someone who was at home (not drawn) steps out
    if (id !== null && !this.people.has(id) && this.lastPeople) {
      const { rows, bandColors, tickMs } = this.lastPeople;
      this.updatePeople(rows, bandColors, tickMs);
    }
    if (id !== null) this.people.get(id)?.setSelected(true);
  }

  /** dark hours of the 8 minute day (same clock as the night shade) */
  isNight(nowMs = Date.now()): boolean {
    const day = (nowMs / (8 * 60 * 1000)) % 1;
    return Math.cos(day * Math.PI * 2) < -0.25;
  }

  /** at night everyone sleeps within two tiles of the camp (a scout stays where he is) */
  private nightRow(r: PersonRow): PersonRow {
    const c = this.camps.get(r[4]);
    if (!c || TASKS[r[3]] === 'scout') return r;
    // everyone has the same sleeping spot all night: nobody gets up to walk to where the day's work would be
    // spread around the fire, the same spot every night for the same person
    const a = hash(r[0], 5) * Math.PI * 2, rr = 0.6 + hash(r[0], 9) * 1.3;
    let nx = c.tx + Math.cos(a) * rr, ny = c.ty + Math.sin(a) * rr;
    const L0 = this.levelAt(c.tx, c.ty);
    if (!this.walkable(Math.round(nx), Math.round(ny)) || Math.abs(this.levelAt(nx, ny) - L0) > 1) { nx = c.tx + (hash(r[0], 2) - 0.5) * 0.6; ny = c.ty + (hash(r[0], 4) - 0.5) * 0.6; }
    const out = [...r] as PersonRow;
    out[1] = Math.round(nx * 10);
    out[2] = Math.round(ny * 10);
    return out;
  }

  /** a farmer works on one of the clan's fields (the same one for a while), not just anywhere round the camp */
  private fieldRow(r: PersonRow): PersonRow {
    const f = this.camps.get(r[4])?.fieldTiles;
    if (!f?.length) return r;
    const [x, y] = f[Math.floor(hash(r[0], 41 + (this.month >> 2)) * f.length)];
    const out = [...r] as PersonRow;
    out[1] = Math.round((x + (hash(r[0], 43) - 0.5) * 0.7) * 10);
    out[2] = Math.round((y + (hash(r[0], 47) - 0.5) * 0.7) * 10);
    return out;
  }

  updatePeople(rows: PersonRow[], bandColors: Map<number, number>, tickMs: number) {
    this.lastPeople = { rows, bandColors, tickMs };
    const seen = new Set<number>();
    const night = this.isNight();
    // a big village shows at most PER_BAND people on the map (the chief, the chosen one and a steady sample):
    // the rest are at home. Thousands of sprites less, and no crowd piled on the camp
    const byBand = new Map<number, PersonRow[]>();
    for (const r of rows) {
      let l = byBand.get(r[4]);
      if (!l) byBand.set(r[4], (l = []));
      l.push(r);
    }
    const roles = this.roles(rows, byBand);
    const shown: PersonRow[] = [];
    for (const l of byBand.values()) {
      if (l.length <= PER_BAND) { shown.push(...l); continue; }
      const rank = (r: PersonRow) => (r[7] === 1 || r[8] || r[0] === this.selectedId || roles.has(r[0]) ? -1 : hash(r[0], 99));
      l.sort((a, b) => rank(a) - rank(b));
      shown.push(...l.slice(0, PER_BAND));
    }
    // at night people sleep indoors: in a tent camp most of them, in a village of huts or houses everyone but the guards
    const sleepers = night ? shown.filter((r) => {
      if (r[0] === this.selectedId || roles.get(r[0]) === 'guard' || roles.get(r[0]) === 'bodyguard' || TASKS[r[3]] === 'scout') return true;
      const home = this.camps.get(r[4])?.dwelling;
      if (home === 'tent') return hash(r[0], 31) < 0.3;
      return home !== 'hut' && home !== 'house';
    }) : shown;
    for (const r0 of sleepers) {
      let r = night ? this.nightRow(r0) : TASKS[r0[3]] === 'farm' ? this.fieldRow(r0) : r0;
      // the bodyguard keeps close to the chief while he looks for a new place
      if (roles.get(r0[0]) === 'bodyguard') {
        const chief = byBand.get(r0[4])?.find((q) => q[7] === 1);
        if (chief) {
          r = [...r] as PersonRow;
          r[1] = chief[1] + 6;
          r[2] = chief[2] + 4;
        }
      }
      seen.add(r[0]);
      let p = this.people.get(r[0]);
      if (!p) {
        p = new PersonSprite(this, r);
        this.people.set(r[0], p);
        if (r[0] === this.selectedId) p.setSelected(true);
      }
      p.target(r, bandColors.get(r[4]) ?? 0xffffff, tickMs);
    }
    for (const [id, p] of this.people) if (!seen.has(id)) { p.destroy(); this.people.delete(id); }
    for (const [id, p] of this.people) p.role = roles.get(id) ?? null;
  }

  /** who does what beyond the day's work: two guards in every band (one walks with the chief when he scouts),
   *  an old man of 70+ who tells stories and the child who listens */
  private roles(rows: PersonRow[], byBand: Map<number, PersonRow[]>): Map<number, Role> {
    const out = new Map<number, Role>();
    for (const l of byBand.values()) {
      const chief = l.find((r) => r[7] === 1);
      const scouting = !!chief && TASKS[chief[3]] === 'scout';
      // a guard stays a guard from 18 until he dies or retires (an elder, at 59)
      const men = l.filter((r) => r[6] === 0 && r[7] !== 1 && r[5] >= 18 && TASKS[r[3]] !== 'elder' && TASKS[r[3]] !== 'scout').sort((a, b) => a[0] - b[0]);
      const n = l.length >= 8 ? 2 : 1;
      men.slice(0, n).forEach((r, k) => out.set(r[0], scouting && n === 2 && k === 1 ? 'bodyguard' : 'guard'));
      const teller = l.find((r) => r[6] === 0 && r[5] >= 70 && TASKS[r[3]] !== 'scout');
      if (teller) {
        out.set(teller[0], 'teller');
        const kid = l.filter((r) => r[5] >= 4 && r[5] < 12).sort((a, b) => a[0] - b[0])[0];
        if (kid) out.set(kid[0], 'listener');
      }
    }
    void rows;
    return out;
  }

  /** a point of a guard's night round (screen), or null where the camp has no room for it */
  patrolPoint(band: number, now: number, id: number): { x: number; y: number; face: number } | null {
    const c = this.camps.get(band);
    if (!c) return null;
    const dir = hash(id, 3) < 0.5 ? 1 : -1;
    const a = dir * now / 14000 + hash(id, 7) * Math.PI * 2;
    for (const R of [1.8, 1.3, 0.9]) {
      const tx = c.tx + Math.cos(a) * R, ty = c.ty + Math.sin(a) * R;
      if (!this.walkable(Math.round(tx), Math.round(ty))) continue;
      const p = this.tileTop(tx, ty);
      // screen direction of the walk: along the circle
      const d = iso(-Math.sin(a) * dir, Math.cos(a) * dir);
      return { x: p.x, y: p.y, face: d.x < 0 ? -1 : 1 };
    }
    return null;
  }

  /** what a person is doing right now, when the guard duty or the night changes it (null: the day's task) */
  nightTask(id: number, task?: number): string | null {
    const p = this.people.get(id);
    const role = p?.role;
    // the guards guard, day and night: that is what they look like too
    if (role === 'guard') return 'пази селото';
    if (role === 'bodyguard') return 'пази водача';
    if (!this.nightNow) return null;
    if (TASKS[task ?? p?.task ?? 0] === 'scout') return null;
    return 'спи';
  }

  /** the night: a dark veil with clear light 2 tiles around every fire, fading out by 3.5 tiles.
   *  Drawn on a small canvas a few times a second: cheap for the graphics card and the processor. */
  private drawNight(dark: number, nowMs: number) {
    const spr = this.nightSprite;
    spr.visible = dark > 0.005;
    if (!spr.visible) return;
    const moving = this.world.x !== this.lastCam[0] || this.world.y !== this.lastCam[1] || this.world.scale.x !== this.lastCam[2];
    if (!moving && nowMs - this.nightAt < 250) return;
    this.nightAt = nowMs;
    this.lastCam = [this.world.x, this.world.y, this.world.scale.x];
    const Q = 4; // canvas pixels are 4x4 screen pixels; the edges are soft anyway
    const W = this.app.screen.width, H = this.app.screen.height;
    const cw = Math.ceil(W / Q), ch = Math.ceil(H / Q);
    const cv = this.nightCanvas;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const g = cv.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = `rgba(5, 10, 28, ${dark.toFixed(3)})`;
    g.fillRect(0, 0, cw, ch);
    const z = this.world.scale.x;
    // a circle of r tiles is an ellipse on screen
    const rx = ((TW / 2) * Math.SQRT2 * z) / Q, ry = ((TH / 2) * Math.SQRT2 * z) / Q;
    g.globalCompositeOperation = 'destination-out';
    for (const c of this.camps.values()) {
      if (!c.hasFire) continue;
      const p = this.tileTop(c.tx, c.ty);
      const x = (this.world.x + p.x * z) / Q, y = (this.world.y + p.y * z) / Q;
      const R = 3.5 * rx;
      if (x < -R || y < -R || x > cw + R || y > ch + R) continue;
      g.save();
      g.translate(x, y);
      g.scale(1, ry / rx);
      const grad = g.createRadialGradient(0, 0, 2 * rx, 0, 0, R);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    spr.texture.source.resize(cw, ch);
    spr.texture.source.update();
    spr.width = W;
    spr.height = H;
  }

  private lastCam = [0, 0, 0];

  /** the whole map as one picture for far zoom; made again when the season or the snow changes, or after two minutes */
  private updateFar(key: string, nowMs: number) {
    if (this.farSprite && key === this.farKey && nowMs - this.farAt < 120000) return;
    this.farKey = key;
    this.farAt = nowMs;
    const { w, h } = this.info;
    const x0 = iso(0, h).x - TW, x1 = iso(w, 0).x + TW;
    const y0 = -15 * ELEV - 40, y1 = iso(w, h).y + 40;
    const frame = new Rectangle(x0, y0, x1 - x0, y1 - y0);
    const res = Math.min(0.3, 4000 / frame.width, 4000 / frame.height);
    // draw everything still: ground, water, snow, trees, fog; no people, camps or names
    const save = { x: this.world.x, y: this.world.y, s: this.world.scale.x };
    this.world.position.set(0, 0);
    this.world.scale.set(1);
    for (const c of this.chunkViews) for (const part of c.parts) part.visible = true;
    const hide = [this.farLayer, this.realmLayer, this.campLayer, this.peopleLayer, this.glowLayer, this.labelLayer];
    const was = hide.map((l) => l.visible);
    for (const l of hide) l.visible = false;
    for (const l of [this.waterLayer, this.terrainLayer, this.snowLayer, this.objLayer, this.fogLayer]) l.visible = true;
    // the fog without its blur: the blur filter would paint the whole frame black, and far away a sharp edge is fine
    const fogFilters = this.fogLayer.filters;
    this.fogLayer.filters = null;
    this.fogLayer.alpha = 0.9;
    const tex = this.app.renderer.generateTexture({ target: this.world, frame, resolution: res, clearColor: [0, 0, 0, 0] });
    this.fogLayer.filters = fogFilters as Filter[];
    this.fogLayer.alpha = 1;
    hide.forEach((l, k) => { l.visible = was[k]; });
    this.world.position.set(save.x, save.y);
    this.world.scale.set(save.s);
    this.farSprite?.destroy(true);
    this.farSprite = new Sprite(tex);
    this.farSprite.position.set(x0, y0);
    this.farSprite.width = frame.width;
    this.farSprite.height = frame.height;
    this.farLayer.addChild(this.farSprite);
  }

  /** called every frame */
  frame(dt: number, nowMs: number) {
    // zoomed far out the whole map is on screen: everything stands still (only the snow still comes and goes)
    const still = this.world.scale.x <= 0.5;
    this.still = still;
    if (!still) this.time += dt / 60;
    if (this.waterFilter) {
      const want = still ? null : [this.waterFilter];
      if ((this.waterLayer.filters?.length ?? 0) !== (want?.length ?? 0)) this.waterLayer.filters = want;
      const u = this.waterFilter.resources.waterUniforms.uniforms;
      u.uTime = this.time;
      const s = this.world.scale.x;
      const res = this.app.renderer.resolution;
      const H = this.app.renderer.height;
      // gl_FragCoord has y up
      u.uCam = new Float32Array([this.world.x * res, H - this.world.y * res, s * res, 0]);
    }
    // seasons: snow in winter
    const m = this.month;
    const winter = m === 11 || m <= 1 ? 1 : m === 2 || m === 10 ? 0.45 : 0;
    this.snowCold.alpha = Math.min(1, winter * 1.2);
    this.snowCool.alpha = winter >= 1 ? 0.7 : 0;
    this.snowCold.visible = this.snowCold.alpha > 0;
    this.snowCool.visible = this.snowCool.alpha > 0;
    this.applySeason();
    // a day lasts 8 real minutes, just for the mood
    const day = (nowMs / (8 * 60 * 1000)) % 1;
    const sun = Math.cos(day * Math.PI * 2); // 1 noon, -1 midnight
    const dark = this.night ? Math.max(0, Math.min(0.82, -sun * 1.0 + 0.05)) : 0;
    const nightNow = sun < -0.25;
    // dusk and dawn: everyone goes to (or gets up from) their sleeping spot at once, not at the next tick
    if (nightNow !== this.nightNow) {
      this.nightNow = nightNow;
      if (this.lastPeople) this.updatePeople(this.lastPeople.rows, this.lastPeople.bandColors, 6000);
    }
    this.drawNight(dark, nowMs);
    this.glowLayer.alpha = Math.min(0.45, dark * 0.55);
    const zoom = this.world.scale.x;
    // far away: one picture of the map, only the camps and their names stay live
    const far = zoom <= 0.4 && !!this.info;
    if (far) {
      this.updateFar(`${this.seasonKey}|${this.snowCold.alpha.toFixed(2)}|${this.snowCool.alpha}|${this.roadVersion}`, nowMs);
      for (const l of [this.waterLayer, this.terrainLayer, this.snowLayer, this.objLayer, this.fogLayer, this.peopleLayer, this.glowLayer]) l.visible = false;
      this.farLayer.visible = true;
      for (const c of this.camps.values()) c.scaleTag(zoom);
      this.far = true;
      return;
    }
    if (this.far) {
      this.far = false;
      this.farLayer.visible = false;
      for (const l of [this.waterLayer, this.terrainLayer, this.snowLayer, this.objLayer, this.fogLayer, this.glowLayer]) l.visible = true;
    }
    // draw only the chunks on screen
    const vx = -this.world.x / zoom, vy = -this.world.y / zoom;
    const vw = this.app.screen.width / zoom, vh = this.app.screen.height / zoom;
    for (const c of this.chunkViews) {
      const a = c.area;
      const on = a.x < vx + vw && a.x + a.width > vx && a.y < vy + vh && a.y + a.height > vy;
      for (const part of c.parts) part.visible = on;
    }
    this.peopleLayer.visible = zoom > 0.4;
    this.labelLayer.alpha = 1;
    if (still) {
      // no walking, fire or banners: just keep the camp names readable
      for (const c of this.camps.values()) c.scaleTag(zoom);
      this.secretFrame(nowMs, zoom, winter);
      return;
    }
    const mx = 80, x0 = vx - mx, x1 = vx + vw + mx, y0 = vy - mx, y1 = vy + vh + mx * 2;
    for (const p of this.people.values()) {
      const on = (p.to.x > x0 && p.to.x < x1 && p.to.y > y0 && p.to.y < y1) || (p.from.x > x0 && p.from.x < x1 && p.from.y > y0 && p.from.y < y1);
      p.c.visible = on;
      if (on) p.frame(nowMs);
    }
    for (const c of this.camps.values()) {
      const on = c.pos.x > x0 - 60 && c.pos.x < x1 + 60 && c.pos.y > y0 - 60 && c.pos.y < y1 + 60;
      c.c.visible = on;
      if (on) c.frame(nowMs, zoom);
    }
    if (!this.mars) this.fauna.frame(performance.now(), Math.min(0.1, dt / 60));
    this.fleet.frame(performance.now(), Math.min(0.1, dt / 60));
    this.canoes.frame(performance.now(), Math.min(0.1, dt / 60));
    this.trains.frame(performance.now(), Math.min(0.1, dt / 60));
    this.secretFrame(nowMs, zoom, winter);
  }
}

function scaleColor(c: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

/** A person: a base sprite plus the clothes on top, tinted in the colour of the band. */
export class PersonSprite {
  r: WorldRenderer;
  c = new Container();
  body: Sprite;
  cloth: Sprite;
  id: number;
  from = { x: 0, y: 0 };
  to = { x: 0, y: 0 };
  /** smooth walking position without bobbing or idle wiggle: the card and camera follow this */
  pos = { x: 0, y: 0 };
  /** where the person was heading, in tiles, and the way there around any water (screen points) */
  tile = { x: 0, y: 0 };
  path: { x: number; y: number }[] = [];
  lens: number[] = [];
  /** the same path in tile points: to see where it runs over water */
  tpath: { x: number; y: number }[] = [];
  t0 = 0;
  dur = 1;
  seed: number;
  task = 0;
  band = 0;
  age = 20;
  female = false;
  /** heads the band: own sprites with a smooth idle animation (sheets S and T) */
  chief = false;
  pose = '';
  facing = 1;
  outline: Container | null = null;
  star: Sprite | null = null;
  /** a famous person of the real world */
  fame = false;
  /** walking back towards the camp (a fisher brings the catch home) */
  homeward = false;
  /** set by the renderer: the night guard of the band, the old storyteller, or the child listening to him */
  role: Role | null = null;

  constructor(r: WorldRenderer, row: PersonRow) {
    this.r = r;
    this.id = row[0];
    this.seed = hash(row[0], 7) * 1000;
    this.facing = hash(row[0], 13) < 0.5 ? -1 : 1;
    this.body = new Sprite();
    this.cloth = new Sprite();
    this.c.addChild(this.body, this.cloth);
    this.c.eventMode = 'none';
    r.peopleLayer.addChild(this.c);
    const p = r.tileTop(row[1] / 10, row[2] / 10);
    this.from = p;
    this.to = p;
    this.pos = { x: p.x, y: p.y };
    this.tile = { x: row[1] / 10, y: row[2] / 10 };
    this.c.position.set(p.x, p.y);
    this.age = row[5];
    this.fame = !!row[8];
    this.female = row[6] === 1;
    this.chief = row[7] === 1;
    this.setPose(this.idlePose());
    this.updateStar();
  }

  /** 70 and more: a small gold star next to the head; a famous person of the real world: a bigger red one */
  private updateStar() {
    const want = this.age >= 70 || this.fame;
    const tex = this.fame ? this.r.tex.redstar : this.r.tex.star;
    if (this.star && this.star.texture !== tex) {
      this.star.destroy();
      this.star = null;
    }
    if (want && !this.star) {
      this.star = new Sprite(tex);
      this.star.anchor.set(0.5);
      this.star.scale.set(this.fame ? 0.32 : 0.25);
      this.c.addChild(this.star);
    } else if (!want && this.star) {
      this.star.destroy();
      this.star = null;
    }
    if (this.star) this.star.position.set(3.2, -Math.abs(this.body.height) - 1.5);
  }

  private setPose(raw: string) {
    const name = this.dress(raw);
    if (name === this.pose) return;
    this.pose = name;
    this.r.atlas.set(this.body, name);
    // the newer animation sheets keep their own fur colours: no band-coloured clothes on top
    const cloth = this.r.atlas.has(name + '_c');
    this.cloth.visible = cloth;
    if (cloth) this.r.atlas.set(this.cloth, name + '_c');
    this.updateOutline();
    if (this.star) this.star.position.set(3.2, -Math.abs(this.body.height) - 1.5);
  }

  /** a red outline: the silhouette drawn in red, shifted in 8 directions behind the person */
  setSelected(on: boolean) {
    if (on && !this.outline) {
      this.outline = new Container();
      for (let k = 0; k < 8; k++) this.outline.addChild(new Sprite(), new Sprite());
      this.c.addChildAt(this.outline, 0);
      this.updateOutline();
    } else if (!on && this.outline) {
      this.outline.destroy({ children: true });
      this.outline = null;
    }
  }

  private updateOutline() {
    if (!this.outline) return;
    const d = 0.8 / Math.max(0.4, Math.abs(this.c.scale.y));
    this.outline.children.forEach((ch, j) => {
      const sp = ch as Sprite;
      const k = j >> 1;
      const a = (k / 8) * Math.PI * 2;
      // the newer sheets have no separate clothes: their outline is the body alone
      const name = j & 1 ? this.pose + '_c' : this.pose;
      sp.visible = this.r.atlas.has(name);
      if (!sp.visible) return;
      this.r.atlas.set(sp, name);
      sp.tint = 0xff2a2a;
      sp.position.set(Math.cos(a) * d, Math.sin(a) * d);
    });
  }

  private dressT: Set<string> | undefined;
  private dressN = -1;
  private dressP = '';
  /** everyday clothes of the band's age: the same pose from the sheets of that age (BS-CD), when there is one */
  private dress(name: string): string {
    const t = this.r.bandTech.get(this.band);
    if (t !== this.dressT || (t?.size ?? 0) !== this.dressN) {
      this.dressT = t;
      this.dressN = t?.size ?? 0;
      this.dressP = this.r.mars ? 'm9' : !t ? '' : t.has('moon_base') ? 'e8' : t.has('computer') ? 'e7' : t.has('steam_engine') ? 'e6' : t.has('caravel') ? 'e5'
        : t.has('heavy_plough') ? 'e4' : t.has('bronze') ? 'e2' : '';
    }
    if (!this.dressP) return name;
    const m = /^([a-z0-9]+?)(\d*)$/.exec(name);
    if (!m) return this.dressP === 'm9' && !/sleep/.test(name) ? this.marsStill(name) : name;
    // from the early modern age on nobody hunts or fishes with a spear in town any more: they just stand there
    const late = (this.dressP >= 'e5' ? LATE_DRESS[m[1]] : undefined) ?? OLD_ONLY[m[1]];
    if (this.dressP === 'm9' && MARS_POSES.has(m[1])) return name;
    const base = late ?? DRESS[m[1]];
    const dressed = base ? `${this.dressP}${base}${late ? '' : m[2]}` : '';
    if (dressed && this.r.atlas.has(dressed)) return dressed;
    if (!base && this.dressP !== 'm9') return name;
    // on Mars nobody is out there in Earth clothes: a pose without a space suit becomes a colonist standing still
    if (this.dressP === 'm9' && !m[1].startsWith('sleep')) return this.marsStill(name);
    return name;
  }

  /** a colonist in a space suit standing still, for a pose that has no space-suit drawing */
  private marsStill(name: string): string {
    const step = /walk\D*(\d)$/.exec(name);
    if (step) {
      const walk = `m9${this.age < 14 ? (this.female ? 'girlwalk' : 'boywalk') : this.age > 60 ? 'oldwalk' : this.female ? 'womanwalk' : 'walk'}${Number(step[1]) % 4}`;
      if (this.r.atlas.has(walk)) return walk;
    }
    const still = `m9${this.age < 14 ? (this.female ? 'girl' : 'boy') : this.age > 60 ? (this.female ? 'oldwoman' : 'elder') : this.female ? 'woman' : 'man'}`;
    return this.r.atlas.has(still) ? still : name;
  }

  /** a stable pick per person, so the pose does not flicker */
  private choose(list: string[], salt: number): string {
    return list[Math.floor(hash(this.id, salt) * list.length)];
  }

  private idlePose(): string {
    const task = TASKS[this.task];
    if (this.age < 12) {
      return this.female
        ? this.choose(['girl', 'girl', 'kidberries', 'kidwave', 'kidpuppy'], 31)
        : this.choose(['boy', 'boy', 'kidtoy', 'kidstick', 'kidfish', 'kidpuppy'], 31);
    }
    if (this.age > 55 || task === 'elder') {
      if (!this.female) return 'elder';
      if (task === 'gather' || task === 'farm') return 'oldbasket';
      if (task === 'craft') return 'oldherbs';
      return this.choose(['oldwoman', 'oldscarf', 'oldwoman'], 33);
    }
    switch (task) {
      case 'gather': case 'farm': return 'gatherer';
      case 'hunt': case 'herd': return 'hunter';
      case 'fish': return this.female ? 'waterjar' : 'hunter';
      case 'craft': return this.female ? this.choose(['potter', 'spinner'], 35) : 'carrier';
      case 'build': return this.female ? 'reedcarrier' : 'carrier';
      default: return this.female ? this.choose(['woman', 'woman2', 'woman', 'waterjar'], 37) : hash(this.id, 21) < 0.15 ? 'wave' : 'man';
    }
  }

  /** the chief: young with a dark beard or none, old with a white beard (sheets S-V) */
  private chiefPose(now: number, walking: boolean): string | null {
    // the chief of a capital is a king: crown, fur cloak and a staff (sheet AW)
    if (this.r.capitals.has(this.band) && this.r.atlas.has('king0')) return walking ? `king${Math.floor(now / 160 + this.seed) % 4}` : 'king0';
    const look = hash(this.id, 41) < 0.5 ? 'chiefA' : 'chiefB';
    const age = this.age >= 50 ? 'o' : 'y';
    const base = `${look}_${age}_${walking ? 'walk' : 'idle'}`;
    if (!this.r.atlas.has(`${base}0`)) return null;
    // 8-frame loops: a slow, calm idle and a smooth walk
    const f = Math.floor(now / (walking ? 110 : 220) + this.seed) % 8;
    return `${base}${f}`;
  }

  /** animated work, sleep and story poses (sheets AB-AE); null = the usual sprites */
  private actionPose(now: number, walking: boolean, arrived: boolean): string | null {
    const A = this.r.atlas;
    const loop = (base: string, n: number, ms: number) => {
      const name = `${base}${Math.floor(now / ms + this.seed) % n}`;
      return A.has(name) ? name : null;
    };
    const task = TASKS[this.task];
    const knows = (id: string) => this.r.bandTech.get(this.band)?.has(id) ?? false;
    const man = !this.female && this.age >= 16 && this.age < 56;
    if (walking) {
      if (task === 'chop') return loop('carry', 8, 110);
      // bronze age: some men ride, some take a cart to the neighbours
      if (man && knows('horse') && hash(this.id, 53) < 0.2) return loop('rider', 4, 160);
      // information age: joggers, people looking at their phones, children on kick scooters, couriers
      // space age: robot dogs, hover scooters, children with toy drones, old couples hand in hand
      if (knows('moon_base')) {
        if (this.female && this.age >= 16 && this.age < 56 && knows('ai') && hash(this.id, 141) < 0.12) { const c = loop('robodogwalk', 4, 180); if (c) return c; }
        if (man && knows('flying_car') && hash(this.id, 143) < 0.1) { const c = loop('hoverride', 4, 160); if (c) return c; }
        if (this.age >= 6 && this.age < 14 && hash(this.id, 145) < 0.35) { const c = loop('dronekid', 4, 180); if (c) return c; }
        if (this.age > 60 && hash(this.id, 147) < 0.2) { const c = loop('eldercouple', 4, 220); if (c) return c; }
      }
      if (knows('computer')) {
        if (man && this.age < 45 && hash(this.id, 121) < 0.1) { const c = loop('jogger', 4, 120); if (c) return c; }
        if (this.age >= 14 && this.age < 50 && knows('smartphone') && hash(this.id, 123) < 0.15) { const c = loop('phonewalk', 4, 180); if (c) return c; }
        if (this.age >= 7 && this.age < 14 && hash(this.id, 125) < 0.35) { const c = loop('kickscooter', 4, 160); if (c) return c; }
        if (man && knows('internet') && hash(this.id, 127) < 0.08) { const c = loop('courier', 4, 150); if (c) return c; }
      }
      // industrial age: cyclists, prams, paper boys, ladies with dogs and motor cars
      if (knows('steam_engine') && !knows('computer')) {
        if (man && knows('school') && hash(this.id, 97) < 0.08) { const c = loop('cyclist', 4, 150); if (c) return c; }
        if (this.female && this.age >= 18 && this.age < 45 && knows('vaccine') && hash(this.id, 99) < 0.08) { const c = loop('pram', 4, 190); if (c) return c; }
        if (!this.female && this.age >= 9 && this.age < 15 && knows('newspaper') && hash(this.id, 101) < 0.3) { const c = loop('paperboy', 4, 160); if (c) return c; }
        if (this.female && this.age >= 18 && knows('factory') && hash(this.id, 103) < 0.08) { const c = loop('lady', 4, 190); if (c) return c; }
      }
      // early modern age: coaches, town criers, couples out for a walk, sailors with their sea bags
      if (man && (knows('post') || knows('palace')) && hash(this.id, 79) < 0.1) { const c = loop('coach', 4, 170); if (c) return c; }
      if (man && knows('newspaper') && hash(this.id, 81) < 0.06) { const c = loop('crier', 4, 170); if (c) return c; }
      if (this.age >= 16 && knows('coffeehouse') && hash(this.id, 83) < 0.06) { const c = loop('strollers', 4, 190); if (c) return c; }
      if (man && knows('caravel') && hash(this.id, 85) < 0.08) { const c = loop('sailors', 4, 170); if (c) return c; }
      // middle ages: knights ride, merchants drive covered wagons, minstrels and pilgrims walk the roads
      if (man && knows('knighthood') && hash(this.id, 53) < 0.12) return loop('knight', 4, 170);
      if (man && knows('guilds') && hash(this.id, 51) < 0.2) return loop('wagon', 4, 170) ?? loop('trader2', 4, 170);
      if (man && knows('knighthood') && hash(this.id, 67) < 0.05) return loop('minstrel', 4, 170);
      if (this.age >= 16 && knows('monastery') && hash(this.id, 69) < 0.04) return loop('pilgrims', 4, 190);
      if (man && (knows('windmill') || knows('watermill')) && knows('heavy_plough') && hash(this.id, 71) < 0.08) return loop('miller', 4, 160);
      if (man && knows('trade') && hash(this.id, 51) < 0.2) return (knows('coins') ? loop('trader2', 4, 170) : null) ?? loop('trader', 4, 170);
      // iron age: a teacher walks with two children, reading a scroll
      if (!this.female && this.age >= 35 && knows('library') && hash(this.id, 63) < 0.12) return loop('teacher', 4, 180);
      return null;
    }
    if (this.r.nightNow && task !== 'scout') {
      // everybody sleeps; the guards walk around the fire (see frame) and the bodyguard stands by the chief
      if (this.role === 'guard' || this.role === 'bodyguard') return (A.has(`${this.guardKit()}idle0`) ? loop(`${this.guardKit()}idle`, 8, 450) : null) ?? loop('guard', 4, 900);
      if (this.chief) {
        const own = loop(`${hash(this.id, 41) < 0.5 ? 'chiefA' : 'chiefB'}_${this.age >= 50 ? 'o' : 'y'}_sleep`, 2, 1500);
        if (own) return own;
      }
      if (this.age < 12) return loop(this.female ? 'sleepGirl' : 'sleepBoy', 2, 1500) ?? loop('sleepK', 2, 1500);
      if (this.age > 55) return loop(this.female ? 'sleepOldF' : 'sleepOldM', 2, 1500) ?? loop(this.female ? 'sleepF' : 'sleepM', 2, 1500);
      return loop(this.female ? 'sleepF' : 'sleepM', 2, 1500);
    }
    if ((this.role === 'guard' || this.role === 'bodyguard') && A.has(`${this.guardKit()}idle0`)) return loop(`${this.guardKit()}idle`, 8, 450);
    if (this.role === 'teller') return loop('tell', 8, 240);
    if (this.role === 'listener') return loop('listen', 8, 240);
    // a fisher on the way back to camp carries the catch home
    if (walking && task === 'fish' && this.homeward && this.age >= 14 && this.age <= 55) {
      const c = loop(this.female ? 'fishbasket' : 'fishcarry', 4, 150);
      if (c) return c;
    }
    if (!arrived) return null;
    if (this.r.mars && !['rest', 'child', 'elder', 'travel', 'lead', 'scout'].includes(task) && this.age >= 16 && this.age <= 60) {
      // on Mars the work is drilling the rocks for samples and ice, or tending the plants under the glass
      const c = this.female || hash(this.id, 171) < 0.3 ? loop('mbotanist', 4, 450) : loop('mdrill', 4, 260);
      if (c) return c;
    }
    switch (task) {
      case 'chop': return loop('chop', 8, 120);
      case 'hunt': return this.age < 56 ? loop('throw', 4, 320) : null;
      case 'gather': return this.female && this.age < 56 ? loop('pick', 4, 340) : null;
      case 'fish': {
        // women fish with a rod from the bank; men with a rod, a net in the shallows or the old harpoon (sheets CS, CT)
        if (this.female) return loop('rodfishf', 4, 520);
        const how = hash(this.id, 161);
        // from the bronze age on the men fish with a rod in the clothes of their time
        if (how < 0.4 || knows('bronze')) { const c = loop('rodfish', 4, 520); if (c) return c; }
        if (how > 0.8) { const c = loop('netpull', 4, 320); if (c) return c; }
        return loop('spearfish', 4, 340);
      }
      case 'craft':
        if (knows('moon_base')) {
          if (knows('robots') && hash(this.id, 151) < 0.25) { const c = loop('technician', 4, 500); if (c) return c; }
          if (this.female && knows('vertical_farm') && hash(this.id, 153) < 0.4) { const c = loop('botanist', 4, 500); if (c) return c; }
          if (hash(this.id, 155) < 0.25) { const c = loop('engineer', 4, 600); if (c) return c; }
          if (this.age < 45 && hash(this.id, 157) < 0.25) { const c = loop('astronaut', 4, 600); if (c) return c; }
        }
        if (knows('computer')) {
          if (knows('antibiotics') && hash(this.id, 131) < 0.12) { const c = loop('doctor', 4, 600); if (c) return c; }
          if (hash(this.id, 133) < 0.3) { const c = loop('programmer', 4, 700); if (c) return c; }
          if (this.female && hash(this.id, 135) < 0.5) { const c = loop('scientist', 4, 600); if (c) return c; }
          if (!this.female && hash(this.id, 137) < 0.5) { const c = loop('builder', 4, 500); if (c) return c; }
        }
        if (!this.female) {
          if (knows('factory') && hash(this.id, 105) < 0.25) { const c = loop('stoker', 4, 300); if (c) return c; }
          if (knows('telegraph') && hash(this.id, 107) < 0.1) { const c = loop('telegraphist', 4, 500); if (c) return c; }
          if (knows('photography') && hash(this.id, 109) < 0.1) { const c = loop('photographer', 4, 600); if (c) return c; }
          if (knows('telescope') && hash(this.id, 87) < 0.1) { const c = loop('astronomer', 4, 600); if (c) return c; }
          if (knows('newspaper') && hash(this.id, 89) < 0.15) { const c = loop('printer', 4, 350); if (c) return c; }
          if (knows('telescope') && hash(this.id, 91) < 0.15) { const c = loop('glassblower', 4, 350); if (c) return c; }
          if (knows('caravel') && hash(this.id, 93) < 0.15) { const c = loop('sailor', 4, 200); if (c) return c; }
          if (knows('monastery') && hash(this.id, 57) < 0.15) return loop('monk', 4, 600);
          if (knows('writing') && hash(this.id, 57) < 0.25) return loop('scribe', 4, 600);
          if (knows('guilds') && hash(this.id, 73) < 0.25) return loop('cooper', 4, 300);
          if (knows('theatre') && hash(this.id, 61) < 0.1) return loop('actor', 4, 500);
          if ((knows('arch') || knows('aqueduct')) && hash(this.id, 59) < 0.3) return loop('mason', 4, 300);
          return (knows('iron') ? loop('ismith', 4, 280) : null) ?? (knows('bronze') ? loop('smith', 4, 260) : null) ?? loop('knap', 4, 300);
        }
        if (knows('factory') && hash(this.id, 111) < 0.4) { const c = loop('seamstress', 4, 300); if (c) return c; }
        if (knows('medicine') && hash(this.id, 59) < 0.3) return loop('healer', 4, 420);
        if (knows('guilds') && hash(this.id, 55) < 0.5) return loop('spinner', 4, 380);
        if (knows('wheel') && hash(this.id, 55) < 0.5) return loop('wheelpot', 4, 420);
        return knows('weaving') && knows('agriculture') ? loop('weaver', 4, 380) : null;
      case 'farm': return man && knows('plough') ? loop('plougher', 4, 260) : null;
      default: return null;
    }
  }

  /** guards (and the bodyguard) wear the best gear of their time: bronze once the band knows it */
  private guardKit(): string {
    const t = this.r.bandTech.get(this.band);
    if (t?.has('moon_base') && this.r.atlas.has('rgwalk0')) return 'rg';
    if (t?.has('computer') && this.r.atlas.has('ogwalk0')) return 'og';
    if (t?.has('steam_engine') && this.r.atlas.has('wgwalk0')) return 'wg';
    if ((t?.has('star_fort') || t?.has('caravel')) && this.r.atlas.has('pgwalk0')) return 'pg';
    if ((t?.has('knighthood') || t?.has('castle')) && this.r.atlas.has('mgwalk0')) return 'mg';
    if (t?.has('iron') && this.r.atlas.has('igwalk0')) return 'ig';
    return t?.has('bronze') && this.r.atlas.has('bgwalk0') ? 'bg' : 'g';
  }

  private walkPose(now: number): string | null {
    const f = Math.floor(now / 140 + this.seed) % 4;
    if (this.age < 12) return `${this.female ? 'girlwalk' : 'boywalk'}${f}`;
    if (this.age > 55) return this.female ? `oldwalk${f}` : null;
    return `${this.female ? 'womanwalk' : 'walk'}${f}`;
  }

  target(row: PersonRow, color: number, tickMs: number) {
    const tx = row[1] / 10, ty = row[2] / 10;
    const p = this.r.tileTop(tx, ty);
    this.from = { x: this.pos.x, y: this.pos.y };
    this.to = p;
    // go around water; with no way by land (a boat) they still go straight
    let way = this.r.dryLine(this.tile.x, this.tile.y, tx, ty) ? null : this.r.landPath(this.tile.x, this.tile.y, tx, ty);
    // with boats a long walk round the water is not worth it: they paddle straight across
    if (way && this.r.bandTech.get(row[4])?.has('boats')) {
      let len = 0;
      for (let i = 1; i < way.length; i++) len += Math.hypot(way[i].x - way[i - 1].x, way[i].y - way[i - 1].y);
      if (len > Math.hypot(tx - this.tile.x, ty - this.tile.y) * 1.8 + 3) way = null;
    }
    this.tpath = way ? [{ x: this.tile.x, y: this.tile.y }, ...way.slice(1, -1), { x: tx, y: ty }] : [{ x: this.tile.x, y: this.tile.y }, { x: tx, y: ty }];
    const boats = !!this.r.bandTech.get(row[4])?.has('boats');
    if (boats && !way && !this.r.dryLine(this.tile.x, this.tile.y, tx, ty)) {
      // in short steps, so the time on the water can be counted apart
      const n = Math.max(2, Math.ceil(Math.hypot(tx - this.tile.x, ty - this.tile.y) * 2));
      this.tpath = Array.from({ length: n + 1 }, (_, i) => ({ x: this.tile.x + (tx - this.tile.x) * i / n, y: this.tile.y + (ty - this.tile.y) * i / n }));
    }
    this.path = this.tpath.map((q, i) => (i === 0 ? this.from : i === this.tpath.length - 1 ? p : this.r.tileTop(q.x, q.y)));
    const camp = this.r.camps.get(row[4]);
    this.homeward = !!camp && Math.hypot(tx - camp.tx, ty - camp.ty) + 0.5 < Math.hypot(this.tile.x - camp.tx, this.tile.y - camp.ty);
    this.lens = [0];
    for (let i = 1; i < this.path.length; i++) {
      // paddling is slow: the water counts three times, so the crossing can be seen
      const a = this.tpath[i - 1], b = this.tpath[i];
      const wet = boats && !this.r.walkable(Math.round((a.x + b.x) / 2), Math.round((a.y + b.y) / 2));
      this.lens.push(this.lens[i - 1] + Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y) * (wet ? 3 : 1));
    }
    this.tile = { x: tx, y: ty };
    // everybody walks at their own steady pace, so a long way takes longer; and each sets off at their own
    // moment somewhere in the month, so people come and go all the time instead of all at once
    const tick = Math.max(800, tickMs);
    const total = this.lens[this.lens.length - 1] ?? 0;
    const pace = WALK_SPEED * (0.8 + hash(this.id, 213) * 0.4) * (this.age > 60 ? 0.75 : 1);
    this.dur = Math.max(400, Math.min(tick * 0.9, (total / pace) * 1000));
    this.t0 = performance.now() + hash(this.id, 211 + (row[1] & 31) + (row[2] & 31) * 32) * Math.max(0, tick * 0.95 - this.dur);
    this.cloth.tint = color;
    this.age = row[5];
    this.fame = !!row[8];
    this.updateStar();
    this.female = row[6] === 1;
    this.chief = row[7] === 1;
    const s = this.age < 12 ? 0.75 + this.age * 0.02 : this.age > 60 ? 0.95 : 1;
    this.c.scale.set(this.facing * s, s);
    this.task = row[3];
    this.band = row[4];
    if (Math.abs(this.to.x - this.from.x) > 1) this.facing = this.to.x < this.from.x ? -1 : 1;
  }

  frame(now: number) {
    const k = Math.max(0, Math.min(1, (performance.now() - this.t0) / this.dur));
    // a steady walk, only the first and last step a little softer
    const e = k < 0.05 ? (k * k) / 0.1 : k > 0.95 ? 1 - ((1 - k) * (1 - k)) / 0.1 : k;
    let x = this.to.x, y = this.to.y;
    let afloat: string | null = null;
    const total = this.lens[this.lens.length - 1] ?? 0;
    if (total > 0 && e < 1) {
      const d = e * total;
      let i = 1;
      while (i < this.lens.length - 1 && this.lens[i] < d) i++;
      const a = this.path[i - 1], b = this.path[i];
      const f = (d - this.lens[i - 1]) / Math.max(1e-6, this.lens[i] - this.lens[i - 1]);
      x = a.x + (b.x - a.x) * f;
      y = a.y + (b.y - a.y) * f;
      if (Math.abs(b.x - a.x) > 1) this.facing = b.x < a.x ? -1 : 1;
      const ta = this.tpath[i - 1], tb = this.tpath[i];
      if (ta && tb) {
        const wx = Math.round(ta.x + (tb.x - ta.x) * f), wy = Math.round(ta.y + (tb.y - ta.y) * f);
        // over water with a boat: in the canoe (towards us or away)
        const t = this.r.bandTech.get(this.band);
        if (!this.r.walkable(wx, wy) && t?.has('boats')) {
          // dugout, then a rowing boat (middle ages), then a motorboat (computer age)
          const boat = t.has('computer') && this.r.atlas.has('motorse0') ? 'motor' : t.has('heavy_plough') && this.r.atlas.has('skiffse0') ? 'skiff' : 'canoe';
          if (this.r.atlas.has(`${boat}se0`)) afloat = `${boat}${b.y < a.y ? 'ne' : 'se'}`;
        }
      }
    }
    const dist = total;
    // a guard on his night round: two tiles around the fire
    const round = this.role === 'guard' && this.r.nightNow ? this.r.patrolPoint(this.band, now, this.id) : null;
    if (round) {
      x = round.x;
      y = round.y;
      this.facing = round.face;
    }
    let walking = !!round || (k > 0 && k < 1 && dist > 3);
    const asleep = this.r.nightNow && TASKS[this.task] !== 'scout';
    // people with nothing to do do not stand still: they stroll a few steps now and then around where they are
    const idleTask = TASKS[this.task];
    if (k >= 1 && !round && !afloat && !asleep && (idleTask === 'rest' || idleTask === 'child' || idleTask === 'elder') && this.role !== 'guard' && this.role !== 'bodyguard' && !this.chief) {
      const L = 6000 + hash(this.id, 223) * 6000;
      const tt = (now + this.seed * 997) / L, j = Math.floor(tt), f = tt - j;
      const spot = (q: number) => ({ x: (hash(this.id, q * 7 + 1) - 0.5) * 28, y: (hash(this.id, q * 7 + 2) - 0.5) * 14 });
      const a = spot(j - 1), b = spot(j);
      const m = Math.min(1, f / 0.4);
      const ramp = Math.min(1, (performance.now() - this.t0 - this.dur) / 2500); // eases in after arriving, no jump
      x += (a.x + (b.x - a.x) * m) * ramp;
      y += (a.y + (b.y - a.y) * m) * ramp;
      if (m < 1 && Math.hypot(b.x - a.x, b.y - a.y) * ramp > 4) {
        walking = true;
        if (Math.abs(b.x - a.x) > 1) this.facing = b.x < a.x ? -1 : 1;
      }
    }
    this.pos.x = x;
    this.pos.y = y;
    let bob = 0;
    const chiefPose = this.chief && !asleep ? this.chiefPose(now, walking) : null;
    const kit = this.guardKit();
    const own = this.r.atlas.has(`${kit}walk0`);
    // guards look like guards all day long once their sprites exist
    const guardOn = (this.role === 'guard' || this.role === 'bodyguard') && own;
    const guardWalk = round || (guardOn && walking) ? `${own ? `${kit}walk` : this.female ? 'womanwalk' : 'walk'}${Math.floor(now / 150 + this.seed) % (own ? 8 : 4)}` : null;
    const special = chiefPose || guardWalk ? null : this.actionPose(now, walking, k >= 1);
    const walk = guardWalk ?? chiefPose ?? special ?? (walking ? this.walkPose(now) : null);
    if (afloat) {
      this.setPose(`${afloat}${Math.floor(now / 380 + this.seed) % 4}`);
    } else if (walk) {
      this.setPose(walk);
    } else {
      this.setPose(this.idlePose());
      if (walking) bob = -Math.abs(Math.sin(now / 110 + this.seed)) * 1.2;
    }
    // small idle movement so the camp feels alive (not while sleeping, sitting or working in place)
    const task = TASKS[this.task];
    if (k >= 1 && task !== 'rest' && !special) {
      const a = now / 1400 + this.seed;
      const amp = task === 'child' ? 4 : 1.5;
      x += Math.sin(a) * amp;
      y += Math.cos(a * 1.3) * amp * 0.5;
    }
    const s = Math.abs(this.c.scale.y);
    this.c.scale.x = this.facing * s;
    this.c.position.set(x, y + bob);
    this.c.zIndex = y;
  }

  destroy() {
    this.c.destroy({ children: true });
  }
}

/** how fast people walk, in world units per second (a tile is 32 wide) */
const WALK_SPEED = 16;

/** stone age pose -> the pose with the same meaning on the sheets with the clothes of each age */
const DRESS: Record<string, string> = {
  walk: 'walk', womanwalk: 'womanwalk', oldwalk: 'oldwalk', boywalk: 'boywalk', girlwalk: 'girlwalk',
  man: 'man', woman: 'woman', elder: 'elder', wave: 'wave', hunter: 'man', potter: 'woman2', spinner: 'woman2', waterjar: 'woman',
  gatherer: 'gatherer', reedcarrier: 'gatherer', carrier: 'carrier', woman2: 'woman2',
  oldwoman: 'oldwoman', oldherbs: 'oldwoman', oldscarf: 'oldwoman', oldbasket: 'oldwoman',
  boy: 'boy', girl: 'girl', kidwave: 'kidwave', kidtoy: 'kidtoy', kidberries: 'girl', kidpuppy: 'kidwave', kidstick: 'kidtoy', kidfish: 'boy',
  rodfish: 'rodfish', fishbasket: 'fishbasket', fishcarry: 'walk',
};
/** stone age work with spears and flint, shown as a dressed pose from the early modern age on */
const LATE_DRESS: Record<string, string> = {
  throw: 'man', spearfish: 'carrier', pick: 'gatherer', knap: 'man',
};
/** stone age poses with no sheet of their own in the later ages: from the bronze age on a plain dressed pose */
const OLD_ONLY: Record<string, string> = { rodfishf: 'woman', netpull: 'carrier' };
/** a colony on Mars: the buildings after the main dome, in the order they come as it grows, and the things around it */
const MARS_BUILDINGS = ['mdomeb3', 'mgreenhouse', 'mpad', 'mpower', 'mlab', 'mdomeb3', 'mairtower', 'mmed', 'mstore', 'mschool', 'mgreenhouse', 'mdomeb3'];
const MARS_PROPS = ['msolar', 'mrover', 'mplants', 'mcrates', 'mdish', 'micedrill', 'mtank', 'mbot', 'mairmaker', 'msuit', 'mbigrover', 'msolar'];
/** the work poses drawn in space suits (sheet DC): on Mars they are worn as they are */
const MARS_POSES = new Set(['mdrill', 'mbotanist']);

// Props a band shows in its camp once it knows the matching technology.
const PROPS: [string, string, boolean | null][] = [
  // [tech, sprite, settled only (true) / camps only (false) / both (null)]
  ['fire', 'logpile', null],
  ['fire', 'chopblock', false],
  ['fire', 'woodstack', true],
  ['clothing', 'hiderack', false],
  ['cave_art', 'totem', null],
  ['burial', 'cairn', false],
  ['burial', 'shrine', true],
  ['pottery', 'pots', null],
  ['grinding', 'quern', false],
  ['grinding', 'quern2', true],
  ['pottery', 'kiln', true],
  ['pottery', 'oven', true],
  ['herding', 'pen', false],
  ['herding', 'goatpen', true],
  ['mudbrick', 'bricks', true],
  ['fishing', 'fishtrap', null],
  ['boats', 'canoe', null],
  ['agriculture', 'granary', true],
  ['agriculture', 'haystack', true],
  ['mudbrick', 'well', true],
  ['weaving', 'basket', null],
  // bronze age (shown once the AG/AH sheets are in the atlas)
  ['copper', 'ore', null],
  ['copper', 'furnace', true],
  ['bronze', 'anvil', true],
  ['bronze', 'toolrack', null],
  ['wheel', 'potwheel', true],
  ['weaving', 'loom', true],
  ['plough', 'ploughox', true],
  ['wheel', 'cart', null],
  ['trade', 'cartfull', true],
  ['horse', 'horsepost', null],
  ['sailing', 'sailboat', null],
  ['writing', 'tablets', true],
  ['trade', 'stall', true],
  ['walls', 'tower', true],
  ['walls', 'gate', true],
  ['trade', 'market', true],
  ['calendar', 'statue', true],
  // iron age (sheets AS-AU)
  ['iron', 'charcoal', true],
  ['iron', 'bloomery', true],
  ['iron', 'ianvil', true],
  ['iron', 'irack', null],
  ['alphabet', 'scrolls', true],
  ['harbor', 'warehouse', true],
  ['harbor', 'lighthouse', true],
  ['kingdom', 'milestone', true],
  ['coins', 'mint', true],
  ['coins', 'chest', true],
  ['coins', 'amphorae', true],
  ['coins', 'press', true],
  ['laws', 'stele', true],
  ['medicine', 'herbtable', true],
  ['medicine', 'beehives', true],
  ['aqueduct', 'aqueduct', true],
  ['aqueduct', 'fountain', true],
  ['watermill', 'mill0', true],
  ['arch', 'crane', true],
  ['arch', 'blocks', true],
  // middle ages (sheets AY-BA)
  ['heavy_plough', 'hplough', true],
  ['heavy_plough', 'haycart', true],
  ['heavy_plough', 'barrow', true],
  ['monastery', 'lectern', true],
  ['monastery', 'bell', true],
  ['knighthood', 'warhorse', true],
  ['knighthood', 'quintain', true],
  ['knighthood', 'farrier', true],
  ['three_field', 'mwell', true],
  ['paper', 'papervat', true],
  ['guilds', 'guildsign', true],
  ['guilds', 'brewery', true],
  ['guilds', 'tannery', true],
  ['guilds', 'spinwheel', true],
  ['guilds', 'markethall', true],
  ['guilds', 'inn', true],
  ['knighthood', 'tourney', true],
  ['windmill', 'windmill0', true],
  ['compass', 'compass', true],
  ['compass', 'cog', true],
  ['clock', 'clocktower', true],
  ['printing', 'printpress', true],
  // early modern age (sheets BE-BH)
  ['caravel', 'navtable', true],
  ['caravel', 'cargo', true],
  ['colonies', 'tradecart', true],
  ['fireworks', 'fireworks', true],
  ['potato', 'potatoes', true],
  ['potato', 'maize', true],
  ['banking', 'bankchest', true],
  ['newspaper', 'newspress', true],
  ['telescope', 'telescope', true],
  ['telescope', 'glassfurn', true],
  ['coffeehouse', 'coffee', true],
  ['microscope', 'microscope', true],
  ['microscope', 'apothecary', true],
  ['palace', 'bfountain', true],
  ['palace', 'sedan', true],
  ['academy', 'globe', true],
  ['academy', 'pclock', true],
  // industrial age (sheets BL-BO)
  ['steam_engine', 'steamengine', true],
  ['steam_engine', 'coalcart', true],
  ['balloon', 'balloon0', true],
  ['factory', 'powerloom', true],
  ['factory', 'girders', true],
  ['factory', 'gaslamp', true],
  ['vaccine', 'docbag', true],
  ['railway', 'loco0', true],
  ['railway', 'carriage', true],
  ['railway', 'signal', true],
  ['school', 'bench', true],
  ['telegraph', 'telegraph', true],
  ['photography', 'camera', true],
  ['fertilizer', 'tractor', true],
  ['fertilizer', 'churns', true],
  ['sewer', 'pump', true],
  ['electricity', 'bulbs', true],
  ['automobile', 'motorcar', true],
  ['radio', 'gramophone', true],
  // information age (sheets CE-CF)
  ['computer', 'pcdesk', true],
  ['computer', 'trafficlight', true],
  ['computer', 'busstop', true],
  ['computer', 'postbox', true],
  ['computer', 'parkbench2', true],
  ['television', 'tvset', true],
  ['television', 'satdish', true],
  ['school', 'playground', true],
  ['jet', 'vending', true],
  ['green_revolution', 'recycling', true],
  ['microchip', 'scooter', true],
  ['mobile_phone', 'phonebox', true],
  ['internet', 'kiosk', true],
  ['solar_power', 'solarpanel', true],
  ['solar_power', 'windturbine', true],
  ['electric_car', 'charger', true],
  // space age (sheet CL)
  ['moon_base', 'spacesuit', true],
  ['moon_base', 'scope2', true],
  ['moon_base', 'futlamp', true],
  ['moon_base', 'wavebench', true],
  ['vertical_farm', 'hydrocrate', true],
  ['vertical_farm', 'gardendome', true],
  ['vertical_farm', 'planttower', true],
  ['maglev', 'chargepad', true],
  ['fusion', 'watertank', true],
  ['ai', 'robodog', true],
  ['ai', 'drone', true],
  ['ai', 'gardenbot', true],
  ['rewilding', 'airpillar', true],
  ['rewilding', 'solartree', true],
  ['flying_car', 'hoverscooter', true],
  ['mars_colony', 'rover', true],
];
/** what the space age replaces: the things of the information age */
const SPACE_DROPS = new Set(['pcdesk', 'trafficlight', 'busstop', 'postbox', 'parkbench2', 'tvset', 'satdish', 'vending', 'recycling', 'scooter', 'phonebox', 'kiosk', 'solarpanel', 'windturbine', 'charger', 'tractor']);
/** what the information age replaces: steam engines, gas lamps, gramophones and the first motor cars */
const MODERN_DROPS = new Set(['steamengine', 'coalcart', 'balloon0', 'powerloom', 'girders', 'gaslamp', 'docbag', 'loco0', 'carriage', 'signal', 'bench', 'telegraph', 'camera', 'churns', 'pump', 'bulbs', 'motorcar', 'gramophone', 'globe', 'telescope', 'microscope', 'bfountain']);
/** what the industrial age replaces: the early modern workshops, carts and chairs */
const INDUSTRIAL_DROPS = new Set(['navtable', 'cargo', 'tradecart', 'glassfurn', 'newspress', 'sedan', 'pclock', 'coffee', 'bankchest', 'apothecary', 'potatoes', 'maize', 'mwell', 'spinwheel', 'guildsign', 'bell', 'clocktower', 'markethall', 'inn']);
/** what the early modern age replaces: the knights' things, the old crafts and the cog */
const EARLY_DROPS = new Set(['hplough', 'quintain', 'warhorse', 'tourney', 'farrier', 'papervat', 'lectern', 'haycart', 'barrow', 'cog', 'compass', 'tannery', 'brewery', 'printpress']);
const STAR_SWAPS: Record<string, string> = { tower: 'sfbastion', itower: 'sfbastion', ctower: 'sfbastion', gate: 'sfgate', igate: 'sfgate', cgate: 'sfgate' };
/** what the middle ages replace: the iron age workshop and the ancient market go */
const MEDIEVAL_DROPS = new Set(['charcoal', 'bloomery', 'mint', 'stele', 'amphorae', 'press', 'herbtable', 'market', 'stall', 'cartfull', 'scrolls', 'statue', 'milestone']);
const CASTLE_SWAPS: Record<string, string> = { tower: 'ctower', gate: 'cgate', itower: 'ctower', igate: 'cgate' };
/** what iron replaces: the bronze workshop goes, the walls get battlements */
const IRON_DROPS = new Set(['ore', 'furnace', 'mould', 'anvil', 'toolrack', 'tablets']);
const IRON_SWAPS: Record<string, string> = { tower: 'itower', gate: 'igate' };
/** ?walls in the address draws the walls as plain lines before their pictures exist (for testing) */
const WALL_DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('walls');
const WALL_PROPS = new Set(['tower', 'gate', 'itower', 'igate', 'ctower', 'cgate', 'sfbastion', 'sfgate']);

export class CampSprite {
  r: WorldRenderer;
  c = new Container();
  label: Text;
  glow: Sprite;
  hearth: Sprite;
  homes: Container = new Container();
  fields: Container = new Container();
  /** trampled earth, one tile at a time so it follows the ground (sheet AM) */
  trodden: Container = new Container();
  troddenKey = '';
  ground: Sprite;
  banner = new Container();
  bannerCloth: Sprite;
  symbol: Sprite;
  tag = new Container();
  tagBg = new Graphics();
  tagText = '';
  id: number;
  key = '';
  fieldKey = '';
  /** the tiles its fields lie on, for the farmers to work */
  fieldTiles: [number, number][] = [];
  pos = { x: 0, y: 0 };
  tx = 0;
  ty = 0;
  settled = false;
  hasFire = false;
  fireFrame = -1;
  homeCount = 0;
  /** what the band sleeps in: at night the people go inside */
  dwelling: BandView['dwelling'] = 'none';
  building: { s: Sprite; base: string; t0: number; flip: boolean }[] = [];
  ship: Sprite | null = null;
  /** Mars: the landing pad and the rocket that comes and goes on it */
  rocket: Sprite | null = null;
  /** how far the town reaches, in tiles (0 for a village or a camp) */
  townR = 0;
  shipKind = 'galleon';

  constructor(r: WorldRenderer, b: BandView) {
    this.r = r;
    this.id = b.id;
    const A = r.atlas;
    this.glow = new Sprite(r.tex.glow);
    this.glow.anchor.set(0.5);
    this.label = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fill: 0xffffff, stroke: { color: 0x000000, width: 3 }, fontWeight: '600' },
      resolution: 2,
    });
    this.label.anchor.set(0.5, 1);
    // worn ground, a stone hearth and a banner in the colour of the band: easy to spot even without fire
    this.ground = new Sprite(r.tex.ground);
    this.ground.anchor.set(0.5);
    this.ground.y = 3;
    this.hearth = A.sprite('hearth0');
    this.hearth.y = 2;
    const pole = A.sprite('banner');
    this.bannerCloth = A.sprite('banner_c');
    this.symbol = A.sprite(`sym${bandSymbol(b.name, b.id)}`);
    const bh = A.frames.banner.h * A.scale('banner');
    this.symbol.scale.set(4.6 / A.frames.sym0.w);
    this.symbol.position.set(0, -bh * 0.5);
    this.symbol.tint = 0x1c140c;
    this.symbol.alpha = 0.85;
    this.banner.addChild(pole, this.bannerCloth, this.symbol);
    this.banner.position.set(-13, 0);
    this.homes.sortableChildren = true;
    this.ground.visible = false;
    this.c.addChild(this.ground, this.trodden, this.fields, this.homes);
    this.homes.addChild(this.hearth, this.banner);
    this.hearth.zIndex = 2;
    this.banner.zIndex = 0;
    r.campLayer.addChild(this.c);
    r.glowLayer.addChild(this.glow);
    this.tag.addChild(this.tagBg, this.label);
    r.labelLayer.addChild(this.tag);
  }

  /** where something placed (ox, oy) pixels from the camp centre really stands: on the ground of its own tile.
   * null where that tile is water, a river or a step of more than one level from the camp (it would hang in the air) */
  private spot(ox: number, oy: number): { x: number; y: number } | null {
    const a = ox / (TW / 2), c = oy / (TH / 2);
    const fx = this.tx + (a + c) / 2, fy = this.ty + (c - a) / 2;
    const xi = Math.round(fx), yi = Math.round(fy);
    if (!this.r.walkable(xi, yi)) return null;
    if (Math.abs(this.r.levelAt(xi, yi) - this.r.levelAt(this.tx, this.ty)) > 1) return null;
    const p = this.r.tileTop(fx, fy);
    return { x: p.x - this.pos.x, y: p.y - this.pos.y };
  }

  /** the town's own tiles within R steps, nearest first (not the middle one, where the fire is) */
  private townTiles(R: number): [number, number][] {
    const bx = Math.round(this.tx), by = Math.round(this.ty);
    const L0 = this.r.levelAt(bx, by);
    const out: [number, number, number][] = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 0.5 || d > R + 0.4) continue;
      // two streets cross at the fire: no buildings on them
      if ((dx === 0 || dy === 0) && d >= 1.5) continue;
      const x = bx + dx, y = by + dy;
      if (!this.r.walkable(x, y) || Math.abs(this.r.levelAt(x, y) - L0) > 1) continue;
      out.push([x, y, d + hash(x, y + 77) * 0.4]);
    }
    return out.sort((p, q) => p[2] - q[2]).map(([x, y]) => [x, y]);
  }

  private tileSpot([x, y]: [number, number]): { x: number; y: number } {
    const p = this.r.tileTop(x, y);
    return { x: p.x - this.pos.x, y: p.y - this.pos.y };
  }

  /** the wall round a village or town: which kind (by the age) and how far out, or none */
  private wallPlan(b: BandView, techs: Set<string>, town: boolean): { kit: string; R: number } | null {
    if (this.r.mars || !b.settled || (b.dwelling !== 'hut' && b.dwelling !== 'house')) return null;
    const kit = techs.has('computer') ? 'DI' : techs.has('steam_engine') ? 'DH' : techs.has('star_fort') ? 'DG' : techs.has('castle') ? 'DF' : techs.has('walls') ? 'DE' : 'DD';
    if (!this.r.atlas.has(`wall${kit}r0`) && !WALL_DEBUG) return null; // that age's wall is not drawn yet
    return { kit, R: town ? this.townR : 2 };
  }

  /** the tiles inside the wall: as far as the town reaches, on dry land not much higher or lower than the fire */
  inside(R: number): Set<string> {
    const bx = Math.round(this.tx), by = Math.round(this.ty);
    const L0 = this.r.levelAt(bx, by);
    const F = new Set<string>();
    for (let dy = -R - 1; dy <= R + 1; dy++) for (let dx = -R - 1; dx <= R + 1; dx++) {
      if (Math.hypot(dx, dy) > R + 0.4) continue;
      const x = bx + dx, y = by + dy;
      if (dx || dy) { if (!this.r.walkable(x, y) || Math.abs(this.r.levelAt(x, y) - L0) > 1) continue; }
      F.add(`${x},${y}`);
    }
    return F;
  }

  /** wall pieces along every outer edge of the tiles inside, a gate where the two streets go out, a tower on every corner */
  private buildWall(kit: string, R: number) {
    const A = this.r.atlas;
    const bx = Math.round(this.tx), by = Math.round(this.ty);
    const F = this.inside(R);
    const corners = new Map<string, { x: number; y: number; L: number; r: boolean; l: boolean }>();
    const corner = (x: number, y: number, L: number, dir: 'r' | 'l') => {
      const k = `${x},${y}`;
      const c = corners.get(k) ?? { x, y, L, r: false, l: false };
      c[dir] = true;
      c.L = Math.max(c.L, L);
      corners.set(k, c);
    };
    const put = (name: string, x: number, y: number, L: number, z = 0) => {
      const p = iso(x, y);
      const px = p.x - this.pos.x, py = p.y - this.r.surfaceAt(x + 0.5, y + 0.5) * ELEV + TH / 2 - this.pos.y;
      if (WALL_DEBUG && !A.has(name)) {
        const g = new Graphics();
        if (name.includes('tower')) g.circle(0, -4, 3).fill(0xd8c8a0);
        else {
          const [ax, ay] = name.includes('r') && !name.includes('tower') && /r\d?$/.test(name) ? [TW / 4, -TH / 4] : [TW / 4, TH / 4];
          g.moveTo(-ax, -ay).lineTo(ax, ay).stroke({ color: name.startsWith('gate') ? 0x6a4020 : 0xd8c8a0, width: 3 });
        }
        g.position.set(px, py);
        g.zIndex = py + z;
        this.homes.addChild(g);
        return;
      }
      if (!A.has(name)) return;
      const s = A.sprite(name);
      s.position.set(px, py);
      s.zIndex = py + z;
      this.homes.addChild(s);
    };
    for (const k of F) {
      const [x, y] = k.split(',').map(Number);
      const L = this.r.levelAt(x, y);
      // the edge towards x+1 / x-1 runs from lower left to upper right on screen ("r"); towards y+1 / y-1 the other way ("l")
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (F.has(`${x + dx},${y + dy}`)) continue;
        const mx = x + dx / 2, my = y + dy / 2;
        const dir: 'r' | 'l' = dx ? 'r' : 'l';
        const gate = (dx && y === by) || (dy && x === bx);
        const v = Math.floor(hash(Math.round(mx * 2), Math.round(my * 2) + 5) * 2);
        put(gate ? `gate${kit}${dir}` : `wall${kit}${dir}${v}`, mx, my, L);
        if (dx) { corner(mx, my - 0.5, L, dir); corner(mx, my + 0.5, L, dir); }
        else { corner(mx - 0.5, my, L, dir); corner(mx + 0.5, my, L, dir); }
      }
    }
    // a tower where the wall turns, so the pieces meet cleanly
    for (const c of corners.values()) if (c.r && c.l) put(hash(Math.round(c.x * 2), Math.round(c.y * 2)) < 0.7 ? `tower${kit}` : `tower${kit}s`, c.x, c.y, c.L, 0.5);
  }

  /** the first good spot on a ring: the wanted one, then closer in, then a little to the side */
  private ringSpot(a: number, rad: number): { x: number; y: number } | null {
    for (const [k, da] of [[1, 0], [0.7, 0], [1, 0.35], [1, -0.35], [0.45, 0], [0.7, 0.6], [0.7, -0.6]]) {
      const q = this.spot(Math.cos(a + da) * rad * k, Math.sin(a + da) * rad * k * 0.5 + 2);
      if (q) return q;
    }
    return null;
  }

  update(b: BandView, kids: boolean) {
    this.dwelling = b.dwelling;
    const p = this.r.tileTop(b.x, b.y);
    this.pos = p;
    this.tx = b.x;
    this.ty = b.y;
    this.settled = b.settled;
    this.hasFire = b.hasFire && !this.r.mars; // no open fire under the thin Martian air
    this.hearth.visible = !this.r.mars;
    this.c.position.set(p.x, p.y);
    this.glow.position.set(p.x, p.y - 4);
    this.glow.visible = b.hasFire || b.dwelling === 'house';
    const shown = shortNum(b.size * this.r.popScale, LANG);
    this.label.text = b.settlementName ? `${b.kingdom?.capital ? '👑 ' : ''}${VILLAGE(b.settlementName)} (${shown})` : `${B(b.name).replace(/^(Родът на|Clan of the) /, '')} (${shown})`;
    this.label.style.fontSize = kids ? 16 : 12;
    this.bannerCloth.tint = b.color;
    this.tag.position.set(p.x, p.y - 30);
    // a kingdom: all its towns get a thicker striped rim in its colour (the capital also has the crown)
    const rim = b.kingdom ? b.kingdom.color : b.color;
    const realm = !!b.kingdom;
    const tagKey = `${this.label.text}|${rim}|${realm}`;
    if (tagKey !== this.tagText) {
      this.tagText = tagKey;
      const w = this.label.width + 14, h = this.label.height + 4;
      this.tagBg.clear()
        .roundRect(-w / 2, -h, w, h, h / 2).fill({ color: 0x101626, alpha: 0.78 })
        .roundRect(-w / 2, -h, w, h, h / 2).stroke({ color: rim, width: realm ? 3 : 2 })
        .poly([-4, 0, 4, 0, 0, 5]).fill(rim);
      if (realm) stripes(this.tagBg, w, h);
      this.label.position.set(0, -2);
    }
    this.updateTrodden(b);
    let n = Math.max(1, Math.min(10, Math.round(b.size / (b.dwelling === 'house' ? 6 : 5))));
    const techs = new Set(b.techIds ?? b.techs);
    let props = PROPS.filter(([tech, sp, settled]) => techs.has(tech) && (settled === null || settled === b.settled) && this.r.atlas.has(sp)).map(([, s]) => s);
    // a big village keeps only its newest things around it (later techs are later in the list)
    const iron = techs.has('iron') && this.r.atlas.has('villab3');
    if (iron) props = props.filter((p) => !IRON_DROPS.has(p)).map((p) => IRON_SWAPS[p] ?? p);
    const medieval = techs.has('heavy_plough') && this.r.atlas.has('timberb3');
    if (medieval) props = props.filter((p) => !MEDIEVAL_DROPS.has(p));
    if (medieval && techs.has('castle')) props = props.map((p) => CASTLE_SWAPS[p] ?? p);
    const early = medieval && techs.has('caravel') && this.r.atlas.has('brickb3');
    if (early) props = props.filter((p) => !EARLY_DROPS.has(p));
    if (early && techs.has('star_fort')) props = props.map((p) => STAR_SWAPS[p] ?? p);
    const industrial = early && techs.has('steam_engine') && this.r.atlas.has('flatsb3');
    if (industrial) props = props.filter((p) => !INDUSTRIAL_DROPS.has(p));
    const modern = industrial && techs.has('computer') && this.r.atlas.has('blockb3');
    if (modern) props = props.filter((p) => !MODERN_DROPS.has(p));
    const space = modern && techs.has('moon_base') && this.r.atlas.has('ecob3');
    if (space) props = props.filter((p) => !SPACE_DROPS.has(p));
    // a young colony over the sea: a wooden fort, log cabins, the flag and a jetty
    const colony = !!b.colony && b.dwelling === 'house' && b.size < 80 && this.r.atlas.has('logcabin') && !this.r.mars;
    // Mars: no Earth things at all, only the machines and gardens of a colony
    const mars = this.r.mars && this.r.atlas.has('mdomeb3');
    if (mars) props = MARS_PROPS.filter((_, k) => k < 4 + Math.floor(b.size / 40));
    if (colony) props = ['colflag', 'jetty', ...props.filter((p) => !WALL_PROPS.has(p))];
    // the walls always stay; of the rest only the newest things (later techs are later in the list)
    const walls = props.filter((p) => WALL_PROPS.has(p));
    const rest = props.filter((p) => !WALL_PROPS.has(p));
    props = [...walls, ...rest.slice(-(12 - walls.length))];
    // walls make a village a town: stone houses, and a temple once it keeps a calendar
    const town = b.dwelling === 'house' && techs.has('walls') && !b.isle && this.r.atlas.has('townb3');
    // a town spreads out as it grows: every building on its own tile, the things around it further out
    const tiles = town ? this.townTiles(Math.max(2, Math.min(5, 2 + Math.floor(b.size / 150)))) : [];
    this.townR = town ? Math.max(2, Math.min(5, 2 + Math.floor(b.size / 150))) : 0;
    if (town) n = Math.max(4, Math.min(tiles.length - Math.min(props.length, Math.floor(tiles.length / 3)), Math.round(b.size / 22)));
    this.updateFields(b);
    // iron age towns: courtyard houses, the king's palace in a capital, a theatre and a school
    const capital = !!b.kingdom?.capital;
    const cold = this.r.tempAt(b.x, b.y) < 0.35;
    const tkind = `${b.dwelling}${town ? 'T' : ''}${town && iron ? `I${capital ? 'K' : ''}${techs.has('theatre') ? 'h' : ''}${techs.has('library') ? 'l' : ''}` : ''}`
      + `${town && medieval ? `M${techs.has('castle') ? 'c' : ''}${techs.has('gothic') ? 'g' : ''}${techs.has('monastery') ? 'm' : ''}` : ''}`
      + `${town && space ? `S${['railway', 'fusion', 'vertical_farm', 'space_elevator', 'flying_car', 'maglev'].map((t) => (techs.has(t) ? t[0] : '')).join('')}` : ''}`
      + `${town && modern ? `N${['jet', 'television', 'nuclear_power', 'rocket', 'automobile', 'school'].map((t) => (techs.has(t) ? t[0] : '')).join('')}${b.size > 300 ? 'B' : ''}` : ''}`
      + `${town && industrial ? `X${['factory', 'railway', 'school', 'vaccine', 'electricity', 'academy', 'theatre'].map((t) => (techs.has(t) ? t[0] : '')).join('')}` : ''}`
      + `${town && early ? `E${['palace', 'telescope', 'banking', 'coffeehouse', 'newspaper', 'post'].map((t) => (techs.has(t) ? t[0] : '')).join('')}` : ''}${colony ? 'C' : ''}`;
    const wall = this.wallPlan(b, techs, town);
    const key = `${tkind}:${n}:${b.settled}:${cold}:${props.join(',')}:${Math.round(b.x)},${Math.round(b.y)}:${wall?.kit ?? ''}${wall?.R ?? ''}`;
    if (key === this.key) return;
    // homes added since last time are built in four steps; the first look at a camp shows it finished
    const sameKind = this.key.split(':')[0] === tkind && this.key !== '';
    const builtBefore = sameKind ? this.homeCount : n;
    this.homeCount = n;
    this.key = key;
    const A = this.r.atlas;
    this.building = [];
    this.rocket = null;
    this.rocketY = NaN;
    for (const ch of [...this.homes.children]) {
      if (ch !== this.hearth && ch !== this.banner) ch.destroy();
    }
    for (let k = 0; k < n; k++) {
      const h = hash(this.id, k + 40);
      let name: string;
      if (mars) {
        // a big glass dome in the middle, round it small living domes, the greenhouse, the lab, the landing pad...
        const big = b.size > 120 || capital;
        name = k === 0 ? (big ? 'bigdomeb3' : 'mdomeb3') : (MARS_BUILDINGS[k - 1] ?? (h < 0.7 ? 'mdomeb3' : h < 0.85 ? 'mgreenhouse' : 'mstore'));
      } else switch (b.dwelling) {
        case 'none': name = 'furbed'; break;
        case 'tent': name = cold && h < 0.5 ? 'bonehut' : h < 0.2 ? 'leanto' : `tent${k % 2}`; break;
        case 'hut': name = A.has('hutb3') ? 'hutb3' : 'roundhut'; break;
        default:
          if (colony) name = k === 0 ? 'colfort' : 'logcabin';
          else if (town && space) {
            // terraced green houses and towers full of gardens round the spaceport, the observatory and the vertical farm
            const big = b.size > 300;
            if (k === 0) name = capital || big ? 'arcob3' : 'ecob3';
            else if (k === 1) name = 'glassmarket2';
            else if (k === 2 && techs.has('railway')) name = 'maglevstation';
            else if (k === 3) name = 'school3';
            else if (k === 4) name = 'medcenter';
            else if (k === 5) name = techs.has('fusion') ? 'fusion' : 'windtower';
            else if (k === 6) name = 'observatory2';
            else if (k === 7) name = 'spacemuseum';
            else if (k === 8) name = capital || big ? 'spaceportb3' : 'park2';
            else if (k === 9 && techs.has('vertical_farm')) name = 'vfarm';
            else if (k === 10) name = techs.has('space_elevator') && capital ? 'elevator' : 'robotshop';
            else if (k === 11) name = 'cafe3';
            else if (k === 12 && techs.has('flying_car')) name = 'skyport';
            else if (k === 13) name = 'starmonument';
            else if (k === 14) name = 'park2';
            else if (k === 15 && capital) name = 'rocketpad';
            else name = h < 0.4 ? 'ecob3' : h < 0.65 ? 'roundhouse' : h < 0.8 ? 'domehouse' : big && h < 0.9 ? 'arcob3' : 'windtower';
          } else if (town && modern) {
            // apartment blocks, offices and glass towers round the hospital, the school, the cinema and the station
            const big = b.size > 300;
            if (k === 0) name = capital || big ? 'skyscraperb3' : 'office';
            else if (k === 1) name = 'supermarket';
            else if (k === 2 && techs.has('railway')) name = 'stationb3';
            else if (k === 3 && techs.has('school')) name = 'school2';
            else if (k === 4) name = 'hospital2';
            else if (k === 5) name = techs.has('nuclear_power') && h < 0.5 ? 'nuclear' : 'powerplant';
            else if (k === 6 && techs.has('television')) name = 'cinema';
            else if (k === 7) name = 'library';
            else if (k === 8 && big) name = 'stadium';
            else if (k === 9) name = techs.has('jet') && (capital || big) ? 'airportb3' : 'firestation2';
            else if (k === 10 && techs.has('television')) name = 'tvtower';
            else if (k === 11) name = 'cafe2';
            else if (k === 12 && techs.has('automobile')) name = 'petrol';
            else if (k === 13) name = 'park';
            else if (k === 14 && techs.has('rocket') && capital) name = 'launchpad';
            else if (k === 15 && techs.has('solar_power')) name = 'solarfarm';
            else if (k === 16 && techs.has('rocket')) name = 'radioscope';
            else name = h < 0.45 ? 'blockb3' : h < 0.7 ? 'house2' : h < 0.8 ? 'office' : big && h < 0.9 ? 'skyscraperb3' : 'flatsb3';
          } else if (town && industrial) {
            // brick flats and villas round the factory, the station, the school and the hospital
            if (k === 0) name = capital && techs.has('palace') ? 'baroqueb3' : 'postoffice';
            else if (k === 1 && techs.has('factory')) name = 'factoryb3';
            else if (k === 2 && techs.has('railway')) name = 'stationb3';
            else if (k === 3 && techs.has('school')) name = 'schoolhouse';
            else if (k === 4 && (techs.has('vaccine') || techs.has('antibiotics'))) name = 'hospital';
            else if (k === 5 && techs.has('electricity')) name = 'powerplant';
            else if (k === 6) name = 'brickchurch';
            else if (k === 7) name = 'store';
            else if (k === 8 && techs.has('academy')) name = 'museum';
            else if (k === 9 && techs.has('theatre')) name = 'theatre2';
            else name = h < 0.4 ? 'flatsb3' : h < 0.7 ? 'villa' : h < 0.85 ? 'brickb3' : 'timberb3';
          } else if (town && early) {
            // brick gable houses round the palace (in a capital), the observatory, the bank, the coffee house and the printers
            if (k === 0) name = capital && techs.has('palace') ? 'baroqueb3' : techs.has('castle') ? 'keepb3' : 'villab3';
            else if (k === 1) name = techs.has('gothic') ? 'churchb3' : 'brickb3';
            else if (k === 2 && techs.has('telescope')) name = 'observb3';
            else if (k === 3 && techs.has('banking')) name = 'bank';
            else if (k === 4 && techs.has('coffeehouse')) name = 'coffeehouse';
            else if (k === 5 && techs.has('newspaper')) name = 'printhouse';
            else if (k === 6) name = capital && techs.has('palace') ? 'opera' : techs.has('post') ? 'townhall' : 'clockshop';
            else if (k === 7 && this.harbourSpot(b)) name = 'bwarehouse';
            else name = h < 0.6 ? 'brickb3' : h < 0.85 ? 'timberb3' : 'villab3';
          } else if (town && medieval) {
            // the lord's castle (or the king's palace), the church, the monastery, half-timbered houses
            if (k === 0) name = techs.has('castle') ? 'keepb3' : capital ? 'palaceb3' : 'villab3';
            else if (k === 1) name = techs.has('gothic') ? 'churchb3' : techs.has('calendar') ? 'templeb3' : 'timberb3';
            else if (k === 2 && techs.has('monastery')) name = 'abbeyb3';
            else if (k === 3 && techs.has('university')) name = 'schoolb3';
            else name = h < 0.65 ? 'timberb3' : 'villab3';
          } else if (town && iron) {
            if (k === 0) name = capital ? 'palaceb3' : techs.has('calendar') ? 'templeb3' : 'villab3';
            else if (k === 1 && techs.has('theatre')) name = 'theatreb3';
            else if (k === 2 && techs.has('library')) name = 'schoolb3';
            else name = h < 0.55 ? 'villab3' : 'townb3';
          } else if (town) name = k === 0 && techs.has('calendar') && A.has('templeb3') ? 'templeb3' : 'townb3';
          else name = k % 3 === 2 ? 'longhouse' : A.has('houseb3') ? 'houseb3' : 'house';
      }
      const a = (k / n) * Math.PI * 2 + 0.6;
      const rad = (b.dwelling === 'house' ? 26 : 19) + (k % 2) * 7;
      const q = town ? (tiles[k] ? this.tileSpot(tiles[k]) : null) : this.ringSpot(a, rad);
      if (!q) continue;
      const s = A.sprite(name);
      if (h < 0.5) s.scale.x *= -1;
      s.position.set(q.x, q.y);
      s.zIndex = s.y;
      this.homes.addChild(s);
      if (name === 'mpad' && A.has('rocketup0')) {
        const rk = A.sprite('rocketdown3');
        rk.position.set(q.x, q.y - 2);
        rk.zIndex = s.y + 0.5;
        this.homes.addChild(rk);
        this.rocket = rk;
      }
      if (k >= builtBefore && /^(hut|house|town|temple|villa|palace|theatre|school|keep|church|timber|abbey|baroque|observ|brick|flats|factory|station|skyscraper|airport|block|arco|spaceport|eco|mdome|bigdome)b3$/.test(name)) {
        this.building.push({ s, base: name.slice(0, -1), t0: Date.now(), flip: s.scale.x < 0 });
        A.set(s, `${name.slice(0, -1)}0`);
        if (h < 0.5) s.scale.x *= -1;
      }
    }
    // camp props in an outer ring
    props.forEach((name, k) => {
      const a = (k / Math.max(5, props.length)) * Math.PI * 2 + 2.1;
      const rad = (b.dwelling === 'house' ? 40 : 32) + (k % 2) * 5;
      const q = town && tiles[n + k] ? this.tileSpot(tiles[n + k]) : this.ringSpot(a, town ? (this.townR + 0.6) * TW * 0.7 : rad);
      if (!q) return;
      const s = A.sprite(name);
      s.position.set(q.x, q.y);
      s.zIndex = s.y;
      this.homes.addChild(s);
    });
    if (wall) this.buildWall(wall.kit, wall.R);
    // an ocean ship rocks on the water next to a harbour town
    this.ship = null;
    const sea = techs.has('caravel') && b.settled && A.has('galleon0') ? this.harbourSpot(b) : null;
    this.shipKind = techs.has('computer') && A.has('containership') ? 'containership' : techs.has('steamship') && A.has('steamer0') ? 'steamer' : 'galleon';
    if (sea) {
      const s = A.sprite(`${this.shipKind}0`);
      const p = this.r.tileTop(sea.x, sea.y);
      s.position.set(p.x - this.pos.x, p.y - this.pos.y);
      s.zIndex = s.y;
      this.homes.addChild(s);
      this.ship = s;
    }
    this.banner.zIndex = this.banner.y;
  }

  /** open water close to the town: a sea tile 2 to 5 steps away */
  private harbourSpot(b: BandView): { x: number; y: number } | null {
    const bx = Math.round(b.x), by = Math.round(b.y);
    for (let r = 2; r <= 5; r++) {
      for (const [dx, dy] of [[r, 0], [0, r], [r, r], [-r, r], [r, -r], [-r, 0], [0, -r], [-r, -r]]) {
        if (this.r.isSea(bx + dx, by + dy)) return { x: bx + dx, y: by + dy };
      }
    }
    return null;
  }

  /** the trampled ground of the camp: the middle fully worn, the edge fading into the grass */
  private updateTrodden(b: BandView) {
    const A = this.r.atlas;
    if (!A.has('trod0_t')) return;
    const bx = Math.round(b.x), by = Math.round(b.y);
    const R = b.settled ? 2 : 1;
    const key = `${bx}:${by}:${R}`;
    if (key === this.troddenKey) return;
    this.troddenKey = key;
    this.trodden.removeChildren().forEach((c) => c.destroy());
    const L0 = this.r.levelAt(bx, by);
    const tiles: [number, number, number][] = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d > R + (R > 1 ? 1 : 0)) continue;
      const x = bx + dx, y = by + dy;
      if (!this.r.walkable(x, y)) continue;
      const L = this.r.levelAt(x, y);
      if (Math.abs(L - L0) > 1) continue;
      // a tile hidden behind a higher one in front would show over its edge
      if (this.r.levelAt(x + 1, y) > L || this.r.levelAt(x, y + 1) > L) continue;
      tiles.push([x, y, d]);
    }
    tiles.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
    for (const [x, y, d] of tiles) {
      const s = A.sprite(`trod${Math.floor(hash(x + 7, y + 3) * 16)}_t`);
      const p = this.r.tileTop(x, y);
      s.position.set(p.x - this.pos.x, p.y - this.pos.y);
      s.alpha = d === 0 ? 1 : d < R ? 0.9 : 0.6;
      this.trodden.addChild(s);
    }
  }

  /** farmed tiles around a village: soil in spring, wheat in summer, stubble after the harvest */
  private updateFields(b: BandView) {
    const m = this.r.month;
    const count = b.settled && !this.r.mars && (b.techIds ?? b.techs).includes('agriculture') ? Math.min(10, 2 + Math.floor(b.size / 10)) : 0;
    // ploughed in early spring, sprouts, tall wheat in summer, stubble and sheaves after the harvest
    const stage = m >= 2 && m <= 3 ? 0 : m <= 5 && m >= 4 ? 1 : m >= 6 && m <= 8 ? 2 : m >= 9 && m <= 10 ? 3 : 0;
    const bx = Math.round(b.x), by = Math.round(b.y);
    const fkey = `${bx}:${by}:${count}:${stage}:${this.townR}`;
    if (fkey === this.fieldKey) return;
    this.fieldKey = fkey;
    this.fields.removeChildren().forEach((c) => c.destroy());
    this.fieldTiles = [];
    if (!count) return;
    const A = this.r.atlas;
    const off = this.townR ? this.townR + 1 : 3;
    // the nearest tiles outside the wall first, in a fixed order, so the fields stay where they are
    const ring: [number, number][] = [];
    for (let dy = -off - 3; dy <= off + 3; dy++) for (let dx = -off - 3; dx <= off + 3; dx++) {
      const d = Math.hypot(dx, dy);
      if (d >= off - 0.5 && d <= off + 3) ring.push([dx, dy]);
    }
    ring.sort((a, c) => Math.hypot(a[0], a[1]) + hash(bx + a[0], by + a[1]) * 0.8 - Math.hypot(c[0], c[1]) - hash(bx + c[0], by + c[1]) * 0.8);
    let placed = 0;
    for (const [dx, dy] of ring) {
      if (placed >= count) break;
      const x = bx + dx, y = by + dy;
      if (!this.r.walkable(x, y)) continue;
      if (Math.hypot(dx, dy) <= (this.townR || 2) + 0.4) continue; // the fields lie outside the wall
      const L = this.r.levelAt(x, y);
      if (Math.abs(L - this.r.levelAt(bx, by)) > 1 || this.r.levelAt(x + 1, y) > L || this.r.levelAt(x, y + 1) > L) continue;
      const h = hash(x, y + 101);
      const name = this.r.atlas.has(`field${stage}_t`) ? `field${stage}`
        : stage === 2 ? `wheat${Math.floor(h * 4)}` : stage === 1 ? `soil${2 + Math.floor(h * 2)}` : `soil${Math.floor(h * 2)}`;
      const s = A.sprite(name + '_t');
      const p = this.r.tileTop(x, y);
      s.position.set(p.x - this.pos.x, p.y - this.pos.y);
      this.fields.addChild(s);
      this.fieldTiles.push([x, y]);
      placed++;
    }
    // fields drawn back to front
    this.fields.children.sort((a, c) => a.y - c.y);
  }

  frame(now: number, zoom: number) {
    // homes going up: stakes, walls, roof frame, finished (about 15 s for each step)
    if (this.building.length) {
      this.building = this.building.filter((bd) => {
        if (bd.s.destroyed) return false;
        const st = Math.min(3, Math.floor((now - bd.t0) / 15000));
        this.r.atlas.set(bd.s, `${bd.base}${st}`);
        if (bd.flip) bd.s.scale.x *= -1;
        return st < 3;
      });
    }
    if (this.rocket && !this.rocket.destroyed) this.flyRocket(now);
    if (this.ship && !this.ship.destroyed && this.shipKind !== 'containership') this.r.atlas.set(this.ship, `${this.shipKind}${Math.floor(now / 400 + this.id) % 4}`);
    const frameNo = this.hasFire ? 1 + (Math.floor(now / 130 + this.id * 7) % 3) : 0;
    if (frameNo !== this.fireFrame) {
      this.fireFrame = frameNo;
      this.r.atlas.set(this.hearth, `hearth${frameNo}`);
    }
    if (this.hasFire) this.glow.scale.set(0.95 + Math.sin(now / 90 + this.id) * 0.06);
    this.bannerCloth.skew.y = Math.sin(now / 500 + this.id) * 0.05;
    this.symbol.skew.y = this.bannerCloth.skew.y;
    this.scaleTag(zoom);
  }

  private rocketY = NaN;
  /** a rocket lands on the pad, stands a while, lifts off and is gone for a while: one round in 80 s */
  private flyRocket(now: number) {
    const rk = this.rocket!;
    if (Number.isNaN(this.rocketY)) this.rocketY = rk.y;
    const t = ((now / 1000 + this.id * 17) % 80);
    const A = this.r.atlas;
    if (t < 4) {
      const k = t / 4; // coming down, slower and slower
      A.set(rk, `rocketdown${Math.min(3, Math.floor(k * 4))}`);
      rk.visible = true;
      rk.y = this.rocketY - 90 * (1 - k) ** 2;
    } else if (t < 50) {
      A.set(rk, 'rocketdown3');
      rk.visible = true;
      rk.y = this.rocketY;
    } else if (t < 55) {
      const k = (t - 50) / 5; // the engines start, then up and away faster and faster
      A.set(rk, `rocketup${Math.min(3, Math.floor(k * 4))}`);
      rk.visible = true;
      rk.y = this.rocketY - (k < 0.4 ? 0 : 140 * ((k - 0.4) / 0.6) ** 2);
    } else rk.visible = false;
  }

  scaleTag(zoom: number) {
    this.tag.scale.set(1 / Math.max(0.3, Math.min(2, zoom)));
  }

  destroy() {
    this.c.destroy({ children: true });
    this.glow.destroy();
    this.tag.destroy({ children: true });
  }
}
