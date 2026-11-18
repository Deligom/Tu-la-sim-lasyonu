// Simülasyon durumundan özet sayılar (2D'deki updateUI() / theo() hesaplarıyla aynı).

import type { Params } from './params';
import type { SimState } from './model';

export const avg = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function theory(P: Readonly<Params>) {
  const rmin = Math.min(...P.rate);
  const bpm = 3 * rmin;
  return { rmin, bpm, cutT: (P.N * 60) / rmin, blockT: (12 / bpm) * 60, levelT: (24 / bpm) * 60, rackT: (120 / bpm) * 60 };
}

export interface Summary {
  /** Üretim, tuğla/dk (ilk 8 s ısınma) */
  perMin: number | null;
  contacts: number;
  slips: number;
  lost: number;
  levels: number;
  racks: number;
  /** Ortalama blok çevrimi, s */
  blockT: number | null;
  midScrap: number;
  anomaly: SimState['anomaly'];
}

export function summarize(S: SimState): Summary {
  const m = S.t / 60;
  return {
    perMin: S.t > 8 ? S.produced / m : null,
    contacts: S.contacts,
    slips: S.slips,
    lost: S.lost,
    levels: S.levels,
    racks: S.sides[0].racks + S.sides[1].racks,
    blockT: avg(S.blockTimes),
    midScrap: S.midScrap,
    anomaly: S.anomaly,
  };
}
