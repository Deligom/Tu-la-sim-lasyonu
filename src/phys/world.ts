// Yükleme detayının fizik motoru: 24 yaş tuğla (6 serbestlik dereceli katı cisim) + kinematik plaka / burun / bant +
// sabit çıtalar. Deterministik, sabit adımlı, tarayıcısız. SI birimleri.
//
// Temas modeli (yaş kil, "yumuşak köşe"):
//  - Yüzler: Winkler yatağı, basınç = k × batma (elastik). Alt yüzün iç kısmı 1 cm × ~2,9 cm hücreler; her hücrede
//    batma hücre boyunca doğrusal alınıp kapalı biçimde integre edilir (hücre sınırında sıçrama yok).
//  - Makaralar: silindir – düz yüz çizgi teması, Winkler ile analitik (parabolik batma), 4 sütun.
//  - Kenarlar: 12 kenar ~1 cm parçalar. Her parçanın iki komşu yüzünde 1 cm'lik bant; bant boyunca batma kapalı
//    biçimde integre edilir. Basınç akma sınırını (pY) aşınca kenar kalıcı ezilir: ezilme derinliği q (mm) parça
//    başına saklanır, ezilen yer düzleşir (temas alanı büyür → kuvvet artar). İz derinliği buradan.
//  - Sönüm: viskoz, tam yüz temasında `zeta` oranında. Yaş kil sekmez.
//  - Sürtünme: her tuğla × destek (plaka parçası / çıta / komşu tuğla) için yapışma yayı (kıl modeli): küçük
//    yerdeğiştirmede yapışır, μN'de kayar. Sürünme yok.
// Bilinçli basitleştirmeler: plaka ve çıtalar rijit (plaka sehimi yüklerden yarı-statik), tuğla yüzlerinin plastik
// ezilmesi yalnızca kenarlarda, yanal yüzlerin iç kısmı yalnızca bantlarla temas eder.

import type { PhysConfig } from './config';
import { Rig, newHit, layerLayout, PIECE_FLAT, PIECE_RAMP, PIECE_HINGE, PIECE_TIP, TOOTH_H, PAD_Z0, PAD_Z1, type Hit } from './rig';

export const GRAV = 9.81;
const BAND = 0.01;
/** Kenar sönümünde kullanılan etkin kütle (kg) */
const EDGE_MASS = 0.5;
const SEG_LEN = 0.01;

/** Dent kaynağı */
export const SRC_SLAT = 0;
export const SRC_PLATE = 1;
export const SRC_BRICK = 2;

// ---------- tuğla yerel geometrisi (bütün tuğlalarda aynı) ----------
interface Geo {
  hx: number;
  hy: number;
  hz: number;
  /** Kenar parçaları: cx cy cz ex ey ez n1x n1y n1z n2x n2y n2z len axis bottomSide */
  seg: Float64Array;
  nSeg: number;
  /** Alt yüz iç hücreleri: cx cy hxc hyc */
  cell: Float64Array;
  nCell: number;
  /** Makara sütunları (yerel y) ve genişlik */
  colY: number[];
  colW: number;
}
const SEG_STRIDE = 15;

function buildGeo(cfg: PhysConfig): Geo {
  const hx = cfg.L / 2, hy = cfg.W / 2, hz = cfg.H / 2;
  const h = [hx, hy, hz];
  const segs: number[] = [];
  for (let a = 0; a < 3; a++) {
    const b = a === 0 ? 1 : 0;
    const c = a === 2 ? 1 : 2;
    const n = Math.max(1, Math.round((2 * h[a]) / SEG_LEN));
    const len = (2 * h[a]) / n;
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const ctr = [0, 0, 0];
          ctr[a] = -h[a] + (i + 0.5) * len;
          ctr[b] = s1 * h[b];
          ctr[c] = s2 * h[c];
          const e = [0, 0, 0];
          e[a] = 1;
          const n1 = [0, 0, 0];
          n1[b] = s1;
          const n2 = [0, 0, 0];
          n2[c] = s2;
          // alt yüz hangi komşu yüz? (z = c ekseni, s2 = −1 ise yüz 2)
          const bottomSide = c === 2 && s2 === -1 ? 2 : 0;
          segs.push(...ctr, ...e, ...n1, ...n2, len, a, bottomSide);
        }
      }
    }
  }
  const nx = Math.round((2 * (hx - BAND)) / 0.01);
  const ny = 4;
  const hxc = (hx - BAND) / nx, hyc = (hy - BAND) / ny;
  const cells: number[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      cells.push(-hx + BAND + (2 * i + 1) * hxc, -hy + BAND + (2 * j + 1) * hyc, hxc, hyc);
    }
  }
  const colW = (2 * hy) / 4;
  const colY = [0, 1, 2, 3].map((j) => -hy + (j + 0.5) * colW);
  return {
    hx, hy, hz,
    seg: new Float64Array(segs),
    nSeg: segs.length / SEG_STRIDE,
    cell: new Float64Array(cells),
    nCell: cells.length / 4,
    colY,
    colW,
  };
}

// ---------- sürtünme grubu ----------
class Group {
  zx = 0;
  zy = 0;
  zz = 0;
  N = 0;
  px = 0;
  py = 0;
  pz = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  nx = 0;
  ny = 0;
  nz = 0;
  mu = 0.5;
  other: Brick | null = null;
  slipping = false;
  /** Burulma kılı (rad), yalnızca pedlerde */
  tw = 0;
}
/** Ped (16 × 13 cm) burulma sürtünmesi için etkin yarıçap, √A / 3 */
const PAD_R_EFF = Math.sqrt(0.16 * 0.13) / 3;

export type BrickState = 'awake' | 'plate' | 'slat';

export interface BrickMetrics {
  /** Çıtaya ilk değme anı (s) */
  tSlat: number;
  /** Çıtaya yaklaşma (çarpma) hızı, en büyük (m/s) */
  impact: number;
  /** En büyük öne eğim ve yan yatma (rad) */
  maxPitch: number;
  maxRoll: number;
  /** Kenar ezilmesi, kaynağa göre en derin (m) */
  dent: [number, number, number];
  /** Alt yüz izi, kaynağa göre en derin (m) */
  faceDent: [number, number, number];
  /** Komşu tuğlayla en büyük temas kuvveti (N) ve dokunduğu tuğlalar */
  brickF: number;
  touched: Set<number>;
  /** Yüzde en büyük basınç (Pa) — makara çizgisi vb. */
  faceP: number;
  /** Plaka bandına göre kayma yolu (m) ve çıtada kayma yolu (m) */
  slipBelt: number;
  slipSlat: number;
  /** Tarak: pedlere göre kayma yolu (m), ped kuvveti (N), dişin tuğlaya değme kuvveti (N) alırken / taşırken / çekerken */
  slipPad: number;
  padN: number;
  toothPick: number;
  toothCarry: number;
  toothOut: number;
}

export class Brick {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  px = 0;
  py = 0;
  pz = 0;
  qw = 1;
  qx = 0;
  qy = 0;
  qz = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  wx = 0;
  wy = 0;
  wz = 0;
  readonly R = new Float64Array(9);
  fx = 0;
  fy = 0;
  fz = 0;
  tx = 0;
  ty = 0;
  tz = 0;
  state: BrickState = 'plate';
  quiet = 0;
  awakeT = 0;
  wakeReq = false;
  /** Kenar parçalarının kalıcı ezilmesi (m) */
  readonly q: Float64Array;
  /** Alt yüz hücrelerinin kalıcı izi (m) */
  readonly qc: Float64Array;
  /** Bu temasta ulaşılan en büyük elastik batma (boşaltma eğrisi için), kenar ve hücre */
  readonly em: Float64Array;
  readonly emc: Float64Array;
  readonly groups = new Map<number, Group>();
  /** Bu adımda plakaya / çıtaya / tuğlalara binen normal kuvvet (N) */
  nPlate = 0;
  nSlat = 0;
  nBrick = 0;
  /** Bu adımda pedlerin ve dişlerin bastırdığı kuvvet (N) */
  nPad = 0;
  nTooth = 0;
  plateFzX = 0;
  /** Sehim için süzülmüş plaka yükü (N) ve yeri */
  load = 0;
  loadX = 0;
  readonly x0: number;
  readonly y0: number;
  readonly m: BrickMetrics = {
    tSlat: NaN, impact: 0, maxPitch: 0, maxRoll: 0, dent: [0, 0, 0], faceDent: [0, 0, 0], brickF: 0, touched: new Set(), faceP: 0,
    slipBelt: 0, slipSlat: 0, slipPad: 0, padN: 0, toothPick: 0, toothCarry: 0, toothOut: 0,
  };

