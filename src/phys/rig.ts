// Yükleme düzeneği: plaka + eğilir burun + bant + aktif kattaki çıtalar. Fizik motoru buradan destek yüzeyini ve
// yüzeyin (bandın) hızını sorar. SI birimleri.
//
// Koordinat (ranza yerel): x ranza ön yüzünden içe (plaka +x'e girer, 0..0,9 m), y ranza ortasından (−0,6..0,6),
// z aktif katın çıta üstünden (çıta sapması 0 iken). Plaka üstü (bant yüzeyi) z = boşluk + plaka kalınlığı.
//
// Plakanın yan kesiti (xz) dışbükey: düz üst → menteşe makarası yayı → rampa (iki makaraya teğet) → uç makarası yayı.
// Bant bu yolu izler: üstte plakaya göre +x'e u hızıyla gider, uçta makaranın etrafından döner, altta −x'e gider.
// Geri çekilirken u = plaka hızı: üst bant zemine göre durur, alt bant zemine göre 2× hızla geri gider.
// Burun menteşe makarasının ekseni etrafında döner (bant boyu değişmez); servo + metal plakalı kol indirir.

import type { PhysConfig } from './config';
import { planLayout, tableColumnY } from '../sim/geometry';
import { DEFAULT_PARAMS } from '../sim/params';
import { RANZA } from '../sim/dims';

export const PIECE_FLAT = 0;
export const PIECE_HINGE = 1;
export const PIECE_RAMP = 2;
export const PIECE_TIP = 3;

/** Destek sorgusunun sonucu (tahsis yapmamak için tek nesne yeniden kullanılır) */
export interface Hit {
  /** Batma (m, > 0 ise temas) */
  d: number;
  /** Destek yüzey normali (dışa) */
  nx: number;
  ny: number;
  nz: number;
  /** Yüzeyin (bant / çıta) o noktadaki hızı */
  vx: number;
  vy: number;
  vz: number;
  /** Yüzey eğriliği (1/m), düzlemde 0 */
  kappa: number;
  /** Parça: plaka parçası 0..3 ya da çıta numarası */
  id: number;
  /** Özelliğin desteğe binen kesri (çıta kenarında kısmi) */
  frac: number;
}
export const newHit = (): Hit => ({ d: 0, nx: 0, ny: 0, nz: 1, vx: 0, vy: 0, vz: 0, kappa: 0, id: -1, frac: 1 });

/** Çıta yüksekliği sapma deseni (sabit, tekrarlanabilir). */
const DEV_PATTERN = [0.3, -0.8, 1, -0.2, 0.6, -1, 0.1, 0.9, -0.5, 0.4, -0.7, 0.8, -0.3, 0.5];

export interface Slat {
  /** Ranza yerel aralık (m) */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  top: number;
}

export const RACK_D = RANZA.derinlikX / 100;
export const RACK_B = RANZA.boyY / 100;
const SLAT_T = RANZA.citaKalinlik / 100;
const PLATE_HALF_W = 0.5;

export function buildSlats(cfg: PhysConfig): Slat[] {
  const out: Slat[] = [];
  const t = RANZA.sac / 100;
  if (cfg.slat === 'paralel') {
    const n = RANZA.paralel.adet, w = RANZA.paralel.en / 100;
    const pitch = (RACK_B - 0.02 - w) / (n - 1);
    for (let k = 0; k < n; k++) {
      const y0 = -RACK_B / 2 + 0.01 + k * pitch;
      out.push({ x0: t, x1: RACK_D - t, y0, y1: y0 + w, top: cfg.slatDev * DEV_PATTERN[k % DEV_PATTERN.length] });
    }
  } else {
    const n = RANZA.dik.adet, w = RANZA.dik.en / 100;
    const pitch = (RACK_D - 0.02 - w) / (n - 1);
    for (let k = 0; k < n; k++) {
      const x0 = 0.01 + k * pitch;
      out.push({ x0, x1: x0 + w, y0: -RACK_B / 2 + t, y1: RACK_B / 2 - t, top: cfg.slatDev * DEV_PATTERN[k % DEV_PATTERN.length] });
    }
  }
  return out;
}

