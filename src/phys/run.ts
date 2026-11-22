// Tam kat yükleme çevrimini koşturur, kareleri kaydeder, ölçümleri özetler. Tarayıcıda parça parça (UI donmasın),
// testte tek seferde çalışır.

import type { PhysConfig } from './config';
import { World, GRAV, type BeltSlat, type Brick } from './world';
import { PAD_X_INSET, PAD_Z0, PAD_Z1 } from './rig';

export interface Frames {
  n: number;
  fps: number;
  nb: number;
  t: Float32Array;
  /** Kare başına — plaka: uç x, burun açısı, bant konumu, menteşe sehimi, uç makarası z; tarak: x kayması, diş alt z, şişme, 0, 0 */
  plate: Float32Array;
  /** Kare × tuğla × (x y z qw qx qy qz) */
  pose: Float32Array;
  /** Kare × tuğla: o ana kadarki en derin kenar ezilmesi (m) */
  dent: Float32Array;
  /** Kare × tuğla × (plaka, çıta, tuğla) normal kuvvet (N) */
  force: Float32Array;
  /** Kare × tuğla: durum 0 uyanık, 1 plakada bekliyor, 2 çıtada durdu */
  state: Uint8Array;
}
export const PLATE_STRIDE = 5;

export interface BrickSummary {
  id: number;
  row: number;
  col: number;
  /** Çıtaya değme hızı (cm/s) */
  impact: number;
  maxPitchDeg: number;
  maxRollDeg: number;
  /** Kenar ezilmesi (mm): çıta, plaka, tuğla, en büyük */
  dentSlat: number;
  dentPlate: number;
  dentBrick: number;
  dent: number;
  /** Alt yüz izi (mm), en derin */
  faceDent: number;
  /** Komşu tuğla temas kuvveti, en büyük (N) */
  brickF: number;
  touched: number[];
  /** Yüzde en büyük basınç (kPa) */
  faceP: number;
  /** Son konum farkı (mm) ve sapma / eğim (derece) */
  dx: number;
  dy: number;
  yawDeg: number;
  pitchDeg: number;
  /** Çıta üstünden yükseklik farkı (mm, + = yukarıda kalmış) */
  dz: number;
  /** Kayma yolu (mm) */
  slipBelt: number;
  slipSlat: number;
  /** Tarak: pedlere göre kayma (mm), ped kuvveti (N), dişin değme kuvveti alırken / taşırken / çekerken (N) */
  slipPad: number;
  padN: number;
  toothPick: number;
  toothCarry: number;
  toothOut: number;
  tSlat: number;
  settled: boolean;
}

export interface Summary {
  bricks: BrickSummary[];
  belt: { minGapMm: number; tMinGap: number; maxN: number; maxFric: number; slipV: number };
  /** Sıralar arası en küçük son boşluk (mm), tasarımda 20 */
  rowGapMin: number;
  /** Sütunlar arası en küçük son boşluk (mm) */
  colGapMin: number;
  betaMaxDeg: number;
  steps: number;
  simT: number;
  wallMs: number;
  /** Plaka sehimi uçta, tam yükte (mm) */
  sagFullMm: number;
  loader: 'plaka' | 'tarak';
  /** Tarak tutucu özeti (loader = 'tarak') */
  comb: {
    /** Tam ped kuvveti (N) = basınç × ped alanı, ve tutma güvenlik katsayısı (2 ped × μ × kuvvet / ağırlık+ivme) */
    padForce: number;
    sf: number;
    slipPadMax: number;
    toothPickMax: number;
    toothCarryMax: number;
    toothOutMax: number;
    /** Çevrim süresi (s): inişten geri çekilmenin sonuna */
    cycle: number;
  } | null;
}

export class LoadingRun {
  readonly world: World;
  readonly frames: Frames;
  private fi = 0;
  private wall = 0;
  private readonly segQ: Float32Array;

  constructor(cfg: PhysConfig) {
    this.world = new World(cfg);
    const n = Math.ceil(this.world.rig.tl.end * cfg.fps) + 2;
    const nb = this.world.bricks.length;
    this.frames = {
      n: 0,
      fps: cfg.fps,
      nb,
      t: new Float32Array(n),
      plate: new Float32Array(n * PLATE_STRIDE),
      pose: new Float32Array(n * nb * 7),
      dent: new Float32Array(n * nb),
      force: new Float32Array(n * nb * 3),
      state: new Uint8Array(n * nb),
    };
    this.segQ = new Float32Array(nb * this.world.geo.nSeg);
    this.record();
  }

  get done(): boolean {
    return this.world.done;
  }

  get progress(): number {
    return Math.min(1, this.world.t / this.world.rig.tl.end);
  }

  private record() {
    const w = this.world, F = this.frames, i = this.fi;
    if (i >= F.t.length) return;
    const r = w.rig;
    F.t[i] = w.t;
    const P = i * PLATE_STRIDE;
    if (r.tarak) {
      F.plate[P] = r.combX;
      F.plate[P + 1] = r.combZ;
      F.plate[P + 2] = r.infl;
      F.plate[P + 3] = 0;
      F.plate[P + 4] = 0;
    } else {
      F.plate[P] = r.xTip;
      F.plate[P + 1] = r.noseK * r.betaMax;
      F.plate[P + 2] = r.beltPos;
      F.plate[P + 3] = r.sagAt(r.chx);
      F.plate[P + 4] = r.ctz;
    }
    const nb = F.nb;
    w.bricks.forEach((b, k) => {
      const o = (i * nb + k) * 7;
      F.pose[o] = b.px;
      F.pose[o + 1] = b.py;
      F.pose[o + 2] = b.pz;
      F.pose[o + 3] = b.qw;
      F.pose[o + 4] = b.qx;
      F.pose[o + 5] = b.qy;
      F.pose[o + 6] = b.qz;
      F.dent[i * nb + k] = b.maxDent();
      F.force[(i * nb + k) * 3] = b.nPlate + b.nPad;
      F.force[(i * nb + k) * 3 + 1] = b.nSlat;
      F.force[(i * nb + k) * 3 + 2] = b.nBrick;
      F.state[i * nb + k] = b.state === 'awake' ? 0 : b.state === 'plate' ? 1 : 2;
    });
    this.fi++;
    F.n = this.fi;
  }

