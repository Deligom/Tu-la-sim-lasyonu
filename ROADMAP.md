# ROADMAP — 3D Tuğla Dizme Simülasyonu

Her aşama bitince bu dosyayı güncelle (✅ / notlar). Bir aşamayı bitirmeden sonrakine geçme.

**Telefon önizlemesi:** https://claude.ai/artifact/PD6tnqViXV7VJ1bVX8zdWw (özel link; `npm run build` →
`dist/onizleme.html` aynı adrese yeniden yayınlanır, başka bir oturumdan güncellerken bu URL verilmeli).

## Aşama 0 — Kurulum ✅ (2026-11-18)
- [x] Vite + TypeScript + Three.js projesi; `src/sim/` (mantık), `src/scene/` (3D), `src/ui/` (panel).
- [x] Sabit adımlı (5 ms) simülasyon döngüsü, hız çarpanı (¼×, 1×, 3×, 10×), durdur / sıfırla.
- [x] Orbit kamera + hazır kamera açıları: üstten, ön hazırlık yakın, A istasyonu yan, B istasyonu yan, ranza içi.

Notlar:
- `src/sim/loop.ts`: adım hep 5 ms; kare süresi 0,1 s'de kırpılıyor (sekme arka plandan dönünce simülasyon fırlamasın).
  Aşama 0–1'de simülasyon yalnızca zamanı ilerletiyor; `step()` Aşama 2'de gelecek.
- Testler: `npm test` (Vitest, Node). `test/ref2d.ts` 2D dosyasındaki `P` ve `geom()`'u doğrudan dosyadan
  okuyup çalıştırıyor; Aşama 2'deki `step()` karşılaştırması da aynı yolla yapılabilir.
- Ek açı: "Genel" (3/4 bakış). Üstten görünüm telefonda dikey: akış aşağı, A sağda (2D'nin telefon görünümüyle
  aynı); yatay ekranda akış sağa, A yukarıda. 2D'nin masaüstü görünümü aynalıydı (A altta), 3D sağ elli eksen kullanıyor.
- Dokunulan parçanın adı ve ölçüleri kartta çıkıyor; turuncu kutu parçayı gösteriyor.
- Çizim yalnızca bir şey değişince yapılıyor (telefonda pil dostu). Malzemesi aynı parçalar tek mesh'te birleşiyor.
- Tek dosyalık derleme (`vite-plugin-singlefile`), ~620 KB (three.js dahil).

## Aşama 1 — Sabit geometri (gerçek ölçek, cm) ✅ (2026-11-18)
- [x] Kalıp, kesici tablası, hızlandırma, 5 birikme bölgesi, dozaj (şerit başına ayrı bant parçaları).
- [x] Ön hazırlık: şerit makaraları, 12 pop-up bandı ve çerçeveleri, kapaklar, kamera direği.
- [x] A/B tablaları, tamponlar, plaka şasesi ve yan raylar, ranza kaldırıcı.
- [x] Ranza modeli: köşebent çerçeve, 5 kat, çıtalar (paralel ve dik iki tip).

Notlar:
- Tüm X konumları ve şerit / tabla / bant Y aralıkları 2D `geom()` ile birebir (testli). Hareketli parçalar
  (tel demeti, artık itici kolları, kapak bıçakları, pop-up çerçevesi, tabla boyuna pop-up'ı, plaka, kaldırıcı
  platformu, ranza) ayrı gruplarda, Aşama 3'te simülasyondan sürülecek.
- Fotoğraflardan alınanlar: ranza çerçevesi (4 köşe dikmesi, en alt katın altında dikme dibinden kata çapraz
  destek), iki çıta tipi, kat arası ~30 cm, kesici tablasının mavi/yeşil makaraları ve turuncu tel kesici,
  makine şasesinin soluk sarısı. Fotoğraflar depoya konmadı (depo herkese açık).
- Ranza: kat rayları L25×25×5, çıta (2 cm) rayın yatay koluna oturuyor, rayın üstü çıta üstüyle aynı hizada.
  Kullanılabilir yükseklik 28 cm; plakadaki tuğla ile üst katın rayı arası 3 cm. En üst kat 150 cm'de,
  yüklenirken tuğla tepesi 174,5 cm (zarf 180 içinde).
