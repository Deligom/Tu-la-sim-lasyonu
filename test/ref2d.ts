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

/** `function name(` ile başlayan fonksiyonu süslü parantezleri sayarak tam olarak keser. */
function grabFunction(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`2D dosyasında ${name}() bulunamadı`);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${name}() kapanmıyor`);
}

export interface Ref2DSim {
  P: Record<string, unknown>;
  step(dt: number): void;
  S(): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * 2D'nin simülasyon çekirdeğini (P, geom, vcol, rowBack, mkSide, reset, tableAccepts, chooseSide, step)
 * dosyadan alıp çizim olmadan çalıştırır. reset() içindeki layout() çağrıları boş bırakılır.
 */
export function load2DSim(overrides: Record<string, unknown> = {}): Ref2DSim {
  const src = script();
  const pSrc = grab(src, /const P=\{[\s\S]*?\};/, 'P');
  const one = (re: RegExp, what: string) => grab(src, re, what);
  const parts = [
    pSrc.replace('const P=', 'var P='),
    'Object.assign(P, overrides);',
    'let G,S;',
    'function layout(){} function layout2(){}',
    grabFunction(src, 'geom'),
    one(/const vcol=[^\n]*;/, 'vcol'),
    one(/const rowBack=[^\n]*;/, 'rowBack'),
    grabFunction(src, 'mkSide'),
    grabFunction(src, 'reset'),
    grabFunction(src, 'tableAccepts'),
    grabFunction(src, 'chooseSide'),
    grabFunction(src, 'step'),
    'reset();',
    'return { P, step, S: () => S };',
  ];
  return new Function('overrides', parts.join('\n'))(overrides);
}