  /** En fazla `budgetMs` boyunca ilerle. Bitti mi? */
  advance(budgetMs = Infinity): boolean {
    const w = this.world;
    const t0 = performance.now();
    const dtF = 1 / this.frames.fps;
    let k = 0;
    while (!w.done) {
      w.step();
      if (w.t >= this.fi * dtF - 1e-9) this.record();
      if ((++k & 63) === 0 && performance.now() - t0 > budgetMs) break;
    }
    this.wall += performance.now() - t0;
    if (w.done) this.finish();
    return w.done;
  }

  private finished = false;
  private finish() {
    if (this.finished) return;
    this.finished = true;
    const nSeg = this.world.geo.nSeg;
    this.world.bricks.forEach((b, k) => this.segQ.set(b.q, k * nSeg));
  }

  /** Bitince: tuğla başına kenar parçalarının ezilmesi (m), tuğla × parça */
  get segmentDents(): Float32Array {
    return this.segQ;
  }

  summary(): Summary {
    const w = this.world, cfg = w.cfg;
    const bricks = w.bricks.map((b) => brickSummary(b, w));
    // sıra / sütun boşlukları (merkezlerden, eğim ihmal)
    let rowGap = Infinity, colGap = Infinity;
    const at = (r: number, c: number) => w.bricks.find((b) => b.row === r && b.col === c);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const a = at(r, c), b = at(r + 1, c);
      if (a && b) rowGap = Math.min(rowGap, b.px - a.px - cfg.L);
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const a = at(r, c), b = at(r, c + 1);
      if (a && b) colGap = Math.min(colGap, b.py - a.py - cfg.W);
    }
    const bs: BeltSlat = w.belt;
    const r = w.rig;
    let comb: Summary['comb'] = null;
    if (r.tarak && r.ctl) {
      const A = (cfg.L - 2 * PAD_X_INSET) * (PAD_Z1 - PAD_Z0);
      const padForce = cfg.padP * A;
      const need = cfg.mass * Math.hypot(GRAV, cfg.aPlate);
      const mx = (f: (b: Brick) => number) => Math.max(0, ...w.bricks.map(f));
      comb = {
        padForce,
        sf: (2 * cfg.muPad * padForce) / need,
        slipPadMax: mx((b) => b.m.slipPad) * 1000,
        toothPickMax: mx((b) => b.m.toothPick),
        toothCarryMax: mx((b) => b.m.toothCarry),
        toothOutMax: mx((b) => b.m.toothOut),
        cycle: r.ctl.outEnd - r.ctl.descStart,
      };
    }
    return {
      bricks,
      belt: { minGapMm: bs.minGap * 1000, tMinGap: bs.tMinGap, maxN: bs.maxN, maxFric: bs.maxFric, slipV: bs.slipV },
      rowGapMin: rowGap * 1000,
      colGapMin: colGap * 1000,
      betaMaxDeg: (w.rig.betaMax * 180) / Math.PI,
      steps: w.steps,
      simT: w.t,
      wallMs: this.wall,
      sagFullMm: cfg.sagFull * 1000,
      loader: cfg.loader,
      comb,
    };
  }
}

const DEG = 180 / Math.PI;

function brickSummary(b: Brick, w: World): BrickSummary {
  const m = b.m;
  const slatTop = slatTopUnder(w, b);
  return {
    id: b.id,
    row: b.row,
    col: b.col,
    impact: m.impact * 100,
    maxPitchDeg: m.maxPitch * DEG,
    maxRollDeg: m.maxRoll * DEG,
    dentSlat: m.dent[0] * 1000,
    dentPlate: m.dent[1] * 1000,
    dentBrick: m.dent[2] * 1000,
    dent: b.maxDent() * 1000,
    faceDent: Math.max(...m.faceDent) * 1000,
    brickF: m.brickF,
    touched: [...m.touched].sort((x, y) => x - y),
    faceP: m.faceP / 1000,
    dx: (b.px - b.x0) * 1000,
    dy: (b.py - b.y0) * 1000,
    yawDeg: b.yaw * DEG,
    pitchDeg: b.pitch * DEG,
    dz: (b.pz - w.geo.hz - slatTop) * 1000,
    slipBelt: m.slipBelt * 1000,
    slipSlat: m.slipSlat * 1000,
    slipPad: m.slipPad * 1000,
    padN: m.padN,
    toothPick: m.toothPick,
    toothCarry: m.toothCarry,
    toothOut: m.toothOut,
    tSlat: m.tSlat,
    settled: b.state === 'slat',
  };
}

function slatTopUnder(w: World, b: Brick): number {
  let top = -Infinity;
  const { hx, hy } = w.geo;
  for (const s of w.rig.slats) {
    if (s.x1 < b.px - hx || s.x0 > b.px + hx || s.y1 < b.py - hy || s.y0 > b.py + hy) continue;
    top = Math.max(top, s.top);
  }
  return Number.isFinite(top) ? top : 0;
}

/** Tek seferde (test / Node). */
export function runLoading(cfg: PhysConfig): { run: LoadingRun; summary: Summary } {
  const run = new LoadingRun(cfg);
  run.advance();
  return { run, summary: run.summary() };
}