/**
 * Katın 24 tuğlası: sıraların arka kenarı (x) ve sütun ortaları (y), ranza yerel, m. 3D sahneyle aynı hesap.
 * Ön sıra her zaman plaka ucunun 2 cm gerisinde (katı tampondan plakaya alış); `rowGap` sıra aralığı (m, hatta 2 cm).
 */
export function layerLayout(rowGap = 0.02): { rowsX0: number[]; colsY: number[] } {
  const lay = planLayout(DEFAULT_PARAMS);
  const shift = lay.PL0 + lay.PLEN - 2 - lay.ZEND + lay.DX - lay.RK0;
  const front = (lay.rowBack(0) + shift) / 100;
  const pitch = lay.L / 100 + rowGap;
  const rowsX0 = [3, 2, 1, 0].map((k) => front - k * pitch);
  const c = lay.sideCenterY(0);
  const colsY = tableColumnY(lay, 0).map((y) => (y - c) / 100);
  return { rowsX0, colsY };
}

/** Yumuşak başlayıp biten 0→1 geçiş */
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));
const easeD = (x: number) => (x <= 0 || x >= 1 ? 0 : 0.5 * Math.PI * Math.sin(Math.PI * x));

export interface Timeline {
  noseStart: number;
  retractStart: number;
  retractEnd: number;
  end: number;
  /** Arayüz için evreler: [başlangıç, ad] */
  phases: [number, string][];
}

/** Tarak tutucunun dişi: y ekseni, hangi yanlarında ped var */
export interface Tooth {
  y: number;
  /** −y yanında (soldaki tuğlaya bakan) ped */
  padNeg: boolean;
  /** +y yanında ped */
  padPos: boolean;
}

/** Tarak tutucu zaman çizelgesi (s) */
export interface CombTimeline {
  descStart: number;
  descEnd: number;
  inflEnd: number;
  liftEnd: number;
  carryStart: number;
  carryEnd: number;
  lowerFastEnd: number;
  lowerEnd: number;
  deflStart: number;
  deflEnd: number;
  outStart: number;
  outEnd: number;
}

/** Diş yüksekliği (m) ve tuğla altına göre diş alt ucu */
export const TOOTH_H = 0.15;
export const TOOTH_BOTTOM = 0.03;
/** Pedin diş alt ucuna göre z aralığı ve tuğla ucundan payı (m) */
export const PAD_Z0 = 0.005;
export const PAD_Z1 = 0.135;
export const PAD_X_INSET = 0.015;
/** Sütun hizasızlık deseni (colErr ile çarpılır) */
const COL_ERR_PATTERN = [0.6, -1, 0.3, 0.9, -0.5, -0.8];

export class Rig {
  readonly cfg: PhysConfig;
  readonly slats: Slat[];
  readonly zu: number;
  readonly Rh: number;
  readonly Rt: number;
  readonly betaMax: number;
  readonly tipStart: number;
  readonly tl: Timeline;
  private readonly tAcc: number;
  private readonly dAcc: number;
  private readonly vTop: number;
  private readonly tCruise: number;
  private slatPitch = 0;
  private slatFirst = 0;

  // ---- anlık durum ----
  t = 0;
  /** Düz burnun uç x'i (plaka önü) */
  xTip = 0;
  /** Plaka hızı (geri çekilirken < 0) */
  vp = 0;
  /** Bandın plakaya göre hızı (üstte +x) */
  u = 0;
  /** Bant konumu (doku kaydırma için) */
  beltPos = 0;
  /** Burun inme oranı 0..1 ve açısı (sehim eğimi dahil) */
  noseK = 0;
  beta = 0;
  betaDot = 0;
  /** Menteşe ve uç makarası merkezleri (xz) */
  chx = 0;
  chz = 0;
  ctx = 0;
  ctz = 0;
  /** Rampa normali, teğeti ve teğet noktaları */
  nrx = 0;
  nrz = 1;
  trx = 1;
  trz = 0;
  thx = 0;
  thz = 0;
  rampLen = 0;
  /** Plaka sehimi: kökten itibaren w(x) tablosu */
  private EI = 1;
  private readonly sagN = 48;
  private readonly sag = new Float64Array(48);
  private sagX0 = 0;
  private sagDx = 0;
  /** Plakadaki yükler (x, Fz) — dünya her adımda doldurur */
  loadX: number[] = [];
  loadF: number[] = [];

