// Yükseklikler ve parça ölçüleri (cm). CLAUDE.md'deki kararlar burada tek yerde; sahne de testler de
// buradan okur. Plan yerleşimi (X, Y) için geometry.ts'ye bak.

/** Tam sayıyı ya da ondalığı Türkçe yaz (95.3 → "95,3"). */
export const tr0 = (v: number): string => String(Math.round(v * 10) / 10).replace('.', ',');

export const TUGLA = { boy: 19, en: 13.5, yukseklik: 19, kutleKg: 3.5 } as const;

export const RANZA = {
  boyY: 120,
  derinlikX: 90,
  cerceveYuk: 150,
  /** En üst kat yüklenirken tuğlanın ulaştığı zarf yüksekliği */
  zarf: 180,
  katSayisi: 5,
  katArasi: 30,
  /** En alt katın çıta üstü, ranza ayağından */
  ilkKat: 30,
  citaKalinlik: 2,
  /** Kat rayı köşebendi: L25×25×5, dik kol üstü çıta üstüyle aynı hizada */
  rayKenar: 2.5,
  /** Dikme köşebendi: L40×40×5 */
  dikmeKenar: 4,
  sac: 0.5,
  /** Plaka giriş yönüne paralel çıtalar (doğru tip) */
  paralel: { adet: 14, en: 5 },
  /** Plaka giriş yönüne dik çıtalar (tuğla ucu boşluğa düşer → red) */
  dik: { adet: 8, en: 7 },
} as const;

export const PLAKA = {
  /** Bırakma boyu */
  boy: 88,
  en: 100,
  /** Toplam kalınlık (üst + alt bant dahil), en fazla 5 cm */
  kalinlik: 5,
  /** Plaka altı ile çıta üstü arası */
  citaBoslugu: 0.5,
  /**
   * Eğilir burun (2026-11-22, kullanıcı seçti; fizikli yükleme detayında denendi): menteşeden uca 35 cm, uçta Ø12 mm
   * makara, menteşede Ø20 mm makara. Servo + metal plakalı kol indirir (~5°).
   */
  burunBoy: 35,
  /** Uç (burun) makarası çapı */
  burunCap: 1.2,
  /** Menteşede bandın büküldüğü makara çapı */
  menteseCap: 2,
  /** Plakanın arkasından iki yana uzanan kollar ve üzerindeki makara çiftleri arası */
  kolBoy: 50,
  makaraArasi: 40,
  /** 10 adet 40×20×2 mm kutu profil (dik duruyor) */
  profilAdet: 10,
} as const;

/**
 * Hattın taşıma yüzeyi (birikme bantları, ön hazırlık makaraları üstü) zeminden yüksekliği.
 * Sahada pres ağzı / kesici tablası ~1 m (2026-11-18). Ölçülünce yalnızca bu sayı değişir.
 */
export const HAT_Z = 100;
/** Pop-up bantlar çevredeki taşıma yüzeyinin bu kadar üstüne çıkar (3–5 mm). */
export const POP_KALKIS = 0.4;
/** Pop-up bantlar dinlenmede yüzeyin bu kadar altında bekler. */
export const POP_INIS = 1.2;

/**
 * Taşıma yüzeyi yükseklikleri. Her aktarmada alan taraf veren taraftan 4 mm yukarıdan alır:
 * hat → pop-up / tabla enine → tabla boyuna (kalkık) = tampon = plaka üstü. Plaka sabit; aktif katın
 * çıta üstü plakanın 5 mm altında. Hat 1 m'de olduğu için ranza kaldırıcı çukurda çalışır.
 */
export const Z = (() => {
  const hat = HAT_Z;
  const tablaEnine = hat + POP_KALKIS;
  const plakaUst = tablaEnine + POP_KALKIS;
  const plakaAlt = plakaUst - PLAKA.kalinlik;
  return {
    hat,
    popAlt: hat - POP_INIS,
    popUst: tablaEnine,
    tablaEnine,
    tablaBoyunaAlt: tablaEnine - POP_INIS,
    tablaBoyunaUst: plakaUst,
    tampon: plakaUst,
    plakaUst,
    plakaAlt,
    aktifCita: plakaAlt - PLAKA.citaBoslugu,
  };
})();

/** Dolu kat sayısına göre ranza kaldırma: (4 − dolu) × 30, en alçak konuma göre. En alt kat önce. */
export function rackLiftFor(filledLevels: number): number {
  return (RANZA.katSayisi - 1 - filledLevels) * RANZA.katArasi;
}

/** Ranza ayağının zeminden yüksekliği (eksi = çukurda), dolu kat sayısına göre. */
export function rackFeetZ(filledLevels: number): number {
  return Z.aktifCita - RANZA.ilkKat - filledLevels * RANZA.katArasi;
}

/** Kaldırıcının en alçak konumunda ranza ayağı (son kat yüklenirken). */
export const RACK_FEET_LOW = rackFeetZ(RANZA.katSayisi - 1);
/** Ranza değişimi zeminde (AGV / zincirli konveyör seviyesi): en alçak konumdan bu kadar kalkık. */
export const RACK_SWAP_LIFT = -RACK_FEET_LOW;
/** Kaldırıcı çukuru derinliği: en alçakta ranza ayağı + platform (12 cm) + 10 cm pay. */
export const PIT_DEPTH = Math.ceil(-RACK_FEET_LOW + 12 + 10);

/** j. katın (0 = en alt) çıta üstü, ranza ayağı feetZ yüksekliğindeyken. */
export function slatTopZ(level: number, feetZ: number): number {
  return feetZ + RANZA.ilkKat + level * RANZA.katArasi;
}

/** Plakadaki tuğlanın üstü ile bir üst katın en alçak noktası (kat rayının alt yüzü) arası. */
export function upperLevelClearance(): number {
  const tuglaUst = PLAKA.citaBoslugu + PLAKA.kalinlik + TUGLA.yukseklik;
  const ustKatAlt = RANZA.katArasi - RANZA.rayKenar;
  return ustKatAlt - tuglaUst;
}

/**
 * Ranza akışı (2026-11-18). Boş ranzalar hattın iki yanındaki zemin konveyöründe, pres tarafından tuğlayla aynı
 * yönde (+X) gelir; istasyonda yandan içe (A: −Y, B: +Y) kaldırıcıya kayar. Dolu ranza düz ileri (+X) çıkış
 * konveyörüne gider. İki akış kesişmez. Mesafeler istasyon merkezinden (dışa doğru +), cm.
 */
export const RANZA_AKIS = {
  /** Giriş konveyörünün ekseni */
  girisY: 142,
  /** Kaldırıcıdaki Y zincirlerinin dış ucu (giriş konveyörüne değer) */
  zincirDis: 81,
  /** Çukurun dış kenarı */
  cukurDis: 81.5,
  /** Çukur, ranza ön yüzünden bu kadar önde başlar ve arka yüzünden bu kadar geride biter */
  cukurOn: 13.5,
  cukurArka: 13,
  /** Konveyörde ranza adımı (90 cm derinlik + 20 cm aralık) */
  adim: 110,
  /** Girişte bekleyen boş ranza sayısı (CLAUDE.md: 3 boş giriş tamponu) */
  girisTampon: 3,
  /** Çıkışta dolu ranza yeri (CLAUDE.md: 3 dolu çıkış tamponu) */
  cikisTampon: 3,
} as const;
