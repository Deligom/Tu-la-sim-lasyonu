// Hareket katmanı (Aşama 3): simülasyon durumunu (SimState) her karede sahneye yansıtır. Mantık burada yok;
// yalnızca model.ts'nin ürettiği konumlar ve aşamalar okunur.
//
// - Tuğlalar tek InstancedMesh (hat + plaka + ranzalar + çıkış tamponu + AGV üstündeki ranzalar).
// - Bant parçaları doku kaydırarak döner; uç sensörü lambası bölge dönüyorsa yeşil, durduysa kırmızı.
// - Pop-up, tabla boyuna pop-up'ı, kapaklar, artık itici kolları, tel demeti, plaka, kaldırıcı.
// - Ranza değişimi çukur sırasıyla gösterilir (dolu ranza zemine kalkar → ileri çıkar → boş ranza yandan
//   girer → ilk kata kalkar). Mantıktaki toplam süre (değişim + 120 cm kaldırma) aynen korunur.

import * as THREE from 'three';
import type { Plant } from './plant';
import { Parts } from './parts';
import { M } from './materials';
import { buildRack, type RackModel, type SlatType } from './rack';
import { tableColumnY, type PlanLayout, type Side } from '../sim/geometry';
import type { Params } from '../sim/params';
import { bitCount, drawRack, type RackNote, type SimState } from '../sim/model';
import { POP_INIS, POP_KALKIS, RACK_FEET_LOW, RANZA, RANZA_AKIS, TUGLA, Z } from '../sim/dims';
import { swapElapsed, swapView } from '../sim/swapview';
import { NOSE_DEFAULT, brickPose, checkLanding, type LandingConfig, type LandingResult, type NoseKind } from '../sim/landing';
import type { LoaderKind } from '../phys/config';

export interface Motion {
  /** Durumu sahneye yansıt. Bir şey değiştiyse true. */
  update(S: SimState): boolean;
  setDefaultSlat(t: SlatType): void;
  /** Burun tipi (sabit / eğilir); iniş ölçümünü döndürür */
  setNose(k: NoseKind): LandingResult;
  /** Şu anki burun ve çıta tipiyle iniş ölçümü */
  landing(): LandingResult;
  /** Yükleyici: bantlı plaka ya da tarak tutucu (aday) */
  setLoader(k: LoaderKind): void;
  /** Dinamik etiket yazıları (anahtar → yazı) */
  labelTexts(): Map<string, string>;
  /** Dokunarak seçilebilen hareketli nesneler */
  pickables: THREE.Object3D[];
  /** Seçimden önce: tuğla kümesinin sınır küresini tazele */
  prepPick(): void;
}

const CAP = 2600;
const L = TUGLA.boy;
const W = TUGLA.en;
const H = TUGLA.yukseklik;
const LIFT_STROKE = POP_INIS + POP_KALKIS;

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Yaş tuğla: kesim yüzlerinde delik deseni (fotoğraftaki delikli tuğla), yanlarda ekstrüzyon çizgileri. */
function brickMaterials(): THREE.Material[] {
  const base = '#ece6db';
  const end = canvasTex(152, 108, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 152, 108);
    g.fillStyle = '#4f483f';
    const cols = 7, rows = 5, mx = 11, my = 10, gap = 5;
    const hw = (152 - 2 * mx - (cols - 1) * gap) / cols;
    const hh = (108 - 2 * my - (rows - 1) * gap) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) g.fillRect(mx + i * (hw + gap), my + j * (hh + gap), hw, hh);
  });
  const side = canvasTex(64, 64, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(70,62,52,0.28)';
    for (let y = 2; y < 64; y += 6) g.fillRect(0, y, 64, 1.5);
  });
  const mk = (map?: THREE.Texture) => new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : base, roughness: 0.93, metalness: 0 });
  const e = mk(end), s = mk(side), t = mk();
  return [e, e, s, s, t, t];
}

