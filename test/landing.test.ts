import { describe, expect, it } from 'vitest';
import { NOSE_DEFAULT, brickPose, checkLanding, noseAngle, tipHeight, tipThickness, topHeight } from '../src/sim/landing';
import { planLayout, tableColumnY } from '../src/sim/geometry';
import { DEFAULT_PARAMS } from '../src/sim/params';
import { PLAKA, RANZA, TUGLA } from '../src/sim/dims';

const lay = planLayout(DEFAULT_PARAMS);
// Katın sıraları ranzada (2D'nin plaka hesabı): tabla → tampon ucu → +strok
const shift = lay.PL0 + lay.PLEN - 2 - lay.ZEND + lay.DX - lay.RK0;
const rows = [3, 2, 1, 0].map((k) => lay.rowBack(k) + shift);
const tipStart = lay.PL0 + lay.DX + lay.PLEN - lay.RK0;

describe('plakadan çıtaya iniş', () => {
  it('kat ranzanın içinde, plaka ucu tam girişte ranzanın arka yüzünün önünde', () => {
    expect(rows[0]).toBeGreaterThan(0);
    expect(rows[3] + TUGLA.boy).toBeLessThan(RANZA.derinlikX);
    expect(tipStart).toBeLessThanOrEqual(RANZA.derinlikX - 1.5);
    expect(tableColumnY(lay, 0)).toHaveLength(6);
  });

  it('sabit burun: ön kenar 5,5 cm düşüyor, tuğla ~30° devriliyor', () => {
    const r = checkLanding({ ...NOSE_DEFAULT, nose: 'sabit' }, rows, tipStart);
    expect(r.maxDrop).toBeCloseTo(topHeight(NOSE_DEFAULT), 1);
    expect(r.maxTiltDeg).toBeGreaterThan(29);
    expect(r.maxDip).toBeLessThan(1e-9);
  });

  it('eğilir burun (11 cm): düşüş uç yüksekliğine iner (~3,1 cm), eğim ~18°', () => {
    const r = checkLanding(NOSE_DEFAULT, rows, tipStart);
    expect(r.maxDrop).toBeCloseTo(tipHeight(NOSE_DEFAULT), 1);
    expect(r.maxDrop).toBeLessThan(0.6 * topHeight(NOSE_DEFAULT));
    expect(r.maxTiltDeg).toBeLessThan(19);
    expect(r.noseDeg).toBeGreaterThan(10);
    expect(r.noseDeg).toBeLessThan(14);
  });

  it('inmiş burun çıtalara değmiyor: uç altı 5 mm yukarıda, alt yüz çıtalara paralel', () => {
    const b = noseAngle(NOSE_DEFAULT);
    const tipBottom = topHeight(NOSE_DEFAULT) - NOSE_DEFAULT.noseLen * Math.sin(b) - tipThickness(NOSE_DEFAULT);
    expect(tipBottom).toBeCloseTo(PLAKA.citaBoslugu, 6);
    // düz haldeki alt yüz eğimi ≈ inme açısı (çizimdeki kama)
    const bottomRise = topHeight(NOSE_DEFAULT) - tipThickness(NOSE_DEFAULT) - PLAKA.citaBoslugu;
    expect(Math.atan(bottomRise / NOSE_DEFAULT.noseLen)).toBeCloseTo(b, 1);
  });

  it('dik çıtalı ranzada tuğla ucu boşluğa dalıyor (red gerekçesi), eğilir burunla bile', () => {
    const sabit = checkLanding({ ...NOSE_DEFAULT, nose: 'sabit', slat: 'dik' }, rows, tipStart);
    const egilir = checkLanding({ ...NOSE_DEFAULT, slat: 'dik' }, rows, tipStart);
    expect(sabit.maxDip).toBeGreaterThan(2);
    expect(egilir.maxDip).toBeGreaterThan(1);
  });

  it('plaka çekilince tuğla çıtaya düz oturuyor', () => {
    for (const x0 of rows) {
      const p = brickPose(NOSE_DEFAULT, x0, -50);
      expect(p.zRear).toBeCloseTo(0, 9);
      expect(p.zFront).toBeCloseTo(0, 9);
    }
  });

  it('menteşe ön sıranın ağırlık merkezinin önünde: burun inerken hiçbir tuğla eğilmiyor', () => {
    for (const x0 of rows) expect(brickPose(NOSE_DEFAULT, x0, tipStart, 1).tilt).toBeCloseTo(0, 9);
  });

  it('plakadayken tuğla düz, plaka üstünde', () => {
    const p = brickPose(NOSE_DEFAULT, rows[0], tipStart, 0);
    expect(p.zRear).toBeCloseTo(topHeight(NOSE_DEFAULT), 9);
    expect(p.tilt).toBeCloseTo(0, 9);
  });
});
