import { describe, expect, it } from 'vitest';
import { load2DGeom } from './ref2d';
import { DEFAULT_PARAMS, cloneParams } from '../src/sim/params';
import { planLayout, popupBandX, prepRollerX, tableColumnY, type Side } from '../src/sim/geometry';

const SCALARS = [
  'L', 'W', 'PITCH', 'BW', 'TD1', 'TD2', 'X_CUT', 'X_BELT', 'R_END', 'GATE', 'G2', 'E', 'ZEND',
  'BUF0', 'BL', 'PL0', 'PLEN', 'DX', 'RK0', 'CLEAR',
] as const;

describe('parametreler 2D ile aynı', () => {
  it('varsayılan P birebir aynı', () => {
    const { P } = load2DGeom();
    expect(cloneParams()).toEqual(P);
  });
});

describe('plan yerleşimi 2D geom() ile aynı', () => {
  const cases: Record<string, Record<string, number>> = {
    varsayılan: {},
    '3 bölge, 10 tuğla, 2 kat tampon': { nZones: 3, N: 10, Bcap: 2 },
    'tampon yok, 7 bölge': { Bcap: 0, nZones: 7 },
  };
  for (const [name, ov] of Object.entries(cases)) {
    it(name, () => {
      const { G } = load2DGeom(ov);
      const lay = planLayout({ ...cloneParams(), ...ov });
      for (const k of SCALARS) expect(lay[k], k).toBe(G[k]);
      expect(lay.zones).toEqual(G.zones);
      for (let i = 0; i < 3; i++) expect(lay.laneMinY(i)).toBeCloseTo(G.laneY(i) - lay.Y_REF_2D, 9);
      for (const s of [0, 1] as Side[]) {
        const [a, b] = lay.band(s);
        expect(a).toBeCloseTo(G.band(s)[0] - lay.Y_REF_2D, 9);
        expect(b).toBeCloseTo(G.band(s)[1] - lay.Y_REF_2D, 9);
      }
    });
  }
});

describe('CLAUDE.md ölçüleri', () => {
  const lay = planLayout(DEFAULT_PARAMS);

  it('orta şerit Y = 0, Ş1 −Y, Ş3 +Y; A tarafı +Y', () => {
    expect(lay.laneCenterY(1)).toBeCloseTo(0, 9);
    expect(lay.laneCenterY(0)).toBeCloseTo(-16.5, 9);
    expect(lay.laneCenterY(2)).toBeCloseTo(16.5, 9);
    expect(lay.sideCenterY(0)).toBeGreaterThan(0);
    expect(lay.sideCenterY(1)).toBeCloseTo(-lay.sideCenterY(0), 9);
  });

  it('kesim 8 tuğla = 152 cm, hızlandırma 60 cm, 5 × 30 cm birikme + 30 cm dozaj', () => {
    expect(lay.X_BELT - lay.X_CUT).toBe(152);
    expect(lay.R_END - lay.X_BELT).toBe(60);
    const acc = lay.zones.filter((z) => z.k === 'A');
    expect(acc).toHaveLength(5);
    for (const z of acc) expect(z.e - z.s).toBe(30);
    const d = lay.zones.find((z) => z.k === 'D')!;
    expect(d.e - d.s).toBe(30);
    expect(d.e).toBe(lay.GATE);
  });

  it('ön hazırlık: 4 sıra, sıra aralığı 21 cm, boy ≈ 85 cm', () => {
    for (let k = 0; k < 3; k++) expect(lay.rowBack(k) - lay.rowBack(k + 1)).toBe(21);
    expect(lay.rowBack(3)).toBe(lay.E);
    expect(lay.ZEND - lay.GATE).toBeGreaterThanOrEqual(82);
    expect(lay.ZEND - lay.GATE).toBeLessThanOrEqual(85);
  });

  it('12 pop-up bandı, makaralar bantlara değmiyor', () => {
    const bands = popupBandX(lay);
    expect(bands).toHaveLength(12);
    const rollers = prepRollerX(lay);
    const minGap = 1.25 + 0.8; // makara yarıçapı + bant yarı genişliği
    for (const r of rollers) for (const b of bands) expect(Math.abs(r - b), `makara ${r} / bant ${b}`).toBeGreaterThan(minGap);
    for (const r of rollers) {
      expect(r - 1.25).toBeGreaterThanOrEqual(lay.G2); // kapak çizgisini geçmiyor
      // son makara durdurucunun altında; tabla kenarını (ZEND + 1) geçmiyor
      expect(r + 1.25).toBeLessThanOrEqual(lay.ZEND + 1);
    }
  });

  it('A/B tablası 6 × 4 tuğla ≈ 96 × 82 cm, plaka eni 100 cm', () => {
    for (const s of [0, 1] as Side[]) {
      const cols = tableColumnY(lay, s);
      expect(cols).toHaveLength(6);
      const width = cols[5] - cols[0] + lay.W;
      expect(width).toBeCloseTo(96, 9);
      const [a, b] = lay.band(s);
      expect(b - a - 2).toBeCloseTo(100, 9); // plaka bandın 1'er cm içinde
    }
    expect(4 * lay.L + 3 * 2).toBe(82);
  });

  it('plaka: bekleme konumu tamponun hemen önünde, strok sonunda arka ucu ranza ön yüzünde', () => {
    expect(lay.PL0).toBe(lay.BUF0 + lay.BL);
    expect(lay.PL0 + lay.DX).toBe(lay.RK0);
    expect(lay.PLEN).toBe(88);
    expect(lay.DX).toBe(97);
    // plaka ucu strok sonunda ranzanın 90 cm derinliğinin içinde kalıyor
    expect(lay.PL0 + lay.DX + lay.PLEN).toBeLessThanOrEqual(lay.RK0 + 90);
  });
});
