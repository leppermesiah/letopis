// How many people lived on the whole real Earth in a year (roughly, from the usual estimates). The world of the game
// lives with far fewer, so the page shows this number and each village its share of it.

const P: [number, number][] = [[-10000, 4e6], [-5000, 5e6], [-3000, 14e6], [-2000, 27e6], [-1000, 50e6], [-500, 100e6], [1, 200e6],
  [1000, 300e6], [1500, 450e6], [1700, 600e6], [1800, 1e9], [1900, 1.6e9], [1950, 2.5e9], [2000, 6.1e9], [2025, 8.1e9], [2100, 10.3e9]];

export function realPeople(year: number): number {
  if (year <= P[0][0]) return P[0][1];
  for (let k = 1; k < P.length; k++) if (year <= P[k][0]) {
    const [y0, a] = P[k - 1], [y1, b] = P[k];
    return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * (year - y0) / (y1 - y0));
  }
  return P[P.length - 1][1];
}

/** 1200 -> 1.2K, 3400000 -> 3.4M, 8100000000 -> 8.1B in English; хил./млн./млрд. in Bulgarian, Tsd./Mio./Mrd. in German */
export function shortNum(n: number, lang: 'bg' | 'en' | 'de' = 'en'): string {
  const r = Math.round(n);
  const u = lang === 'bg' ? ['\u00a0хил.', '\u00a0млн.', '\u00a0млрд.'] : lang === 'de' ? ['\u00a0Tsd.', '\u00a0Mio.', '\u00a0Mrd.'] : ['K', 'M', 'B'];
  const f = (x: number, s: string) => `${x >= 100 ? Math.round(x) : Math.round(x * 10) / 10}`.replace('.', lang === 'en' ? '.' : ',') + s;
  return r < 1000 ? String(r) : r < 1e6 ? f(r / 1e3, u[0]) : r < 1e9 ? f(r / 1e6, u[1]) : f(r / 1e9, u[2]);
}
