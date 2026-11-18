import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DT, SimLoop, SPEEDS } from '../src/sim/loop';
import { Simulation } from '../src/sim/sim';

const frames = (loop: SimLoop, seconds: number, fps = 60) => {
  let n = 0;
  for (let i = 0; i < Math.round(seconds * fps); i++) n += loop.advance(1 / fps);
  return n;
};

describe('sabit adımlı döngü', () => {
  it('adım 5 ms', () => expect(DT).toBe(0.005));

  it('hız çarpanları ¼×, 1×, 3×, 10×', () => {
    expect([...SPEEDS]).toEqual([0.25, 1, 3, 10]);
    for (const sp of SPEEDS) {
      const loop = new SimLoop(new Simulation());
      loop.speed = sp;
      const n = frames(loop, 2);
      expect(Math.abs(n - (2 * sp) / DT)).toBeLessThanOrEqual(1);
    }
  });

  it('kare süresi ne olursa olsun adımlar hep DT', () => {
    const seen = new Set<number>();
    const loop = new SimLoop({ step: (dt) => seen.add(dt), reset: () => {} });
    for (const d of [0.001, 0.0123, 0.05, 0.0049, 0.1]) loop.advance(d);
    expect([...seen]).toEqual([DT]);
  });

  it('kesirli kalan bir sonraki kareye taşınıyor', () => {
    const loop = new SimLoop(new Simulation());
    for (let i = 0; i < 4; i++) loop.advance(0.0125);
    expect(loop.steps).toBe(10);
  });

  it('uzun kare kırpılıyor (arka plandan dönünce simülasyon fırlamasın)', () => {
    const loop = new SimLoop(new Simulation());
    loop.speed = 10;
    expect(loop.advance(5)).toBe(Math.round((0.1 * 10) / DT));
  });

  it('durdurunca ilerlemiyor, sıfırlayınca baştan', () => {
    const sim = new Simulation();
    const loop = new SimLoop(sim);
    frames(loop, 1);
    loop.running = false;
    expect(frames(loop, 1)).toBe(0);
    expect(sim.t).toBeGreaterThan(0.99);
    loop.reset();
    expect(sim.t).toBe(0);
    expect(loop.steps).toBe(0);
  });

  it('deterministik: farklı kare dilimleriyle aynı adım sayısında aynı durum', () => {
    const a = new Simulation();
    const b = new Simulation();
    const la = new SimLoop(a);
    const lb = new SimLoop(b);
    la.stepN(12000);
    lb.speed = 10;
    while (lb.steps < 12000) lb.advance(Math.min(0.0173, (12000 - lb.steps) * DT / 10 + 1e-9));
    expect(lb.steps).toBe(12000);
    expect(b.t).toBe(a.t);
  });
});

describe('simülasyon modülü render ve DOM bağımsız', () => {
  it('src/sim içinde three.js ya da DOM kullanımı yok', () => {
    const dir = fileURLToPath(new URL('../src/sim/', import.meta.url));
    for (const f of readdirSync(dir)) {
      const src = readFileSync(dir + f, 'utf8');
      expect(src, f).not.toMatch(/from ['"]three/);
      expect(src, f).not.toMatch(/\b(document|window|requestAnimationFrame)\b/);
    }
  });
});
