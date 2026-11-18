import { describe, expect, it } from 'vitest';
import { planLayout } from '../src/sim/geometry';
import { DEFAULT_PARAMS } from '../src/sim/params';
import { RANZA, RANZA_AKIS } from '../src/sim/dims';

// Ölçüler istasyon merkezinden (dışa doğru +). Sahnedeki parçalarla aynı sayılar (src/scene/station.ts).
const LIFTER_POST_OUT = 72.6; // kolon + kızak dış yüzü
const RAIL_CHAIN_OUT = 58.0; // plaka zincir tahrikinin en dış parçası
const half = RANZA.boyY / 2;

describe('ranza akışı: boşlar yandan girer, dolular ileri çıkar', () => {
  const lay = planLayout(DEFAULT_PARAMS);
  const c = lay.sideCenterY(0);

  it('giriş konveyörü istasyonun dışında, kaldırıcı kolonlarına ve çukura değmiyor', () => {
    const laneIn = RANZA_AKIS.girisY - half;
    expect(laneIn).toBeGreaterThan(LIFTER_POST_OUT);
    expect(laneIn).toBeGreaterThan(RANZA_AKIS.cukurDis);
    expect(RANZA_AKIS.cukurDis).toBeGreaterThan(RANZA_AKIS.zincirDis);
    expect(laneIn - RANZA_AKIS.zincirDis).toBeLessThanOrEqual(1.5); // ayak boşluğa düşmez
    expect(RAIL_CHAIN_OUT).toBeLessThan(laneIn);
  });

  it('giriş konveyörü hattın yanından geçiyor (tabla, tampon, dönüş bandı)', () => {
    const laneInY = c + RANZA_AKIS.girisY - half;
    const [, tableOut] = lay.band(0);
    expect(laneInY).toBeGreaterThan(tableOut + 20);
    expect(laneInY).toBeGreaterThan(67 + 50); // yan dönüş bandının dış kenarı + yürüme payı
  });

  it('yandan girişte ranza kolonların arasından geçer, ileri çıkışta arka kolonların arasından', () => {
    expect(half).toBeLessThan(64); // kolonlar Y'de ranzanın dışında
    expect(RANZA_AKIS.cukurOn).toBeGreaterThan(8 + 4); // ön kolonlar X'te ranzanın önünde
    expect(RANZA_AKIS.cukurArka).toBeGreaterThan(8 + 2);
  });

  it('A ve B çıkış konveyörleri birbirine değmiyor', () => {
    expect(c - half).toBeGreaterThan(0);
  });
});
