// Hat mantığı: referans-2d-simulasyon.html içindeki reset(), tableAccepts(), chooseSide() ve step()
// fonksiyonlarının birebir TypeScript karşılığı. İşlem sırası ve aritmetik aynı tutuldu ki sonuçlar
// bit bit aynı çıksın (test/sim.test.ts 2D'nin kendisiyle adım adım karşılaştırıyor).
// Burada değişiklik yaparsan önce 2D'de doğrula, sonra buraya taşı.
//
// Farklar yalnızca çizim için: tuğlalara kalıcı `id`, blok halindeki tuğlanın `cy` değeri 3D Y'sinde,
// istasyonda `outQ` (çıkıştaki ranzalar) ve araçta `cargo` notları. Hiçbiri sonuçları değiştirmez.

import type { Params } from './params';
import type { PlanLayout, Side } from './geometry';

export type BrickState = 'push' | 'scrap' | 'belt' | 'block' | 'table' | 'grp' | 'plate' | 'rack';

export interface Brick {
  id: number;
  lane: number;
  /** Arka kenarın X'i */
  x: number;
  /** Akış yönündeki boy (artıkta kısa) */
  len: number;
  st: BrickState;
  t0?: number;
  /** Artık itiliyorsa yön: −1 (−Y), +1 (+Y) */
  kick?: number;
  /** İtilen artığın Y kayması */
  off?: number;
  /** Ortada (Ş2) oluşan artık */
  mid?: boolean;
  slip?: boolean;
  touch?: boolean;
  stopped?: boolean;
  lost?: boolean;
  dead?: boolean;
  gone?: boolean;
  /** Pop-up blokta: başlangıç ve anlık Y merkezi */
  cy0?: number;
  cy?: number;
}

export type GateState = 'open' | 'closing' | 'closed' | 'opening';

export interface Lane {
  /** Dozaj bırakabilir mi (bu şeritte 4'ten az tuğla bırakıldı) */
  meter: boolean;
  gate: GateState;
  gt: number;
  /** Bölge başına çalışıyor mu */
  run: boolean[];
  trip: boolean;
  prepRun: boolean;
  relBrick: Brick | null;
  stuckT: number;
}

export interface Block {
  bricks: Brick[];
  off: number;
  target: number;
  half: 0 | 1;
  side: Side;
  sgn: number;
  done?: boolean;
}

export interface PrepZone {
  phase: 'fill' | 'lift' | 'move' | 'lower';
  timer: number;
  block: Block | null;
}

export interface Table {
  halves: [Brick[] | null, Brick[] | null];
  next: number;
  exiting: Brick[] | null;
}

export interface LevelGroup {
  bricks: Brick[];
  back: number;
  front: number;
}

export interface Plate {
  phase: 'ready' | 'loaded' | 'insert' | 'retract';
  /** Strok, cm (0 = bekleme) */
  px: number;
  level: Brick[] | null;
  /** Toplam sarılan bant, cm (doku kaydırma için) */
  belt: number;
}

export interface Rack {
  levels: number;
  /** Kaldırma, en alçak konuma göre cm */
  lift: number;
  target: number;
  phase: 'ok' | 'needSwap' | 'swap';
  timer: number;
  bricks: Brick[];
  reject: boolean;
}

export interface Station {
  groups: LevelGroup[];
  plate: Plate;
  rack: Rack;
  empty: number;
  full: number;
  incoming: number;
  racks: number;
  rejected: number;
  starve: number;
  rackWait: number;
  loadBusy: number;
  loaded: number;
  /** Not (mantığı etkilemez, çizim için): çıkış tamponundaki ranzalar, eskiden yeniye; true = reddedilmiş boş ranza */
  outQ: boolean[];
}

export interface Vehicle {
  busy: boolean;
  timer: number;
  to: number;
  bring: boolean;
  busyT: number;
  /** Not (mantığı etkilemez, çizim için): bu seferde aldığı ranza */
  cargo: 'full' | 'reject' | null;
}

