import { describe, expect, it } from 'vitest';
import { NOSE_DEFAULT, NOSE_SHORT, brickPose, checkLanding, noseAngle, tipHeight, tipThickness, topHeight } from '../src/sim/landing';
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

  it('eğilir burun (35 cm, Ø12 uç): düşüş uç yüksekliğine iner (~2,3 cm), eğim ~14°, burun ~5° iner', () => {
    const r = checkLanding(NOSE_DEFAULT, rows, tipStart);
    expect(tipHeight(NOSE_DEFAULT)).toBeCloseTo(2.3, 6);
    expect(r.maxDrop).toBeCloseTo(tipHeight(NOSE_DEFAULT), 1);
    expect(r.maxDrop).toBeLessThan(0.45 * topHeight(NOSE_DEFAULT));
    expect(r.maxTiltDeg).toBeLessThan(15);
    expect(r.noseDeg).toBeGreaterThan(4);
    expect(r.noseDeg).toBeLessThan(6);
  });

  it('ilk taslak (11 cm, Ø20 uç): ~3,1 cm, ~18°; yeni burun ikisini de azaltıyor', () => {
    const k = checkLanding(NOSE_SHORT, rows, tipStart);
    const y = checkLanding(NOSE_DEFAULT, rows, tipStart);
    expect(k.maxDrop).toBeCloseTo(3.1, 1);
    expect(k.maxTiltDeg).toBeGreaterThan(17);
    expect(k.maxTiltDeg).toBeLessThan(19);
    expect(y.maxDrop).toBeLessThan(k.maxDrop - 0.5);
    expect(y.maxTiltDeg).toBeLessThan(k.maxTiltDeg - 3);
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

  it('ilk taslakta menteşe ön sıranın ağırlık merkezinin önünde: burun inerken hiçbir tuğla eğilmiyor', () => {
    for (const x0 of rows) expect(brickPose(NOSE_SHORT, x0, tipStart, 1).tilt).toBeCloseTo(0, 9);
  });

  it('35 cm burun inerken üstündeki iki sıra burunla birlikte eğilir, geridekiler düz', () => {
    const a = noseAngle(NOSE_DEFAULT);
    const hinge = tipStart - NOSE_DEFAULT.noseLen;
    for (const x0 of rows) {
      const t = brickPose(NOSE_DEFAULT, x0, tipStart, 1).tilt;
      if (x0 + TUGLA.boy / 2 > hinge) expect(t).toBeCloseTo(a, 6);
      else expect(t).toBeCloseTo(0, 9);
    }
    expect(rows.filter((x0) => x0 + TUGLA.boy / 2 > hinge)).toHaveLength(2);
  });

  it('plakadayken tuğla düz, plaka üstünde', () => {
    const p = brickPose(NOSE_DEFAULT, rows[0], tipStart, 0);
    expect(p.zRear).toBeCloseTo(topHeight(NOSE_DEFAULT), 9);
    expect(p.tilt).toBeCloseTo(0, 9);
  });
});
