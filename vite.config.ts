import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Tek dosyalık çıktı (telefon önizlemesi için). İki sayfa ayrı derlenir:
//   vite build                 → dist/index.html          (hat simülasyonu)
//   vite build --mode yukleme  → dist-yukleme/yukleme.html (yükleme detayı, fizikli iniş)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [viteSingleFile()],
  build:
    mode === 'yukleme'
      ? { target: 'es2020', chunkSizeWarningLimit: 2000, outDir: 'dist-yukleme', rollupOptions: { input: 'yukleme.html' } }
      : { target: 'es2020', chunkSizeWarningLimit: 2000 },
  // fizik testleri tam çevrim koşturur (birkaç saniye)
  test: { environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 60000 },
}));