export interface SimState {
  t: number;
  /** Sütunların ön ucu */
  f: number[];
  bricks: Brick[];
  cuts: number;
  produced: number;
  scrap: number[];
  lost: number;
  contacts: number;
  slips: number;
  trips: number;
  lanes: Lane[];
  zone: PrepZone;
  blocks: Block[];
  tables: Table[];
  sides: Station[];
  pref: number;
  veh: Vehicle[];
  tripsV: number;
  anomaly: { lane: number; t: number } | null;
  rng: number;
  scrapPushed: number;
  midScrap: number;
  levels: number;
  wFill: number;
  wTable: number;
  blockTimes: number[];
  lastBlock: number | null;
  q: number[];
  qmax: number[];
  cam: number[];
  lastCut: number;
  blockDir: number[];
  nextId: number;
}

function mkSide(P: Readonly<Params>): Station {
  return {
    groups: [],
    plate: { phase: 'ready', px: 0, level: null, belt: 0 },
    rack: { levels: 0, lift: 120, target: 120, phase: 'ok', timer: 0, bricks: [], reject: false },
    empty: P.inCap, full: 0, incoming: 0, racks: 0, rejected: 0, starve: 0, rackWait: 0, loadBusy: 0, loaded: 0, outQ: [],
  };
}

export function createState(P: Readonly<Params>, G: PlanLayout): SimState {
  return {
    t: 0, f: [G.X_CUT, G.X_CUT, G.X_CUT], bricks: [], cuts: 0, produced: 0, scrap: [0, 0, 0], lost: 0, contacts: 0, slips: 0, trips: 0,
    lanes: [0, 1, 2].map(() => ({ meter: true, gate: 'open' as GateState, gt: 0, run: [], trip: false, prepRun: false, relBrick: null, stuckT: 0 })),
    zone: { phase: 'fill', timer: 0, block: null }, blocks: [],
    tables: [0, 1].map(() => ({ halves: [null, null] as [Brick[] | null, Brick[] | null], next: 0, exiting: null })),
    sides: [mkSide(P), mkSide(P)], pref: 0,
    veh: Array.from({ length: P.nVeh }, () => ({ busy: false, timer: 0, to: 0, bring: false, busyT: 0, cargo: null as Vehicle['cargo'] })), tripsV: 0,
    anomaly: null, rng: 12345, scrapPushed: 0, midScrap: 0, levels: 0, wFill: 0, wTable: 0, blockTimes: [], lastBlock: null,
    q: [0, 0, 0], qmax: [0, 0, 0], cam: [0, 0, 0], lastCut: -99, blockDir: [0, 0], nextId: 1,
  };
}

function tableAccepts(S: SimState, s: number): boolean {
  const T = S.tables[s];
  return !T.exiting && T.next < 2 && !T.halves[T.next as 0 | 1];
}

function chooseSide(S: SimState): number {
  for (const s of [0, 1]) if (tableAccepts(S, s) && S.tables[s].next === 1) return s;
  const c = [0, 1].filter((s) => tableAccepts(S, s));
  if (!c.length) return -1;
  if (c.length === 2) {
    const ld = (s: number) => S.sides[s].groups.length + (S.sides[s].plate.phase !== 'ready' ? 1 : 0);
    c.sort((a, b) => ld(a) - ld(b) || (a === S.pref ? -1 : 1));
  }
  return c[0];
}

