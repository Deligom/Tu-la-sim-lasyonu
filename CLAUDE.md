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

## Koordinatlar
- X: akış yönü (kalıp → ön hazırlık → tampon → plaka → ranza).
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
10. **Tampon:** 1 katlık bölgeli bant, 100 cm/s (bant durur, tuğla altından kaymaz).
11. **Fırıncı tipi plaka (geri çekilen bantlı yükleyici):** 88 cm bırakma boyu, ~100 cm en, toplam kalınlık ≤5 cm
    (ör. 10 adet 40×20×2 çelik kutu → uçta ~1,4 mm sehim). Burun makarası ≤20 mm, plaka çıtaların ~5 mm üstünden geçer.
    Strok 97 cm, 50 cm/s. Geri çekilirken bant aynı hızda ileri sarar → tuğla zemine göre durur, çıtaya iner.
    **Kılavuz:** plakanın iki yanında, ranzanın DIŞINDA biten sabit çelik profil ray. Plakanın arkasından iki yana
    50 cm (tercihen 60 cm) kol; her kolda 2 makara çifti (cam follower) rayı **alttan ve üstten** kavrar, biri
    eksantrik milli (boşluk alma). Altında araba YOK. Bant motoru plakanın arka kısmında.
    **Eğilir burun (2026-11-21, kullanıcı önerisi, ölçüler taslak):** plakanın son 11 cm'si menteşeli kama. Ranzaya
    girerken düz (plakanın tam 88 cm'si taşır), strokun son 2 cm'sinde ~13° iner: alt yüzü çıtaların 5 mm üstünde ve
    çıtalara paralel, üst yüzü rampa olur; geri çekilirken inik kalır, plaka ranzadan çıkarken kalkar. Menteşede bandın
    büküldüğü makara, uçta Ø20 mm makara. Menteşe ön sıradaki tuğlanın ağırlık merkezinin önünde (inerken tuğla oynamaz).
    Tuğlanın burundan inişi: sabit burunda 5,5 cm / 30° devrilme → eğilir burunda ~3,1 cm / ~18° (kalan düşüşü uç
    yüksekliği belirler: 5 mm boşluk + Ø20 makara + 2 kat bant). Hesap: `src/sim/landing.ts`.
    **İleri-geri tahrik (2026-11-18):** zincir. Rayların dışında birer makaralı zincir, tamponun altından geçen ortak
    mille tek servo motordan sürülür (iki taraf mekanik senkron). Vidalı mil yok: yavaş ve araya bir şey sıkışmaya açık.
12. **Ranza:** 120 (boy, Y) × 90 (derinlik, X) × 150 cm (en üst tuğlayla 180), 5 kat, kat arası 30 cm,
    kullanılabilir yükseklik 28 cm. 5 mm köşebent çerçeve, ahşap çıtalar. İç derinlik ~85 cm, kullanılabilir boy
    110 cm (her yandan 5 cm pay → 100). Çıtalar **plaka giriş yönüne paralel** olmalı; dik çıtalı ranzada tuğla ucu
    boşluğa düşüp ezilir → plaka ucundaki lazer ile tespit edilip ranza reddedilir.
13. **Ranza kaldırıcı:** hidrolik, 20 cm/s. Plaka sabit yükseklikte; ranza sıradaki katı plaka hizasına getirir.
    **En alt kat önce** (ranza boşken en yukarıda, kaldırma = (4 − dolu kat) × 30 cm).
    **Hat yüksekliği ve çukur (2026-11-18):** hat (pres ağzı, bant yüzeyi) zeminden ~1 m. Hatta seviye farkı yok;
    kot farkını kaldırıcı çukuru alır. Ranza ayağı boşken ~+65 cm, son katta ~−55 cm (çukurda), çukur ~77 cm.
    Ranza değişimi zeminde: dolu ranza zemine kalkar, boş ranza zeminden ilk kata kalkar. Toplam kaldırma
    (55 + 65 = 120 cm) ve süre 2D ile aynı.
14. **Ranza konumlama:** zincirli konveyör + pnömatik durdurma pimi + iki yandan senkron kendinden merkezli çene.
    Her kattan önce plaka ucundaki 2 lazer mesafe sensörü çıta yüksekliğini ve eğimi ölçer.
15. **Ranza değişimi ve taşıma:** değişim 6 s; istasyon başına 3 boş giriş + 3 dolu çıkış tamponu.
    ~120 ranza/saat (iki istasyon toplam). 3 AGV (kaldırmalı, ranzanın altına girer), 60 s tur.
    **Akış (2026-11-18):** yükleme istasyonu (tabla → tampon → plaka → ranza) akış yönünde kalır. Boş ranzalar pres
    (kalıp) hizasından, hattın iki yanındaki zemin konveyöründe tuğlayla aynı yönde (+X) gelir; istasyonda yandan
    içe kaldırıcıya kayar. Dolu ranza düz ileri (+X) çıkış konveyörüne gider. İki akış kesişmez.
16. **Emniyet:** ilk birikme bölgesinde "kuyruk dolu" sensörü → PLC presi otomatik durdurur.

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
- 2 AGV teorik sınırda, 3 AGV önerilen.

## 3D'de özellikle görülmesi gerekenler
- Pop-up bantların sıra hizası ve kalkışı; kapaklar; artık iticiler.
- Plakanın yan raylar + makara çiftleriyle ranzaya girişi, geri çekilirken bant sarma (peel-off), burun düşüşü.
- Ranza kaldırıcının kat kat inişi; plaka ile çıtalar arası boşluk (çarpma kontrolü).
- Ranza değişimi, AGV giriş/çıkışı.
- Yaş tuğla için temas, kayma ve düşme sayaçları (2D'deki gibi).
