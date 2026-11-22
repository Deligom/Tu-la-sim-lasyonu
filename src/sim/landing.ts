// Plakadan ranzaya iniş kontrolü (Aşama 5, öne alındı). Plaka geri çekilirken bant sarar, tuğla zemine göre yerinde
// durur; altındaki destek yüzeyi (plaka üstü → burun → çıtalar) değişir. Tuğla yarı-statik katı cisim olarak bu yüzeye
// oturur: ağırlık merkezinin altındaki en yüksek dayanak doğrusu = destek noktalarının üst dışbükey zarfı.
// Bir adımda köşe yüksekliği birden düşüyorsa tuğla devrilip düşüyor demektir.
//
// Yükseklikler aktif katın çıta üstüne göre (0 = çıta üstü), X ranza ön yüzüne göre (plaka +X'e girer). cm.

import { PLAKA, RANZA, TUGLA } from './dims';

export type NoseKind = 'sabit' | 'egilir';
export type SlatKind = 'paralel' | 'dik';

export interface LandingConfig {
  nose: NoseKind;
  /** Eğilir burnun menteşeden uca boyu */
  noseLen: number;
  /** Burun makarası çapı (≤ 2 cm) */
  rollerDia: number;
  /** Bant kalınlığı */
  beltThk: number;
  /** Plaka altı ile çıta üstü arası */
  clearance: number;
  plateThk: number;
  slat: SlatKind;
}

/**
 * Eğilir burun (2026-11-22): 35 cm, Ø12 mm uç makarası (PLAKA). Menteşe 2. sıranın altında: burun inerken (~5°)
 * 1. sıra ve 2. sıranın burun üstündeki kısmı burunla birlikte eğilir. İlk taslak 11 cm / Ø20 idi (`NOSE_SHORT`).
 */
export const NOSE_DEFAULT: LandingConfig = {
  nose: 'egilir',
  noseLen: PLAKA.burunBoy,
  rollerDia: PLAKA.burunCap,
  beltThk: 0.3,
  clearance: PLAKA.citaBoslugu,
  plateThk: PLAKA.kalinlik,
  slat: 'paralel',
};

/** İlk taslak (2026-11-21): 11 cm burun, Ø20 uç makarası. Karşılaştırma için. */
export const NOSE_SHORT: LandingConfig = { ...NOSE_DEFAULT, noseLen: 11, rollerDia: 2 };

/** Plaka üstü (bant yüzeyi) çıta üstünden ne kadar yukarıda */
export const topHeight = (c: LandingConfig) => c.clearance + c.plateThk;
/** İnmiş burnun ucunda bant yüzeyi: boşluk + makara + makaranın altından ve üstünden dolanan bant */
export const tipHeight = (c: LandingConfig) => c.clearance + c.rollerDia + 2 * c.beltThk;
/** Düz burnun uç kalınlığı (makara + iki kat bant) */
export const tipThickness = (c: LandingConfig) => c.rollerDia + 2 * c.beltThk;
/** Eğilir burnun inme açısı (radyan): üst yüz menteşe etrafında döner, uç tipHeight'a iner */
export const noseAngle = (c: LandingConfig) => Math.asin(Math.min(1, (topHeight(c) - tipHeight(c)) / c.noseLen));

/** Dik çıtaların X aralıkları (ranza yerel, sahnedeki modelle aynı) */
function dikSlats(): [number, number][] {
  const D = RANZA.derinlikX;
  const n = RANZA.dik.adet, w = RANZA.dik.en;
  const pitch = (D - 2 - w) / (n - 1);
  return Array.from({ length: n }, (_, k) => [1 + k * pitch, 1 + k * pitch + w] as [number, number]);
}
const DIK = dikSlats();
const GAP_DEPTH = -RANZA.katArasi; // çıta arası boşluk: altta bir sonraki kat

function slatAt(slat: SlatKind, x: number): number {
  if (slat === 'paralel') return 0;
  for (const [a, b] of DIK) if (x >= a && x <= b) return 0;
  return GAP_DEPTH;
}

interface Pt {
  x: number;
  z: number;
}

/**
 * Plaka ucunun (düz haldeki burun ucu) yerel X'i `tip`, burun inme oranı `k` (0 = düz, 1 = tam inmiş) iken
 * [a, b] aralığındaki destek noktaları.
 */