  // ---- tarak tutucu (loader = 'tarak') ----
  readonly tarak: boolean;
  /** Alma bandının (tamponun) üstü, çıta üstüne göre (m) */
  readonly zBuf: number;
  ctl: CombTimeline | null = null;
  teeth: Tooth[] = [];
  /** Sönük dişin yarı kalınlığı */
  ht = 0.01;
  /** Diş boyu (tarak çerçevesinde x aralığı) */
  toothX0 = 0;
  toothX1 = 0;
  /** Sıra başına ped x aralığı (tarak çerçevesinde) */
  padX: [number, number][] = [];
  /** Sütun ortaları (y), hizasızlık dahil (başlangıç) */
  colsY: number[] = [];
  rowsX0: number[] = [];
  /** Tarağın anlık x kayması (ranzada 0, alırken −strok), diş alt ucu z'si, hızları, şişme oranı */
  combX = 0;
  combZ = 0;
  combVx = 0;
  combVz = 0;
  infl = 0;

  constructor(cfg: PhysConfig) {
    this.cfg = cfg;
    this.slats = buildSlats(cfg);
    if (cfg.slat === 'paralel' && this.slats.length > 1) {
      this.slatPitch = this.slats[1].y0 - this.slats[0].y0;
      this.slatFirst = this.slats[0].y0;
    } else if (this.slats.length > 1) {
      this.slatPitch = this.slats[1].x0 - this.slats[0].x0;
      this.slatFirst = this.slats[0].x0;
    }
    this.zu = cfg.clearance + cfg.plateThk;
    this.Rh = cfg.hingeRollerDia / 2 + cfg.beltThk;
    this.Rt = cfg.tipRollerDia / 2 + cfg.beltThk;
    this.tipStart = cfg.plateLen;
    // İnmiş burunda uç makarasının altı (bant dahil) çıtaların `clearance` üstünde
    const a = cfg.noseLen - this.Rt, b = this.Rh - this.Rt;
    const target = cfg.clearance + this.Rt - (this.zu - this.Rh);
    const R0 = Math.hypot(a, b), phi0 = Math.atan2(b, a);
    this.betaMax = cfg.nose === 'egilir' ? Math.max(0, phi0 - Math.asin(Math.max(-1, Math.min(1, target / R0)))) : 0;
    // zaman çizelgesi
    const noseStart = 0.05;
    const retractStart = noseStart + cfg.noseT + 0.05;
    const v = cfg.vPlate, acc = cfg.aPlate, D = cfg.stroke;
    let tAcc = v / acc, dAcc = (v * v) / (2 * acc), vTop = v;
    if (2 * dAcc > D) {
      dAcc = D / 2;
      tAcc = Math.sqrt(D / acc);
      vTop = acc * tAcc;
    }
    this.tAcc = tAcc;
    this.dAcc = dAcc;
    this.vTop = vTop;
    this.tCruise = (D - 2 * dAcc) / vTop;
    const retractEnd = retractStart + 2 * tAcc + this.tCruise;
    this.tl = {
      noseStart, retractStart, retractEnd, end: retractEnd + 0.5,
      phases: [
        [0, 'plaka ranzada, duruyor'],
        [noseStart, cfg.nose === 'egilir' ? 'burun iniyor (servo + kol)' : 'bekliyor'],
        [retractStart, 'plaka geri çekiliyor, bant sarıyor'],
        [retractEnd, 'tuğlalar çıtada'],
      ],
    };
    this.tarak = cfg.loader === 'tarak';
    this.zBuf = this.zu;
    if (this.tarak) this.setupComb();
    this.update(0);
  }