export function step(S: SimState, P: Readonly<Params>, G: PlanLayout, dt: number): void {
  const t = S.t + dt;
  S.t = t;
  const L = P.L;
  const vcol = (i: number) => (P.rate[i] * P.L) / 60;
  const newBrick = (b: Omit<Brick, 'id'>): Brick => ({ id: S.nextId++, ...b });

  // 1) Sütunlar ve kesim
  for (let i = 0; i < 3; i++) S.f[i] += vcol(i) * dt;
  for (const b of S.bricks) {
    if (b.st === 'push') b.x += vcol(b.lane) * dt;
    else if (b.st === 'scrap') {
      const c = b.x + b.len / 2;
      if (b.kick) {
        b.off = (b.off || 0) + b.kick * P.pushV * dt;
      } else if (c >= G.X_BELT) {
        b.x += P.vb * dt;
        if (c >= G.X_BELT + 12) {
          if (b.lane === 1) {
            if (!b.mid) {
              b.mid = true;
              S.midScrap++;
            }
          } else {
            b.kick = b.lane === 0 ? -1 : 1;
          }
        }
      } else b.x += vcol(b.lane) * dt;
    }
  }
  if (Math.min(...S.f) >= G.X_BELT) {
    for (let i = 0; i < 3; i++) {
      const ex = S.f[i] - G.X_BELT;
      if (ex > 0.3) S.bricks.push(newBrick({ lane: i, x: G.X_BELT, len: ex, st: 'scrap', t0: t }));
      S.scrap[i] += Math.max(0, ex);
      for (let k = 0; k < P.N; k++) S.bricks.push(newBrick({ lane: i, x: G.X_CUT + k * L, len: L, st: 'push' }));
      S.f[i] = G.X_CUT;
    }
    S.cuts++;
    S.produced += 3 * P.N;
    S.lastCut = t;
  }
  for (const b of S.bricks) if (b.st === 'push' && b.x + L / 2 >= G.X_BELT) b.st = 'belt';

  // 2) Şeritler: bölgeler, dozaj, ön hazırlık indeksleme
  const Zs = G.zones;
  const nz = Zs.length;
  for (let i = 0; i < 3; i++) {
    const ln = S.lanes[i];
    const lb = S.bricks.filter((b) => b.lane === i && b.st === 'belt').sort((a, b) => b.x - a.x);
    const prepSide = lb.filter((b) => b.x + L > G.GATE - 0.3); // dozaj ucunda bekleyen + ön hazırlıktakiler
    const behind = lb.filter((b) => b.x + L <= G.GATE - 0.3);
    const released = lb.filter((b) => b.x + L > G.GATE + 0.5).length;
    ln.meter = released < 4;
    const indexed = lb.filter((b) => b.x >= G.E - 0.01).length;
    // Ön hazırlık senkron indeksleme
    const crossing = prepSide.find((b) => b.x < G.E - 0.01);
    if (crossing) {
      const waiting = crossing.x + L <= G.GATE + 0.3;
      const allowed = !waiting || (ln.meter && ln.gate === 'open' && S.zone.phase === 'fill');
      if (allowed) {
        const sh = Math.min(P.vz * dt, G.E - crossing.x);
        const cx = crossing.x;
        prepSide.forEach((b) => {
          if (b.x >= cx - 0.01) b.x += sh;
        });
        ln.prepRun = sh > 0;
        ln.relBrick = crossing;
      } else {
        ln.prepRun = false;
        ln.relBrick = null;
      }
    } else {
      ln.prepRun = false;
      ln.relBrick = null;
    }
    // Bölge durumları (aşağı akıştan yukarıya)
    const run: boolean[] = new Array(nz).fill(true);
    const acc: boolean[] = new Array(nz + 1).fill(true);
    const cap: number[] = new Array(nz).fill(Infinity);
    acc[nz] = false; // dozaj ucu: geçiş yalnızca senkron indekslemeyle
    const all = lb;
    for (let z = nz - 1; z >= 0; z--) {
      const zn = Zs[z];
      const inZ = all.filter((b) => {
        const c = b.x + L / 2;
        return c >= zn.s && c < zn.e && !(ln.prepRun && b === ln.relBrick);
      });
      const atEnd = inZ.find((b) => b.x + L >= zn.e - 0.3);
      const nextAcc = acc[z + 1];
      if (zn.k === 'D') {
        cap[z] = G.GATE;
        run[z] = !atEnd;
      } else if (P.acc === 'zpa') {
        run[z] = zn.k === 'R' ? true : !(atEnd && !nextAcc);
        if (!nextAcc) cap[z] = zn.e;
      } else {
        run[z] = true;
      }
      const entryBlocked = inZ.some((b) => b.x < zn.s + 6);
      acc[z] = (run[z] || inZ.length === 0) && !entryBlocked;
    }
    ln.run = run;
    // Hareket (arkadakiler)
    let limit = crossing ? crossing.x : prepSide.length ? Math.min(...prepSide.map((b) => b.x)) : Infinity;
    limit = Math.min(limit, G.GATE);
    let src = 'gate';
    let q = 0;
    if (prepSide.length && Math.min(...prepSide.map((b) => b.x)) < G.GATE) src = 'brick';
    for (const b of behind) {
      const c = b.x + L / 2;
      let z = -1;
      for (let k = 0; k < nz; k++)
        if (c >= Zs[k].s && c < Zs[k].e) {
          z = k;
          break;
        }
      const v = z < 0 ? P.vb : run[z] ? (Zs[z].k === 'R' ? P.vb : P.va) : 0;
      let nx = b.x + v * dt;
      if (z >= 0 && nx + L > cap[z]) {
        nx = Math.max(b.x, cap[z] - L);
        if (Zs[z].k === 'R' && v > 0 && !b.slip) {
          b.slip = true;
          S.slips++;
        }
      }
      const maxX = limit - L;
      if (b.x > maxX + 0.05) {
        b.lost = true;
        S.lost++;
        continue;
      }
      let touching = false;
      if (nx >= maxX - 0.001) {
        nx = maxX;
        if (src === 'brick') touching = true;
      }
      if (touching && !b.touch) S.contacts++;
      b.touch = touching;
      if (touching && v > 0 && !b.slip) {
        b.slip = true;
        S.slips++;
      }
      if (!touching && nx > b.x + 1e-6) b.slip = false;
      b.stopped = nx <= b.x + 1e-6;
      if (b.stopped) q++;
      b.x = nx;
      limit = b.x;
      src = 'brick';
    }
    S.q[i] = q;
    if (q > S.qmax[i]) S.qmax[i] = q;
    S.cam[i] = released;
    // Kapak
    if (ln.gate === 'open' && !ln.meter && indexed === 4 && S.zone.phase === 'fill') {
      const span = lb.some((b) => b.x < G.G2 && b.x + L > G.G2);
      if (span) {
        if (!ln.trip) {
          S.trips++;
          ln.trip = true;
        }
      } else {
        ln.gate = 'closing';
        ln.gt = P.gateT;
        ln.trip = false;
      }
    } else if (ln.gate === 'closing') {
      ln.gt -= dt;
      if (ln.gt <= 0) ln.gate = 'closed';
    } else if (ln.gate === 'opening') {
      ln.gt -= dt;
      if (ln.gt <= 0) ln.gate = 'open';
    }
    // teşhis: bırakma izni olduğu halde tuğla ilerlemiyor mu?
    const w = lb.find((b) => b.x + L >= G.GATE - 0.3 && b.x + L <= G.GATE + 0.3);
    const okRel = w && ln.meter && ln.gate === 'open' && S.zone.phase === 'fill' && !lb.some((b) => b.x + L > G.GATE + 0.3 && b.x < G.E - 0.01);
    ln.stuckT = okRel ? (ln.stuckT || 0) + dt : 0;
    if (ln.stuckT > 1.5 && !S.anomaly) S.anomaly = { lane: i, t: +t.toFixed(2) };
  }

  // 3) Ön hazırlık bloğu ve pop-up yönü
  const Zp = S.zone;
  if (Zp.phase === 'fill') {
    const ready = S.lanes.every((ln, i) => ln.gate === 'closed' && S.bricks.filter((b) => b.lane === i && b.st === 'belt' && b.x >= G.E - 0.01).length === 4);
    const side = ready ? chooseSide(S) : -1;
    if (!ready) S.wFill += dt;
    else if (side < 0) S.wTable += dt;
    if (ready && side >= 0) {
      if (S.lastBlock !== null) {
        S.blockTimes.push(t - S.lastBlock);
        if (S.blockTimes.length > 40) S.blockTimes.shift();
      }
      S.lastBlock = t;
      const bricks = S.bricks.filter((b) => b.st === 'belt' && b.x >= G.E - 0.01);
      bricks.forEach((b) => {
        b.st = 'block';
        b.cy0 = G.laneCenterY(b.lane);
        b.cy = b.cy0;
      });
      const T = S.tables[side];
      const half = T.next++ as 0 | 1;
      const sgn = side === 0 ? 1 : -1;
      Zp.block = { bricks, off: 0, target: sgn * (half === 0 ? G.TD2 : G.TD1), half, side: side as Side, sgn };
      Zp.phase = 'lift';
      Zp.timer = P.liftT;
      S.blockDir[side]++;
    }
  } else if (Zp.phase === 'lift') {
    Zp.timer -= dt;
    if (Zp.timer <= 0) {
      Zp.phase = 'move';
      S.blocks.push(Zp.block!);
    }
  } else if (Zp.phase === 'move') {
    if (Math.abs(Zp.block!.off) >= G.CLEAR) {
      Zp.phase = 'lower';
      Zp.timer = P.liftT;
    }
  } else if (Zp.phase === 'lower') {
    Zp.timer -= dt;
    if (Zp.timer <= 0) {
      Zp.phase = 'fill';
      Zp.block = null;
      S.lanes.forEach((ln) => {
        ln.gate = 'opening';
        ln.gt = P.gateT;
      });
    }
  }
  for (const blk of S.blocks) {
    blk.off = blk.sgn > 0 ? Math.min(blk.target, blk.off + P.tSpeed * dt) : Math.max(blk.target, blk.off - P.tSpeed * dt);
    blk.bricks.forEach((b) => (b.cy = (b.cy0 as number) + blk.off));
    if (blk.off === blk.target) {
      blk.done = true;
      blk.bricks.forEach((b) => (b.st = 'table'));
      const T = S.tables[blk.side];
      T.halves[blk.half] = blk.bricks;
      if (T.halves[0] && T.halves[1]) {
        const lv = [...T.halves[0], ...T.halves[1]];
        lv.forEach((b) => (b.st = 'grp'));
        T.exiting = lv;
        T.halves = [null, null];
        S.levels++;
        S.sides[blk.side].groups.push({ bricks: lv, back: 0, front: 0 });
        S.pref = 1 - blk.side;
      }
    }
  }
  S.blocks = S.blocks.filter((b) => !b.done);
  for (const T of S.tables)
    if (T.exiting && T.exiting.every((b) => b.x >= G.ZEND + 1)) {
      T.exiting = null;
      T.next = 0;
    }

  // 4) Tampon bant, fırıncı plaka, ranza kaldırıcı
  S.sides.forEach((sd) => {
    const pl = sd.plate;
    const rk = sd.rack;
    let lim = pl.phase === 'ready' ? G.PL0 + G.PLEN - 2 : G.PL0 - 1;
    for (const g of sd.groups) {
      let fr = -1e9;
      let bk = 1e9;
      for (const b of g.bricks) {
        fr = Math.max(fr, b.x + L);
        bk = Math.min(bk, b.x);
      }
      const dx = Math.max(0, Math.min(P.exitSpeed * dt, lim - fr));
      g.bricks.forEach((b) => (b.x += dx));
      g.back = bk + dx;
      g.front = fr + dx;
      lim = bk + dx - 8;
    }
    if (pl.phase === 'ready' && sd.groups.length && sd.groups[0].front >= G.PL0 + G.PLEN - 2.01) {
      const g = sd.groups.shift()!;
      pl.level = g.bricks;
      g.bricks.forEach((b) => (b.st = 'plate'));
      pl.phase = 'loaded';
    }
    const rackReady = rk.phase === 'ok' && rk.lift === rk.target && rk.levels < 5;
    if (pl.phase === 'ready') {
      if (rk.levels < 5 && !sd.groups.some((g) => g.back >= G.PL0 - 90)) sd.starve += dt;
    } else if (pl.phase === 'loaded') {
      if (rackReady) pl.phase = 'insert';
      else sd.rackWait += dt;
    } else if (pl.phase === 'insert') {
      sd.loadBusy += dt;
      const d = Math.min(P.vPlate * dt, G.DX - pl.px);
      pl.px += d;
      pl.level!.forEach((b) => (b.x += d));
      if (pl.px >= G.DX) pl.phase = 'retract';
    } else if (pl.phase === 'retract') {
      sd.loadBusy += dt;
      const d = Math.min(P.vPlate * dt, pl.px);
      pl.px -= d;
      pl.belt += d;
      if (pl.px <= 0) {
        rk.bricks.forEach((b) => (b.dead = true));
        pl.level!.forEach((b) => (b.st = 'rack'));
        rk.bricks = pl.level!;
        pl.level = null;
        pl.phase = 'ready';
        rk.levels++;
        sd.loaded++;
        if (rk.levels < 5) rk.target = (4 - rk.levels) * 30;
        else rk.phase = 'needSwap';
      }
    }
    if (rk.phase === 'ok') {
      if (rk.lift < rk.target) rk.lift = Math.min(rk.target, rk.lift + P.liftSpeed * dt);
      else if (rk.lift > rk.target) rk.lift = Math.max(rk.target, rk.lift - P.liftSpeed * dt);
    } else if (rk.phase === 'needSwap') {
      if (sd.empty > 0 && sd.full < P.outCap) {
        rk.phase = 'swap';
        rk.timer = P.swapT;
      } else sd.rackWait += dt;
    } else if (rk.phase === 'swap') {
      rk.timer -= dt;
      if (rk.timer <= P.swapT / 2 && rk.bricks.length) {
        rk.bricks.forEach((b) => (b.dead = true));
        rk.bricks = [];
      }
      if (rk.timer <= 0) {
        sd.empty--;
        sd.full++;
        sd.outQ.push(rk.reject);
        if (!rk.reject) sd.racks++;
        rk.levels = 0;
        rk.lift = 0;
        rk.target = 120;
        S.rng = (S.rng * 16807) % 2147483647;
        const bad = S.rng / 2147483647 < P.badRack / 100;
        rk.reject = bad;
        if (bad) {
          sd.rejected++;
          rk.phase = 'needSwap';
        } else rk.phase = 'ok';
      }
    }
  });

  // 5) Taşıyıcılar
  for (const v of S.veh) {
    if (v.busy) {
      v.busyT += dt;
      v.timer -= dt;
      if (v.timer <= 0) {
        v.busy = false;
        const sd = S.sides[v.to];
        if (v.bring) {
          sd.incoming--;
          sd.empty++;
        }
      }
    }
    if (!v.busy) {
      let best = -1;
      let bs = 0;
      S.sides.forEach((sd, i) => {
        const sc = sd.full * 2 + (P.inCap - sd.empty - sd.incoming);
        if (sc > bs) {
          bs = sc;
          best = i;
        }
      });
      if (best >= 0) {
        const sd = S.sides[best];
        v.busy = true;
        v.timer = P.tripT;
        v.to = best;
        S.tripsV++;
        if (sd.full > 0) {
          sd.full--;
          v.cargo = sd.outQ.shift() ? 'reject' : 'full';
        } else v.cargo = null;
        v.bring = sd.empty + sd.incoming < P.inCap;
        if (v.bring) sd.incoming++;
      }
    }
  }
  for (const b of S.bricks)
    if (b.st === 'scrap' && b.kick && b.off !== undefined && Math.abs(b.off) > G.W + 10 && !b.gone) {
      b.gone = true;
      S.scrapPushed++;
    }
  S.bricks = S.bricks.filter((b) => !(b.lost || b.dead || (b.st === 'scrap' && (b.gone || (b.mid && b.x > G.X_BELT + 40) || t - (b.t0 as number) > 8))));
}