  constructor(id: number, row: number, col: number, x: number, y: number, z: number, nSeg: number, nCell = 68) {
    this.id = id;
    this.row = row;
    this.col = col;
    this.px = x;
    this.py = y;
    this.pz = z;
    this.x0 = x;
    this.y0 = y;
    this.q = new Float64Array(nSeg);
    this.qc = new Float64Array(nCell);
    this.em = new Float64Array(nSeg);
    this.emc = new Float64Array(nCell);
    this.updateR();
  }

  updateR() {
    const { qw: w, qx: x, qy: y, qz: z } = this;
    const R = this.R;
    R[0] = 1 - 2 * (y * y + z * z);
    R[1] = 2 * (x * y - w * z);
    R[2] = 2 * (x * z + w * y);
    R[3] = 2 * (x * y + w * z);
    R[4] = 1 - 2 * (x * x + z * z);
    R[5] = 2 * (y * z - w * x);
    R[6] = 2 * (x * z - w * y);
    R[7] = 2 * (y * z + w * x);
    R[8] = 1 - 2 * (x * x + y * y);
  }

  /** Öne eğim (+ = ön aşağı), yan yatma, sapma (rad) */
  get pitch() {
    return Math.asin(Math.max(-1, Math.min(1, -this.R[6])));
  }
  get roll() {
    return Math.asin(Math.max(-1, Math.min(1, this.R[7])));
  }
  get yaw() {
    return Math.atan2(this.R[3], this.R[0]);
  }
  maxDent(): number {
    return Math.max(this.m.dent[0], this.m.dent[1], this.m.dent[2]);
  }
}

export interface BeltSlat {
  /** En küçük alt bant – çıta boşluğu (m) ve anı */
  minGap: number;
  tMinGap: number;
  /** Temas olursa en büyük bastırma kuvveti ve sürtünme (N) */
  maxN: number;
  maxFric: number;
  /** Temas anındaki kayma hızı (m/s) */
  slipV: number;
}

// ---------- tek adım kapalı biçim integraller ----------
let _I = 0;
let _W = 0;
/** Kenar bandı: kenarda elastik batma e, geometrik batma d, ezilme q, yükselme oranı r, destek eğriliği kap. */
function bandInt(e: number, d: number, q: number, r: number, kap: number) {
  if (kap > 0) {
    const disc = r * r + 2 * kap * e;
    let s = (-r + Math.sqrt(disc)) / kap;
    if (s > BAND) s = BAND;
    if (s < 0) s = 0;
    _I = e * s - (r * s * s) / 2 - (kap * s * s * s) / 6;
    _W = s;
    return;
  }
  if (r <= 1e-6) {
    _I = e * BAND - (r * BAND * BAND) / 2;
    _W = BAND;
    return;
  }
  const sq = Math.min(q / r, BAND);
  let I = e * sq;
  const sEnd = Math.min(BAND, d / r);
  if (sEnd > sq) I += d * (sEnd - sq) - (r * (sEnd * sEnd - sq * sq)) / 2;
  _I = I;
  _W = Math.max(sq, sEnd);
}

let _Ls = 0; // ∫ d ds (birim aralıkta)
let _Lw = 0; // temas kesri
let _Lc = 0; // ağırlık merkezi (0..1)
let _Lm = 0; // en derin batma
let _Lf = 1; // boşaltmada elastik kuvvet çarpanı
/** d(s) = d0 + (d1 − d0) s, s ∈ [sa, sb] ⊂ [0,1], pozitif kısmın integrali */
function linInt(d0: number, d1: number, sa: number, sb: number) {
  _Ls = 0;
  _Lw = 0;
  _Lc = 0.5;
  _Lm = 0;
  if (sb <= sa) return;
  const g = d1 - d0;
  let a = sa, b = sb;
  if (Math.abs(g) > 1e-15) {
    const z = -d0 / g; // sıfır geçişi
    if (g > 0) a = Math.max(a, z);
    else b = Math.min(b, z);
  } else if (d0 <= 0) return;
  if (b <= a) return;
  const da = d0 + g * a, db = d0 + g * b;
  const I = 0.5 * (da + db) * (b - a);
  if (I <= 0) return;
  _Ls = I;
  _Lw = b - a;
  _Lm = Math.max(da, db);
  // yamuk ağırlık merkezi
  _Lc = a + ((b - a) * (da + 2 * db)) / (3 * (da + db));
}

// Diş kesiti (u: dişe göre y, w: diş altına göre z): dikdörtgen, alt köşeleri 45° pahlı. İçerideyse batma ve dış normal.
let _td = 0;
let _tu = 0;
let _tw = 0;
const R2 = Math.SQRT1_2;
function toothHit(u: number, w: number, ht: number, ch: number): boolean {
  if (w < 0 || w > TOOTH_H || u < -ht || u > ht) return false;
  const s5 = ((u - (-ht + ch)) * -R2) + w * -R2; // sol alt pah
  const s6 = ((u - (ht - ch)) * R2) + w * -R2; // sağ alt pah
  if (s5 > 0 || s6 > 0) return false;
  let d = u + ht, nu = -1, nw = 0;
  if (ht - u < d) { d = ht - u; nu = 1; nw = 0; }
  if (w < d) { d = w; nu = 0; nw = -1; }
  if (TOOTH_H - w < d) { d = TOOTH_H - w; nu = 0; nw = 1; }
  if (-s5 < d) { d = -s5; nu = -R2; nw = -R2; }
  if (-s6 < d) { d = -s6; nu = R2; nw = -R2; }
  if (d > 0.015) return false;
  _td = d;
  _tu = nu;
  _tw = nw;
  return true;
}
/** Üst yüzde diş temas noktaları (yerel x/hx, y/hy) */
const TOP_PTS = [-0.8, -0.6, -0.8, 0, -0.8, 0.6, -0.27, -0.6, -0.27, 0, -0.27, 0.6, 0.27, -0.6, 0.27, 0, 0.27, 0.6, 0.8, -0.6, 0.8, 0, 0.8, 0.6];

export interface WorldOptions {
  /** Yalnızca bu tuğlalar (test için); boşsa 24 tuğla */
  only?: number[];
  /** Test: plaka yok, tuğlalar uyanık ve verilen konumda (x, y, z, öne eğim rad) */
  drop?: { x: number; y: number; z: number; pitch?: number; roll?: number; vz?: number }[];
}

export class World {
  readonly cfg: PhysConfig;
  readonly rig: Rig;
  readonly geo: Geo;
  readonly bricks: Brick[] = [];
  readonly rowsX0: number[];
  readonly colsY: number[];
  t = 0;
  steps = 0;
  readonly I: [number, number, number];
  readonly cW: number;
  readonly belt: BeltSlat = { minGap: Infinity, tMinGap: 0, maxN: 0, maxFric: 0, slipV: 0 };
  /** Uyanık tuğla sayısı (performans) */
  awakeCount = 0;
  private readonly h = newHit();
  private readonly h2 = newHit();
  private maxSupportZ: number;