  /** Trapez hız profili: t0'dan başlayan strok yolu ve hızı */
  private trap(t: number, t0: number): [number, number] {
    const acc = this.cfg.aPlate, tA = this.tAcc, tC = this.tCruise, vT = this.vTop;
    const s = t - t0;
    if (s <= 0) return [0, 0];
    if (s < tA) return [0.5 * acc * s * s, acc * s];
    if (s < tA + tC) return [this.dAcc + vT * (s - tA), vT];
    const r = s - tA - tC;
    if (r < tA) return [this.dAcc + vT * tC + vT * r - 0.5 * acc * r * r, vT - acc * r];
    return [this.cfg.stroke, 0];
  }

  /**
   * Tarak tutucu: arkada ranzanın dışında kalan kiriş, sütun aralıklarında 7 diş (5 çift yanlı, 2 dış tek yanlı).
   * Tamponda yukarıdan iner, yastıkları şişirir, 5 mm kaldırır, ranzaya girer, tuğlaları çıtaya indirir (son 1 cm
   * yavaş), vakumla söndürür, aynı aralıklardan yatay geri çekilir.
   */
  private setupComb() {
    const cfg = this.cfg;
    this.away = true;
    const { rowsX0, colsY } = layerLayout(cfg.rowGap);
    this.rowsX0 = rowsX0;
    this.colsY = colsY.map((y, i) => y + cfg.colErr * COL_ERR_PATTERN[i % COL_ERR_PATTERN.length]);
    this.ht = cfg.toothT / 2;
    const hw = cfg.W / 2, hg = 0.015;
    const ys = [colsY[0] - hw - hg];
    for (let i = 0; i + 1 < colsY.length; i++) ys.push((colsY[i] + colsY[i + 1]) / 2);
    ys.push(colsY[colsY.length - 1] + hw + hg);
    this.teeth = ys.map((y, i) => ({ y, padNeg: i > 0, padPos: i < ys.length - 1 }));
    this.toothX0 = rowsX0[0] - 0.03;
    this.toothX1 = rowsX0[rowsX0.length - 1] + cfg.L + 0.01;
    this.padX = rowsX0.map((x0) => [x0 + PAD_X_INSET, x0 + cfg.L - PAD_X_INSET] as [number, number]);
    // zaman çizelgesi
    const T = 2 * this.tAcc + this.tCruise;
    const descStart = 0.05, descEnd = descStart + 0.3;
    const inflEnd = descEnd + cfg.inflT;
    const liftEnd = inflEnd + 0.15;
    const carryStart = liftEnd + 0.05, carryEnd = carryStart + T;
    const lowerFastEnd = carryEnd + 0.3;
    const lowerEnd = lowerFastEnd + 0.01 / Math.max(1e-3, cfg.vSet);
    const deflStart = lowerEnd + 0.1, deflEnd = deflStart + cfg.deflT;
    const outStart = deflEnd + 0.05, outEnd = outStart + T;
    this.ctl = { descStart, descEnd, inflEnd, liftEnd, carryStart, carryEnd, lowerFastEnd, lowerEnd, deflStart, deflEnd, outStart, outEnd };
    (this as { tl: Timeline }).tl = {
      noseStart: descStart, retractStart: outStart, retractEnd: outEnd, end: outEnd + 0.4,
      phases: [
        [0, 'katı tamponda, tarak yukarıda'],
        [descStart, 'tarak iniyor, dişler aralıklara giriyor'],
        [descEnd, 'yastıklar şişiyor'],
        [inflEnd, '5 mm kaldırıyor'],
        [carryStart, 'tarak ranzaya giriyor'],
        [carryEnd, 'tuğlaları çıtaya indiriyor'],
        [lowerFastEnd, 'son 1 cm yavaş'],
        [deflStart, 'vakumla söndürüyor'],
        [outStart, 'tarak aynı aralıklardan geri çekiliyor'],
        [outEnd, 'tuğlalar çıtada'],
      ],
    };
  }

