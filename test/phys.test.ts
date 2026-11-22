import { describe, expect, it } from 'vitest';
import { physConfig } from '../src/phys/config';
import { World } from '../src/phys/world';
import { Rig, layerLayout } from '../src/phys/rig';
import { runLoading } from '../src/phys/run';
import { NOSE_DEFAULT, tipHeight } from '../src/sim/landing';
import { RANZA } from '../src/sim/dims';

/** Önceki tasarım (bantlı plaka): karşılaştırma testleri */
const plakaCfg = (o: Partial<Parameters<typeof physConfig>[0]> = {}) => physConfig({ loader: 'plaka', ...o });

/** Plakasız düşürme: tuğla çıtaların üstünde, en alçak noktası h yüksekte. */
function drop(h: number, pitch = 0) {
  const cfg = physConfig();
  const low = (cfg.H / 2) * Math.cos(pitch) + (cfg.L / 2) * Math.sin(Math.abs(pitch));
  const w = new World(cfg, { drop: [{ x: 0.45, y: 0, z: h + low, pitch }] });
  const b = w.bricks[0];
  let vImpact = 0, rebound = 0, touched = false;
  while (w.t < 0.8) {
    w.step();
    if (b.nSlat > 0) touched = true;
    if (!touched) vImpact = Math.max(vImpact, -b.vz);
    else rebound = Math.max(rebound, b.vz);
  }
  return { w, b, vImpact, rebound };
}

describe('fizik motoru: çıtaya düşürme', () => {
  it('serbest düşme hızı √(2gh)', () => {
    for (const h of [0.01, 0.03, 0.055]) expect(drop(h).vImpact).toBeCloseTo(Math.sqrt(2 * 9.81 * h), 2);
  });

  it('yaş kil az seker, durur, iz yükseklikle derinleşir', () => {
    const r = [0.01, 0.03, 0.055].map((h) => drop(h));
    for (const x of r) {
      expect(x.rebound).toBeLessThan(0.3 * x.vImpact);
      expect(x.b.state).toBe('slat');
    }
    const d = r.map((x) => Math.max(...x.b.m.faceDent));
    expect(d[0]).toBeGreaterThan(0.0001);
    expect(d[1]).toBeGreaterThan(d[0]);
    expect(d[2]).toBeGreaterThan(d[1]);
    expect(d[2]).toBeLessThan(0.003);
  });

  it('kenar üstüne düşen tuğla kenardan ezilir, sonra yatar', () => {
    const { b } = drop(0.01, 0.3);
    expect(b.maxDent()).toBeGreaterThan(0.0005);
    expect(Math.abs(b.pitch)).toBeLessThan(0.01);
  });

  it('çıtada duran tuğla kaymaz, batmaz', () => {
    const { b } = drop(0);
    expect(Math.abs(b.px - 0.45)).toBeLessThan(1e-4);
    expect(b.maxDent()).toBeLessThan(5e-5);
  });
});

describe('plaka düzeneği (rig)', () => {
  it('kat düzeni 3D sahneyle aynı: 4 sıra, 6 sütun, sıralar arası 2 cm', () => {
    const { rowsX0, colsY } = layerLayout();
    expect(rowsX0).toHaveLength(4);
    expect(colsY).toHaveLength(6);
    for (let i = 1; i < 4; i++) expect(rowsX0[i] - rowsX0[i - 1]).toBeCloseTo(0.21, 6);
    expect(rowsX0[3] + 0.19).toBeLessThan(RANZA.derinlikX / 100);
  });

  it('inmiş burunda uç makarasının altı çıtaların 5 mm üstünde, uç yüksekliği 2D kontrolüyle aynı', () => {
    const r = new Rig(plakaCfg());
    r.update(r.tl.noseStart + r.cfg.noseT + 0.01);
    expect(r.noseK).toBeCloseTo(1, 6);
    // yüksüz rig: sehim yok
    expect(r.ctz - r.Rt).toBeCloseTo(r.cfg.clearance, 6);
    expect((r.ctz + r.Rt) * 100).toBeCloseTo(tipHeight(NOSE_DEFAULT), 0);
  });

  it('geri çekilirken üst bant zemine göre durur, alt bant 2× hızla geri gider', () => {
    const r = new Rig(plakaCfg());
    r.update(1.2);
    expect(r.vp).toBeLessThan(-0.4);
    expect(r.flatBeltV).toBeCloseTo(0, 9);
    expect(r.vp - r.u).toBeCloseTo(2 * r.vp, 9);
  });
});