  constructor(cfg: PhysConfig, opt: WorldOptions = {}) {
    this.cfg = cfg;
    this.rig = new Rig(cfg);
    this.geo = buildGeo(cfg);
    const { rowsX0, colsY } = layerLayout(cfg.rowGap);
    this.rowsX0 = rowsX0;
    this.colsY = colsY;
    const m = cfg.mass;
    this.I = [(m * (cfg.W ** 2 + cfg.H ** 2)) / 12, (m * (cfg.L ** 2 + cfg.H ** 2)) / 12, (m * (cfg.L ** 2 + cfg.W ** 2)) / 12];
    this.cW = 2 * cfg.zeta * Math.sqrt((cfg.kW * m) / (cfg.L * cfg.W));
    const zc = this.rig.zu + this.geo.hz;
    let id = 0;
    if (opt.drop) {
      this.rig.away = true;
      this.rig.update(0);
      for (const d of opt.drop) {
        const b = new Brick(id++, 0, 0, d.x, d.y, d.z, this.geo.nSeg, this.geo.nCell);
        const p = d.pitch ?? 0, r = d.roll ?? 0;
        // önce öne eğim (y ekseni), sonra yan yatma (x ekseni)
        const qy = [Math.cos(p / 2), 0, Math.sin(p / 2), 0];
        const qx = [Math.cos(r / 2), Math.sin(r / 2), 0, 0];
        b.qw = qx[0] * qy[0] - qx[1] * qy[1];
        b.qx = qx[1] * qy[0];
        b.qy = qx[0] * qy[2];
        b.qz = qx[1] * qy[2];
        b.updateR();
        b.state = 'awake';
        b.vz = d.vz ?? 0;
        this.bricks.push(b);
      }
      this.maxSupportZ = Math.max(...this.rig.slats.map((s) => s.top));
      return;
    }
    for (let r = 0; r < rowsX0.length; r++) {
      for (let c = 0; c < colsY.length; c++) {
        if (!opt.only || opt.only.includes(id)) {
          this.bricks.push(new Brick(id, r, c, rowsX0[r] + this.geo.hx, colsY[c], zc, this.geo.nSeg, this.geo.nCell));
        }
        id++;
      }
    }
    this.maxSupportZ = Math.max(this.rig.zu, ...this.rig.slats.map((s) => s.top));
    if (this.rig.tarak) {
      // tarak: kat alma bandında (tampon), ranzadaki hedefinin bir strok gerisinde; sütun hizasızlığı rig'den
      for (const b of this.bricks) {
        b.state = 'awake';
        b.px -= cfg.stroke;
        b.py = this.rig.colsY[b.col];
        b.pz = this.rig.zBuf + this.geo.hz - (m * GRAV) / (cfg.kW * cfg.L * cfg.W);
      }
      this.maxSupportZ = Math.max(this.rig.zBuf, ...this.rig.slats.map((s) => s.top));
      return;
    }
    // plaka rijitliği: tam yükte (24 tuğla) uç sehimi sagFull
    this.rig.loadX = [];
    this.rig.loadF = [];
    for (const x0 of rowsX0) for (let c = 0; c < colsY.length; c++) {
      this.rig.loadX.push(x0 + this.geo.hx);
      this.rig.loadF.push(m * GRAV);
    }
    this.rig.calibrateEI();
    for (const b of this.bricks) {
      b.load = m * GRAV;
      b.loadX = b.px;
    }
    this.collectLoads();
    this.rig.update(0);
    for (const b of this.bricks) this.placeOnPlate(b);
  }

  get done(): boolean {
    return this.t >= this.rig.tl.end;
  }

  private placeOnPlate(b: Brick) {
    // yerinde bekleyen tuğla: plaka üstünde, sehimi izler (elastik batma ~µm, ihmal)
    b.pz = this.rig.zu - this.rig.sagAt(b.px) + this.geo.hz - (this.cfg.mass * GRAV) / (this.cfg.kW * this.cfg.L * this.cfg.W);
  }

  private inNoseZone(b: Brick): boolean {
    const r = this.rig;
    const ext = Math.abs(b.R[0]) * this.geo.hx + Math.abs(b.R[1]) * this.geo.hy + Math.abs(b.R[2]) * this.geo.hz;
    return b.px + ext > r.chx - r.Rh - 0.01 && b.px - ext < r.xTip + 0.015;
  }

  /**
   * Plaka sehimi için yükler. Kütlesiz kiriş ile tuğla arasında adım adım geri besleme kararsız olur (yük → sehim →
   * temas kopar → sehim kalkar); yük 20 ms zaman sabitiyle süzülür. Plakanın kendi titreşimi bu modelde yok.
   */
  private collectLoads() {
    const X: number[] = [], F: number[] = [];
    const a = Math.min(1, this.cfg.dt / 0.02), W = this.cfg.mass * GRAV;
    for (const b of this.bricks) {
      let target = 0, x = b.loadX;
      if (b.state === 'plate') {
        target = W;
        x = b.px;
      } else if (b.state === 'awake' && b.nPlate > 0) {
        target = Math.min(b.nPlate, 3 * W);
        x = b.plateFzX;
      }
      b.load += (target - b.load) * a;
      b.loadX += (x - b.loadX) * (target > 0 ? a * 5 > 1 ? 1 : a * 5 : 0);
      if (b.load > 1e-3) {
        X.push(b.loadX);
        F.push(b.load);
      }
    }
    this.rig.loadX = X;
    this.rig.loadF = F;
  }

  // ---------- kuvvet uygulama ----------
  private applyForce(b: Brick, fx: number, fy: number, fz: number, px: number, py: number, pz: number) {
    b.fx += fx;
    b.fy += fy;
    b.fz += fz;
    const rx = px - b.px, ry = py - b.py, rz = pz - b.pz;
    b.tx += ry * fz - rz * fy;
    b.ty += rz * fx - rx * fz;
    b.tz += rx * fy - ry * fx;
  }

  private group(b: Brick, key: number, mu: number, other: Brick | null): Group {
    let g = b.groups.get(key);
    if (!g) {
      g = new Group();
      g.mu = mu;
      g.other = other;
      b.groups.set(key, g);
    }
    return g;
  }

  /** Normal kuvveti uygula ve sürtünme grubuna yaz. h: destek normali ve hızı. */
  private normal(
    b: Brick, key: number, mu: number, other: Brick | null, F: number,
    px: number, py: number, pz: number, h: Hit,
  ) {
    if (F <= 0) return;
    const fx = F * h.nx, fy = F * h.ny, fz = F * h.nz;
    this.applyForce(b, fx, fy, fz, px, py, pz);
    if (other) this.applyForce(other, -fx, -fy, -fz, px, py, pz);
    const g = this.group(b, key, mu, other);
    g.N += F;
    g.px += F * px;
    g.py += F * py;
    g.pz += F * pz;
    g.vx += F * h.vx;
    g.vy += F * h.vy;
    g.vz += F * h.vz;
    g.nx += F * h.nx;
    g.ny += F * h.ny;
    g.nz += F * h.nz;
  }

  /** Noktanın tuğlaya göre hızı ile destek hızı arasındaki yaklaşma hızı (normal boyunca, + = yaklaşıyor) */
  private approach(b: Brick, px: number, py: number, pz: number, h: Hit): number {
    const rx = px - b.px, ry = py - b.py, rz = pz - b.pz;
    const vx = b.vx + b.wy * rz - b.wz * ry - h.vx;
    const vy = b.vy + b.wz * rx - b.wx * rz - h.vy;
    const vz = b.vz + b.wx * ry - b.wy * rx - h.vz;
    return -(vx * h.nx + vy * h.ny + vz * h.nz);
  }

  /** Kenar parçası teması (yumuşak köşe). sides: 1 = yalnız yüz 1 bandı, 2 = yalnız yüz 2, 3 = ikisi. */
  private edge(
    b: Brick, si: number, px: number, py: number, pz: number,
    n1x: number, n1y: number, n1z: number, n2x: number, n2y: number, n2z: number, len: number,
    h: Hit, kEff: number, sides: number, key: number, mu: number, other: Brick | null, src: number,
  ) {
    const d = h.d;
    let q = b.q[si];
    let em = b.em[si];
    const dY = this.cfg.pY / kEff;
    let e = d - q;
    if (e <= 0) {
      b.em[si] = 0;
      return;
    }
    if (e > dY) {
      // akma: kenar ezilir
      q = d - dY;
      b.q[si] = q;
      e = dY;
      em = dY;
      if (q > b.m.dent[src]) b.m.dent[src] = q;
    }
    // yükleme eğrisi e'de (ya da boşaltmada en büyük em'de)
    let eL = e, scale = 1;
    if (e >= em) em = e;
    else {
      const eu = em * (1 - 1 / this.cfg.kUnload);
      if (e <= eu) {
        // boşaltma doğrusu sıfıra indi: kalan batma kalıcı iz
        b.q[si] = d;
        b.em[si] = 0;
        if (d > b.m.dent[src]) b.m.dent[src] = d;
        return;
      }
      eL = em;
      scale = (e - eu) / (em - eu);
    }
    b.em[si] = em;
    const dL = q + eL;
    const r1 = -(n2x * h.nx + n2y * h.ny + n2z * h.nz);
    const r2 = -(n1x * h.nx + n1y * h.ny + n1z * h.nz);
    let I = 0, W = 0;
    if (sides & 1) {
      bandInt(eL, dL, q, r1, h.kappa);
      I += _I;
      W += _W;
    }
    if (sides & 2) {
      bandInt(eL, dL, q, r2, h.kappa);
      I += _I;
      W += _W;
    }
    if (I <= 0) return;
    const va = this.approach(b, px, py, pz, h);
    const w = len * h.frac;
    // sönüm: yüzeyle aynı alan orantılı sönüm + parçanın kendi rijitliğine göre küçük bir ek (tek kenar teması)
    const cF = this.cW * W * w + 2 * this.cfg.zetaEdge * Math.sqrt(kEff * W * w * EDGE_MASS);
    const F = kEff * I * w * scale + cF * va;
    const p = kEff * e;
    if (p > b.m.faceP) b.m.faceP = Math.min(p, this.cfg.pY);
    if (key >= 100 && key < 200 && d < 0.001 && va > b.m.impact) b.m.impact = va;
    this.normal(b, key, mu, other, F, px, py, pz, h);
    this.trackSupport(b, key, F, px, h);
  }