  /** Tarak diş alt ucunun z'si (çıta üstüne göre) */
  private combZAt(t: number): number {
    const c = this.ctl!, cfg = this.cfg;
    const zGrip = this.zBuf + TOOTH_BOTTOM;
    const zUp = zGrip + 0.18;
    const zCarry = zGrip + cfg.liftPick;
    const zSet = cfg.setGap + TOOTH_BOTTOM;
    const zHi = zSet + 0.01;
    if (t < c.descEnd) return zUp + (zGrip - zUp) * ease((t - c.descStart) / (c.descEnd - c.descStart));
    if (t < c.inflEnd) return zGrip;
    if (t < c.carryEnd) return zGrip + (zCarry - zGrip) * ease((t - c.inflEnd) / (c.liftEnd - c.inflEnd));
    if (t < c.lowerFastEnd) return zCarry + (zHi - zCarry) * ease((t - c.carryEnd) / (c.lowerFastEnd - c.carryEnd));
    if (t < c.lowerEnd) return zHi + (zSet - zHi) * ((t - c.lowerFastEnd) / (c.lowerEnd - c.lowerFastEnd));
    return zSet;
  }

  private updateComb(t: number) {
    const c = this.ctl!, D = this.cfg.stroke;
    const [sIn, vIn] = this.trap(t, c.carryStart);
    const [sOut, vOut] = this.trap(t, c.outStart);
    this.combX = -D + sIn - sOut;
    this.combVx = vIn - vOut;
    this.combZ = this.combZAt(t);
    const h = 1e-4;
    this.combVz = (this.combZAt(t + h) - this.combZAt(t - h)) / (2 * h);
    if (t < c.descEnd) this.infl = 0;
    else if (t < c.deflStart) this.infl = ease((t - c.descEnd) / this.cfg.inflT);
    else this.infl = 1 - ease((t - c.deflStart) / this.cfg.deflT);
  }

  /** Alma bandı (tampon): ranzanın önünde, plaka üstü yüksekliğinde sabit düz yüzey. */
  buffer(px: number, py: number, pz: number, h: Hit): void {
    h.d = 0;
    if (!this.tarak || px > -0.003 || py < -PLATE_HALF_W || py > PLATE_HALF_W) return;
    const d = this.zBuf - pz;
    if (d <= 0 || d > 0.02) return;
    h.d = d;
    h.nx = 0;
    h.ny = 0;
    h.nz = 1;
    h.kappa = 0;
    h.frac = 1;
    h.id = 60;
    h.vx = h.vy = h.vz = 0;
  }

  /** Geri çekilme yolu ve hızı */
  private stroke(t: number): [number, number] {
    return this.trap(t, this.tl.retractStart);
  }

  /** Burun inme oranı: düz → iner (başta), plaka ranzadan çıkınca kalkar. */
  private noseProfile(t: number): [number, number] {
    if (this.cfg.nose !== 'egilir') return [0, 0];
    const T = this.cfg.noseT;
    const down = (t - this.tl.noseStart) / T;
    // ranzadan çıkış: uç x < −2 cm olduğu an
    const sOut = this.cfg.plateLen + 0.02;
    const tOut = this.timeAtStroke(sOut);
    const up = (t - tOut) / T;
    if (t < tOut) return [ease(down), easeD(down) / T];
    return [1 - ease(up), -easeD(up) / T];
  }

  private timeAtStroke(sTarget: number): number {
    // tek düze artan; ikiye bölme
    let lo = this.tl.retractStart, hi = this.tl.retractEnd;
    if (this.stroke(hi)[0] < sTarget) return Infinity;
    for (let i = 0; i < 50; i++) {
      const m = 0.5 * (lo + hi);
      if (this.stroke(m)[0] < sTarget) lo = m;
      else hi = m;
    }
    return hi;
  }

  /** Kökten (ön makara çifti, plaka arkasının 5 cm gerisi) x uzaklığındaki sehim (m, aşağı +). */
  sagAt(x: number): number {
    const i = (x - this.sagX0) / this.sagDx;
    if (i <= 0) return 0;
    if (i >= this.sagN - 1) return this.sag[this.sagN - 1];
    const k = Math.floor(i), f = i - k;
    return this.sag[k] * (1 - f) + this.sag[k + 1] * f;
  }
  sagSlopeAt(x: number): number {
    const i = (x - this.sagX0) / this.sagDx;
    const k = Math.max(0, Math.min(this.sagN - 2, Math.floor(i)));
    return (this.sag[k + 1] - this.sag[k]) / this.sagDx;
  }