describe('tam kat yükleme, bantlı plaka (önceki tasarım, karşılaştırma)', () => {
  const def = runLoading(plakaCfg());
  const S = def.summary;

  it('deterministik', () => {
    const again = runLoading(plakaCfg()).summary;
    expect(again.bricks.map((b) => [b.dx, b.dy, b.dent])).toEqual(S.bricks.map((b) => [b.dx, b.dy, b.dent]));
  });

  it('bütün tuğlalar çıtaya düz oturuyor, yerinden en çok birkaç cm', () => {
    for (const b of S.bricks) {
      expect(b.settled).toBe(true);
      expect(Math.abs(b.pitchDeg)).toBeLessThan(1);
      expect(Math.abs(b.dz)).toBeLessThan(3);
      expect(Math.hypot(b.dx, b.dy)).toBeLessThan(50);
    }
    expect(S.rowGapMin).toBeGreaterThan(-0.5);
  });

  it('plaka sehimiyle bile alt bant çıtalara değmiyor (5 mm boşluk)', () => {
    expect(S.belt.minGapMm).toBeGreaterThan(2);
    expect(S.belt.minGapMm).toBeLessThan(5);
    expect(S.belt.maxN).toBe(0);
  });

  // İlk taslak burun (11 cm, Ø20): karşılaştırma için
  const kisa = runLoading(plakaCfg({ noseLen: 0.11, tipRollerDia: 0.02, hingeRollerDia: 0.02 })).summary;
  const mx = (s: typeof S, f: (b: (typeof S.bricks)[number]) => number) => Math.max(...s.bricks.map(f));

  it('dinamik bulgu: ilk taslakta (11 cm) ön sıra yarı-statik tahminden (≈18°) fazla eğiliyor', () => {
    const front = kisa.bricks.filter((b) => b.row === 3);
    expect(Math.min(...front.map((b) => b.maxPitchDeg))).toBeGreaterThan(20);
  });

  it('sabit burun eğilir burundan sert iner (çarpma hızı, kenar ezilmesi)', () => {
    const sabit = runLoading(plakaCfg({ nose: 'sabit' })).summary;
    const imp = (s: typeof S) => Math.max(...s.bricks.map((b) => b.impact));
    const dent = (s: typeof S) => Math.max(...s.bricks.map((b) => b.dent));
    expect(imp(sabit)).toBeGreaterThan(imp(S) + 10);
    expect(dent(sabit)).toBeGreaterThan(dent(S));
  });

  it('varsayılan uzun burun (35 cm, Ø12 uç) ilk taslaktan yumuşak indirir (2026-11-22 kararı)', () => {
    expect(mx(S, (b) => b.maxPitchDeg)).toBeLessThan(0.6 * mx(kisa, (b) => b.maxPitchDeg));
    expect(mx(S, (b) => b.impact)).toBeLessThan(mx(kisa, (b) => b.impact) - 20);
    expect(mx(S, (b) => b.dent)).toBeLessThan(mx(kisa, (b) => b.dent));
    expect(mx(S, (b) => b.brickF)).toBeLessThan(0.5 * mx(kisa, (b) => b.brickF));
    expect(S.rowGapMin).toBeGreaterThan(kisa.rowGapMin + 5);
  });

  it('sıra aralığı 3 cm: kat plakaya sığar; komşu teması hafifler ama kalkmaz (2026-11-22 denemesi)', () => {
    expect(layerLayout(0.03).rowsX0[0]).toBeGreaterThanOrEqual(0);
    const g3 = runLoading(plakaCfg({ rowGap: 0.03 })).summary;
    expect(mx(g3, (b) => b.brickF)).toBeLessThan(0.8 * mx(S, (b) => b.brickF));
    expect(mx(g3, (b) => b.dentBrick)).toBeLessThan(mx(S, (b) => b.dentBrick));
    expect(g3.rowGapMin).toBeGreaterThan(S.rowGapMin + 8);
    // tuğla hâlâ eğilirken önündeki sıraya değiyor
    expect(g3.bricks.filter((b) => b.brickF > 1).length).toBeGreaterThan(12);
  });

  it('çıta 4 mm yüksekse alt bant çıtaya sürter (kuvvet ve ters yönde 2× kayma)', () => {
    const s = runLoading(plakaCfg({ slatDev: 0.004 })).summary;
    expect(s.belt.minGapMm).toBeLessThan(0);
    expect(s.belt.maxN).toBeGreaterThan(10);
    expect(s.belt.maxFric).toBeGreaterThan(0);
    expect(s.belt.slipV).toBeCloseTo(1, 1);
  });
});

describe('tarak tutucu (yükleyici, 2026-11-22)', () => {
  const T = (o: Partial<Parameters<typeof physConfig>[0]> = {}) => runLoading(physConfig(o)).summary;

  it('varsayılan yükleyici tarak', () => expect(physConfig().loader).toBe('tarak'));
  const S = T();
  const mx = (s: typeof S, f: (b: (typeof S.bricks)[number]) => number) => Math.max(...s.bricks.map(f));

  it('tuğlaları düşürmeden, eğmeden, komşuya değmeden çıtaya koyar', () => {
    for (const b of S.bricks) {
      expect(b.settled).toBe(true);
      expect(b.maxPitchDeg).toBeLessThan(0.5);
      expect(Math.hypot(b.dx, b.dy)).toBeLessThan(1);
      expect(Math.abs(b.dz)).toBeLessThan(0.5);
    }
    expect(mx(S, (b) => b.impact)).toBeLessThan(20);
    expect(mx(S, (b) => b.dent)).toBeLessThan(0.5);
    expect(mx(S, (b) => b.brickF)).toBe(0);
    expect(S.rowGapMin).toBeGreaterThan(19);
    expect(S.comb!.slipPadMax).toBeLessThan(0.5);
    expect(S.comb!.toothPickMax + S.comb!.toothOutMax).toBe(0);
    expect(S.comb!.sf).toBeGreaterThan(2);
  });

  it('sütun hizasızlığı 4 mm: dişler değmeden girer; 12 mm: diş tuğlaya basar (kamera durdurmalı)', () => {
    expect(T({ colErr: 0.004 }).comb!.toothPickMax).toBe(0);
    expect(T({ colErr: 0.012 }).comb!.toothPickMax).toBeGreaterThan(100);
  });

  it('yastık basıncı yetmezse (güvenlik < 1) tuğlalar pedde kayar', () => {
    const z = T({ padP: 2000 });
    expect(z.comb!.sf).toBeLessThan(1);
    expect(z.comb!.slipPadMax).toBeGreaterThan(10);
  });
});