- Ranza başta 120 cm kalkık (boş, en alt kat plaka hizasında). Kaldırıcı en altta iken platform zeminle aynı
  hizada (36 cm'lik çukur). 4 kolonlu hidrolik, kolon / çene / pim yerleşimi şematik.
- Plaka: 10 dik kutu profil + üst/alt bant = 5 cm, burun Ø20 mm, 2 lazer burunda. Kol, makara çifti, arka kiriş
  ve bant motoru plakanın arkasında; ranzaya hiçbir şey girmiyor. Bant motoru, plaka beklerken tamponun ön
  ucunun altında kalıyor.
- Yükseklik zinciri (her aktarmada alan taraf 4 mm yukarıdan alıyor): birikme / ön hazırlık 154,7 → pop-up ve
  tabla enine 155,1 → tabla boyuna (kalkık) = tampon = plaka üstü 155,5 cm.
- Şematik bırakılanlar (CLAUDE.md'de ayrıntı yok): pres gövdesi, A/B tablasında enine / boyuna bantların
  kesişmesi (boyuna bantlar sürekli, enine bantlar parçalı), artık itici kolları (köprüden sarkıyor, şerit
  aralarında bekliyor), kaldırıcı kolonları.

Açık sorular (cevaba göre değişecek):
1. **Hat yüksekliği** CLAUDE.md'de yok. Plaka sabit ve boş ranza 120 cm kalkıyor; kaldırıcı en altta zeminde
   dersek aktif kat 150 cm'de, bant yüzeyi ~155 cm çıkıyor (pres ağzı da o yükseklikte). Gerçek pres ağzı
   ~1 m ise ya ranza kaldırıcı daha derin bir çukurda çalışmalı ya da hatta bir yerde seviye farkı olmalı.
2. **Plakanın ileri-geri tahriki** (97 cm strok, 50 cm/s) neyle? Kremayer, zincir, vidalı mil? Şimdilik yok.
3. **Ranza giriş / çıkış yönü** ve 3 boş + 3 dolu tampon yerleşimi (Aşama 3). 2D'deki gibi ±Y dışa doğru
   (A için +Y) varsaydım; zincirli konveyör de o yönde.
4. Akış yönüne bakan biri için A tarafı (+Y) solda kalıyor. Sahada da öyle mi?

## Aşama 2 — Simülasyon mantığı
- [ ] `referans-2d-simulasyon.html` içindeki `step()` mantığını TS modülüne taşı (aynı parametreler, aynı sonuçlar).
- [ ] Node'da çalışan testler: 240/dk'da 10 dk → 0 temas, 0 taşma; 360/dk → taşma; tek parça bant → temas > 0.
- [ ] 2D ile 3D mantık sonuçlarını karşılaştıran test.

## Aşama 3 — Hareketli 3D
- [ ] Tuğlalar InstancedMesh; artık parçaları ayrı renk.
- [ ] Bölge bantlarının dönüşü (doku kaydırma), dozaj/ön hazırlık senkron indeksleme.
- [ ] Pop-up çerçevenin kalkıp inmesi, bloğun A/B'ye gidişi.
- [ ] Plaka: giriş, geri çekilirken bant sarma, burun makarasından tuğlanın inişi; yan kollar ve makaralar.
- [ ] Ranza kaldırıcı, ranza değişimi, AGV'ler (basit kutu modeller yeterli).

## Aşama 4 — Arayüz
- [ ] Parametre paneli (2D'deki sürgüler), istatistik kartları, darboğaz göstergesi, şerit teşhis satırı.
- [ ] Değişen ayarlar listesi + varsayılana dön; teşhis JSON'unu kopyala.
- [ ] Telefonda kullanılabilir yerleşim.

## Aşama 5 — Mühendislik kontrolleri
- [ ] Plaka sehimi ve kat yüksekliği boşluğu görselleştirmesi (plaka ile üst kat çıtası arası mm).
- [ ] Dik çıtalı ranzada tuğla düşmesi senaryosu (görsel uyarı + red).
- [ ] Makara çifti kuvvetleri (yük ağırlık merkezi ve kol uzunluğuna göre) panelde.