  /** Plaka sehimi tablosunu yüklerden kur (konsol kiriş, tekil yüklerin süperpozisyonu). */
  private computeSag() {
    const root = this.xTip - this.cfg.plateLen - 0.05;
    const Lb = this.cfg.plateLen + 0.05;
    this.sagX0 = root;
    this.sagDx = Lb / (this.sagN - 1);
    this.sag.fill(0);
    for (let j = 0; j < this.loadX.length; j++) {
      const a = Math.max(0, Math.min(Lb, this.loadX[j] - root));
      const P = this.loadF[j];
      if (P <= 0 || a <= 0) continue;
      for (let i = 0; i < this.sagN; i++) {
        const x = i * this.sagDx;
        this.sag[i] += x <= a ? (P * x * x * (3 * a - x)) / (6 * this.EI) : (P * a * a * (3 * x - a)) / (6 * this.EI);
      }
    }
  }

  /** Eğilme rijitliğini tam yükteki uç sehiminden ayarla (yükler loadX/loadF'te). */
  calibrateEI() {
    this.EI = 1;
    this.computeSag();
    const tip1 = this.sag[this.sagN - 1];
    this.EI = this.cfg.sagFull > 0 && tip1 > 0 ? tip1 / this.cfg.sagFull : 1e30;
    this.computeSag();
  }

  /** Kökten a uzaklıkta plakanın noktasal dikey rijitliği (N/m) */
  stiffnessAt(x: number): number {
    const a = Math.max(0.05, x - (this.xTip - this.cfg.plateLen - 0.05));
    return (3 * this.EI) / (a * a * a);
  }

  /** Test için: plaka ranzadan uzakta (yalnızca çıtalar) */
  away = false;

  update(t: number) {
    const cfg = this.cfg;
    const prevT = this.t;
    this.t = t;
    if (this.tarak) this.updateComb(t);
    const [s, sp] = this.away ? [cfg.plateLen + 5, 0] : this.stroke(t);
    this.xTip = this.tipStart - s;
    this.vp = -sp;
    this.u = sp * (1 + cfg.syncErr);
    if (t > prevT) this.beltPos += this.u * (t - prevT);
    this.computeSag();
    const [k, kd] = this.noseProfile(t);
    this.noseK = k;
    const hx = this.xTip - cfg.noseLen;
    const wH = this.sagAt(hx);
    this.chx = hx;
    this.chz = this.zu - this.Rh - wH;
    this.beta = k * this.betaMax + this.sagSlopeAt(hx);
    this.betaDot = kd * this.betaMax;
    const ax = cfg.noseLen - this.Rt, az = this.Rh - this.Rt;
    const cb = Math.cos(this.beta), sb = Math.sin(this.beta);
    this.ctx = this.chx + ax * cb + az * sb;
    this.ctz = this.chz - ax * sb + az * cb;
    // iki makaraya üstten teğet doğru
    const Dx = this.ctx - this.chx, Dz = this.ctz - this.chz, D = Math.hypot(Dx, Dz);
    const ux = Dx / D, uz = Dz / D;
    const sg = (this.Rh - this.Rt) / D, cg = Math.sqrt(Math.max(0, 1 - sg * sg));
    this.nrx = cg * -uz + sg * ux;
    this.nrz = cg * ux + sg * uz;
    this.trx = this.nrz;
    this.trz = -this.nrx;
    this.thx = this.chx + this.Rh * this.nrx;
    this.thz = this.chz + this.Rh * this.nrz;
    const ttx = this.ctx + this.Rt * this.nrx, ttz = this.ctz + this.Rt * this.nrz;
    this.rampLen = (ttx - this.thx) * this.trx + (ttz - this.thz) * this.trz;
  }

  /** Düz bant üstünün zemine göre hızı */
  get flatBeltV(): number {
    return this.vp + this.u;
  }

