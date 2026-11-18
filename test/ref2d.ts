// referans-2d-simulasyon.html içindeki kodu doğrudan dosyadan okuyup Node'da çalıştırır.
// Böylece 3D tarafı, 2D'nin bir kopyasıyla değil kendisiyle karşılaştırılır.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HTML_PATH = fileURLToPath(new URL('../referans-2d-simulasyon.html', import.meta.url));

function script(): string {
  const html = readFileSync(HTML_PATH, 'utf8');
  const a = html.indexOf('<script>');
  const b = html.lastIndexOf('</script>');
  if (a < 0 || b < 0) throw new Error('2D dosyasında <script> bulunamadı');
  return html.slice(a + '<script>'.length, b);
}

function grab(src: string, re: RegExp, what: string): string {
  const m = src.match(re);
  if (!m) throw new Error(`2D dosyasında ${what} bulunamadı`);
  return m[0];
}

export interface Ref2DGeom {
  [k: string]: unknown;
  laneY(i: number): number;
  band(s: 0 | 1): [number, number];
}

/** 2D'nin P nesnesini ve geom() fonksiyonunu döndürür. `overrides` P'ye uygulanır. */
export function load2DGeom(overrides: Record<string, unknown> = {}): { P: Record<string, unknown>; G: Ref2DGeom } {
  const src = script();
  const pSrc = grab(src, /const P=\{[\s\S]*?\};/, 'P');
  const geomSrc = grab(src, /function geom\(\)\{[\s\S]*?\n\}/, 'geom()');
  const fn = new Function(
    'overrides',
    `${pSrc.replace('const P=', 'var P=')}\nObject.assign(P, overrides);\n${geomSrc}\nreturn { P, G: geom() };`,
  );
  return fn(overrides);
}
