// Hattın plan yerleşimi (X ve Y). X konumları referans-2d-simulasyon.html içindeki geom() ile
// birebir aynı formüllerle hesaplanır; test/geometry.test.ts bunu 2D dosyasının kendisiyle karşılaştırır.
//
// Koordinatlar (CLAUDE.md): X akış yönü, Y enine (A tarafı +Y, B tarafı −Y), Z yukarı. Birim cm.
// 2D'de Y ekseni çizim için kaydırılmıştı (Y0). 3D'de orta şeridin ekseni Y = 0.

import type { Params } from './params';

export type ZoneKind = 'R' | 'A' | 'D'; // R: hızlandırma, A: birikme, D: dozaj
export interface Zone {
  s: number;
  e: number;
  k: ZoneKind;
}
export type Side = 0 | 1; // 0 = A (+Y), 1 = B (−Y)

export interface PlanLayout {
  L: number;
  W: number;
  /** Şerit aralığı (tuğla eni + boşluk) */
  PITCH: number;
  /** 3 şeritlik blok genişliği */
  BW: number;
  /** Pop-up ile bloğun tablaya kayması: yakın yarı / uzak yarı */
  TD1: number;
  TD2: number;
  /** Kesici tablası başı (ayırma teli) */
  X_CUT: number;
  /** Kesici tablası sonu = hızlandırma başı */
  X_BELT: number;
  /** Hızlandırma sonu */
  R_END: number;
  zones: Zone[];
  /** Dozaj ucu */
  GATE: number;
  /** Kapak çizgisi */
  G2: number;
  /** Ön hazırlık başı */
  E: number;
  /** Ön hazırlık sonu (durdurucu) */
  ZEND: number;
  /** Tampon başı ve boyu */
  BUF0: number;
  BL: number;
  /** Plakanın bekleme konumunda arka ucu, plaka boyu, strok */
  PL0: number;
  PLEN: number;
  DX: number;
  /** Ranza ön yüzü */
  RK0: number;
  /** Pop-up yan transferde bloğun ön hazırlıktan tamamen çıkması için gereken yol */
  CLEAR: number;
  /** 2D'deki Y değerinden 3D Y'ye geçiş: y3 = y2 − Y_REF_2D */
  Y_REF_2D: number;
  /** Şeridin −Y kenarı (tuğlanın kenarı) */
  laneMinY(i: number): number;
  laneCenterY(i: number): number;
  /** Tabla / tampon / plaka bandının Y aralığı (2D'deki band()) */
  band(side: Side): [number, number];
  sideCenterY(side: Side): number;
  /** Ön hazırlıkta k. sıranın arka kenarı (k = 0 en öndeki sıra) */
  rowBack(k: number): number;
}

export function planLayout(p: Readonly<Params>): PlanLayout {
  const L = p.L;
  const W = p.W;
  const PITCH = W + p.gap;
  const BW = 3 * PITCH - p.gap;
  const TD1 = BW + 9;
  const TD2 = TD1 + 3 * PITCH;
  const Y0 = TD2 + 17; // yalnızca 2D ile eşleme için
  const X_CUT = 30;
  const X_BELT = X_CUT + p.N * L;
  const R_END = X_BELT + 60;
  const zones: Zone[] = [{ s: X_BELT, e: R_END, k: 'R' }];
  for (let j = 0; j < p.nZones; j++) zones.push({ s: R_END + j * p.ZL, e: R_END + (j + 1) * p.ZL, k: 'A' });
  const GATE = R_END + (p.nZones + 1) * p.ZL;
  zones.push({ s: GATE - p.ZL, e: GATE, k: 'D' });
  const G2 = GATE + 1;
  const E = GATE + 2;
  const ZEND = E + 4 * L + 3 * 2; // 4 sıra, 2 cm aralık
  const BUF0 = ZEND + 3;
  const BL = p.Bcap * 92;
  const PL0 = BUF0 + BL;
  const PLEN = 88;
  const DX = 97;
  const RK0 = PL0 + DX;
  const Y_REF_2D = Y0 + PITCH + W / 2;

  const band2d = (s: Side): [number, number] =>
    s === 0 ? [Y0 + TD1 - 3, Y0 + TD2 + BW + 3] : [Y0 - TD2 - 3, Y0 - TD1 + BW + 3];

  return {
    L, W, PITCH, BW, TD1, TD2, X_CUT, X_BELT, R_END, zones, GATE, G2, E, ZEND,
    BUF0, BL, PL0, PLEN, DX, RK0, CLEAR: BW + 1, Y_REF_2D,
    laneMinY: (i) => Y0 + i * PITCH - Y_REF_2D,
    laneCenterY: (i) => Y0 + i * PITCH + W / 2 - Y_REF_2D,
    band: (s) => {
      const [a, b] = band2d(s);
      return [a - Y_REF_2D, b - Y_REF_2D];
    },
    sideCenterY: (s) => {
      const [a, b] = band2d(s);
      return (a + b) / 2 - Y_REF_2D;
    },
    rowBack: (k) => ZEND - L - k * (L + 2),
  };
}

/** Pop-up enine bantlarının X konumları: her sıranın arka kenarından 3 / 9,5 / 16 cm (12 bant). */
export const POPUP_BAND_OFFSETS = [3, 9.5, 16] as const;
export function popupBandX(lay: PlanLayout): number[] {
  const xs: number[] = [];
  for (let k = 3; k >= 0; k--) for (const o of POPUP_BAND_OFFSETS) xs.push(lay.rowBack(k) + o);
  return xs;
}

/**
 * Ön hazırlık makaralarının X konumları: bantların arasında, sıra başına 2 makara, sıra aralarında birer
 * makara, iki uçta birer makara. Makara Ø2,5 cm, bant 1,6 cm; birbirine değmezler (testte kontrol ediliyor).
 */
export function prepRollerX(lay: PlanLayout): number[] {
  const xs = [lay.E + 0.5];
  for (let k = 3; k >= 0; k--) {
    const rb = lay.rowBack(k);
    xs.push(rb + 6.25, rb + 12.75);
    if (k > 0) xs.push(rb + lay.L + 1); // sıra arası boşluğun ortası
  }
  xs.push(lay.ZEND - 0.5);
  return xs;
}

/** A tablasında (ve aynalısı B'de) 6 tuğla sütununun Y merkezleri. */
export function tableColumnY(lay: PlanLayout, side: Side): number[] {
  const sgn = side === 0 ? 1 : -1;
  const ys: number[] = [];
  for (const td of [lay.TD1, lay.TD2]) for (let i = 0; i < 3; i++) ys.push(lay.laneCenterY(i) + sgn * td);
  return ys.sort((a, b) => a - b);
}
