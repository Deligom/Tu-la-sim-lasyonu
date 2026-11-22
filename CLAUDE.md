# Yaş Tuğla Dizme Hattı — 3D Simülasyon

TOPALOĞULLARI Toprak Sanayi (Osmancık, Çorum) tuğla fabrikası için tasarlanan otomatik dizme hattının
gerçek ölçekli, etkileşimli 3D simülasyonu. Amaç: mekanizmaların birbirine nasıl oturduğunu, çarpışma
ve zamanlama sorunlarını 3D'de görmek. Şu an elle 15 kişinin yaptığı işi (kesiciden çıkan yaş tuğlayı
ranzalara dizmek) otomatiğe bağlamak.

Bu dosyadaki tüm ölçü ve kararlar önceki tasarım çalışmasında netleşti ve 2D simülasyonda
(`referans-2d-simulasyon.html`) doğrulandı. **Değiştirmeden önce sor.** Simülasyon mantığının
referansı o dosyadaki `step()` fonksiyonudur; 3D sürüm aynı sonuçları vermeli.

## Teknik tercihler
- Vite + TypeScript + Three.js. Tek sayfa, telefonda da çalışmalı (iPhone, Safari).
- Birim: **cm** (sahne 1 birim = 1 cm), zaman: saniye.
- Simülasyon mantığı render'dan ayrı, saf TS modülü: sabit adım (5 ms), deterministik, tarayıcısız test edilebilir.
- Tuğlalar `InstancedMesh` ile (aynı anda ~300+ tuğla).
- Türkçe arayüz, gayriresmi dil.
- **Yükleme detayı** (`yukleme.html`, `src/phys/`, `src/detail/`, 2026-11-22): tampondan ranza çıtasına yüklemenin ayrı,
  fizikli sayfası. Kendi küçük fizik motoru (hazır motorlar yumuşak köşe / plastik iz modelini kuramıyor): SI birimleri,
  0,2 ms sabit adım, deterministik, Node'da testli (`test/phys.test.ts`). Ayrı telefon önizlemesi var (ROADMAP'e bak).
  Varsayılan yükleyici tarak tutucu; önceki bantlı plaka karşılaştırma için seçilebilir (ana sahnede "Yükleyici" düğmesi).

## Koordinatlar
- X: akış yönü (kalıp → ön hazırlık → tampon → tarak → ranza).
- Y: enine (şeritler; A tarafı +Y, B tarafı −Y).
- Z: yukarı.

## Ürün
- Yaş tuğla 19 (akış yönünde boy) × 13,5 (en) × 19 (yükseklik) cm, ~3,5 kg. Yaş kil: çarpma, kayma, düşme ezer.

## Hat, baştan sona
1. **Vakumlu pres / kalıp:** 3 sütun yan yana, kesintisiz basıyor. Hedef **240 tuğla/dk** toplam.
   Şerit hızları (tuğla/dk): Ş1 85, **Ş2 80 (orta, en yavaş, referans)**, Ş3 83. Sütun hızı = hız × 19 cm/dk.
   Orta çıkış kalıpta bilerek ~%2–3 frenleniyor → artık hep kenar şeritlerde oluşur.
