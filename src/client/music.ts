// Quiet background music of the age the world is in (public/music, made with Suno for the project).
// Every age has two songs that take turns; a new age (or the next song) fades the old one out and the new one in.

const TRACKS = ['stone-age', 'stone-age', 'bronze-age', 'iron-age', 'middle-ages', 'early-modern', 'industrial', 'information-age', 'space-age'];
/** at full volume the music still stays well under the sounds of the world */
const LEVEL = 0.22;
const FADE_MS = 5000;

export class Music {
  on = false;
  volume = 0.6;
  private want = '';
  private playing: { name: string; base: string; el: HTMLAudioElement; t0: number; handed: boolean }[] = [];
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
    if (this.on && this.want && cur?.base !== this.want) this.play(Math.random() < 0.5 ? this.want : `${this.want}1`);
    if (!this.timer) this.timer = window.setInterval(() => this.fade(), 100);
    this.fade();
  }

  private play(name: string) {
    const el = new Audio(`music/${name}.ogg`);
    el.volume = 0;
    void el.play().catch(() => { /* not allowed yet: the next click starts it */ });
    this.playing.push({ name, base: this.want, el, t0: performance.now(), handed: false });
  }

  private fade() {
    const now = performance.now();
    let top = this.playing[this.playing.length - 1];
    // a few seconds before a song ends the other song of the same age comes in
    if (this.on && top && !top.handed && top.el.duration && (top.el.ended || top.el.currentTime > top.el.duration - 6)) {
      top.handed = true;
      this.play(top.name === top.base ? `${top.base}1` : top.base);
      top = this.playing[this.playing.length - 1];
    }
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
    // while music plays the clock keeps running, to hand over to the next song in time
    if (settled && !this.on && this.timer) { clearInterval(this.timer); this.timer = 0; }
  }
}