  private trackSupport(b: Brick, key: number, F: number, px: number, h: Hit) {
    if (F <= 0) return;
    if (key < 100) {
      b.nPlate += F * h.nz;
      b.plateFzX += F * h.nz * px;
    } else if (key < 200) {
      b.nSlat += F;
      if (Number.isNaN(b.m.tSlat)) b.m.tSlat = this.t;
    } else if (key < 300) b.nBrick += F;
    else if (key < 400) b.nPad += F;
    else b.nTooth += F;
  }

  // ---------- bir tuğlanın destek temasları ----------
  private supports(b: Brick) {
    const { geo, rig, cfg, h, h2 } = this;
    const R = b.R;
    const { hx, hy, hz } = geo;
    const low = b.pz - (Math.abs(R[6]) * hx + Math.abs(R[7]) * hy + Math.abs(R[8]) * hz);
    if (low > this.maxSupportZ + 0.003) return;
    const k = cfg.kW;
    const par = cfg.slat === 'paralel';
    // --- alt yüz hücreleri (düzlemsel parçalar: düz üst, rampa, çıta üstleri) ---
    const C = geo.cell;
    const ncx = -R[2], ncz = -R[8]; // alt yüz dış normali
    for (let i = 0; i < geo.nCell; i++) {
      const cx = C[4 * i], cy = C[4 * i + 1], hxc = C[4 * i + 2], hyc = C[4 * i + 3];
      // hücrenin yerel x boyunca iki ucu
      const ax = b.px + R[0] * (cx - hxc) + R[1] * cy - R[2] * hz;
      const ay = b.py + R[3] * (cx - hxc) + R[4] * cy - R[5] * hz;
      const az = b.pz + R[6] * (cx - hxc) + R[7] * cy - R[8] * hz;
      const bx = ax + 2 * hxc * R[0], by = ay + 2 * hxc * R[3], bz = az + 2 * hxc * R[6];
      if (az > this.maxSupportZ + 0.002 && bz > this.maxSupportZ + 0.002) continue;
      const area = 4 * hxc * hyc;
      // plaka: düz üst (x ≤ menteşe) ve rampa (teğet noktaları arası)
      if (!rig.tarak && az > rig.zu - 0.04) {
        // düz üst
        {
          const d0 = rig.zu - rig.sagAt(ax) - az, d1 = rig.zu - rig.sagAt(bx) - bz;
          let sa = 0, sb = 1;
          const dx = bx - ax;
          if (Math.abs(dx) > 1e-12) {
            const sh = (rig.chx - ax) / dx;
            if (dx > 0) sb = Math.min(sb, sh);
            else sa = Math.max(sa, sh);
          } else if (ax > rig.chx) sb = 0;
          if (d0 < 0.03 && d1 < 0.03) {
            if (this.cellPlastic(b, i, d0, d1, sa, sb, SRC_PLATE)) this.cellForce(b, PIECE_FLAT, ax, ay, az, bx, by, bz, ncx, ncz, 0, 1, area, hyc, k, cfg.muBelt);
          }
        }
        // rampa
        if (rig.rampLen > 1e-5) {
          const d0 = (rig.thx - ax) * rig.nrx + (rig.thz - az) * rig.nrz;
          const d1 = (rig.thx - bx) * rig.nrx + (rig.thz - bz) * rig.nrz;
          const s0 = (ax - rig.thx) * rig.trx + (az - rig.thz) * rig.trz;
          const s1 = (bx - rig.thx) * rig.trx + (bz - rig.thz) * rig.trz;
          let sa = 0, sb = 1;
          const ds = s1 - s0;
          if (Math.abs(ds) > 1e-12) {
            const lo = (0 - s0) / ds, hi = (rig.rampLen - s0) / ds;
            sa = Math.max(sa, Math.min(lo, hi));
            sb = Math.min(sb, Math.max(lo, hi));
          } else if (s0 < 0 || s0 > rig.rampLen) sb = 0;
          if (d0 < 0.03 && d1 < 0.03 && Math.abs(ay) <= 0.5) {
            if (this.cellPlastic(b, i, d0, d1, sa, sb, SRC_PLATE)) this.cellForce(b, PIECE_RAMP, ax, ay, az, bx, by, bz, ncx, ncz, rig.nrx, rig.nrz, area, hyc, k, cfg.muBelt);
          }
        }
      }
      // çıtalar
      if (az < this.maxSupportZ + 0.002 || bz < this.maxSupportZ + 0.002) {
        const mx = 0.5 * (ax + bx), my = 0.5 * (ay + by), mz = Math.min(az, bz);
        const ey = Math.abs(R[3]) * hxc + Math.abs(R[4]) * hyc;
        const ex = Math.abs(R[0]) * hxc + Math.abs(R[1]) * hyc;
        rig.slat(mx, my, Math.max(mz, -0.019), par ? my - ey : mx - ex, par ? my + ey : mx + ex, h);
        if (h.d > 0 && h.nz > 0.5) {
          const s = rig.slats[h.id];
          const d0 = s.top - az, d1 = s.top - bz;
          let sa = 0, sb = 1;
          const dx = bx - ax;
          if (Math.abs(dx) > 1e-12) {
            const lo = (s.x0 - ax) / dx, hi = (s.x1 - ax) / dx;
            sa = Math.max(sa, Math.min(lo, hi));
            sb = Math.min(sb, Math.max(lo, hi));
          }
          if (par) {
            // y'de kısmi taşıma kesri h.frac
          } else h.frac = 1;
          if (this.cellPlastic(b, i, d0, d1, sa, sb, SRC_SLAT)) {
            const frac = h.frac;
            this.cellForce(b, 100 + h.id, ax, ay, az, bx, by, bz, ncx, ncz, 0, 1, area * frac, hyc, k, cfg.muWood);
          }
        }
      }
      // tarak: alma bandı (x < −3 mm, plaka üstü yüksekliğinde)
      if (rig.tarak && (az < rig.zBuf + 0.002 || bz < rig.zBuf + 0.002)) {
        const d0 = rig.zBuf - az, d1 = rig.zBuf - bz;
        let sa = 0, sb = 1;
        const dx = bx - ax;
        if (Math.abs(dx) > 1e-12) {
          const sh = (-0.003 - ax) / dx;
          if (dx > 0) sb = Math.min(sb, sh);
          else sa = Math.max(sa, sh);
        } else if (ax > -0.003) sb = 0;
        if (d0 < 0.02 && d1 < 0.02 && Math.abs(ay) <= 0.5 && this.cellPlastic(b, i, d0, d1, sa, sb, SRC_PLATE)) {
          this.cellForce(b, 60, ax, ay, az, bx, by, bz, ncx, ncz, 0, 1, area, hyc, k, cfg.muBelt);
        }
      }
    }
    // --- makaralar: silindir – alt yüz çizgi teması (analitik) ---
    for (const which of [PIECE_HINGE, PIECE_TIP] as const) {
      if (rig.tarak) break;
      if (which === PIECE_HINGE && cfg.nose !== 'egilir' && rig.beta < 1e-6) continue;
      const [cx, cz, Rr] = rig.rollerCenter(which);
      // yerel çerçevede eksen
      const dx = cx - b.px, dy = 0, dz = cz - b.pz;
      const clx = R[0] * dx + R[3] * dy + R[6] * dz;
      const cly = R[1] * dx + R[4] * dy + R[7] * dz;
      const clz = R[2] * dx + R[5] * dy + R[8] * dz;
      const alx = R[3], aly = R[4], alz = R[5];
      if (Math.abs(aly) < 0.5) continue;
      // temas normali (dünya) = tuğlanın yukarı ekseni
      let nx = R[2], nz = R[8];
      const nn = Math.hypot(nx, nz);
      nx /= nn;
      nz /= nn;
      if (!rig.onArc(which, nx, nz, 0.05)) continue;
      for (let j = 0; j < 4; j++) {
        const yj = geo.colY[j];
        const tt = (yj - cly) / aly;
        const Ax = clx + tt * alx, Az = clz + tt * alz;
        const gap = -hz - Az;
        const del = Rr - gap;
        if (del <= 0 || del > 0.01) continue;
        const bb = Math.sqrt(2 * Rr * del);
        const s0 = Math.max(-bb, -hx - Ax), s1 = Math.min(bb, hx - Ax);
        if (s1 <= s0) continue;
        const I = del * (s1 - s0) - (s1 ** 3 - s0 ** 3) / (6 * Rr);
        if (I <= 0) continue;
        const M = (del * (s1 * s1 - s0 * s0)) / 2 - (s1 ** 4 - s0 ** 4) / (8 * Rr);
        const sc = M / I;
        const lx = Ax + sc, ly = yj, lz = -hz;
        const px = b.px + R[0] * lx + R[1] * ly + R[2] * lz;
        const py = b.py + R[3] * lx + R[4] * ly + R[5] * lz;
        const pz = b.pz + R[6] * lx + R[7] * ly + R[8] * lz;
        if (py < -0.5 || py > 0.5) continue;
        h2.nx = R[2];
        h2.ny = R[5];
        h2.nz = R[8];
        h2.kappa = 1 / Rr;
        h2.frac = 1;
        rig.rollerBeltV(which, nx, nz, h2);
        const va = this.approach(b, px, py, pz, h2);
        const F = (k * I + this.cW * va * (s1 - s0)) * geo.colW;
        // en büyük basınç yüzün içindeki en derin noktada (eksen kenarın dışındaysa kırpılmış uçta)
        const sN = s0 > 0 ? s0 : s1 < 0 ? s1 : 0;
        const pN = k * (del - (sN * sN) / (2 * Rr));
        if (pN > b.m.faceP) b.m.faceP = pN;
        this.normal(b, which, cfg.muBelt, null, F, px, py, pz, h2);
        this.trackSupport(b, which, F, px, h2);
      }
    }
    // --- kenarlar ---
    const S = geo.seg;
    for (let si = 0; si < geo.nSeg; si++) {
      const o = si * SEG_STRIDE;
      const lx = S[o], ly = S[o + 1], lz = S[o + 2];
      // hızlı eleme: yerel z yukarıdaysa ve tuğla az eğikse alt özellik değil
      const pz = b.pz + R[6] * lx + R[7] * ly + R[8] * lz;
      if (pz > this.maxSupportZ + 0.002) continue;
      const px = b.px + R[0] * lx + R[1] * ly + R[2] * lz;
      const py = b.py + R[3] * lx + R[4] * ly + R[5] * lz;
      const ex = S[o + 3], ey = S[o + 4], ez = S[o + 5];
      const n1lx = S[o + 6], n1ly = S[o + 7], n1lz = S[o + 8];
      const n2lx = S[o + 9], n2ly = S[o + 10], n2lz = S[o + 11];
      const len = S[o + 12], axis = S[o + 13], bottomSide = S[o + 14];
      const n1x = R[0] * n1lx + R[1] * n1ly + R[2] * n1lz;
      const n1y = R[3] * n1lx + R[4] * n1ly + R[5] * n1lz;
      const n1z = R[6] * n1lx + R[7] * n1ly + R[8] * n1lz;
      const n2x = R[0] * n2lx + R[1] * n2ly + R[2] * n2lz;
      const n2y = R[3] * n2lx + R[4] * n2ly + R[5] * n2lz;
      const n2z = R[6] * n2lx + R[7] * n2ly + R[8] * n2lz;
      // plaka
      if (!rig.tarak && pz > rig.zu - 0.045) {
        rig.plate(px, py, pz, true, h);
        if (h.d > 0 && h.d < 0.02) {
          let sides = 3;
          if (h.kappa > 0) {
            if (axis === 0) sides = 0; // makaraya dik kenar: yüz integrali taşır
            else if (bottomSide === 2) sides = 1; // alt yüz bandını yüz integrali taşır
          }
          if (sides) this.edge(b, si, px, py, pz, n1x, n1y, n1z, n2x, n2y, n2z, len, h, k, sides, h.id, cfg.muBelt, null, SRC_PLATE);
        }
      }
      // çıtalar
      if (pz < this.maxSupportZ + 0.002) {
        const wex = R[0] * ex + R[1] * ey + R[2] * ez;
        const wey = R[3] * ex + R[4] * ey + R[5] * ez;
        const half = 0.5 * len;
        const e0 = par ? py - Math.abs(wey) * half : px - Math.abs(wex) * half;
        const e1 = par ? py + Math.abs(wey) * half : px + Math.abs(wex) * half;
        rig.slat(px, py, pz, e0, e1, h);
        if (h.d > 0) this.edge(b, si, px, py, pz, n1x, n1y, n1z, n2x, n2y, n2z, len, h, k, 3, 100 + h.id, cfg.muWood, null, SRC_SLAT);
      }
      // tarak: alma bandı
      if (rig.tarak && pz < rig.zBuf + 0.002) {
        rig.buffer(px, py, pz, h);
        if (h.d > 0) this.edge(b, si, px, py, pz, n1x, n1y, n1z, n2x, n2y, n2z, len, h, k, 3, 60, cfg.muBelt, null, SRC_PLATE);
      }
    }
  }

