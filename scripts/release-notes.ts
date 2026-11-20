// Release notes: the English changelog of every version after the last release, up to this one.
// usage: node dist/release-notes.mjs 1.91 [1.90]
(globalThis as { localStorage?: unknown }).localStorage ??= { getItem: () => null, setItem: () => undefined };
const { CHANGELOG } = await import('../src/client/help');
const num = (v: string) => { const [a = 0, b = 0, c = 0] = v.replace(/^v/, '').split('.').map(Number); return a * 1e6 + b * 1e3 + c; };
const to = num(process.argv[2]) + 999, from = process.argv[3] ? num(process.argv[3]) : num(process.argv[2]) - 10_000;
const out: string[] = [];
for (const r of CHANGELOG) {
  const n = num(r.v);
  if (n <= from || n > to) continue;
  out.push(`## ${r.v}`, '');
  for (const it of r.items) out.push(`- ${it[3] === 'fix' ? 'Fix: ' : ''}${it[1].replace(/<[^>]+>/g, '')}`);
  out.push('');
}
console.log(out.join('\n'));