  /**
   * Noktanın plaka üst profiline batması. `arcs` false ise yaylar atlanır (yüz hücreleri makaraları analitik
   * hesaplar). Temas yoksa h.d ≤ 0.
   */
  plate(px: number, py: number, pz: number, arcs: boolean, h: Hit): void {
    h.d = 0;
    if (py < -PLATE_HALF_W || py > PLATE_HALF_W) return;
    if (pz > this.zu + 0.002 || pz < this.zu - 0.04 - this.cfg.noseLen * Math.sin(this.betaMax)) return;
    if (px > this.xTip + 0.01) return;
    let best = Infinity, piece = -1, nx = 0, nz = 1, kap = 0;
    // düz üst
    if (px <= this.chx) {
      const d = this.zu - this.sagAt(px) - pz;
      if (d > 0 && d < best) {
        best = d; piece = PIECE_FLAT; nx = 0; nz = 1; kap = 0;
      }
    }
    // menteşe yayı
    {
      const rx = px - this.chx, rz = pz - this.chz;
      if (rx >= 0 && rx * this.nrz - rz * this.nrx <= 0) {
        const r = Math.hypot(rx, rz);
        const d = this.Rh - r;
        if (arcs && d > 0 && d < best && r > 1e-9) {
          best = d; piece = PIECE_HINGE; nx = rx / r; nz = rz / r; kap = 1 / this.Rh;
        } else if (!arcs && d > 0) {
          h.d = 0;
          return;
        }
      }
    }
    // rampa
    {
      const s = (px - this.thx) * this.trx + (pz - this.thz) * this.trz;
      if (s >= 0 && s <= this.rampLen) {
        const d = (this.thx - px) * this.nrx + (this.thz - pz) * this.nrz;
        if (d > 0 && d < best) {
          best = d; piece = PIECE_RAMP; nx = this.nrx; nz = this.nrz; kap = 0;
        }
      }
    }
    // uç yayı
    {
      const rx = px - this.ctx, rz = pz - this.ctz;
      if (rx * this.nrz - rz * this.nrx >= 0 && (rx >= 0 || rz < 0)) {
        const r = Math.hypot(rx, rz);
        const d = this.Rt - r;
        if (d > 0 && d < best && r > 1e-9) {
          if (!arcs) {
            h.d = 0;
            return;
          }
          best = d; piece = PIECE_TIP; nx = rx / r; nz = rz / r; kap = 1 / this.Rt;
        }
      }
    }
    if (piece < 0) return;
    h.d = best;
    h.nx = nx;
    h.ny = 0;
    h.nz = nz;
    h.kappa = kap;
    h.id = piece;
    h.frac = 1;
    // yüzeydeki nokta ve bant hızı
    const sx = px + nx * best, sz = pz + nz * best;
    let rvx = this.vp, rvz = 0, tx = 1, tz = 0;
    if (piece === PIECE_HINGE) {
      tx = nz; tz = -nx;
    } else if (piece >= PIECE_RAMP) {
      rvx += this.betaDot * (sz - this.chz);
      rvz -= this.betaDot * (sx - this.chx);
      if (piece === PIECE_RAMP) {
        tx = this.trx; tz = this.trz;
      } else {
        tx = nz; tz = -nx;
      }
    }
    h.vx = rvx + this.u * tx;
    h.vy = 0;
    h.vz = rvz + this.u * tz;
  }

  /** Makara yayının (menteşe = 1, uç = 3) merkezi, yarıçapı ve geçerli açı aralığı için yardımcılar */
  rollerCenter(which: 1 | 3): [number, number, number] {
    return which === 1 ? [this.chx, this.chz, this.Rh] : [this.ctx, this.ctz, this.Rt];
  }

  /** Makara yüzeyinde, merkezden (nx, nz) yönündeki noktada bant hızı */
  rollerBeltV(which: 1 | 3, nx: number, nz: number, out: Hit) {
    const [cx, cz, R] = this.rollerCenter(which);
    let rvx = this.vp, rvz = 0;
    if (which === 3) {
      const sx = cx + nx * R, sz = cz + nz * R;
      rvx += this.betaDot * (sz - this.chz);
      rvz -= this.betaDot * (sx - this.chx);
    }
    out.vx = rvx + this.u * nz;
    out.vy = 0;
    out.vz = rvz - this.u * nx;
  }

  /** (nx, nz) yönü makaranın bantlı yayında mı (menteşe: üst ile rampa arası, uç: rampadan sonrası) */
  onArc(which: 1 | 3, nx: number, nz: number, tol: number): boolean {
    const cr = nx * this.nrz - nz * this.nrx; // sin(açı − rampa açısı)
    if (which === 1) return nx >= -tol && cr <= tol;
    return cr >= -tol;
  }

