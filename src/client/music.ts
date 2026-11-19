// Quiet background music of the age the world is in (public/music, made with Suno for the project).
// Each track loops seamlessly; a new age fades the old track out and the new one in.

const TRACKS = ['stone-age', 'stone-age', 'bronze-age', 'iron-age', 'middle-ages', 'early-modern', 'industrial', 'information-age', 'space-age'];
/** at full volume the music still stays well under the sounds of the world */
const LEVEL = 0.22;
const FADE_MS = 5000;

export class Music {
  on = false;
  volume = 0.6;
  private want = '';
  private playing: { name: string; el: HTMLAudioElement; t0: number }[] = [];
  private timer = 0;

  /** the age (0..8) or Mars */
  setEra(era: number, mars: boolean) {
    this.want = mars ? 'mars' : TRACKS[Math.max(0, Math.min(TRACKS.length - 1, era))];
    if (this.on) this.update();
  }

  start() {
    this.on = true;
    this.update();
  }

  stop() {
    this.on = false;
    this.update();
  }

  setVolume(v: number) {
    this.volume = v;
    this.update();
  }

  private update() {
    const cur = this.playing[this.playing.length - 1];
    if (this.on && this.want && cur?.name !== this.want) {
      const el = new Audio(`music/${this.want}.ogg`);
      el.loop = true;
      el.volume = 0;
      void el.play().catch(() => { /* not allowed yet: the next click starts it */ });
      this.playing.push({ name: this.want, el, t0: performance.now() });
    }
    if (!this.timer) this.timer = window.setInterval(() => this.fade(), 100);
    this.fade();
  }

  private fade() {
    const now = performance.now();
    const top = this.playing[this.playing.length - 1];
    for (const p of this.playing) {
      const target = this.on && p === top ? LEVEL * this.volume : 0;
      const step = (LEVEL / FADE_MS) * 100;
      const v = p.el.volume + Math.max(-step, Math.min(step, target - p.el.volume));
      p.el.volume = Math.max(0, Math.min(1, v));
      if (this.on && p === top && p.el.paused && now - p.t0 > 500) void p.el.play().catch(() => {});
    }
    // tracks faded out are let go; when everything is quiet the clock stops
    this.playing = this.playing.filter((p) => {
      if (p !== top && p.el.volume <= 0.001) { p.el.pause(); p.el.src = ''; return false; }
      return true;
    });
    if (!this.on && top && top.el.volume <= 0.001) top.el.pause();
    const settled = this.playing.length <= 1 && (!top || Math.abs(top.el.volume - (this.on ? LEVEL * this.volume : 0)) < 0.002);
    if (settled && this.timer) { clearInterval(this.timer); this.timer = 0; }
  }
}
