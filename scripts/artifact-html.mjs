// dist/index.html (tek dosya) → dist/onizleme.html: claude.ai önizleme sayfası biçimi.
// Önizleme platformu <html>/<head>/<body> iskeletini kendisi ekliyor; burada yalnızca başlık, meta,
// yazı tipi bağlantıları, stil, gövde ve betik bırakılıyor.

import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist/index.html', 'utf8');
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
writeFileSync('dist/onizleme.html', out);
console.log(`dist/onizleme.html yazıldı (${(out.length / 1024).toFixed(0)} KB)`);