function beltTexture(): THREE.CanvasTexture {
  const t = canvasTex(64, 8, (g) => {
    g.fillStyle = '#2b2d31';
    g.fillRect(0, 0, 64, 8);
    g.fillStyle = '#4a4e55';
    g.fillRect(0, 0, 5, 8);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

interface Strip {
  tex: THREE.Texture;
  period: number;
}

function addStrip(parent: THREE.Object3D, base: THREE.CanvasTexture, cx: number, cy: number, z: number, len: number, wid: number, period: number): Strip {
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.repeat.set(len / period, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 }));
  m.position.set(cx, cy, z);
  m.receiveShadow = true;
  parent.add(m);
  return { tex, period };
}

function buildAgv(): THREE.Group {
  const p = new Parts({ title: 'AGV (kaldırmalı)', detail: 'Ranzanın altına girer, kaldırıp taşır. 60 s tur: dolu ranzayı çıkıştan alır, boşu girişe bırakır. Basit model.' });
  p.box(M.paintYellow, -40, 40, -48, 48, 1, 17);
  p.box(M.dark, -36, 36, -44, 44, 17, 19);
  for (const x of [-30, 30]) for (const y of [-40, 40]) p.cyl(M.dark, 'y', x, y, 4, 4, 5, 12);
  p.box(M.lens, 38, 40.5, -10, 10, 9, 12);
  return p.build('AGV');
}

export function createMotion(plant: Plant, lay: PlanLayout, P: Readonly<Params>, scene: THREE.Scene): Motion {
  const zr = Z.hat;
  const laneY = [0, 1, 2].map((i) => lay.laneCenterY(i));
  const sideC = [lay.sideCenterY(0), lay.sideCenterY(1)];
  const D = RANZA.derinlikX;
  const step = RANZA_AKIS.adim;

  // ---------- tuğlalar ----------
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(L, W, H), brickMaterials(), CAP);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.frustumCulled = false;
  inst.count = 0;
  inst.userData.info = { title: 'Yaş tuğla', detail: `${L} × ${String(W).replace('.', ',')} × ${H} cm, ~3,5 kg. Kırmızı: artık; parlak kırmızı: ortada oluşan artık ya da temas.` };
  const LANE = [new THREE.Color('#a99d8d'), new THREE.Color('#978c7f'), new THREE.Color('#b0a392')];
  const SCRAP = new THREE.Color('#c0623f');
  const ALERT = new THREE.Color('#ff3b30');
  inst.setColorAt(0, LANE[0]);
  scene.add(inst);

  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const YAXIS = new THREE.Vector3(0, 1, 0);
  let n = 0;
  /** Arka kenarı x0, boyu len, Y merkezi yc, alt yüzü z0. tilt > 0: ön alt köşe (x0+len, z0) etrafında öne eğik. */
  const put = (x0: number, len: number, yc: number, z0: number, col: THREE.Color, tilt = 0) => {
    if (n >= CAP) return;
    _s.set(len / L, 1, 1);
    if (tilt === 0) {
      _q.identity();
      _p.set(x0 + len / 2, yc, z0 + H / 2 + 0.06);
    } else {
      _q.setFromAxisAngle(YAXIS, tilt);
      const c = Math.cos(tilt), s = Math.sin(tilt);
      const ox = len / 2, oz = -H / 2;
      _p.set(x0 + len - (ox * c + oz * s), yc, z0 + 0.06 - (-ox * s + oz * c));
    }
    _m.compose(_p, _q, _s);
    inst.setMatrixAt(n, _m);
    inst.setColorAt(n, col);
    n++;
  };

  // Ranzadaki kat deseni (2D'nin plaka hesabından: tabla → tampon ucu → +strok), ranza ön yüzü ve merkezine göre
  const pattern: { dx: number; dy: number; lane: number }[][] = ([0, 1] as Side[]).map((s) => {
    const cols = tableColumnY(lay, s);
    const shift = lay.PL0 + lay.PLEN - 2 - lay.ZEND + lay.DX - lay.RK0;
    const out: { dx: number; dy: number; lane: number }[] = [];
    for (let k = 0; k < 4; k++) cols.forEach((y, ci) => out.push({ dx: lay.rowBack(k) + shift, dy: y - sideC[s], lane: ci % 3 }));
    return out;
  });
  /** mask: dolu katlar (bit j = alttan j. kat) */
  const drawRackBricks = (s: number, front: number, yc: number, feet: number, mask: number) => {
    for (let j = 0; j < RANZA.katSayisi; j++) {
      if (!((mask >> j) & 1)) continue;
      const z = feet + RANZA.ilkKat + j * RANZA.katArasi;
      for (const b of pattern[s]) put(front + b.dx, L, yc + b.dy, z, LANE[b.lane]);
    }
  };

  // ---------- bant dokuları ve bölge lambaları ----------
  const beltTex = beltTexture();
  const zoneStrips: Strip[][] = []; // [zone][lane]
  const lamps: THREE.Mesh[][] = [];
  const lampOn = new THREE.MeshBasicMaterial({ color: 0x2fbf5f });
  const lampOff = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const lampGeo = new THREE.BoxGeometry(1.9, 1.9, 0.5);
  const fx = new THREE.Group();
  fx.name = 'Hareket';
  scene.add(fx);
  lay.zones.forEach((zn, z) => {
    zoneStrips[z] = [];
    lamps[z] = [];
    for (let i = 0; i < 3; i++) {
      zoneStrips[z][i] = addStrip(fx, beltTex, (zn.s + zn.e) / 2, laneY[i], zr + 0.04, zn.e - zn.s - 7, 13.6, 20);
      if (zn.k !== 'R') {
        const lm = new THREE.Mesh(lampGeo, lampOn);
        lm.position.set(zn.e - 1.5, laneY[i], zr + 21.55);
        fx.add(lm);
        lamps[z][i] = lm;
      }
    }
  });
  const tamponStrips = sideC.map((c) => (lay.BL > 0 ? addStrip(fx, beltTex, lay.BUF0 + (lay.BL - 1) / 2, c, Z.tampon + 0.04, lay.BL - 7, 97, 25) : null));
  const plateStrips = plant.stations.map((st) => addStrip(st.plate, beltTex, lay.PL0 + 2.3 + 42.3, sideC[st.side], Z.plakaUst + 0.04, 84.6, 97.5, 12));
  // tarak: alma bandı (tamponun 2. bölgesi) — kat üstüne gelirken tamponla aynı hızda döner
  const pickStrips = plant.stations.map((st) => addStrip(st.pickBelt, beltTex, lay.PL0 + 44.25, sideC[st.side], Z.plakaUst + 0.04, lay.PLEN - 7, 97, 25));
  const lastFront = [Number.NaN, Number.NaN];

  // ---------- ranza havuzu ----------
  const mkRack = (name: string) => {
    const r = buildRack(name);
    r.group.visible = false;
    fx.add(r.group);
    return r;
  };
  const outgoing = sideC.map((_, s) => mkRack(`${s ? 'B' : 'A'} (çıkıyor)`));
  const incoming = sideC.map((_, s) => mkRack(`${s ? 'B' : 'A'} (giriyor)`));
  const outBuf = sideC.map((_, s) => Array.from({ length: RANZA_AKIS.cikisTampon }, () => mkRack(`${s ? 'B' : 'A'} (dolu, çıkışta)`)));

  // ---------- AGV'ler ----------
  const agvs = Array.from({ length: P.nVeh }, () => {
    const g = buildAgv();
    fx.add(g);
    return { g, rack: mkRack('AGV üstünde') };
  });
  const ox0 = lay.RK0 + D + RANZA_AKIS.cukurArka + 0.5;
  const ox1 = ox0 + RANZA_AKIS.cikisTampon * step + 10;
  const outSlotFront = (k: number) => ox0 + 8 + k * step;
  const home = (i: number) => new THREE.Vector2(ox1 + 260, (i - (P.nVeh - 1) / 2) * 130);
  type Path = { pts: THREE.Vector2[]; cum: number[]; pick: number; drop: number; pickE: number; dropE: number };
  const pathCache = new Map<string, Path>();
  const agvPath = (i: number, s: number): Path => {
    const key = `${i}:${s}`;
    const hit = pathCache.get(key);
    if (hit) return hit;
    const c = sideC[s];
    const sy = s === 0 ? 1 : -1;
    const aisle = sy * 360;
    const yIn = c + sy * RANZA_AKIS.girisY;
    const pickX = outSlotFront(RANZA_AKIS.cikisTampon - 1) + D / 2;
    const h = home(i);
    const v = (x: number, y: number) => new THREE.Vector2(x, y);
    const pts = [h, v(ox1 + 120, c), v(pickX, c), v(ox1 + 120, c), v(ox1 + 420, c), v(ox1 + 420, aisle), v(-260, aisle),
      v(-120, yIn), v(45, yIn), v(-120, yIn), v(-120, aisle), v(ox1 + 260, aisle), h.clone()];
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
    const tot = cum[cum.length - 1];
    const p: Path = { pts, cum: cum.map((x) => x / tot), pick: cum[2] / tot, drop: cum[4] / tot, pickE: cum[6] / tot, dropE: cum[8] / tot };
    pathCache.set(key, p);
    return p;
  };
  const along = (p: Path, f: number, out: THREE.Vector2) => {
    const k = Math.max(1, p.cum.findIndex((c) => c >= f));
    const a = p.cum[k - 1], b = p.cum[k];
    return out.copy(p.pts[k - 1]).lerp(p.pts[k], b > a ? (f - a) / (b - a) : 0);
  };

  // ---------- durum ----------
  let lastS: SimState | null = null;
  let lastT = 0;
  let defaultSlat: SlatType = 'paralel';
  const lastBack = [NaN, NaN];
  const pusherY = [0, 0];
  const texts = new Map<string, string>();
  const v2 = new THREE.Vector2();

  // Ranzanın çıtaları: 2D'nin komple red kuralındaki ranza dik çıtalı çizilir (eski kural); yamuk katlar eğri çıtalı.
  const NO_NOTE: RackNote = { filled: 0, bad: 0, reject: false };
  const setSlat = (r: RackModel, n: Pick<RackNote, 'bad' | 'reject'>) => {
    r.setSlatType(n.reject ? 'dik' : defaultSlat);
    r.setBad(n.bad);
  };

  // Eğilir burun (35 cm): girişin son 2 cm'sinde iner (~5°, üstündeki iki sıra burunla eğilir), geri çekilirken
  // bütün tuğlalar indikten sonra, plaka ranzadan çıkarken kalkar.
  let nose: NoseKind = NOSE_DEFAULT.nose;
  const noseK = [0, 0];
  // Tarak tutucu: zamanlama 2D modelin plaka evrelerinden (alma → giriş → geri çekilme). Tamponda inme / şişirme
  // tweenle; ranzada indirme girişin son 4 cm'sine sıkıştırıldı (fizikli ayrıntı yükleme detayı sayfasında).
  let loader: LoaderKind = 'tarak';
  const combDown = [0, 0];
  const combInfl = [0, 0];
  /** Ranzada indirme oranı ve indirme yolu (tuğla altı plaka üstünden aktif çıtanın 1 mm üstüne) */
  const combLowerK = (px: number) => smooth((px - (lay.DX - 4)) / 4);
  const COMB_DROP = Z.plakaUst - Z.aktifCita - 0.1;
  const landCfg = (): LandingConfig => ({ ...NOSE_DEFAULT, nose, slat: defaultSlat });
  const rowsX0 = pattern[0].filter((_, i) => i % 6 === 0).map((b) => b.dx);
  const landing = () => checkLanding(landCfg(), rowsX0, lay.PL0 + lay.DX + lay.PLEN - lay.RK0);
  const updateNoseK = (S: SimState) =>
    S.sides.forEach((sd, s) => {
      const pl = sd.plate;
      if (nose !== 'egilir') noseK[s] = 0;
      else if (pl.phase === 'insert') noseK[s] = smooth((pl.px - (lay.DX - 2)) / 2);
      else if (pl.phase === 'retract') noseK[s] = smooth(pl.px / 8);
      else noseK[s] = 0;
    });

  function update(S: SimState): boolean {
    if (S !== lastS) {
      lastS = S;
      lastT = S.t;
      lastBack[0] = lastBack[1] = NaN;
    } else if (S.t === lastT) return false;
    const dt = Number.isNaN(lastT) ? 0 : Math.max(0, S.t - lastT);
    lastT = S.t;
    n = 0;

    updateNoseK(S);
    // 1) sütunlar
    for (let i = 0; i < 3; i++) put(0, S.f[i], laneY[i], zr, LANE[i]);

    // 2) hattaki tuğlalar
    const Zp = S.zone;
    const liftK = Zp.phase === 'lift' ? 1 - Zp.timer / P.liftT : Zp.phase === 'lower' ? Zp.timer / P.liftT : Zp.phase === 'move' ? 1 : 0;
    const liftingBlock = Zp.phase === 'lift' && Zp.block ? new Set(Zp.block.bricks) : null;
    let kick0 = 0, kick2 = 0;
    for (const b of S.bricks) {
      switch (b.st) {
        case 'push':
        case 'belt':
          put(b.x, b.len, laneY[b.lane], zr, b.touch ? ALERT : LANE[b.lane]);
          break;
        case 'scrap': {
          const off = b.off ?? 0;
          const y = laneY[b.lane] + off;
          const over = Math.abs(y) - 23.5;
          const z = b.kick && over > 0 ? Math.max(zr - 24, zr - 0.8 - over * 0.725) : zr;
          if (b.kick && b.lane === 0) kick0 = Math.min(kick0, off);
          if (b.kick && b.lane === 2) kick2 = Math.max(kick2, off);
          put(b.x, b.len, y, z, b.mid ? ALERT : SCRAP);
          break;
        }
        case 'block': {
          const z = liftingBlock && liftingBlock.has(b) ? zr + POP_KALKIS * smooth(liftK) : Z.popUst;
          put(b.x, L, b.cy ?? 0, z, LANE[b.lane]);
          break;
        }
        case 'table':
          put(b.x, L, b.cy ?? 0, Z.tablaEnine, LANE[b.lane]);
          break;
        case 'grp':
          put(b.x, L, b.cy ?? 0, Z.tampon, LANE[b.lane]);
          break;
        case 'plate': {
          const s = (b.cy ?? 0) > 0 ? 0 : 1;
          const pl = S.sides[s].plate;
          const y = b.cy ?? 0;
          if (loader === 'tarak') {
            let z = Z.plakaUst;
            if (pl.phase === 'insert') {
              const k = combLowerK(pl.px);
              z = Z.plakaUst + 0.5 * (1 - k) - COMB_DROP * k;
            } else if (pl.phase === 'retract') z = Z.aktifCita;
            put(b.x, L, y, z, LANE[b.lane]);
            break;
          }
          // Burun inerken (girişin son 2 cm'si) üstündeki tuğlalar burunla birlikte eğilir; geri çekilirken bant sarar,
          // tuğla yerinde durur, altından plaka → burun → çıta geçer. Duruş, iniş ölçümüyle aynı modelden
          // (src/sim/landing.ts): destek noktalarının üst zarfına oturan katı cisim.
          if (pl.phase !== 'retract' && !(pl.phase === 'insert' && noseK[s] > 0)) {
            put(b.x, L, y, Z.plakaUst, LANE[b.lane]);
            break;
          }
          const tip = lay.PL0 + pl.px + lay.PLEN - lay.RK0;
          const pose = brickPose(landCfg(), b.x - lay.RK0, tip, noseK[s]);
          put(b.x, L, y, Z.aktifCita + pose.zFront, LANE[b.lane], pose.tilt);
          break;
        }
        default:
          break; // 'rack': ranza çiziminden
      }
    }

    // 3) bantlar, lambalar
    lay.zones.forEach((zn, z) => {
      for (let i = 0; i < 3; i++) {
        const running = zn.k === 'R' || S.lanes[i].run[z] !== false;
        const v = !running ? 0 : zn.k === 'R' ? P.vb : P.va;
        const st = zoneStrips[z][i];
        st.tex.offset.x -= (v * dt) / st.period;
        const lm = lamps[z][i];
        if (lm) lm.material = running ? lampOn : lampOff;
      }
    });
    S.sides.forEach((sd, s) => {
      const g = sd.groups[0];
      const strip = tamponStrips[s];
      if (strip && g && g.back < lay.PL0) {
        if (!Number.isNaN(lastBack[s]) && g.back > lastBack[s] && g.back - lastBack[s] < 60) strip.tex.offset.x -= (g.back - lastBack[s]) / strip.period;
        lastBack[s] = g.back;
      } else lastBack[s] = NaN;
      const ps = plateStrips[s];
      ps.tex.offset.x = -sd.plate.belt / ps.period;
      const pk = pickStrips[s];
      if (g && sd.plate.phase === 'ready' && g.front > lay.PL0) {
        if (!Number.isNaN(lastFront[s]) && g.front > lastFront[s] && g.front - lastFront[s] < 60) pk.tex.offset.x -= (g.front - lastFront[s]) / pk.period;
        lastFront[s] = g.front;
      } else lastFront[s] = Number.NaN;
    });

    // 4) pop-up, tabla pop-up, kapaklar, iticiler, tel demeti
    plant.prepPopup.position.z = LIFT_STROKE * smooth(liftK);
    plant.stations.forEach((st) => (st.tablePopup.position.z = S.tables[st.side].exiting ? LIFT_STROKE : 0));
    S.lanes.forEach((ln, i) => {
      const k = ln.gate === 'open' ? 0 : ln.gate === 'closed' ? 1 : ln.gate === 'closing' ? 1 - ln.gt / P.gateT : ln.gt / P.gateT;
      plant.line.gates[i].position.z = -21 * smooth(k);
    });
    pusherY[0] = kick0 < 0 ? Math.max(-26, kick0) : pusherY[0] * 0.7;
    pusherY[1] = kick2 > 0 ? Math.min(26, kick2) : pusherY[1] * 0.7;
    plant.line.pushers[0].position.y = pusherY[0];
    plant.line.pushers[1].position.y = pusherY[1];
    const dc = S.t - S.lastCut;
    plant.line.harp.position.z = dc >= 0 && dc < 0.4 ? -24 * Math.sin((Math.PI * dc) / 0.4) : 0;

    // 5) plaka, kaldırıcı, ranza değişimi
    const v = P.liftSpeed;
    const Ts = P.swapT;
    S.sides.forEach((sd, s) => {
      const st = plant.stations[s];
      const rf = plant.rackFlows[s];
      st.nose.rotation.y = nose === 'egilir' ? st.noseDown * noseK[s] : 0;
      const rk = sd.rack;
      const c = sideC[s];
      const sy = s === 0 ? 1 : -1;
      const yIn = c + sy * RANZA_AKIS.girisY;
      const name = s === 0 ? 'A' : 'B';
      st.plate.position.x = sd.plate.px;
      if (loader === 'tarak') {
        const pl = sd.plate;
        combDown[s] += ((pl.phase === 'ready' ? 0 : 1) - combDown[s]) * Math.min(1, dt / 0.2);
        if (pl.phase === 'retract') combInfl[s] = 1 - smooth((lay.DX - pl.px) / 2);
        else if (pl.phase === 'ready') combInfl[s] = 0;
        else if (combDown[s] > 0.95) combInfl[s] = Math.min(1, combInfl[s] + dt / 0.25);
        const k = pl.phase === 'insert' ? combLowerK(pl.px) : pl.phase === 'retract' ? 1 : 0;
        const lift = pl.phase === 'insert' ? 0.5 * (1 - k) : 0;
        st.comb.group.position.set(pl.px, 0, st.combBaseZ + 18 * (1 - smooth(combDown[s])) + lift - COMB_DROP * k);
        st.comb.setInfl(combInfl[s]);
        st.combCarriage.position.x = pl.px;
      }

      const E = swapElapsed(rk.phase, rk.timer, rk.levels, rk.lift, rk.target, v, Ts);
      const logicPushed = E >= 0 && rk.phase !== 'swap';
      const cur: RackNote = { filled: rk.filled, bad: rk.bad, reject: rk.reject };
      const leaving: RackNote = rk.phase === 'swap' ? cur : logicPushed ? sd.outQ[sd.outQ.length - 1] ?? NO_NOTE : NO_NOTE;
      const next = rk.phase === 'swap' ? drawRack(S.rng, P) : cur;

      let feet: number;
      let stationVisible = true;
      let mask = rk.filled;
      let note: Pick<RackNote, 'bad' | 'reject'> = cur;
      let label: string;
      outgoing[s].group.visible = false;
      incoming[s].group.visible = false;
      let queue = sd.empty;
      let outItems = sd.outQ;
      const nBad = bitCount(rk.bad & ((1 << rk.levels) - 1));
      const badTxt = nBad ? ` · ${nBad} yamuk kat atlandı` : '';

      if (E < 0) {
        if (rk.phase === 'needSwap' && rk.reject) {
          feet = 0;
          mask = 0;
          label = `Ranza ${name} · red`;
        } else if (rk.phase === 'needSwap') {
          feet = RACK_FEET_LOW + rk.lift;
          label = rk.filled ? `Ranza ${name} · dolu${badTxt}, boş ranza bekliyor` : `Ranza ${name} · bütün katlar yamuk, boş çıkıyor`;
        } else {
          feet = RACK_FEET_LOW + rk.lift;
          label = `Ranza ${name} · ${rk.levels}/5${badTxt}`;
        }
      } else {
        label = `Ranza ${name} · değişiyor`;
        const sv = swapView(E, v, Ts, leaving.reject);
        queue = sd.empty + (logicPushed ? 1 : 0) - (sv.stage !== 'rise1' ? 1 : 0);
        if (sv.stage !== 'rise2') outItems = logicPushed ? sd.outQ.slice(0, -1) : sd.outQ;
        feet = sv.feet;
        if (sv.stage === 'rise1') {
          mask = leaving.filled;
          note = leaving;
        } else if (sv.stage === 'exchange') {
          const p = sv.p;
          stationVisible = false;
          const og = outgoing[s];
          const slot = Math.max(0, RANZA_AKIS.cikisTampon - 1 - outItems.length);
          og.group.visible = true;
          og.group.position.set(lay.RK0 + smooth(p / 0.55) * (outSlotFront(slot) - lay.RK0), c - RANZA.boyY / 2, 0);
          setSlat(og, leaving);
          drawRackBricks(s, og.group.position.x, c, 0, leaving.filled);
          const ic = incoming[s];
          ic.group.visible = true;
          const yA = yIn - RANZA.boyY / 2, yB = c - RANZA.boyY / 2;
          if (p < 0.45) ic.group.position.set(lay.RK0 - step + smooth(p / 0.45) * step, yA, 0);
          else ic.group.position.set(lay.RK0, yA + smooth((p - 0.5) / 0.5) * (yB - yA), 0);
          setSlat(ic, next);
        } else {
          mask = 0;
          note = next;
        }
      }

      st.lifter.setFeetZ(feet);
      st.rack.group.visible = stationVisible;
      setSlat(st.rack, note);
      if (stationVisible) drawRackBricks(s, lay.RK0, c, feet, mask);

      // girişte bekleyen boşlar (yamuk katları lazer ölçünce belli olur)
      rf.waiting.forEach((r, k) => {
        r.group.visible = k < queue;
        setSlat(r, NO_NOTE);
      });
      // çıkış tamponu (en eski en uçta)
      outBuf[s].forEach((r, i) => {
        const item = outItems[i];
        r.group.visible = item !== undefined;
        if (item === undefined) return;
        const slot = RANZA_AKIS.cikisTampon - 1 - i;
        r.group.position.set(outSlotFront(slot), c - RANZA.boyY / 2, 0);
        setSlat(r, item);
        drawRackBricks(s, outSlotFront(slot), c, 0, item.filled);
      });
      texts.set(`rack${s}`, label);
    });

    // 6) AGV'ler
    S.veh.forEach((veh, i) => {
      const a = agvs[i];
      if (!a) return;
      if (!veh.busy) {
        const h = home(i);
        a.g.position.set(h.x, h.y, 0);
        a.rack.group.visible = false;
        return;
      }
      const path = agvPath(i, veh.to);
      const f = Math.min(1, Math.max(0, 1 - veh.timer / P.tripT));
      along(path, f, v2);
      a.g.position.set(v2.x, v2.y, 0);
      const c = sideC[veh.to];
      const carryFull = veh.cargo && f >= path.pick && f < path.drop;
      const carryEmpty = veh.bring && f >= path.pickE && f < path.dropE;
      if (veh.cargo && f < path.pick) {
        // daha almadı: ranza çıkış konveyörünün ucunda bekliyor
        const fr = outSlotFront(RANZA_AKIS.cikisTampon - 1);
        a.rack.group.visible = true;
        a.rack.group.position.set(fr, c - RANZA.boyY / 2, 0);
        setSlat(a.rack, veh.cargo);
        drawRackBricks(veh.to, fr, c, 0, veh.cargo.filled);
      } else if (carryFull || carryEmpty) {
        a.rack.group.visible = true;
        a.rack.group.position.set(v2.x - D / 2, v2.y - RANZA.boyY / 2, 4);
        const cg = carryFull && veh.cargo ? veh.cargo : NO_NOTE;
        setSlat(a.rack, cg);
        drawRackBricks(veh.to, v2.x - D / 2, v2.y, 4, cg.filled);
      } else a.rack.group.visible = false;
    });

    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    return true;
  }

  const showLoader = () => {
    for (const st of plant.stations) {
      st.plate.visible = loader === 'plaka';
      st.comb.group.visible = st.combCarriage.visible = st.pickBelt.visible = loader === 'tarak';
    }
  };
  showLoader();

  return {
    update,
    setDefaultSlat(t) {
      defaultSlat = t;
      if (lastS) {
        const S = lastS;
        lastT = Number.NaN;
        update(S);
      }
    },
    labelTexts: () => texts,
    setNose(k) {
      nose = k;
      if (lastS) {
        const S = lastS;
        lastT = Number.NaN;
        update(S);
      }
      return landing();
    },
    landing,
    setLoader(k) {
      loader = k;
      showLoader();
      if (lastS) {
        const S = lastS;
        lastT = Number.NaN;
        update(S);
      }
    },
    pickables: [inst, fx],
    prepPick() {
      inst.computeBoundingSphere();
    },
  };
}
