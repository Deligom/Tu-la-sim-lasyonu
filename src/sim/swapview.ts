// Ranza değişiminin görsel zaman çizelgesi (çizim için, mantık değil). Mantık 2D'deki sırayı izler:
// değişim (swapT) en alçakta, sonra boş ranza 120 cm kalkar. Sahada çukur var: dolu ranza önce zemine kalkar,
// değişim zeminde olur, boş ranza zeminden ilk kata kalkar. Toplam süre aynı (swapT + 120 / kaldırıcı hızı).

import { RACK_FEET_LOW, rackFeetZ } from './dims';

export type SwapStage = 'rise1' | 'exchange' | 'rise2';

export interface SwapView {
  stage: SwapStage;
  /** Kaldırıcı üstündeki ranzanın ayak yüksekliği (exchange'de zemin: 0) */
  feet: number;
  /** exchange aşamasında 0 → 1 */
  p: number;
}

/**
 * @param E değişim penceresinde geçen süre: swap aşamasında (swapT − timer), sonrasında swapT + lift / v
 * @param leavingReject çıkan ranza reddedilmiş boş ranza mı (zaten zeminde durur)
 */
export function swapView(E: number, liftSpeed: number, swapT: number, leavingReject: boolean): SwapView {
  const tR1 = -RACK_FEET_LOW / liftSpeed;
  if (E < tR1) return { stage: 'rise1', feet: leavingReject ? 0 : RACK_FEET_LOW + E * liftSpeed, p: 0 };
  if (E < tR1 + swapT) return { stage: 'exchange', feet: 0, p: (E - tR1) / swapT };
  return { stage: 'rise2', feet: Math.min(rackFeetZ(0), (E - tR1 - swapT) * liftSpeed), p: 1 };
}

/** Mantıktaki ranza durumundan değişim penceresindeki geçen süre; pencere dışında −1. */
export function swapElapsed(phase: string, timer: number, levels: number, lift: number, target: number, liftSpeed: number, swapT: number): number {
  if (phase === 'swap') return swapT - timer;
  if (phase === 'ok' && levels === 0 && lift < target) return swapT + lift / liftSpeed;
  return -1;
}
