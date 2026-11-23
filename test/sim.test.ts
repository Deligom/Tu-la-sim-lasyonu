import { describe, expect, it } from 'vitest';
import { load2DSim } from './ref2d';
import { Simulation } from '../src/sim/sim';
import { DT } from '../src/sim/loop';
import { summarize, theory } from '../src/sim/stats';
import type { SimState } from '../src/sim/model';
import type { Params } from '../src/sim/params';

const run = (sim: Simulation, seconds: number, stop?: (S: SimState) => boolean) => {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    sim.step(DT);
    if (stop && i % 200 === 0 && stop(sim.S)) break;
  }
  return sim.S;
};

/** 2D ile 3D durumunu karşılaştırmak için mantıkta anlamı olan her şey (çizim alanları hariç). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fingerprint(S: any) {
  const brick = (b: any) => [b.lane, b.st, b.x, b.len, !!b.kick, b.off ?? 0, !!b.mid, !!b.slip, !!b.touch];
  return {
    t: S.t, f: S.f, cuts: S.cuts, produced: S.produced, scrap: S.scrap, lost: S.lost, contacts: S.contacts, slips: S.slips,
    trips: S.trips, levels: S.levels, midScrap: S.midScrap, scrapPushed: S.scrapPushed, wFill: S.wFill, wTable: S.wTable,
    blockDir: S.blockDir, blockTimes: S.blockTimes, q: S.q, qmax: S.qmax, cam: S.cam, pref: S.pref, rng: S.rng, tripsV: S.tripsV,
    anomaly: S.anomaly, zone: [S.zone.phase, S.zone.timer, S.zone.block?.off ?? null],
    lanes: S.lanes.map((l: any) => [l.meter, l.gate, l.gt, l.run.join(','), l.trip, !!l.prepRun]),
    tables: S.tables.map((T: any) => [T.next, !!T.exiting, T.halves.map((h: any) => !!h)]),
    sides: S.sides.map((d: any) => [d.groups.length, d.plate.phase, d.plate.px, d.plate.belt, d.rack.levels, d.rack.lift,
      d.rack.target, d.rack.phase, d.rack.timer, !!d.rack.reject, d.empty, d.full, d.incoming, d.racks, d.rejected,
      d.starve, d.rackWait, d.loadBusy, d.loaded]),
    veh: S.veh.map((v: any) => [v.busy, v.timer, v.to, v.bring, v.busyT]),
    bricks: S.bricks.map(brick),
  };
}

function compareWith2D(ov: Partial<Params>, seconds: number, every = 1000) {
  const ref = load2DSim(ov as Record<string, unknown>);
  const sim = new Simulation(ov);
  const n = Math.round(seconds / DT);
  for (let i = 1; i <= n; i++) {
    ref.step(DT);
    sim.step(DT);
    if (i % every === 0 || i === n) {
      const a = fingerprint(sim.S);
      const b = fingerprint(ref.S());
      if (JSON.stringify(a) !== JSON.stringify(b)) expect(a, `adım ${i} (t = ${(i * DT).toFixed(3)} s)`).toEqual(b);
    }
  }
  return sim.S;
}

describe('2D ile birebir aynı sonuç', () => {
  it('varsayılanlar, 4 dk, her 5 s karşılaştır', () => {
    const S = compareWith2D({}, 240);
    expect(S.levels).toBeGreaterThan(30);
  }, 60_000);
  it('tek parça bant, 300/dk, 2 dk', () => {
    const S = compareWith2D({ acc: 'single', rate: [106.25, 100, 103.75] }, 120);
    expect(S.contacts).toBeGreaterThan(0);
  }, 60_000);
  it('%20 uyumsuz ranza, 2 araç, 3 dk', () => {
    const S = compareWith2D({ badRack: 20, nVeh: 2 }, 180);
    expect(S.sides[0].rejected + S.sides[1].rejected).toBeGreaterThan(0);
  }, 60_000);
  it('360/dk taşma anına kadar', () => {
    compareWith2D({ rate: [127.5, 120, 124.5] }, 150);
  }, 60_000);
});

describe('CLAUDE.md: 2D\'de doğrulanan sonuçlar', () => {
  it('240/dk, 10 dk: 0 temas, 0 taşma, blok her 3,0 s, istasyon başına 12 s\'de bir kat', () => {
    const sim = new Simulation();
    const S = run(sim, 600);
    const s = summarize(S);
    const th = theory(sim.params);
    expect(th.bpm).toBe(240);
    expect(s.contacts).toBe(0);
    expect(s.slips).toBe(0);
    expect(s.lost).toBe(0);
    expect(s.anomaly).toBeNull();
    expect(s.midScrap).toBe(0);
    expect(s.perMin!).toBeGreaterThan(235);
    expect(s.blockT!).toBeCloseTo(3.0, 1);
    expect(s.levels / 10).toBeGreaterThan(9.5); // ≈ 10 kat/dk → her istasyona 12 s'de bir
    expect(S.sides[0].loaded + S.sides[1].loaded).toBeGreaterThan(90);
    expect(s.racks).toBeGreaterThanOrEqual(15); // ~120 ranza/saat, ilk ranza dolana kadar ısınma
    // Ön hazırlık hiç tabla beklemiyor: istasyonlar ve ranza taşıma yetişiyor.
    expect(S.wTable / S.t).toBeLessThan(0.01);
    // Not: plaka zamanın ~%5,8'inde ranza bekliyor (ranza değişimi + 120 cm kaldırma). 2D de aynı; eşiği %5
    // olduğu için ~5. dakikadan sonra "ranza bekliyor" uyarısı veriyor. Tampon bunu emiyor.
    for (const sd of S.sides) expect(sd.rackWait / S.t).toBeLessThan(0.07);
  }, 60_000);

  it('330/dk: ön hazırlık hâlâ yetişiyor (taşma yok)', () => {
    const S = run(new Simulation({ rate: [116.875, 110, 114.125] }), 600, (S) => S.lost > 0);
    expect(S.lost).toBe(0);
  }, 60_000);

  it('360/dk: hat taşıyor', () => {
    const S = run(new Simulation({ rate: [127.5, 120, 124.5] }), 600, (S) => S.lost > 0);
    expect(S.lost).toBeGreaterThan(0);
  }, 60_000);

  // 240/dk'da kuyruk 1 tuğlayı geçmiyor; tek parça bantta da temas olmuyor (2D'de de böyle).
  // Fark kuyruk oluşunca çıkıyor: 300/dk'da bölgeli bantta 0, tek parça bantta yüzlerce temas.
  it('300/dk: bölgeli bantta 0 temas, tek parça bantta yüzlerce', () => {
    const r300: Partial<Params> = { rate: [106.25, 100, 103.75] };
    const zpa = run(new Simulation(r300), 600);
    expect(zpa.contacts).toBe(0);
    expect(zpa.lost).toBe(0);
    const single = run(new Simulation({ ...r300, acc: 'single' }), 600);
    expect(single.contacts).toBeGreaterThan(100);
  }, 60_000);

  it('240/dk tek parça bant: kuyruk oluşmuyor, temas yok (2D ile aynı)', () => {
    const S = run(new Simulation({ acc: 'single' }), 300);
    expect(Math.max(...S.qmax)).toBeLessThanOrEqual(1);
    expect(S.contacts).toBe(0);
  }, 60_000);
});

// 2026-11-23, kullanıcı kararı: dik çıta artık red sebebi değil (tarak düz koyuyor). Lazer her katı ölçer;
// yamuk kat atlanır, ranzanın geri kalanı dolar. Oran 0 iken çekiliş yapılmaz (yukarıdaki 2D testleri aynı kalır).
describe('yamuk kat (3D eki)', () => {
  /** Ranza değişirken: tuğla yamuk kata konmamış, her kat ya dolu ya yamuk. Bozuk ranza sayısını döndürür. */
  const runCheck = (sim: Simulation, seconds: number) => {
    let wrong = 0;
    let seen = 0;
    for (let i = 0, n = Math.round(seconds / DT); i < n; i++) {
      sim.step(DT);
      for (const sd of sim.S.sides) {
        const rk = sd.rack;
        if (rk.phase !== 'swap' || rk.reject) continue; // değişimde: katlar son hâlinde
        seen++;
        if ((rk.filled & rk.bad) !== 0 || (rk.filled | rk.bad) !== 31) wrong++;
      }
    }
    return { wrong, seen };
  };

  it('%20 yamuk kat: katlar atlanıyor, ranza reddedilmiyor, hat yetişiyor', () => {
    const sim = new Simulation({ badLevel: 20 });
    const r = runCheck(sim, 600);
    const s = summarize(sim.S);
    expect(r.seen).toBeGreaterThan(0);
    expect(r.wrong).toBe(0);
    expect(s.skipped).toBeGreaterThan(10);
    expect(s.rejected).toBe(0);
    expect(s.lost).toBe(0);
    expect(s.perMin!).toBeGreaterThan(235);
    expect(s.racks).toBeGreaterThan(new Simulation().params.inCap); // eksik katlı ranzalar da dolu sayılır
  }, 60_000);

  it('bütün katlar yamuksa ranza boş çıkar, tuğla konmaz', () => {
    const sim = new Simulation({ badLevel: 100 });
    runCheck(sim, 120);
    const s = summarize(sim.S);
    expect(s.rejected).toBeGreaterThan(0);
    expect(s.racks).toBe(0);
    expect(sim.S.sides[0].loaded + sim.S.sides[1].loaded).toBe(0);
  }, 60_000);
});
