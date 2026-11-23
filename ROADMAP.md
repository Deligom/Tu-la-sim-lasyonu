# ROADMAP — 3D Tuğla Dizme Simülasyonu

Her aşama bitince bu dosyayı güncelle (✅ / notlar). Bir aşamayı bitirmeden sonrakine geçme.

**Telefon önizlemeleri** (özel linkler; `npm run build` iki dosyayı üretir, başka bir oturumdan güncellerken URL verilmeli):
- Hat simülasyonu: https://claude.ai/artifact/PD6tnqViXV7VJ1bVX8zdWw ← `dist/onizleme.html`
- Yükleme detayı (fizikli iniş): https://claude.ai/artifact/8V3gBSZMA3UBitj5BCFGpd ← `dist-yukleme/onizleme.html`

## Devam notu (2026-11-23) — yeni sohbet buradan başlasın
- Depo: `Deligom/Tu-la-sim-lasyonu`, dal: `main` (varsayılan; 2026-11-23'e kadar `claude/adoring-cannon-pyibnj`).
  Önce `CLAUDE.md`, sonra bu dosya. `npm install && npm test` (73 test), `npm run dev` (`/` hat, `/yukleme.html` yükleme
  detayı), `npm run build` (iki önizleme dosyası). Fizik senaryoları: `npx tsx scripts/phys-cmp.ts [tarak|genel|burun]`,
  düşürme: `npx tsx scripts/phys-drop.ts`.
- Bitenler: Aşama 0–4; Aşama 5'in iniş kısmı: yarı-statik kontrol (`src/sim/landing.ts`, ana sahnede) + **fizikli yükleme
  detayı** (`yukleme.html`, aşağıda) + **tarak tutucu**.
- **2026-11-23 kararları:** (1) dik çıtalı ranza da kullanılır, ranza reddedilmez; lazer her katı ölçer, yalnızca yamuk
  kat atlanır (CLAUDE.md #12; mantıkta 3D eki `badLevel`, varsayılan 0 → 2D testleri aynı). (2) Aşama 4 açılır panel
  olarak yapıldı (aşağıda). (3) Aşama 6 kavramı seçildi: tarak + iki ayrı orta yükleyici (Aşama 6'ya bak); sıradaki iş
  yığma modunun simülasyonu.
  (4) Kullanıcı sırada parça parça detaylı çizimlere geçecek (mil / rulman çapları vb.); mukavemet hesabını henüz
  bilmiyor, birlikte hesaplanabilir (Aşama 5'in açık yük hesapları bunun girdisi). Sacı garanti olsun diye kalın seçmeyi
  düşünüyor (ör. 2 mm yeterken 4 mm).
- **KARAR (2026-11-22, kullanıcı): yükleyici tarak tutucu** (CLAUDE.md #11). Fizikte, detay sayfasında ve ana sahnede
  varsayılan; bantlı plaka "önceki tasarım" olarak karşılaştırma için duruyor (CLAUDE.md'de ayrı bölüm, ana sahnede
  "Yükleyici" düğmesi, testlerde `loader: 'plaka'`). 2D mantık modeli (ve eşdeğerlik testleri) plaka evreleriyle kaldı;
  kapasite kontrolü: yükleyici çevrimi ~8,8 s'ye kadar hat taşmıyor, tarak 50 cm/s'de 6,3 s. Dik çıtalı ranzada da tarak
  tuğlayı düz koyuyor (0°, 0,07 mm; plakada 9,7°, 2,4 mm).
- **Alma bandı (2026-11-22/23):** kullanıcı, tarağın altındaki yer sabitse arkadan gelen katın aralıkları kapatacağını
  fark etti. Mantık zaten katı bütün olarak taşıyordu (tahrikli bant gibi); çizim düzeltildi: alma bandı kendi motoruyla
  dönen bant, kat geçerken tamponla aynı hızda döner. **Karar: tampon + alma bandı iki ayrı bölge** (tek uzun bant değil;
  CLAUDE.md #10). Geçişte iki bandın hızı eşit olmalı.
- **En son konu (2026-11-22): tarak tutucu.** Kullanıcı bantlı plaka yerine tuğlaları yandan, sütun aralıklarına giren ve
  şişen yastıkla açılan U profillerle tutmayı önerdi; arkadan tek kirişe bağlı tarak olarak kuruldu ve simüle edildi
  (`src/phys` tarak modu, `src/scene/comb.ts`, ana sahne + detay sayfası). Sonuç (kil / ped sayıları tahmin):

  | Senaryo | Tutma güvenliği | Oturma cm/s | Eğim ° | Kenar mm | Pedde kayma mm | Diş teması N | Komşu N | Sıra arası mm | Çevrim s |
  |---|---|---|---|---|---|---|---|---|---|
  | Tarak, varsayılan (0,06 bar, μ 0,4) | 2,8 | 9 | 0,0 | 0,08 | 0 | 0 | 0 | 20 | 6,3 |
  | Sütun hizasızlığı 4 mm | 2,8 | 9 | 0,0 | 0,37 | 0 | 0 | 0 | 20 | 6,3 |
  | Sütun hizasızlığı 8 mm (aralık 17 mm < diş) | 2,8 | 9 | 0,0 | 2,73 | 0,1 | 569 | 0 | 20 | 6,3 |
  | Ped sürtünmesi 0,15 | 1,1 | 10 | 0,0 | 0,08 | 38,9 | 0 | 0 | 20 | 6,3 |
  | 0,02 bar (yetersiz) | 0,9 | 37 | 1,5 | 0,90 | 258 | 0 | 6 | 2 | 6,3 |
  | Çıta yükseklik ±4 mm | 2,8 | 6 | 0,1 | 1,28 | 5,2 | 43 | 0 | 20 | 6,3 |
  | Bırakma 5 mm | 2,8 | 26 | 0,0 | 0,24 | 0 | 0 | 0 | 20 | 6,3 |
  | 80 cm/s, 4 m/s² | 2,7 | 9 | 0,0 | 0,08 | 0 | 0 | 0 | 20 | 4,7 |

  Karşılaştırma: bantlı plaka (35 cm burun) 48 cm/s, 10°, 2,2 mm, komşuya 92 N, sıra arası 13 mm. Tarakla iniş, eğilme ve
  komşu teması fiilen kalkıyor; sıra aralığı sorusu da kalkıyor (2 cm yeter). Tarakta kritik olanlar: sütun aralıklarının
  hizası (kamera), basınç / sürtünme (basınç sensörü + yük hücresi), çıta yüksekliği (lazerle ölçüp indirme ayarı).
  Modelde: pedler sabit basınçla iter, ped sürtünmesi kayma ve burulmaya direnir (burulma eklenmeden tuğla pedler arasında
  sallanıyordu), dişler rijit ve pahlı. Ana sahnede zamanlama 2D modelin plaka evrelerinden: ranzada indirme girişin son
  4 cm'sine sıkıştırıldı, tamponda inme/şişirme tweenle (2D mantık ve testler değişmedi).
- **Bu oturumun kararları** (CLAUDE.md #11'e işlendi):
  - Burnu servoya bağlı metal plakalı kol indirir. Uç makarası çıtaya değmez (alt bant 2× hızla ters gider), 5 mm kalır.
  - **Burun 35 cm, uç makarası Ø12, plaka 5 cm** (kullanıcı seçti). Ölçüler `PLAKA.burunBoy / burunCap / menteseCap`;
    ana sahne, yarı-statik hesap ve fizik sayfası buradan okur. Ana sahnede burun inerken üstündeki iki sıra eğilir.
- **Neden** (fizikli simülasyon, kil sayıları tahmin; `scripts/phys-cmp.ts burun`): ilk taslakta (11 cm, Ø20) tuğla menteşe
  makarası üstünden *dinamik* devriliyordu (27°, 79 cm/s; yarı-statik 18°), 25 cm/s'de daha kötü (35°). Her sıra önündeki
  sıraya dayanıyordu (279 N, ~3,7 mm iz, sıra aralığı 20 → 3 mm). Belirleyici: ağırlık merkezi ucu geçtiğinde ön kenarın
  çıtadan yüksekliği. Uzun burunda tuğla rampadan yavaşça iner, Ø12 makara ucu 3,1 → 2,3 cm'ye indirir:

  | Tasarım | Eğim ° (en çok) | Çarpma cm/s | Kenar mm | Komşu N | Sıra arası mm | Bant–çıta mm |
  |---|---|---|---|---|---|---|
  | İlk taslak: 5 cm, burun 11 cm, Ø20 | 27 | 79 | 3,9 | 279 | 3 | 3,2 |
  | 5 cm, burun 30 cm, Ø20 | 13 | 51 | 2,9 | 98 | 13 | 3,2 |
  | **Varsayılan: 5 cm, burun 35 cm, uç Ø12 (β 5,4°)** | **10** | **48** | **2,2** | **92** | **13** | **3,2** |
  | 3 cm, burun 35 cm, uç Ø12, sehim 1,8 mm | 9 | 50 | 2,3 | 99 | 18 | 2,6 |
  | 3 cm, sabit burun, Ø12 | 13 | 66 | 3,9 | 58 | 14 | 4,1 |
  | 2,5 cm, burun 35 cm, sehim 3,6 mm | 8 | 49 | 2,1 | 103 | 16 | 0,2 |

  - Sabit burunda küçük makara işe yaramıyor (makaranın üstü plaka üstüyle aynı hizada, uç alçalmıyor): menteşe şart.
  - Sehim (konsol, tuğla yükü): 5 cm = 10 dik 40×20×2 → 1,4 mm, 16 kg; 3 cm = 24 yatık 40×20×2 → ~1,8 mm, 39 kg;
    2,5 cm ~3,6 mm; 2 cm dolu sac ~4,3 mm + 88 kg kendi ağırlığı. 3 cm'nin altında sehim 5 mm boşluğu yiyor.
  - Uzun burun: 1. sıra ve 2. sıranın bir kısmı burnun üstünde; burun inerken (~5°) eğilirler, kaymazlar. Servo kolu bu
    yükü (≈ 25–35 kg, menteşeye göre ~50–60 N·m) taşımalı.
  - Hâlâ her sıra önündekine hafifçe değiyor (~90 N, ~1,9 mm iz; eğim 6–10° iken üst kenar ~2–3 cm öne gelir, aralık
    2 cm). Tamamen kaldırmak için sıra aralığı (ör. 3 cm: 4 × 19 + 3 × 3 = 85 cm, ranza iç derinliğine tam sığar) ya da uç
    yüksekliği konuşulmalı.
- **Sıra aralığı denemesi (2026-11-22, kullanıcı istedi; yalnızca fizik sayfasında, `rowGap`):** ön sıra plaka ucunun
  2 cm gerisinde kalır, kat arkaya uzar.

  | Aralık | Komşu kuvveti, en çok | Tuğla–tuğla izi | Temas anındaki eğim | İnişten sonra en dar aralık |
  |---|---|---|---|---|
  | 2 cm (hat) | 92 N | 1,9 mm | ~5,5° | 13 mm |
  | 3 cm | 55 N | 1,4 mm | ~7° | 27 mm |
  | 3,5 cm (plakaya sığmıyor) | 137 N | – | ~8,5° | – |

  Temas kalkmıyor: tuğla inerken eğilip önündeki sıraya değiyor; aralık büyüdükçe daha çok eğilip daha sert çarpıyor.
  Tamamen kaldırmak için ~4,5 cm gerekir, 88 cm plakaya sığmaz. 3 cm, kuvveti ~%40 azaltıyor ve sıraları düzgün
  bırakıyor. Hatta uygulamak: ön hazırlık servosu +3 cm, ön hazırlık 88 cm, tabla 85 cm derinlik, kat plakada arkaya
  1 cm pay; 2D referans (`referans-2d-simulasyon.html`) 2 cm'ye bağlı, eşdeğerlik testleri için orada da değişmeli.
- Kullanıcıyla konuşulacaklar / sıradaki işler: (0) ped – yaş kil sürtünmesi sahada ölçülecek (kullanıcı ~3 hafta
  Ankara'da; isterse seramik çamuruyla ön deneme); tarağın ayrıntıları: düşey eksen, araba ve makara çifti kuvvetleri,
  diş / kiriş dayanımı, kamera ile aralık kontrolü; (1) sıra aralığı 2 cm kalıyor (tarakla komşu teması yok);
  (2) **sahada düşürme denemesi**: yaş tuğlayı 1, 3, 5,5 cm'den düz ve 17° eğik çıtaya bırakıp iz derinliğini ölçmek →
  `kW` ve `pY` buradan ayarlanır; (3) sıradaki iş: Aşama 6 tasarım konuşması, sonra Aşama 5'in yük hesapları ve parça
  çizimleri. (Burun servo kolu ve plaka sehimi önceki plakaya aitti, tarakla gereksiz.)
- Fabrika fotoğrafları depoda yok (depo herkese açık); gerekirse kullanıcı yeniden yükler. Ölçüleri CLAUDE.md'de.

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

## Aşama 3 — Hareketli 3D ✅ (2026-11-18)
- [x] Tuğlalar InstancedMesh; artık parçaları ayrı renk.
- [x] Bölge bantlarının dönüşü (doku kaydırma), dozaj/ön hazırlık senkron indeksleme.
- [x] Pop-up çerçevenin kalkıp inmesi, bloğun A/B'ye gidişi.
- [x] Plaka: giriş, geri çekilirken bant sarma, burun makarasından tuğlanın inişi; yan kollar ve makaralar.
- [x] Ranza kaldırıcı, ranza değişimi, AGV'ler (basit kutu modeller yeterli).

Notlar:
- `src/scene/motion.ts`: mantık yok, yalnızca `SimState` okunur. Simülasyon ilerlemezse çizim de yapılmaz.
- Tuğlalar tek InstancedMesh (≤ 2600): sütunlar, hat, plaka, ranzalar, çıkış tamponu, AGV üstü. Kesim yüzünde delik
  deseni, yanlarda ekstrüzyon çizgisi. Şerit tonları hafif farklı; artık kırmızı, ortadaki artık ve temas parlak kırmızı.
- Bant parçaları bölge dönüyorsa kayıyor; uç sensörü lambası yeşil / kırmızı. Tampon bandı kat ilerledikçe, plaka bandı
  geri çekilirken sarıyor (doku zemine göre duruyor).
- Pop-up (0,2 s kalkış / iniş), tabla boyuna pop-up'ı kat çıkarken kalkık, kapaklar 0,3 s'de iniyor, artık itici kolu
  artığı dışa itiyor, artık oluktan dönüş bandına kayıyor, tel demeti kesimde iniyor.
- Ranzadaki eski katlar mantıkta tutulmuyor (2D yalnızca son katı tutuyor); çizimde kat deseni 2D'nin plaka hesabından
  türetiliyor (tabla → tampon ucu → +97 cm), dolu kat sayısıyla çiziliyor. Konumlar son katla birebir aynı.
- Ranza değişimi çukur sırasıyla (`src/sim/swapview.ts`, testli): dolu ranza zemine kalkar → çıkış konveyörüne ileri
  gider → girişteki öndeki boş ranza aktarma yerine ilerler, yandan içe kaldırıcıya kayar → ilk kata kalkar. Pencere
  süresi mantıkla aynı (6 s + 6 s). Reddedilen ranza dik çıtalı görünür ve boş çıkar.
- Modele iki çizim notu eklendi (`outQ`, `cargo`); 2D karşılaştırma testleri hâlâ bit bit aynı.
- AGV: 3 adet, dış koridordan: çıkışın ucundan dolu ranzayı alır, kurutmaya (sahne dışı, +X) bırakır, boş ranza
  deposundan (pres tarafı) boş alır, girişin başına bırakır, park yerine döner. 60 s'lik sefer yol uzunluğuna bölünüyor.
- "Ranza içi" kamerası tuğla tepeleriyle üst kat arasından, yan koridorun üstünden bakıyor (dolu katta tuğlaların
  içine düşmesin diye).

Bulgu (Aşama 5'te ele alınacak): **burundan iniş 5,5 cm.** Tuğla plakanın üstünde (plaka 5 cm + 5 mm boşluk), çıta
5,5 cm aşağıda. Ağırlık merkezi burnu geçince tuğla öne devriliyor: ön kenar çıtaya oturuyor, eğim ~35°'den başlayıp
arka kenar burundan çıkana kadar ~17°'ye iniyor, sonra arka kenar 5,5 cm düşüyor. Görseldeki devrilme basit katı cisim
yaklaşımı.

Basitleştirmeler: ön hazırlık makaraları ve pop-up bantları dönmüyor (tuğla hareketi gösteriyor); AGV'nin girişe
bıraktığı boş ranza kuyruğa atlıyor (konveyörde yürümüyor); AGV'ler aynı koridoru paylaşıyor, üst üste binebilir.

## Aşama 4 — Arayüz ✅ (2026-11-23)
- [x] Parametre paneli (2D'deki sürgüler), istatistik kartları, darboğaz göstergesi, şerit teşhis satırı.
- [x] Değişen ayarlar listesi + varsayılana dön; teşhis JSON'unu kopyala.
- [x] Telefonda kullanılabilir yerleşim.

Notlar:
- Açılır panel (kullanıcı seçti): rafta "Durum" ve "Ayarlar" düğmeleri. Geniş ekranda (≥900 px) sağda 400 px panel, sahne
  daralır; telefonda alttan açılır (ekranın ~yarısı), açıkken rafta yalnızca oynat / sıfırla / hız kalır. Sekmeler:
  Durum (2D'deki uyarı satırı, darboğaz, 12 kart, şerit teşhisi, 10 dk ileri sar), Ayarlar (birikme bandı, 2D'deki
  sürgüler, değişenler, varsayılana dön, teşhisi kopyala), Hesap (2D'deki teorik tablo + tarağın fizikli çevrimi).
  `src/ui/sheet.ts`, `src/ui/settings.ts`. Telefonda başlık kutusu gizli (saatin yanında sütuna dönüşüyordu).
- Hesaplar ve uyarılar 2D'deki `updateUI()` / `calc()` ile aynı; "plaka" yazan yerler "tarak". 2D'deki gibi ~5. dakikadan
  sonra "ranza bekliyor" uyarısı çıkabiliyor (eşik %5, ölçülen ~%6; üretim etkilenmiyor).
- Darboğaz: ölçülen doluluklar (birikme, ön hazırlığın tabla beklemesi, tarak A/B giriş + çıkış, taşıyıcılar); kaynaklardan
  en dolusu işaretli. Varsayılanda taşıyıcılar ~%58 (10 dk).
- Sürgüler: 2D'dekiler; "Fırıncı plaka hızı" → "Tarak giriş / çıkış hızı", "Çıtası dik ranza oranı" yerine "Yamuk kat
  oranı" (3D eki `badLevel`). Yerleşimi değiştirenler (kesim, bölge sayısı, tampon, araç sayısı; · işaretli) bırakınca sahne
  yeniden kurulur (sayfa yenilenir). Diğerleri canlı.
- Ayarlar ve raf düğmeleri (yükleyici, çıtalar, etiketler) tarayıcıda hatırlanır (`tugla-hat-ayar-v1`); depolama
  yazılamıyorsa yenileme için adresin #'inden taşınır. Not: parça kartlarındaki hız yazıları sahne kurulurkenki
  değerleri gösterir (canlı değişen hızlar kartta güncellenmez).

## Aşama 5 — Mühendislik kontrolleri (iniş kısmı öne alındı, 2026-11-21)
- [x] **Burundan iniş** (öne alındı): `src/sim/landing.ts`, testli. Tuğla, geri çekilen plakanın altında değişen
  destek yüzeyine (plaka → burun → çıta) oturan yarı-statik katı cisim; duruş = destek noktalarının üst dışbükey
  zarfı. Bir adımda köşenin ani düşüşü = devrilme / düşme. Sahnedeki tuğla duruşu aynı fonksiyondan.
  - Sabit burun: ön kenar 5,5 cm düşüyor, ~30° devriliyor.
  - **Eğilir burun, ilk taslak** (2026-11-22'de 35 cm / Ø12 ile değişti, devam notuna bak): 11 cm menteşeli kama, strokun son 2 cm'sinde ~13° iner, alt
    yüzü çıtaların 5 mm üstünde. İniş ~3,1 cm / ~18°. 11 cm'den uzun burun düşüşü azaltmıyor; kalan düşüş uç
    yüksekliğinden (5 mm + Ø20 makara + 2 kat bant). 11 cm'de menteşe ön sıranın ağırlık merkezinin önünde: burun
    inerken tuğla oynamıyor, çevrim süresi uzamıyor (mantık ve 2D sonuçları değişmiyor).
  - Seçenekler (ölçüldü, karar bekliyor): uç makarası inikken çıtaların üstünde yuvarlanırsa (0 boşluk) 2,6 cm;
    Ø12 makarayla daha da az.
  - Arayüz: "Burun: eğilir / sabit" düğmesi, iniş kartı, üst şeritte "iniş X cm", yeni "Burun" kamerası.
- [x] Dik çıtalı ranzada tuğla düşmesi senaryosu (görsel + sayı): "Çıtalar: dik" seçilince sahnede tuğla ucu boşluğa
  dalıyor; sabit burunda 8,6 cm düşüş + 3,1 cm dalma, eğilir burunda bile ~1,6 cm dalma → plaka için red gerekçesiydi.
  **2026-11-23:** tarakla dik çıta sorun değil, red kuralı kalktı. Yerine kat kat yamuk kontrolü: lazer her katı ölçer,
  yamuk kat atlanır (`badLevel`, mantıkta 3D eki; `Rack.bad / filled` bit maskeleri). Sahnede yamuk katta iki çıta
  turuncu ve bir ucu 1,5 cm kalkık; ranza etiketi "N yamuk kat atlandı". 2D'nin komple red kuralı (`badRack`) yalnızca
  2D eşdeğerlik testi için duruyor, arayüzde yok. Testli: tuğla yamuk kata konmuyor, %20'de hat yetişiyor, hepsi
  yamuksa ranza boş çıkıyor. Ölçüm (20 dk, 240/dk): %25 / %30 / %35 taşma yok (ranza bekleme %15 / %15 / %28–48), %45'te
  ranza taşıma yetişmiyor, hat taşıyor.
- [x] **Fizikli yükleme detayı** (2026-11-22, kullanıcı istedi: ayrıntılı fizik, tam kat, ayrı sayfa, yumuşak köşe).
  `yukleme.html` + `src/phys/` (motor, testli) + `src/detail/` (sahne, arayüz).
  - Motor: 24 tuğla 6 serbestlik dereceli katı cisim, 0,2 ms adım, deterministik. Plaka / burun / bant kinematik: düz
    üst → menteşe makarası yayı → rampa (iki makaraya teğet) → uç makarası yayı; bant her noktada gerçek hızıyla
    (üstte zemine göre 0, uçta makaranın etrafında, altta 2× geri). Burun menteşe makarası ekseni etrafında döner,
    servo 0,25 s'de indirir. Plaka sehimi yüklerden (konsol kiriş, tam yükte uçta 1,4 mm; yük 20 ms süzülür).
  - Yaş kil: alt yüz hücreleri + 12 kenarın 1 cm'lik bantları, Winkler (basınç = k × batma, kapalı biçim integral),
    akma basıncında kalıcı ezilme, boşaltmada 10× sert dönüş (iz kalır, sekme ~0,2). Makaralar silindir – yüz çizgi
    teması (analitik). Sürtünme yapışma yayı + μN'de kayma. Tuğla–tuğla: kenar, yalnızca baktığı yüze.
  - Doğrulama (testli): serbest düşme hızı √(2gh); düz düşüşte iz 1 / 3 / 5,5 cm → 0,31 / 0,53 / 0,71 mm; 17° eğik
    düşüşte kenar 1,8–3,9 mm; durgun tuğla kaymıyor; tam katta hepsi düz oturuyor; deterministik.
  - Ölçülenler: çıtaya çarpma hızı, eğim, kenar / yüz izi (kaynağa göre), tuğla–tuğla kuvveti, yer değiştirme ve sıra
    aralığı, alt bant – çıta boşluğu ve sürtünmesi, makara çizgisi basıncı. Tuğlaya dokununca zaman grafiği.
  - Senaryolar (ilk taslak burunla, 11 cm / Ø20 — o günkü varsayılan; yeni burunla karşılaştırma devam notunda. Eğim
    ranza önündeki sıradan dibe doğru, kil sayıları tahmin):

    | Senaryo | Eğim ° | Çarpma cm/s | Kenar mm | Komşu N | Sıra arası mm | Bant–çıta |
    |---|---|---|---|---|---|---|
    | İlk taslak (eğilir 11 cm, 50 cm/s) | 11/12/9/27 | 79 | 3,9 | 279 | 3 | 3,2 mm |
    | Sabit burun | 6/11/6/19 | 106 | 5,5 | 139 | 1 | 3,4 mm |
    | Eğilir, 25 cm/s | 11/9/8/35 | 50 | 3,7 | 135 | 8 | 3,1 mm |
    | Ø12 uç makarası | 10/10/9/25 | 77 | 3,8 | 232 | 11 | 3,3 mm |
    | Çıta sapması ±4 mm | 10/11/10/27 | 82 | 5,3 | 239 | 11 | −0,8 mm, 200 N |
    | Bant %3 hızlı | 9/10/5/27 | 80 | 3,9 | 327 | 1 | 3,2 mm |
  - Basitleştirmeler: plaka ve çıtalar rijit (sehim yarı-statik), tuğlanın yan yüzlerinin içi yalnızca bantlarla temas
    eder, yüz izi yalnızca alt yüzde, ranza sabit (zincir / çene esnekliği yok). Dik çıtada bazı tuğlalar boşluğa
    dalıp oturmuyor (beklenen; red gerekçesi).
- [x] **Tarak tutucu** (2026-11-22, kullanıcı önerisi → kesin): `src/phys` tarak modu (pedler sabit basınç, yapışma–kayma
  + burulma sürtünmesi; dişler rijit, pahlı kesit; alma bandı), `src/scene/comb.ts` (ortak model), detay sayfası
  (varsayılan) ve ana sahne (varsayılan, "Yükleyici" ile plakaya geçilir). Testli: düz koyma, hizasızlık sınırı, düşük
  basınçta kayma. Senaryolar `scripts/phys-cmp.ts tarak`. Ana sahnede tarak zamanlaması 2D plaka evrelerinden (tamponda
  inme / şişirme tweenle, ranzada indirme girişin son 4 cm'sine sıkıştırıldı).
- [ ] Tarak: araba + düşey eksen kuvvetleri, makara çifti kuvvetleri (84 kg yük, kol uzunluğu), diş ve kiriş dayanımı.
- [ ] Tarak dişleri ile üst kat arası boşluk görselleştirmesi (mm).
- [ ] (Önceki plaka için) plaka sehimi ve kat yüksekliği boşluğu görselleştirmesi.
- [ ] Makara çifti kuvvetleri (yük ağırlık merkezi ve kol uzunluğuna göre) panelde (tarak arabası için).
- Eğilir burnun tahriki: servo + metal plakalı kol (2026-11-22, kullanıcı; ölçüler açık). Burun menteşe makarası ekseni
  etrafında döndüğü için üst bant boyu değişmez; alt bant gerdirmesi açık. Lazerler menteşenin arkasına alındı.

## Aşama 6 — İkinci ürün: yığma tuğla (29 × 13,5 × 19)
Tasarım açık; aşağıdakiler konuşulmadan başlanmayacak.
- Kavram sayfası (2026-11-23, `docs/yigma-kavramlar.html`, https://claude.ai/artifact/AVrMhAygUmSESML2qAERnD).
  Kullanıcının cevapları: **6+3+6 şart**: ön/arka sıranın 29'luk kenarı tarak yönünde, ranza taşınırken virajda dışarı
  devrilmesin diye (13,5 tabanda devrilme 0,71 g, 29'da 1,53 g). İpli kilit zor (kullanıcı da öyle düşünüyor). Yığma
  **sık** üretiliyor (her ay / hafta) → bant düzeni iki ürünü de taşımalı. Kalıpta iki 29'luk sütun arası **2 cm**.
- **Önerilen: 4. kavram, orta yükleyici (kullanıcının fikri):** tarak yalnızca ön ve arka 6×1 sırayı koyar (bugünkü 7
  diş aynen; dönmüş 6×1 sıra bugünkü 6 sütunla aynı genişlikte), ortadaki 3 tuğlayı A–B ranzaları arasındaki orta yükleyici
  yandan sokar (iki uzun çene, U profil + yastık). Kullanıcının sırası 6×1 → orta → 6×1; öneri: iki 6×1 tarakla birlikte,
  sonra orta (tarak katta bir kez gider). 6'lı grup tablada döner tablayla (Ø ~1 m) 90° döner, katta 2 dönüş; 3'lü grup
  hattın ortasından düz gidip orta istasyonda tek tek yana aktarılır (dönmez). Orta yuva iki yanda 5 cm → kat derinliği
  81,5 cm. A–B arası 40 cm'den ~120 cm'ye (ortak yükleyici) ya da ~2,2 m'ye (iki ayrı) açılmalı. Zaman tahmini ≈ 10,5 s
  / kat, bütçe ~11,4 s (pres hızı bilinmiyor, ~157/dk tahmini). 1. kavram (5 × 3) devrilme yüzünden düştü; 2–3 (bitişik
  ikililer) orta yükleyiciyle gereksiz.
- **Kullanıcı onayladı (2026-11-23):** iki 6×1 birlikte, sonra orta; pres hızı bilinmiyor (~157/dk tahminiyle git);
  **iki ayrı orta yükleyici** (yer sorunu yok, A–B arası 3 m'ye kadar açılabilir); orta yuvada 5 cm olur. Sıradaki iş:
  yığma modunun simülasyonu (2 şerit, 6'lı / 3'lü grup, döner tabla, orta istasyon ve yükleyici, 6+3+6 kat, zaman).
- [x] Diziliş deseni (onaylı): önde ve arkada 29'luk kenar X yönünde 6'şar tuğla, ortada 13,5'luk yatay sıra (29 Y
  yönünde) 3 tuğla → kat başına 15 tuğla, derinlik 29 + 13,5 + 29 = 71,5 cm (+ aralıklar), en ≈ 96 cm.
- [ ] Bantla çıkış yönü 13,5 X × 29 Y: orta sıra olduğu gibi, ön ve arka sıralar 90° dönmeli (tek tek ya da 6'lı grup).
- [ ] 2 sütun × 29 cm + aralık ≈ 61 cm; 3 şeritlik bölgeli bant 47 cm. Şerit bantları 29'luk tuğlayı iki banda bindirir
  → bant düzeni / bölge eşlemesi değişmeli.
- [ ] Kesim: 152 cm'lik tablada sütun başına 11 tuğla (148,5 cm), kesim başına 22 tuğla; kat 15 tuğla (kesim ≠ kat).