  // ---------- tarak tutucu: pedler (sabit basınç) ve dişler (rijit, pahlı) ----------
  private comb(b: Brick) {
    const { rig, cfg, geo, h2: h } = this;
    const R = b.R;
    const { hx, hy, hz } = geo;
    const ex = Math.abs(R[0]) * hx + Math.abs(R[1]) * hy + Math.abs(R[2]) * hz;
    const ey = Math.abs(R[3]) * hx + Math.abs(R[4]) * hy + Math.abs(R[5]) * hz;
    const ez = Math.abs(R[6]) * hx + Math.abs(R[7]) * hy + Math.abs(R[8]) * hz;
    const X = rig.combX, Zc = rig.combZ;
    const tx0 = rig.toothX0 + X, tx1 = rig.toothX1 + X;
    if (b.px + ex < tx0 || b.px - ex > tx1) return;
    if (b.pz + ez < Zc || b.pz - ez > Zc + TOOTH_H) return;
    const T = rig.teeth;
    // --- pedler: yastık basıncı × temas alanı, yüze dik; sürtünme yapışma–kayma ---
    if (rig.infl > 1e-4) {
      const px0 = rig.padX[b.row][0] + X, px1 = rig.padX[b.row][1] + X;
      const fx = Math.abs(R[0]) * hx + Math.abs(R[2]) * hz;
      const fz = Math.abs(R[6]) * hx + Math.abs(R[8]) * hz;
      const ox0 = Math.max(px0, b.px - fx), ox1 = Math.min(px1, b.px + fx);
      const oz0 = Math.max(Zc + PAD_Z0, b.pz - fz), oz1 = Math.min(Zc + PAD_Z1, b.pz + fz);
      if (ox1 > ox0 && oz1 > oz0) {
        const A = (ox1 - ox0) * (oz1 - oz0);
        const cx = 0.5 * (ox0 + ox1), cz = 0.5 * (oz0 + oz1);
        const F0 = cfg.padP * A * rig.infl;
        // yüzün y konumu (küçük sapmada yüz merkezi; sapmalı köşe teması dişlerde)
        const fy = Math.abs(R[4]) * hy;
        let iR = 0;
        while (iR < T.length && T[iR].y <= b.py) iR++;
        for (const side of [-1, 1]) {
          const tooth = side > 0 ? T[iR] : T[iR - 1];
          if (!tooth || !(side > 0 ? tooth.padNeg : tooth.padPos)) continue;
          const faceY = b.py + side * fy;
          const gap = side * (tooth.y - side * rig.ht - faceY);
          if (gap > cfg.padStroke || gap < -0.01) continue;
          h.nx = 0;
          h.ny = -side;
          h.nz = 0;
          h.kappa = 0;
          h.frac = 1;
          h.vx = rig.combVx;
          h.vy = 0;
          h.vz = rig.combVz;
          const va = this.approach(b, cx, faceY, cz, h);
          const F = F0 + 300 * (A / 0.0208) * va;
          this.normal(b, side > 0 ? 301 : 300, cfg.muPad, null, F, cx, faceY, cz, h);
          this.trackSupport(b, 300, F, cx, h);
          if (F0 > b.m.padN) b.m.padN = F0;
        }
      }
    }
    // --- dişler: rijit kesit (YZ), alt köşeleri 45° pahlı ---
    const S = geo.seg;
    const ht = rig.ht, ch = Math.min(cfg.toothChamfer, ht * 0.9);
    for (let i = 0; i < T.length; i++) {
      const ty = T[i].y;
      if (Math.abs(ty - b.py) > ey + ht + 0.002) continue;
      h.vx = rig.combVx;
      h.vy = 0;
      h.vz = rig.combVz;
      h.kappa = 0;
      h.frac = 1;
      h.id = i;
      // kenar parçaları (yumuşak köşe)
      for (let si = 0; si < geo.nSeg; si++) {
        const o = si * SEG_STRIDE;
        const lx = S[o], ly = S[o + 1], lz = S[o + 2];
        const px = b.px + R[0] * lx + R[1] * ly + R[2] * lz;
        if (px < tx0 || px > tx1) continue;
        const py = b.py + R[3] * lx + R[4] * ly + R[5] * lz;
        const u = py - ty;
        if (u < -ht || u > ht) continue;
        const pz = b.pz + R[6] * lx + R[7] * ly + R[8] * lz;
        if (!toothHit(u, pz - Zc, ht, ch)) continue;
        h.d = _td;
        h.nx = 0;
        h.ny = _tu;
        h.nz = _tw;
        const n1lx = S[o + 6], n1ly = S[o + 7], n1lz = S[o + 8];
        const n2lx = S[o + 9], n2ly = S[o + 10], n2lz = S[o + 11];
        this.edge(
          b, si, px, py, pz,
          R[0] * n1lx + R[1] * n1ly + R[2] * n1lz, R[3] * n1lx + R[4] * n1ly + R[5] * n1lz, R[6] * n1lx + R[7] * n1ly + R[8] * n1lz,
          R[0] * n2lx + R[1] * n2ly + R[2] * n2lz, R[3] * n2lx + R[4] * n2ly + R[5] * n2lz, R[6] * n2lx + R[7] * n2ly + R[8] * n2lz,
          S[o + 12], h, cfg.kW, 3, 400 + i, 0.4, null, SRC_PLATE,
        );
      }
      // üst yüz noktaları (diş tuğlanın üstüne basarsa)
      for (let a = 0; a < TOP_PTS.length; a += 2) {
        const lx = TOP_PTS[a] * hx, ly = TOP_PTS[a + 1] * hy, lz = hz;
        const px = b.px + R[0] * lx + R[1] * ly + R[2] * lz;
        if (px < tx0 || px > tx1) continue;
        const py = b.py + R[3] * lx + R[4] * ly + R[5] * lz;
        const pz = b.pz + R[6] * lx + R[7] * ly + R[8] * lz;
        if (!toothHit(py - ty, pz - Zc, ht, ch)) continue;
        h.d = _td;
        h.nx = 0;
        h.ny = _tu;
        h.nz = _tw;
        const Ai = (cfg.L * cfg.W) / (TOP_PTS.length / 2);
        const va = this.approach(b, px, py, pz, h);
        const F = (cfg.kW * _td + this.cW * va) * Ai;
        this.normal(b, 400 + i, 0.4, null, F, px, py, pz, h);
        this.trackSupport(b, 400 + i, F, px, h);
      }
    }
  }