function supportPoints(c: LandingConfig, tip: number, k: number, a: number, b: number): Pt[] {
  const zu = topHeight(c);
  const lowered = c.nose === 'egilir' ? k : 0;
  const beta = noseAngle(c) * lowered;
  const hinge = tip - c.noseLen;
  const tipX = c.nose === 'egilir' ? hinge + c.noseLen * Math.cos(beta) : tip;
  const tipZ = c.nose === 'egilir' ? zu - c.noseLen * Math.sin(beta) : zu;
  const plate = (x: number) => {
    if (x > tipX) return -Infinity;
    if (c.nose === 'sabit' || x <= hinge) return zu;
    return zu - ((x - hinge) / (tipX - hinge)) * (zu - tipZ);
  };
  const S = (x: number) => Math.max(plate(x), slatAt(c.slat, x));
  const xs = new Set<number>([a, b]);
  const eps = 1e-6;
  const add = (x: number) => {
    for (const v of [x - eps, x, x + eps]) if (v >= a && v <= b) xs.add(v);
  };
  add(hinge);
  add(tipX);
  if (c.slat === 'dik') for (const [p, q] of DIK) {
    add(p);
    add(q);
  }
  return [...xs].sort((u, v) => u - v).map((x) => ({ x, z: S(x) }));
}

/** Üst dışbükey zarf (monoton zincir). */
function upperHull(pts: Pt[]): Pt[] {
  const h: Pt[] = [];
  for (const p of pts) {
    while (h.length >= 2) {
      const o = h[h.length - 2], q = h[h.length - 1];
      const cross = (q.x - o.x) * (p.z - o.z) - (q.z - o.z) * (p.x - o.x);
      if (cross >= 0) h.pop();
      else break;
    }
    h.push(p);
  }
  return h;
}

export interface BrickPose {
  /** Arka ve ön alt köşe yükseklikleri (çıta üstüne göre) */
  zRear: number;
  zFront: number;
  /** Öne eğim (radyan, + = ön aşağı) */
  tilt: number;
}

/** Arka kenarı x0'da olan tuğlanın, plaka ucu `tip`'teyken duruşu. */
export function brickPose(c: LandingConfig, x0: number, tip: number, k = 1): BrickPose {
  const L = TUGLA.boy;
  const a = x0, b = x0 + L, xc = x0 + L / 2;
  const hull = upperHull(supportPoints(c, tip, k, a, b));
  let i = hull.findIndex((p) => p.x > xc);
  if (i <= 0) i = Math.max(1, hull.length - 1);
  const p = hull[i - 1], q = hull[i];
  const m = q.x > p.x ? (q.z - p.z) / (q.x - p.x) : 0;
  const zAt = (x: number) => p.z + m * (x - p.x);
  return { zRear: zAt(a), zFront: zAt(b), tilt: Math.atan(-m) };
}

export interface RowResult {
  x0: number;
  /** Bir anda (devrilme / düşme) köşenin en büyük düşüşü */
  maxDrop: number;
  /** En büyük öne eğim, derece */
  maxTiltDeg: number;
  /** Köşenin çıta üstünün altına en çok girişi (dik çıtada boşluğa düşme), cm, ≥ 0 */
  maxDip: number;
}

export interface LandingResult {
  rows: RowResult[];
  maxDrop: number;
  maxTiltDeg: number;
  maxDip: number;
  /** Burun inme açısı, derece (sabit burunda 0) */
  noseDeg: number;
}

/**
 * Bir katın 4 sırasını, plaka ucu `tipStart`'tan ranza önünün gerisine çekilene kadar izler.
 * @param rowsX0 sıraların arka kenarları (ranza yerel)
 */
export function checkLanding(c: LandingConfig, rowsX0: number[], tipStart: number, stepCm = 0.02): LandingResult {
  const rows = rowsX0.map((x0) => {
    let prev = brickPose(c, x0, tipStart);
    let maxDrop = 0, maxTilt = Math.max(0, prev.tilt), maxDip = Math.max(0, -Math.min(prev.zRear, prev.zFront));
    for (let tip = tipStart - stepCm; tip > x0 - c.noseLen - 5; tip -= stepCm) {
      const p = brickPose(c, x0, tip);
      maxDrop = Math.max(maxDrop, prev.zRear - p.zRear, prev.zFront - p.zFront);
      maxTilt = Math.max(maxTilt, p.tilt);
      maxDip = Math.max(maxDip, -Math.min(p.zRear, p.zFront));
      prev = p;
    }
    return { x0, maxDrop, maxTiltDeg: (maxTilt * 180) / Math.PI, maxDip };
  });
  return {
    rows,
    maxDrop: Math.max(...rows.map((r) => r.maxDrop)),
    maxTiltDeg: Math.max(...rows.map((r) => r.maxTiltDeg)),
    maxDip: Math.max(...rows.map((r) => r.maxDip)),
    noseDeg: c.nose === 'egilir' ? (noseAngle(c) * 180) / Math.PI : 0,
  };
}