2. **Çoklu tel kesici:** şerit başına 8 tuğla (152 cm). En yavaş sütun 152 cm'ye ulaşınca 3 sütun birlikte kesilir.
   Hızlı sütunlardaki fazla boy = artık (240/dk'da Ş1 ~9,5 cm, Ş3 ~5,5 cm). Bir kesim = 24 tuğla = 1 ranza katı.
3. **Yandan artık itici:** hızlandırma bandının başında (+12 cm), artık iki komşusundan ayrıldığı noktada.
   Ş1 artığı dışa (−Y), Ş3 artığı dışa (+Y) pnömatik itilir; yan dönüş bandı karıştırıcıya götürür.
   Ortada artık oluşursa uyarı (kalıp ayarı bozulmuş demek).
4. **Hızlandırma bölgesi:** 60 cm, 150 cm/s, **hiç durmaz** (kesiciden itilen tuğlayı karşılar).
5. **Bölgeli birikme (sıfır basınçlı, ZPA):** şerit başına 5 bölge × 30 cm, 150 cm/s. Her bölge ayrı tahrikli
   (ya da tek motor + bölge başına elektromanyetik kavrama-fren). Önündeki bölge doluysa bölge, tuğlası uç
   sensörüne gelince durur → tuğlalar asla birbirine değmez.
6. **Dozaj bölgesi:** 30 cm, tuğlayı uçta bekletir. Ön hazırlık servosu ile **senkron** bırakır. Önceki tuğla
   çekilirken sıradaki dozaja ilerleyebilir (boru hattı).
7. **Ön hazırlık (4'lü):** şerit başına bağımsız servo ile dönen kısa makaralar (~14 cm genişlik, 4–5 cm aralık).
   Her bırakmada servo, tuğlanın arka kenarı fotoselden geçince +2 cm daha ilerleyip durur → sıra aralığı 21 cm,
   tuğlalar arası 2 cm, öndeki durdurucuya çarpma yok. 4 sıra, uzunluk 85 cm.
   Kamera şerit başına sayar; 4 olunca o şeridin dozajı durur, **şerit kapağı** (pnömatik, 0,3 s) kapanır.
   Kapak çizgisinde ışık bariyeri: altında tuğla varsa kapanmaz.
8. **Pop-up 90° transfer:** her sıranın altında 3 enine bant (sıra arkasından 3 / 9,5 / 16 cm), toplam 12 bant,
   makara aralarında. Tek rijit çerçeve, 4 kılavuzlu pnömatik silindir, makara yüzeyinin 3–5 mm üstüne çıkar.
   **Çift yönlü:** motor yönüne göre +Y → A tablası, −Y → B tablası, 120 cm/s. Bir katın ilk bloğu uzak yarıya,
   ikincisi yakın yarıya. Yarım kalmış tabla önce tamamlanır.
9. **A/B toplama tablası:** 6×4 = 24 tuğla (≈96 × 82 cm). Enine pop-up ile bloğu alır, boyuna pop-up ile katı
   tampon banda gönderir.
10. **Tampon:** 1 katlık bölgeli bant, 100 cm/s (bant durur, tuğla altından kaymaz). Arkasında **alma bandı** (2. bölge,
    ayrı motor). **İki bölge (2026-11-23, kullanıcı kararı; tek uzun bant değil):** tarak alma bandındaki katı beklerken
    tampon kendi başına çalışır, tabla dolan katı hemen tampona verir. Kat bölge geçişinden geçerken iki bant AYNI hızda
    döner (ortak sürücü ya da senkron servo); hız farkı olursa yavaş taraf öndekileri frenler, sıra aralıkları kapanır.
11. **Tarak tutucu (yükleyici, 2026-11-22 kesin; kullanıcı önerisi).** Tuğlaları alttan bantla değil, yandan tutar:
    sütun aralıklarına giren dişlerde iki U profil, araya şişen yastık U'ları açar, kauçuk pedler tuğlanın yan yüzüne
    bastırır (insanın koliyi iki koluyla sıkması gibi; elle iki tuğla yandan sıkılarak kaldırılabiliyor).
    - **Tarak:** arkada ranzanın DIŞINDA kalan kiriş; sütun aralıklarında (3 cm) 7 diş (5 çift yanlı, 2 dış tek yanlı),
      15 cm yüksek, tuğla altından 3 cm yukarıda biter. Tuğlaların üstünde ve altında hiçbir şey yok (üst kata 8,5 cm
      sorun değil). Diş düşeyde çok rijit (15 cm yükseklik): sehim ~0,1 mm.
    - **Diş:** iki U profil + arada yastık (kumaş takviyeli yassı hortum, iki U'ya yapışık: basınçla açılır, vakumla
      kapanır, yay yok). Sönükken ~20 mm → her yanda ~5 mm boşluk; strok kılavuzda sınırlı (~8 mm). Alt uçlar ~4 mm 45°
      pahlı. Sıra başına ayrı tırtıklı kauçuk ped (16 × 13 cm).
    - **Kuvvet:** basınç × alan; 0,06 bar → ped başına ~125 N (yüze ~6 kPa: tuğlanın kendi ağırlığıyla bastığı kadar, iz
      yok). μ 0,4'te tutma güvenliği ~2,8 (2 ped × μ × F / (ağırlık + 2 m/s² ivme)). Basınç panelden ayarlı.
    - **Alma bandı:** önceki plakanın bekleme yerinde, plaka üstü yüksekliğinde, kendi motoruyla dönen bant (tamponun
      2. bölgesi). Kat tampondan buraya bütün olarak, iki bant aynı hızda dönerken gelir: tuğlalar sabit yüzeyde itilmez,
      2 cm sıra aralığı kapanmaz (2026-11-22, kullanıcının uyarısı). Tarak tutarken durur; sıradaki kat tamponda bekler.
      Tampon ile iki ayrı bölge (madde 10).
    - **Çevrim:** alma bandında yukarıdan iner →
      şişirir → 5 mm kaldırır → ranzaya girer (strok 97 cm, 50 cm/s) → tuğlaları çıtanın ~1 mm üstüne indirir (son 1 cm
      2 cm/s) → vakumla söndürür → aynı aralıklardan YATAY geri çekilir. ~6,3 s (80 cm/s'de ~4,7 s).
    - **Kılavuz ve tahrik:** önceki plakanınkiler aynen: iki yanda ranzanın DIŞINDA biten sabit ray, arabadan iki yana
      50 cm (tercihen 60 cm) kol, her kolda 2 makara çifti (cam follower) rayı alttan ve üstten kavrar (biri eksantrik
      milli). İleri-geri zincir: rayların dışında birer makaralı zincir, tamponun altından geçen ortak mille tek servo
      (iki taraf mekanik senkron; vidalı mil yok). Arabaya düşey eksen eklenir (iki kılavuz + servo): tamponda ~18 cm
      iner / kalkar, ranzada tuğlaları çıtaya indirir.
    - **İzleme:** diş başına basınç sensörü (kuvvet), kılavuzda strok sensörü (tuğla yok / geniş), arka kirişte yük
      hücresi (24 tuğla ≈ 84 kg tartılır; eksik / kayan tuğla görülür, bırakırken yükün çıtaya geçtiği doğrulanır), her
      dişte çek valf (hava kesilirse tutar). Kamera inmeden önce sütun aralıklarını ölçer. Çıta yüksekliğini ve eğimini
      ölçen 2 lazer tarağın arka kirişinde (öneri).
    - **Fizikli simülasyon (`yukleme.html`):** çıtaya ~9 cm/s oturma, 0° eğim, ~0,1 mm kenar izi, komşu teması yok, yer
      değiştirme ~0, sıra aralığı korunuyor (plakada 48 cm/s, 10°, 2,2 mm, komşuya 92 N). Tolerans: komşu iki sütun arası
      ≥ ~22 mm (sütun ±4 mm geçiyor, ±8 mm'de diş tuğlaya basıyor). Basınç / sürtünme yetmezse (güvenlik < 1) tuğla pedde
      kayar. Çıta yükseklik farkı (±4 mm) varsa yüksek çıtaya önce değen tuğla pedde kayar → kat yüksekliği lazerle
      ölçülüp indirme ayarlanmalı.
    - Açık: ped – yaş kil sürtünmesi sahada ölçülecek; ped malzemesi, yastık hortumu, düşey eksen ayrıntısı.
12. **Ranza:** 120 (boy, Y) × 90 (derinlik, X) × 150 cm (en üst tuğlayla 180), 5 kat, kat arası 30 cm,
    kullanılabilir yükseklik 28 cm. 5 mm köşebent çerçeve, ahşap çıtalar. İç derinlik ~85 cm, kullanılabilir boy
    110 cm (her yandan 5 cm pay → 100). Çıtalar **plaka giriş yönüne paralel** olmalı; dik çıtalı ranzada tuğla ucu
    boşluğa düşüp ezilir → lazerle tespit edilip ranza reddedilir. (Tarakta tuğla çıtaya düz konduğu için dik çıtada da
    ezilmiyor: fizikli simülasyonda 0° eğim, 0,07 mm iz; plakada 9,7°, 2,4 mm. Red kuralı korunacak mı konuşulmalı.)
13. **Ranza kaldırıcı:** hidrolik, 20 cm/s. Tarak sabit yükseklikte taşır; ranza sıradaki katı tarağın hizasına getirir.
    **En alt kat önce** (ranza boşken en yukarıda, kaldırma = (4 − dolu kat) × 30 cm).
    **Hat yüksekliği ve çukur (2026-11-18):** hat (pres ağzı, bant yüzeyi) zeminden ~1 m. Hatta seviye farkı yok;
    kot farkını kaldırıcı çukuru alır. Ranza ayağı boşken ~+65 cm, son katta ~−55 cm (çukurda), çukur ~77 cm.
    Ranza değişimi zeminde: dolu ranza zemine kalkar, boş ranza zeminden ilk kata kalkar. Toplam kaldırma
    (55 + 65 = 120 cm) ve süre 2D ile aynı.
14. **Ranza konumlama:** zincirli konveyör + pnömatik durdurma pimi + iki yandan senkron kendinden merkezli çene.
    Her kattan önce 2 lazer mesafe sensörü çıta yüksekliğini ve eğimi ölçer (tarak indirmesi buna göre ayarlanır).
15. **Ranza değişimi ve taşıma:** değişim 6 s; istasyon başına 3 boş giriş + 3 dolu çıkış tamponu.
    ~120 ranza/saat (iki istasyon toplam). 3 AGV (kaldırmalı, ranzanın altına girer), 60 s tur.
    **Akış (2026-11-18):** yükleme istasyonu (tabla → tampon → tarak → ranza) akış yönünde kalır. Boş ranzalar pres
    (kalıp) hizasından, hattın iki yanındaki zemin konveyöründe tuğlayla aynı yönde (+X) gelir; istasyonda yandan
    içe kaldırıcıya kayar. Dolu ranza düz ileri (+X) çıkış konveyörüne gider. İki akış kesişmez.
16. **Emniyet:** ilk birikme bölgesinde "kuyruk dolu" sensörü → PLC presi otomatik durdurur.


## Önceki tasarım: bantlı fırıncı plakası (2026-11-18 – 11-22; karşılaştırma için simülasyonda duruyor)
Tarak kesinleşince yerini bıraktı. Ana sahnede "Yükleyici: plaka", yükleme detayında "Bantlı plaka (önceki)" ile görülür;
yarı-statik iniş hesabı `src/sim/landing.ts`. Kararların özeti:
- **Fırıncı tipi plaka (geri çekilen bantlı yükleyici):** 88 cm bırakma boyu, ~100 cm en, toplam kalınlık ≤5 cm
    (ör. 10 adet 40×20×2 çelik kutu → uçta ~1,4 mm sehim). Uç makarası Ø12, plaka çıtaların ~5 mm üstünden geçer.
    Kalınlık 5 cm'de kalıyor (2026-11-22, kullanıcı seçti). İnceltme denendi: 3 cm (24 yatık 40×20×2, ~1,8 mm sehim) aynı
    inişi verir, sıra aralığını biraz daha korur; 3 cm'nin altında sehim 5 mm boşluğu yer.
    Strok 97 cm, 50 cm/s. Geri çekilirken bant aynı hızda ileri sarar → tuğla zemine göre durur, çıtaya iner.
    **Kılavuz:** plakanın iki yanında, ranzanın DIŞINDA biten sabit çelik profil ray. Plakanın arkasından iki yana
    50 cm (tercihen 60 cm) kol; her kolda 2 makara çifti (cam follower) rayı **alttan ve üstten** kavrar, biri
    eksantrik milli (boşluk alma). Altında araba YOK. Bant motoru plakanın arka kısmında.
    **Eğilir burun (2026-11-22, kullanıcı seçti; ilk taslak 2026-11-21: 11 cm, Ø20):** plakanın son **35 cm**'si menteşeli
    kama (ölçüler `PLAKA.burunBoy / burunCap / menteseCap`). Ranzaya girerken düz (plakanın tam 88 cm'si taşır), strok
    sonunda ~5° iner: alt yüzü çıtaların 5 mm üstünde ve çıtalara paralel, üst yüzü uzun, az eğimli rampa olur; geri
    çekilirken inik kalır, plaka ranzadan çıkarken kalkar. Menteşede bandın büküldüğü Ø20 makara, uçta **Ø12** makara.
    Menteşe 2. sıranın altında: burun inerken 1. sıra ve 2. sıranın burun üstündeki kısmı ~5° eğilir (kaymaz).
    Neden: kısa (11 cm) burunda tuğla menteşe üstünden dinamik devriliyordu (fizikli simülasyonda 27°, 79 cm/s). Uzun
    burunda tuğla rampadan yavaşça iner; belirleyici olan, ağırlık merkezi ucu geçtiğinde ön kenarın yüksekliği.
    Uç yüksekliği: 5 mm boşluk + Ø12 makara + 2 kat bant = 2,3 cm (Ø20 ile 3,1). Sabit burunda küçük makara işe yaramaz.
    Yarı-statik: sabit burun 5,5 cm / 30° → eğilir 2,3 cm / ~14° (`src/sim/landing.ts`). Fizikli: en çok ~10°, ~48 cm/s,
    kenar ezilmesi ~2,2 mm (`yukleme.html`).
    **Burun tahriki (2026-11-22, kullanıcı):** servoya bağlı metal plakalı kol (itme çubuğu + burna kaynaklı manivela),
    ölçüleri taslak. Burun menteşe makarasının ekseni etrafında döner (bant boyu değişmez). Kol, burnun üstündeki
    tuğlaların yükünü taşır (~25–35 kg, menteşeye göre ~50–60 N·m).
    **Uç makarası çıtaya değmez (2026-11-22, kullanıcı):** bant uç makarasının etrafından dolanır; geri çekilirken alt bant
    zemine göre 2× hızla ters yönde gider. Makara çıtada "yuvarlanamaz", değerse bant çıtaya sürter ve ranzayı plakaya
    doğru çeker. 5 mm boşluk kalır.
    **İleri-geri tahrik (2026-11-18):** zincir. Rayların dışında birer makaralı zincir, tamponun altından geçen ortak
    mille tek servo motordan sürülür (iki taraf mekanik senkron). Vidalı mil yok: yavaş ve araya bir şey sıkışmaya açık.

## İkinci ürün: yığma tuğla (tasarımı açık, 2026-11-18)
- 29 × 13,5 × 19 cm. Kalıp değişince 2 sütun çıkıyor (sütun eni 29), tel aralığı 13,5 cm (makinist ayarlıyor).
- Makine bunu da dizmeli. 29'luk kenarla 3 × 29 = 87 cm, ranzanın 90 cm'lik derinliğine sığmıyor.
- Elle diziliş (onaylı): önde ve arkada 29'luk kenarı plaka giriş yönünde (X) 6'şar tuğla, ortada yatay yatırılmış
  3 tuğla (29 Y yönünde) → kat başına 6 + 3 + 6 = 15 tuğla, derinlik ≈ 29 + 13,5 + 29 + aralıklar ≈ 75 cm, en ≈ 96 cm.
- Akış, kesici, birikme, ön hazırlık ve tabla bu ürün için henüz tasarlanmadı (ROADMAP'e bak).

## 2D simülasyonda doğrulanan sonuçlar (240/dk, varsayılanlar)
- Blok her 3,0 s; ön hazırlık ~330/dk'ya kadar yetişiyor (~%35–40 pay); ~360/dk'da taşıyor.
- Bölgeli bantta 0 temas. 240/dk'da kuyruk oluşmuyor, tek parça bantta da temas olmuyor; fark kuyruk oluşunca
  çıkıyor: 300/dk'da bölgeli bantta 0, tek parça bantta 10 dk'da yüzlerce temas.
- Plaka çevrimi ~5,4 s; her istasyona 12 s'de bir kat. Plaka ≥35 cm/s, kaldırıcı ≥20 cm/s şart.
- Tarak (2026-11-22): 3D mantık modelinde yükleyici çevrimi ~8,8 s'yi geçince (eşdeğer 22 cm/s) tablalar beklemeye,
  hat taşmaya başlıyor; tarağın çevrimi 50 cm/s'de 6,3 s (~%40 pay), 80 cm/s'de 4,7 s. 2D mantık plaka evreleriyle
  kaldı (2D eşdeğerlik testleri için); tarağın ek süreleri (iniş, şişirme, indirme, söndürme) çevrime sığıyor.
- 2 AGV teorik sınırda, 3 AGV önerilen.

## 3D'de özellikle görülmesi gerekenler
- Pop-up bantların sıra hizası ve kalkışı; kapaklar; artık iticiler.
- Tarağın tamponda inişi, dişlerin sütun aralıklarına girişi, yastıkların şişmesi; yan raylar + makara çiftleriyle
  ranzaya giriş, çıtaya indirme, söndürüp aralıklardan yatay geri çekilme.
- Ranza kaldırıcının kat kat inişi; tarak dişleri ile çıtalar / üst kat arası boşluk (çarpma kontrolü).
- Ranza değişimi, AGV giriş/çıkışı.
- Yaş tuğla için temas, kayma ve düşme sayaçları (2D'deki gibi).
