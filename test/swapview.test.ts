import { describe, expect, it } from 'vitest';
import { swapElapsed, swapView } from '../src/sim/swapview';
import { RACK_FEET_LOW, rackFeetZ } from '../src/sim/dims';
import { Simulation } from '../src/sim/sim';
import { DT } from '../src/sim/loop';

describe('ranza değişimi görseli (çukur sırası)', () => {
  const v = 20, Ts = 6;
  it('dolu ranza en alttan başlar, boş ranza ilk katta biter; toplam süre mantıkla aynı', () => {
    expect(swapView(0, v, Ts, false).feet).toBeCloseTo(RACK_FEET_LOW, 9);
    const end = Ts + 120 / v;
    expect(swapView(end, v, Ts, false).feet).toBeCloseTo(rackFeetZ(0), 6);
    expect(swapView(end, v, Ts, false).stage).toBe('rise2');
  });
  it('kaldırıcı zıplamıyor (aşama geçişlerinde sürekli)', () => {
    let prev = swapView(0, v, Ts, false).feet;
    for (let E = 0.01; E <= Ts + 120 / v; E += 0.01) {
      const f = swapView(E, v, Ts, false).feet;
      expect(Math.abs(f - prev)).toBeLessThan(v * 0.01 + 1e-6);
      prev = f;
    }
  });
  it('simülasyonda pencere süresi = değişim + 120 cm kaldırma', () => {
    const sim = new Simulation();
    const rk = () => sim.S.sides[0].rack;
    let start = -1, endT = -1;
    for (let i = 0; i < 40000 && endT < 0; i++) {
      sim.step(DT);
      const r = rk();
      const E = swapElapsed(r.phase, r.timer, r.levels, r.lift, r.target, v, Ts);
      if (E >= 0 && start < 0) start = sim.S.t;
      if (start >= 0 && E < 0) endT = sim.S.t;
    }
    expect(start).toBeGreaterThan(0);
    expect(endT - start).toBeCloseTo(Ts + 120 / v, 1);
  });
});
