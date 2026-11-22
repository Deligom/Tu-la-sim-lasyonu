// Yükleme detayı (fizikli iniş) parametreleri. Fizik motoru SI birimleriyle çalışır (m, kg, s, N);
// arayüz cm / mm / kPa gösterir. Ölçüler CLAUDE.md ve src/sim/dims.ts'den; kil sayıları TAHMİN, sahadaki
// düşürme denemesiyle ayarlanacak.

import { PLAKA, TUGLA } from '../sim/dims';

export type NoseKind = 'egilir' | 'sabit';
export type SlatKind = 'paralel' | 'dik';
/** Yükleyici: şişen yastıklı tarak tutucu (2026-11-22 kesin tasarım) ya da önceki bantlı fırıncı plakası (karşılaştırma) */
export type LoaderKind = 'plaka' | 'tarak';

export interface PhysConfig {
  loader: LoaderKind;
  // ---- tarak tutucu (loader = 'tarak') ----
  /** Yastık basıncı (Pa). Ped kuvveti = basınç × ped alanı */
  padP: number;
  /** Ped (tırtıklı kauçuk) – yaş kil sürtünmesi */
  muPad: number;
  /** Dişin sönükken toplam kalınlığı (m), sütun aralığı 3 cm */
  toothT: number;
  /** Pedin her yana en çok açılması (m), kılavuzdaki strok sınırı */
  padStroke: number;
  /** Diş alt ucundaki pah (m, 45°) */
  toothChamfer: number;
  /** Sütun hizasızlığı, en fazla (m); sütunlara sabit bir desenle dağılır */
  colErr: number;
  /** Bırakma yüksekliği: yastıklar sönerken tuğla altı ile çıta üstü arası (m) */
  setGap: number;
  /** Son yaklaşma hızı (m/s), son 1 cm */
  vSet: number;
  /** Alırken tamponda kaldırma (m) */
  liftPick: number;
  /** Şişirme / vakumla söndürme süreleri (s) */
  inflT: number;
  deflT: number;
  // ---- plaka ve burun ----
  nose: NoseKind;
  /** Menteşe ekseninden düz burnun ucuna (m) */
  noseLen: number;
  /** Uç makarası çapı (m) */
  tipRollerDia: number;
  /** Menteşede bandın büküldüğü makara çapı (m) */
  hingeRollerDia: number;
  /** Bant kalınlığı (m) */
  beltThk: number;
  /** Plaka altı ile çıta üstü arası (m) */
  clearance: number;
  /** Plaka toplam kalınlığı (m) */
  plateThk: number;
  /** Plaka bırakma boyu (m) */
  plateLen: number;
  /** Strok (m) */
  stroke: number;
  /** Plaka hızı (m/s) */
  vPlate: number;
  /** Plaka ivmesi (m/s²) */
  aPlate: number;
  /** Burnun inme süresi, servo + kol (s) */
  noseT: number;
  /** Bant hızının plaka hızına göre hatası (0,02 = bant %2 hızlı) */
  syncErr: number;
  /** Tam yükte (24 tuğla) plaka ucu sehimi (m) */
  sagFull: number;
  // ---- kat düzeni ----
  /** Sıralar arası boşluk (m). Hatta 2 cm (ön hazırlık servosu); 4 × 19 + 3 × aralık plakaya sığmalı (≤ 86 cm). */
  rowGap: number;
  // ---- ranza ----
  slat: SlatKind;
  /** Çıta üst yüzü yükseklik sapması, en fazla (m). Sabit bir desenle çıtalara dağıtılır. */
  slatDev: number;
  // ---- yaş kil ----
  /** Winkler yatak katsayısı (Pa/m = N/m³): basınç = k × batma */
  kW: number;
  /** Plastik akma basıncı (Pa): bunun üstünde köşe kalıcı ezilir */
  pY: number;
  /** Boşaltma rijitliği / yükleme rijitliği: büyükse batmanın çoğu kalıcı iz olur (yaş kil) */
  kUnload: number;
  /** Temas sönümü, tam yüz temasında kritik sönüme oranı */
  zeta: number;
  /** Kenar temasında, her kenar parçasının kendi rijitliğine göre kritik sönüm oranı (yaş kil sekmez) */
  zetaEdge: number;
  /** Sürtünme katsayıları */
  muBelt: number;
  muWood: number;
  muClay: number;
  /** Plakanın alt bandı ile ahşap çıta arası */
  muBeltWood: number;
  // ---- tuğla ----
  mass: number;
  L: number;
  W: number;
  H: number;
  // ---- sayısal ----
  /** Zaman adımı (s) */
  dt: number;
  /** Kayıt sıklığı (kare/s) */
  fps: number;
}

export const PHYS_DEFAULT: Readonly<PhysConfig> = Object.freeze({
  loader: 'tarak',
  padP: 6000,
  muPad: 0.4,
  toothT: 0.02,
  padStroke: 0.008,
  toothChamfer: 0.004,
  colErr: 0,
  setGap: 0.001,
  vSet: 0.02,
  liftPick: 0.005,
  inflT: 0.25,
  deflT: 0.2,
  nose: 'egilir',
  noseLen: PLAKA.burunBoy / 100,
  tipRollerDia: PLAKA.burunCap / 100,
  hingeRollerDia: PLAKA.menteseCap / 100,
  beltThk: 0.003,
  clearance: PLAKA.citaBoslugu / 100,
  plateThk: PLAKA.kalinlik / 100,
  plateLen: PLAKA.boy / 100,
  stroke: 0.97,
  vPlate: 0.5,
  aPlate: 2,
  noseT: 0.25,
  syncErr: 0,
  sagFull: 0.0014,
  rowGap: 0.02,
  slat: 'paralel',
  slatDev: 0,
  kW: 2e8,
  pY: 2.5e5,
  kUnload: 10,
  zeta: 0.3,
  zetaEdge: 0,
  muBelt: 0.6,
  muWood: 0.5,
  muClay: 0.6,
  muBeltWood: 0.35,
  mass: TUGLA.kutleKg,
  L: TUGLA.boy / 100,
  W: TUGLA.en / 100,
  H: TUGLA.yukseklik / 100,
  dt: 2e-4,
  fps: 240,
} satisfies PhysConfig);

export function physConfig(over: Partial<PhysConfig> = {}): PhysConfig {
  return { ...PHYS_DEFAULT, ...over };
}
