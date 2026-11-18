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
- Ranza başta boş, en alt katı plaka hizasında. 4 kolonlu hidrolik kaldırıcı; kolon / çene / pim yerleşimi şematik.
  (Çukur ve yükseklikler aşağıdaki revizyonla değişti.)
- Plaka: 10 dik kutu profil + üst/alt bant = 5 cm, burun Ø20 mm, 2 lazer burunda. Kol, makara çifti, arka kiriş
  ve bant motoru plakanın arkasında; ranzaya hiçbir şey girmiyor. Bant motoru, plaka beklerken tamponun ön
  ucunun altında kalıyor.
- Yükseklik zinciri (her aktarmada alan taraf 4 mm yukarıdan alıyor): birikme / ön hazırlık 100 → pop-up ve
  tabla enine 100,4 → tabla boyuna (kalkık) = tampon = plaka üstü 100,8 cm; aktif kat çıtası 95,3 cm.
- Şematik bırakılanlar (CLAUDE.md'de ayrıntı yok): pres gövdesi, A/B tablasında enine / boyuna bantların
  kesişmesi (boyuna bantlar sürekli, enine bantlar parçalı), artık itici kolları (köprüden sarkıyor, şerit
  aralarında bekliyor), kaldırıcı kolonları.

Revizyon (2026-11-18, kullanıcıyla):
- [x] Hat yüksekliği ~1 m (`HAT_Z` tek sayı). Hatta seviye farkı yok; ranza kaldırıcı ~77 cm'lik çukurda.
  Ranza ayağı boşken +65,3 cm, son katta −54,7 cm. Plakanın arkasındaki parçalar artık plaka altına göre konumlu.
- [x] Plaka ileri-geri tahriki: rayların dışında birer zincir, tamponun altından geçen ortak mil, tek servo.
- [x] Ranza giriş / çıkış akışı: istasyon akış yönünde kaldı. Boş ranzalar kalıp hizasından hattın iki yanındaki
  zemin konveyöründe +X yönünde geliyor (girişte 3 boş bekliyor), istasyonda yandan içe kaldırıcıya kayıyor; dolu
  ranza düz ileri çıkış konveyörüne (3 yer) gidiyor. Kaldırıcıda çapraz aktarma: Y zincirleri (giriş) + X zincirleri
  (çıkış). Giriş konveyörü istasyon merkezinden 142 cm dışarıda; hat toplam ~5,6 m eninde. Yan görünümde girişte
  bekleyen ranzalar saydamlaşıyor (istasyonun önünü kapatmasın). Konveyör uzunluğu kalıptan başlıyor (~8 m, 7 ranza
  sığar); mantıkta giriş tamponu 2D'deki gibi 3.
- A tarafı (+Y) akışa bakana göre solda. Hat simetrik, yalnızca isim; artık Ş1 (−Y, B tarafı) 9,5 cm, Ş3 (+Y) 5,5 cm.

## Aşama 2 — Simülasyon mantığı ✅ (2026-11-18)
- [x] `referans-2d-simulasyon.html` içindeki `step()` mantığını TS modülüne taşı (aynı parametreler, aynı sonuçlar).
- [x] Node'da çalışan testler: 240/dk'da 10 dk → 0 temas, 0 taşma; 360/dk → taşma; tek parça bant → temas > 0.
- [x] 2D ile 3D mantık sonuçlarını karşılaştıran test.

Notlar:
- `src/sim/model.ts`: reset / tableAccepts / chooseSide / step birebir port, işlem sırası aynı. Tuğlalara çizim için
  kalıcı `id` eklendi; bloktaki tuğlanın `cy`'si 3D Y'sinde. Başka fark yok.
- `test/ref2d.ts`, 2D dosyasındaki asıl `step()`'i Node'da çalıştırıyor. `test/sim.test.ts` iki simülasyonu her
  5 s'de tüm durum (tuğla konumları dahil) üzerinden karşılaştırıyor: varsayılan 4 dk, tek parça bant 300/dk,
  %20 uyumsuz ranza + 2 araç, 360/dk. Hepsi bit bit aynı.
- Doğrulananlar: 240/dk'da 10 dk 0 temas / 0 kayma / 0 taşma, blok ortalaması 3,0 s, ~10 kat/dk, ön hazırlık tablayı
  hiç beklemiyor; 330/dk'da taşma yok; 360/dk'da taşma var.
- 2D'nin kendisinde görülen iki şey (port hatası değil):
  1. 240/dk'da kuyruk 1 tuğlayı geçmiyor; tek parça bantta da temas olmuyor. Fark kuyruk oluşunca çıkıyor:
     300/dk'da bölgeli bantta 0, tek parça bantta 10 dk'da yüzlerce temas. CLAUDE.md buna göre düzeltildi.
  2. Varsayılanlarda plaka zamanın ~%5,8'inde ranza bekliyor (değişim 6 s + 120 cm kaldırma 6 s). 2D'nin uyarı eşiği
     %5 olduğu için ~5. dakikadan sonra "ranza bekliyor" uyarısı veriyor; üretim etkilenmiyor (tabla bekleme %0).
- Çukurlu kaldırıcıda değişim sırası farklı (dolu ranza önce zemine kalkar), toplam süre aynı. Mantıkta 2D sırası
  korunuyor; Aşama 3'te görselde çukur sırasıyla gösterilecek.
- Üst şeritte canlı sayaç: üretim/dk, temas, taşan, kat, ranza.

## Aşama 3 — Hareketli 3D
(Ranza değişimi: dolu ranza zemine kalkar → X zincirleriyle ileri çıkar → boş ranza yandan içe gelir → ilk kata kalkar.)
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

## Aşama 6 — İkinci ürün: yığma tuğla (29 × 13,5 × 19)
Tasarım açık; aşağıdakiler konuşulmadan başlanmayacak.
- [x] Diziliş deseni (onaylı): önde ve arkada 29'luk kenar X yönünde 6'şar tuğla, ortada 13,5'luk yatay sıra (29 Y
  yönünde) 3 tuğla → kat başına 15 tuğla, derinlik 29 + 13,5 + 29 = 71,5 cm (+ aralıklar), en ≈ 96 cm.
- [ ] Bantla çıkış yönü 13,5 X × 29 Y: orta sıra olduğu gibi, ön ve arka sıralar 90° dönmeli (tek tek ya da 6'lı grup).
- [ ] 2 sütun × 29 cm + aralık ≈ 61 cm; 3 şeritlik bölgeli bant 47 cm. Şerit bantları 29'luk tuğlayı iki banda bindirir
  → bant düzeni / bölge eşlemesi değişmeli.
- [ ] Kesim: 152 cm'lik tablada sütun başına 11 tuğla (148,5 cm), kesim başına 22 tuğla; kat 15 tuğla (kesim ≠ kat).
