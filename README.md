# Yaş tuğla dizme hattı · 3D simülasyon

Kesiciden çıkan yaş tuğlayı ranzalara dizen otomatik hattın gerçek ölçekli (1 birim = 1 cm) 3D modeli.
Kararlar ve ölçüler [CLAUDE.md](CLAUDE.md), yol haritası [ROADMAP.md](ROADMAP.md), mantık referansı
[referans-2d-simulasyon.html](referans-2d-simulasyon.html).

```bash
npm install
npm run dev      # geliştirme sunucusu (telefondan da açılır: --host)
npm test         # Node testleri (tarayıcı gerekmez)
npm run build    # dist/index.html: her şey içinde tek dosya; dist/onizleme.html: claude.ai önizleme biçimi
```

## Klasörler

- `src/sim/`: simülasyon mantığı. Saf TypeScript, three.js ve DOM yok, Node'da çalışır.
  - `params.ts`: 2D'deki `P` ile birebir aynı parametreler
  - `geometry.ts`: plan yerleşimi (X, Y), 2D'deki `geom()` ile aynı formüller
  - `dims.ts`: yükseklikler, ranza / plaka ölçüleri, kaldırıcı formülü
  - `loop.ts`: 5 ms sabit adımlı döngü, hız çarpanı, durdur / sıfırla
  - `sim.ts`: simülasyon durumu (Aşama 2'de 2D `step()` buraya taşınacak)
- `src/scene/`: three.js sahnesi (makineler, kamera açıları, seçim)
- `src/ui/`: kumanda rafı ve stil
- `test/`: Vitest. `test/ref2d.ts` 2D dosyasındaki kodu doğrudan okuyup çalıştırır; karşılaştırmalar
  kopya üzerinden değil, referansın kendisiyle yapılır.

## Koordinatlar

X akış yönü (kalıp → ranza), Y enine (A tarafı +Y, B tarafı −Y; orta şerit Y = 0), Z yukarı, zemin Z = 0.