  /** Uyuyan tuğla tarak dişinin yoluna girdiyse uyandır */
  private combTouches(b: Brick): boolean {
    const rig = this.rig;
    const X = rig.combX, Zc = rig.combZ;
    const ex = Math.abs(b.R[0]) * this.geo.hx + Math.abs(b.R[1]) * this.geo.hy + Math.abs(b.R[2]) * this.geo.hz;
    const ey = Math.abs(b.R[3]) * this.geo.hx + Math.abs(b.R[4]) * this.geo.hy + Math.abs(b.R[5]) * this.geo.hz;
    if (b.px + ex < rig.toothX0 + X || b.px - ex > rig.toothX1 + X) return false;
    if (b.pz + this.geo.hz < Zc || b.pz - this.geo.hz > Zc + TOOTH_H) return false;
    for (const t of rig.teeth) if (Math.abs(t.y - b.py) < ey + rig.ht) return true;
    return false;
  }

  /** Hücrenin kalıcı izi: ortalama elastik batma akma sınırını aşarsa iz derinleşir. Temas varsa true. */
  private cellPlastic(b: Brick, ci: number, d0: number, d1: number, sa: number, sb: number, src: number): boolean {
    let q = b.qc[ci];
    linInt(d0 - q, d1 - q, sa, sb);
    _Lf = 1;
    if (_Ls <= 0) {
      b.emc[ci] = 0;
      return false;
    }
    const dY = this.cfg.pY / this.cfg.kW;
    let mean = _Ls / _Lw;
    let em = b.emc[ci];
    if (mean > dY) {
      q += mean - dY;
      b.qc[ci] = q;
      if (q > b.m.faceDent[src]) b.m.faceDent[src] = q;
      linInt(d0 - q, d1 - q, sa, sb);
      if (_Ls <= 0) return false;
      mean = _Ls / _Lw;
      em = mean;
    }
    if (mean >= em) {
      b.emc[ci] = mean;
      return true;
    }
    // boşaltma: sert doğru boyunca, sıfıra inince kalan batma kalıcı iz
    const eu = em * (1 - 1 / this.cfg.kUnload);
    if (mean <= eu) {
      b.qc[ci] = q + mean;
      b.emc[ci] = 0;
      if (q + mean > b.m.faceDent[src]) b.m.faceDent[src] = q + mean;
      return false;
    }
    // kuvvet, yükleme eğrisinin em'deki değerinden doğrusal azalır
    _Lf = ((em / mean) * (mean - eu)) / (em - eu);
    return true;
  }

  private cellForce(
    b: Brick, key: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    ncx: number, ncz: number, snx: number, snz: number, area: number, hyc: number, k: number, mu: number,
  ) {
    void hyc;
    const h = this.h2;
    const proj = -(ncx * snx + ncz * snz);
    if (proj <= 0) return;
    const s = _Lc;
    const px = ax + (bx - ax) * s, py = ay + (by - ay) * s, pz = az + (bz - az) * s;
    h.nx = snx;
    h.ny = 0;
    h.nz = snz;
    h.kappa = 0;
    h.frac = 1;
    if (key < 100) {
      // bant hızı
      let rvx = this.rig.vp, rvz = 0, tx = 1, tz = 0;
      if (key === PIECE_RAMP) {
        rvx += this.rig.betaDot * (pz - this.rig.chz);
        rvz -= this.rig.betaDot * (px - this.rig.chx);
        tx = this.rig.trx;
        tz = this.rig.trz;
      }
      h.vx = rvx + this.rig.u * tx;
      h.vy = 0;
      h.vz = rvz + this.rig.u * tz;
    } else {
      h.vx = h.vy = h.vz = 0;
    }
    const va = this.approach(b, px, py, pz, h);
    const A = area * proj;
    const F = (k * _Ls * _Lf + this.cW * va * _Lw) * A;
    if (k * _Lm > b.m.faceP && _Lm < 0.01) b.m.faceP = k * _Lm;
    this.normal(b, key, mu, null, F, px, py, pz, h);
    this.trackSupport(b, key, F, px, h);
  }

