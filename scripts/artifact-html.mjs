// Tek dosyalık derleme → claude.ai önizleme sayfası biçimi. Kullanım: node scripts/artifact-html.mjs <girdi> <çıktı>
// (varsayılan dist/index.html → dist/onizleme.html).
// Önizleme platformu <html>/<head>/<body> iskeletini kendisi ekliyor; burada yalnızca başlık, meta,
// yazı tipi bağlantıları, stil, gövde ve betik bırakılıyor.

import { readFileSync, writeFileSync } from 'node:fs';

const [inPath = 'dist/index.html', outPath = 'dist/onizleme.html'] = process.argv.slice(2);
const src = readFileSync(inPath, 'utf8');
const pick = (re) => [...src.matchAll(re)].map((m) => m[0]);

const title = pick(/<title>[\s\S]*?<\/title>/g);
const metas = pick(/<meta name="(?:claude:viewport-fit-sides|theme-color)"[^>]*>/g);
const links = pick(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.[^"]+"[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g);
const body = src.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? '';
const bodyNoScripts = body.replace(/<script[\s\S]*?<\/script>/g, '').trim();

if (!title.length || !styles.length || !scripts.length || !bodyNoScripts) {
  console.error('artifact-html: beklenen parçalar bulunamadı');
  process.exit(1);
}

const out = [...title, ...metas, ...links, ...styles, bodyNoScripts, ...scripts].join('\n');
writeFileSync(outPath, out);
console.log(`${outPath} yazıldı (${(out.length / 1024).toFixed(0)} KB)`);
