// Yükseklikler ve parça ölçüleri (cm). CLAUDE.md'deki kararlar burada tek yerde; sahne de testler de
// buradan okur. Plan yerleşimi (X, Y) için geometry.ts'ye bak.

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
  /** Burun makarası çapı, en fazla 20 mm */
  burunCap: 2,
  /** Plakanın arkasından iki yana uzanan kollar ve üzerindeki makara çiftleri arası */
  kolBoy: 50,
  makaraArasi: 40,
  /** 10 adet 40×20×2 mm kutu profil (dik duruyor) */
  profilAdet: 10,
} as const;

/** Plaka sabit yükseklikte. Aktif katın çıta üstü buraya gelir (ranza boşken kaldırma 120 cm). */
export const AKTIF_CITA_Z = 150;
/** Pop-up bantlar çevredeki taşıma yüzeyinin bu kadar üstüne çıkar (3–5 mm). */
export const POP_KALKIS = 0.4;
/** Pop-up bantlar dinlenmede yüzeyin bu kadar altında bekler. */
export const POP_INIS = 1.2;

/**
 * Taşıma yüzeyi yükseklikleri. CLAUDE.md'de hat yüksekliği yok; plakanın sabit yüksekliğinden geriye
 * doğru türetildi: plaka üstü = tampon üstü = tablanın boyuna pop-up'ı kalkmış hali; her aktarmada
 * alan taraf veren taraftan 4 mm yukarıdan alır.
 */
export const Z = (() => {
  const plakaAlt = AKTIF_CITA_Z + PLAKA.citaBoslugu;
  const plakaUst = plakaAlt + PLAKA.kalinlik;
  const tablaEnine = plakaUst - POP_KALKIS;
  const hat = tablaEnine - POP_KALKIS; // birikme bantları ve ön hazırlık makaraları üstü
  return {
    aktifCita: AKTIF_CITA_Z,
    plakaAlt,
    plakaUst,
    tampon: plakaUst,
    tablaBoyunaUst: plakaUst,
    tablaEnine,
    popUst: tablaEnine,
    hat,
    popAlt: hat - POP_INIS,
    tablaBoyunaAlt: tablaEnine - POP_INIS,
  };
})();

/** Dolu kat sayısına göre ranza kaldırma yüksekliği: (4 − dolu) × 30. En alt kat önce. */
export function rackLiftFor(filledLevels: number): number {
  return (RANZA.katSayisi - 1 - filledLevels) * RANZA.katArasi;
}

/** j. katın (0 = en alt) çıta üstü, verilen kaldırma yüksekliğinde. */
export function slatTopZ(level: number, lift: number): number {
  return lift + RANZA.ilkKat + level * RANZA.katArasi;
}

/** Plakadaki tuğlanın üstü ile bir üst katın en alçak noktası (kat rayının alt yüzü) arası. */
export function upperLevelClearance(): number {
  const tuglaUst = PLAKA.citaBoslugu + PLAKA.kalinlik + TUGLA.yukseklik;
  const ustKatAlt = RANZA.katArasi - RANZA.rayKenar;
  return ustKatAlt - tuglaUst;
}