  // ---------- tuğla – tuğla ----------
  private pair(a: Brick, b: Brick) {
    // a'nın kenarları b'nin kutusuna
    const { geo, cfg, h } = this;
    const { hx, hy, hz } = geo;
    const Ra = a.R, Rb = b.R;
    const S = geo.seg;
    const kEff = cfg.kW / 2;
    for (let si = 0; si < geo.nSeg; si++) {
      const o = si * SEG_STRIDE;
      const lx = S[o], ly = S[o + 1], lz = S[o + 2];
      const px = a.px + Ra[0] * lx + Ra[1] * ly + Ra[2] * lz;
      const py = a.py + Ra[3] * lx + Ra[4] * ly + Ra[5] * lz;
      const pz = a.pz + Ra[6] * lx + Ra[7] * ly + Ra[8] * lz;
      const dx = px - b.px, dy = py - b.py, dz = pz - b.pz;
      const bx = Rb[0] * dx + Rb[3] * dy + Rb[6] * dz;
      const dxx = hx - Math.abs(bx);
      if (dxx <= 0) continue;
      const by = Rb[1] * dx + Rb[4] * dy + Rb[7] * dz;
      const dyy = hy - Math.abs(by);
      if (dyy <= 0) continue;
      const bz = Rb[2] * dx + Rb[5] * dy + Rb[8] * dz;
      const dzz = hz - Math.abs(bz);
      if (dzz <= 0) continue;
      const n1lx = S[o + 6], n1ly = S[o + 7], n1lz = S[o + 8];
      const n2lx = S[o + 9], n2ly = S[o + 10], n2lz = S[o + 11];
      const n1x = Ra[0] * n1lx + Ra[1] * n1ly + Ra[2] * n1lz;
      const n1y = Ra[3] * n1lx + Ra[4] * n1ly + Ra[5] * n1lz;
      const n1z = Ra[6] * n1lx + Ra[7] * n1ly + Ra[8] * n1lz;
      const n2x = Ra[0] * n2lx + Ra[1] * n2ly + Ra[2] * n2lz;
      const n2y = Ra[3] * n2lx + Ra[4] * n2ly + Ra[5] * n2lz;
      const n2z = Ra[6] * n2lx + Ra[7] * n2ly + Ra[8] * n2lz;
      // Kenar yalnızca baktığı yöndeki yüzlere batabilir: kenarın dış yönü (n1 + n2) o yüzün normaline karşı olmalı.
      // (Yan yana duran iki tuğlanın alt / üst yüzleri aynı hizada; en az batma kuralı tek başına yanlış yüzü seçer.)
      const qx = n1x + n2x, qy = n1y + n2y, qz = n1z + n2z;
      const cx = Rb[0] * qx + Rb[3] * qy + Rb[6] * qz;
      const cy = Rb[1] * qx + Rb[4] * qy + Rb[7] * qz;
      const cz = Rb[2] * qx + Rb[5] * qy + Rb[8] * qz;
      let d = Infinity, ax = -1, sg = 1;
      const pen = [hx - bx, hx + bx, hy - by, hy + by, hz - bz, hz + bz];
      for (let f = 0; f < 6; f++) {
        // yüzün dış normali s·e_k (B yerel); kenarın dış yönü c ona karşı olmalı: c · n < 0
        const s = f % 2 === 0 ? 1 : -1, k = f >> 1;
        const cdotn = s * (k === 0 ? cx : k === 1 ? cy : cz);
        if (cdotn > -0.05) continue;
        if (pen[f] < d) {
          d = pen[f];
          ax = k;
          sg = s;
        }
      }
      if (ax < 0 || d > 0.015) continue;
      h.d = d;
      h.nx = sg * Rb[ax];
      h.ny = sg * Rb[3 + ax];
      h.nz = sg * Rb[6 + ax];
      h.kappa = 0;
      h.frac = 1;
      h.id = b.id;
      const sx = px + h.nx * d - b.px, sy = py + h.ny * d - b.py, sz = pz + h.nz * d - b.pz;
      h.vx = b.vx + b.wy * sz - b.wz * sy;
      h.vy = b.vy + b.wz * sx - b.wx * sz;
      h.vz = b.vz + b.wx * sy - b.wy * sx;
      const before = a.nBrick;
      this.edge(a, si, px, py, pz, n1x, n1y, n1z, n2x, n2y, n2z, S[o + 12], h, kEff, 3, 200 + b.id, cfg.muClay, b, SRC_BRICK);
      const df = a.nBrick - before;
      if (df > 0) {
        b.nBrick += df;
        a.m.touched.add(b.id);
        b.m.touched.add(a.id);
        if (b.state !== 'awake' && df > 0.05) b.wakeReq = true;
        if (a.state !== 'awake' && df > 0.05) a.wakeReq = true;
      }
    }
  }

  // ---------- sürtünme ----------
  private friction(b: Brick) {
    const dt = this.cfg.dt;
    for (const [key, g] of b.groups) {
      if (g.N <= 0) {
        g.zx = g.zy = g.zz = 0;
        g.tw = 0;
        g.slipping = false;
        if (key >= 200) b.groups.delete(key);
        continue;
      }
      const N = g.N;
      const px = g.px / N, py = g.py / N, pz = g.pz / N;
      let nx = g.nx, ny = g.ny, nz = g.nz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const svx = g.vx / N, svy = g.vy / N, svz = g.vz / N;
      const rx = px - b.px, ry = py - b.py, rz = pz - b.pz;
      let vx = b.vx + b.wy * rz - b.wz * ry - svx;
      let vy = b.vy + b.wz * rx - b.wx * rz - svy;
      let vz = b.vz + b.wx * ry - b.wy * rx - svz;
      const o = g.other;
      if (o) {
        // komşu tuğlanın o noktadaki hızı zaten svx..'de (destek hızı)
      }
      const vn = vx * nx + vy * ny + vz * nz;
      vx -= vn * nx;
      vy -= vn * ny;
      vz -= vn * nz;
      const zn = g.zx * nx + g.zy * ny + g.zz * nz;
      g.zx += vx * dt - zn * nx;
      g.zy += vy * dt - zn * ny;
      g.zz += vz * dt - zn * nz;
      const kt = N / 3e-4;
      const ct = Math.sqrt(kt * this.cfg.mass);
      let fx = -kt * g.zx - ct * vx, fy = -kt * g.zy - ct * vy, fz = -kt * g.zz - ct * vz;
      const fm = Math.hypot(fx, fy, fz), lim = g.mu * N;
      g.slipping = fm > lim;
      if (g.slipping) {
        const s = lim / fm;
        fx *= s;
        fy *= s;
        fz *= s;
        g.zx = -fx / kt;
        g.zy = -fy / kt;
        g.zz = -fz / kt;
        const vs = Math.hypot(vx, vy, vz) * dt;
        if (key < 100) b.m.slipBelt += vs;
        else if (key < 200) b.m.slipSlat += vs;
        // ped kayması yalnızca taşırken (söndürürken tuğlanın çıtaya inmesi kayma sayılmaz)
        else if (key >= 300 && key < 400 && (!this.rig.ctl || this.t < this.rig.ctl.deflStart)) b.m.slipPad += vs;
      }
      this.applyForce(b, fx, fy, fz, px, py, pz);
      if (o) this.applyForce(o, -fx, -fy, -fz, px, py, pz);
      // Ped: geniş temas yüzeyi dönmeye de direnir (burulma sürtünmesi, sınır μ·N·r, r ≈ √A / 3)
      if (key >= 300 && key < 400) {
        const wn = b.wx * nx + b.wy * ny + b.wz * nz;
        g.tw += wn * dt;
        const r = PAD_R_EFF;
        const kr = kt * r * r;
        const cr = Math.sqrt(kr * this.I[1]);
        let tq = -kr * g.tw - cr * wn;
        const tlim = g.mu * N * r;
        if (Math.abs(tq) > tlim) {
          tq = Math.sign(tq) * tlim;
          g.tw = -tq / kr;
        }
        b.tx += tq * nx;
        b.ty += tq * ny;
        b.tz += tq * nz;
      }
      g.N = 0;
      g.px = g.py = g.pz = 0;
      g.vx = g.vy = g.vz = 0;
      g.nx = g.ny = g.nz = 0;
    }
  }