  /**
   * Noktanın çıtalara batması. Özellik [e0, e1] aralığına yayılıyorsa (paralel çıtada y, dik çıtada x) kenarda
   * kısmi taşıma kesri hesaplanır. Yandan girişte (nokta çıtanın içinde, yan yüze daha yakın) yan normal döner.
   */
  slat(px: number, py: number, pz: number, e0: number, e1: number, h: Hit): void {
    h.d = 0;
    const S = this.slats;
    if (!S.length) return;
    const par = this.cfg.slat === 'paralel';
    const along = par ? py : px; // çıtaların dizildiği yön
    const k0 = Math.floor((along - this.slatFirst) / this.slatPitch);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      if (k < 0 || k >= S.length) continue;
      const s = S[k];
      if (pz > s.top + 1e-6 || pz < s.top - SLAT_T) continue;
      if (par ? px < s.x0 || px > s.x1 : py < s.y0 || py > s.y1) continue;
      const a = par ? s.y0 : s.x0, b = par ? s.y1 : s.x1;
      const span = e1 - e0;
      const ov = Math.min(e1, b) - Math.max(e0, a);
      const inside = along >= a && along <= b;
      if (!inside && ov <= 0) continue;
      const dt = s.top - pz;
      let frac = span > 1e-9 ? Math.max(0, Math.min(1, ov / span)) : inside ? 1 : 0;
      if (inside) {
        const dl = along - a, dr = b - along;
        const ds = Math.min(dl, dr);
        // Yandan giriş yalnızca nokta üst yüzün belirgin altındaysa (çıta arasına dalmış kenar). Üstten basan
        // kenar çıta kenarına çok yakın olsa da üstten taşınır (ezilme derinliği 8 mm'ye kadar).
        if (dt > 0.008 && ds < dt) {
          // yandan giriş
          h.d = ds;
          h.nx = par ? 0 : dl < dr ? -1 : 1;
          h.ny = par ? (dl < dr ? -1 : 1) : 0;
          h.nz = 0;
          h.kappa = 0;
          h.frac = 1;
          h.id = k;
          h.vx = h.vy = h.vz = 0;
          return;
        }
        if (span <= 1e-9) frac = 1;
      }
      if (frac <= 0 || dt > 0.012) continue;
      h.d = dt;
      h.nx = 0;
      h.ny = 0;
      h.nz = 1;
      h.kappa = 0;
      h.frac = frac;
      h.id = k;
      h.vx = h.vy = h.vz = 0;
      return;
    }
  }

  /**
   * Alt bant ile çıtalar arası en küçük boşluk (m, eksi = basıyor) ve yeri. Plaka altı (sehimli) ve uç makarasının
   * altı, ranzanın içindeki ve plakanın altındaki çıtalara karşı.
   */
  bottomGap(): { gap: number; x: number; slat: number } {
    let best = Infinity, bx = 0, bs = -1;
    const zb0 = this.zu - this.cfg.plateThk;
    const par = this.cfg.slat === 'paralel';
    const xr0 = this.xTip - this.cfg.plateLen;
    for (let k = 0; k < this.slats.length; k++) {
      const s = this.slats[k];
      if (par && (s.y1 < -PLATE_HALF_W || s.y0 > PLATE_HALF_W)) continue;
      // plaka altı: x ∈ [max(xr0, s.x0), min(chx, s.x1)] içinde en çok sehim uçta
      const xa = Math.max(xr0, s.x0), xb = Math.min(this.chx, s.x1);
      if (xb >= xa) {
        const g = zb0 - this.sagAt(xb) - s.top;
        if (g < best) {
          best = g; bx = xb; bs = k;
        }
      }
      // uç makarası altı
      if (this.ctx >= s.x0 && this.ctx <= s.x1) {
        const g = this.ctz - this.Rt - s.top;
        if (g < best) {
          best = g; bx = this.ctx; bs = k;
        }
      }
    }
    return { gap: best, x: bx, slat: bs };
  }
}