  // ---------- tümleştirme ----------
  private integrate(b: Brick) {
    const dt = this.cfg.dt, m = this.cfg.mass, R = b.R;
    b.vx += (b.fx / m) * dt;
    b.vy += (b.fy / m) * dt;
    b.vz += (b.fz / m) * dt;
    // açısal: gövde çerçevesinde
    const wbx = R[0] * b.wx + R[3] * b.wy + R[6] * b.wz;
    const wby = R[1] * b.wx + R[4] * b.wy + R[7] * b.wz;
    const wbz = R[2] * b.wx + R[5] * b.wy + R[8] * b.wz;
    const tbx = R[0] * b.tx + R[3] * b.ty + R[6] * b.tz;
    const tby = R[1] * b.tx + R[4] * b.ty + R[7] * b.tz;
    const tbz = R[2] * b.tx + R[5] * b.ty + R[8] * b.tz;
    const [Ix, Iy, Iz] = this.I;
    const Lx = Ix * wbx, Ly = Iy * wby, Lz = Iz * wbz;
    const gx = wby * Lz - wbz * Ly, gy = wbz * Lx - wbx * Lz, gz = wbx * Ly - wby * Lx;
    const nwx = wbx + ((tbx - gx) / Ix) * dt;
    const nwy = wby + ((tby - gy) / Iy) * dt;
    const nwz = wbz + ((tbz - gz) / Iz) * dt;
    b.wx = R[0] * nwx + R[1] * nwy + R[2] * nwz;
    b.wy = R[3] * nwx + R[4] * nwy + R[5] * nwz;
    b.wz = R[6] * nwx + R[7] * nwy + R[8] * nwz;
    b.px += b.vx * dt;
    b.py += b.vy * dt;
    b.pz += b.vz * dt;
    const { wx, wy, wz } = b;
    const h = 0.5 * dt;
    const qw = b.qw - h * (wx * b.qx + wy * b.qy + wz * b.qz);
    const qx = b.qx + h * (wx * b.qw + wy * b.qz - wz * b.qy);
    const qy = b.qy + h * (wy * b.qw + wz * b.qx - wx * b.qz);
    const qz = b.qz + h * (wz * b.qw + wx * b.qy - wy * b.qx);
    const n = Math.hypot(qw, qx, qy, qz);
    b.qw = qw / n;
    b.qx = qx / n;
    b.qy = qy / n;
    b.qz = qz / n;
    b.updateR();
  }

  /** Bir adım ilerle. */
  step() {
    const cfg = this.cfg, dt = cfg.dt, rig = this.rig;
    this.t += dt;
    this.steps++;
    this.collectLoads();
    rig.update(this.t);
    // uyandırma
    for (const b of this.bricks) {
      if (b.state === 'plate') {
        b.px += rig.flatBeltV * dt;
        this.placeOnPlate(b);
        if (this.inNoseZone(b) || b.wakeReq) this.wake(b, rig.flatBeltV);
      } else if (b.state === 'slat' && b.wakeReq) this.wake(b, 0);
      b.wakeReq = false;
    }
    let awake = 0;
    for (const b of this.bricks) {
      b.fx = b.fy = 0;
      b.fz = -cfg.mass * GRAV;
      b.tx = b.ty = b.tz = 0;
      b.nPlate = b.nSlat = b.nBrick = 0;
      b.nPad = b.nTooth = 0;
      b.plateFzX = 0;
      if (b.state === 'awake') {
        awake++;
        this.supports(b);
        if (rig.tarak) this.comb(b);
      } else if (rig.tarak && b.state === 'slat' && this.combTouches(b)) {
        this.wake(b, 0);
        awake++;
        this.supports(b);
        this.comb(b);
      }
    }
    if (rig.tarak && rig.ctl) {
      const c = rig.ctl;
      for (const b of this.bricks) {
        if (b.nTooth <= 0) continue;
        if (this.t < c.carryStart) b.m.toothPick = Math.max(b.m.toothPick, b.nTooth);
        else if (this.t < c.deflStart) b.m.toothCarry = Math.max(b.m.toothCarry, b.nTooth);
        else b.m.toothOut = Math.max(b.m.toothOut, b.nTooth);
      }
    }
    this.awakeCount = awake;
    // tuğla çiftleri (en az biri uyanık, kutular yakın)
    const n = this.bricks.length;
    for (let i = 0; i < n; i++) {
      const a = this.bricks[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.bricks[j];
        if (a.state !== 'awake' && b.state !== 'awake') continue;
        const lim = 0.21;
        if (Math.abs(a.px - b.px) > lim || Math.abs(a.py - b.py) > 0.17 || Math.abs(a.pz - b.pz) > 0.21) continue;
        if (!this.aabbNear(a, b)) continue;
        this.pair(a, b);
        this.pair(b, a);
      }
    }
    for (const b of this.bricks) {
      if (b.state !== 'awake') {
        b.groups.clear();
        continue;
      }
      if (b.nPlate > 0) b.plateFzX /= b.nPlate;
      if (b.nBrick > b.m.brickF) b.m.brickF = b.nBrick;
      this.friction(b);
      this.integrate(b);
      b.awakeT += dt;
      const p = b.pitch, r = Math.abs(b.roll);
      if (p > b.m.maxPitch) b.m.maxPitch = p;
      if (r > b.m.maxRoll) b.m.maxRoll = r;
      this.sleepCheck(b);
    }
    this.beltSlat();
  }

  private aabbNear(a: Brick, b: Brick): boolean {
    const { hx, hy, hz } = this.geo, m = 0.003;
    for (let k = 0; k < 3; k++) {
      const ea = Math.abs(a.R[3 * k]) * hx + Math.abs(a.R[3 * k + 1]) * hy + Math.abs(a.R[3 * k + 2]) * hz;
      const eb = Math.abs(b.R[3 * k]) * hx + Math.abs(b.R[3 * k + 1]) * hy + Math.abs(b.R[3 * k + 2]) * hz;
      const pa = k === 0 ? a.px : k === 1 ? a.py : a.pz;
      const pb = k === 0 ? b.px : k === 1 ? b.py : b.pz;
      if (Math.abs(pa - pb) > ea + eb + m) return false;
    }
    return true;
  }

  private wake(b: Brick, vx: number) {
    b.state = 'awake';
    b.vx = vx;
    b.vy = b.vz = 0;
    b.wx = b.wy = b.wz = 0;
    b.quiet = 0;
    b.awakeT = 0;
  }

  private sleepCheck(b: Brick) {
    if (b.awakeT < 0.1 || this.inNoseZone(b)) {
      b.quiet = 0;
      return;
    }
    const v = Math.hypot(b.vx, b.vy, b.vz), w = Math.hypot(b.wx, b.wy, b.wz);
    const onSlat = b.nSlat > 0 && b.nPlate <= 0 && b.nPad <= 0 && b.nTooth <= 0;
    if (onSlat && v < 0.002 && w < 0.02) b.quiet += this.cfg.dt;
    else b.quiet = 0;
    if (b.quiet > 0.15) {
      b.state = 'slat';
      b.vx = b.vy = b.vz = 0;
      b.wx = b.wy = b.wz = 0;
      b.groups.clear();
    }
  }

  private beltSlat() {
    const rig = this.rig;
    const g = rig.bottomGap();
    if (!Number.isFinite(g.gap)) return;
    if (g.gap < this.belt.minGap) {
      this.belt.minGap = g.gap;
      this.belt.tMinGap = this.t;
    }
    if (g.gap < 0) {
      const N = -g.gap * rig.stiffnessAt(g.x);
      const slip = Math.abs(rig.vp - rig.u);
      const fr = slip > 1e-4 ? this.cfg.muBeltWood * N : 0;
      if (N > this.belt.maxN) this.belt.maxN = N;
      if (fr > this.belt.maxFric) {
        this.belt.maxFric = fr;
        this.belt.slipV = slip;
      }
    }
  }
}
