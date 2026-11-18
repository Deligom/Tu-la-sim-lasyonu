// Yükleme istasyonu (A: +Y, B: −Y): toplama tablası, tampon bant, yükleyici şasesi + yan raylar,
// fırıncı tipi plaka (kollar, makara çiftleri, bant motoru, lazerler), ranza ve ranza kaldırıcı.
// Hareketli düzenekler ayrı gruplarda; Aşama 3'te konumları simülasyondan sürülecek.

import * as THREE from 'three';
import { Parts, tr } from './parts';
import { M } from './materials';
import type { LabelSpec } from './labels';
import { buildRack, type RackModel } from './rack';
import { popupBandX, tableColumnY, type PlanLayout, type Side } from '../sim/geometry';
import type { Params } from '../sim/params';
import { PLAKA, RANZA, Z, rackLiftFor } from '../sim/dims';

export interface LifterModel {
  platform: THREE.Group;
  setLift(lift: number): void;
  lift: number;
}

export interface StationHandles {
  side: Side;
  /** Boyuna pop-up çerçevesi (kalkınca katı tampona yollar) */
  tablePopup: THREE.Group;
  /** Plaka düzeneği; position.x = strok (0 = bekleme) */
  plate: THREE.Group;
  rack: RackModel;
  lifter: LifterModel;
}

/** Kaldırıcı platformu ve ranzanın Z = 0'daki (en alçak) hali; rods birim boylu, Z'de ölçeklenir. */
const ROD_BASE_Z = -30;
const CROSS_BOTTOM = -12;

export function buildStation(lay: PlanLayout, p: Readonly<Params>, side: Side, labels: LabelSpec[]): { group: THREE.Group; handles: StationHandles } {
  const zr = Z.hat;
  const c = lay.sideCenterY(side);
  const sy = side === 0 ? 1 : -1;
  const out = (v: number) => c + sy * v; // v > 0: dış tarafa doğru
  const name = side === 0 ? 'A' : 'B';
  const group = new THREE.Group();
  group.name = `İstasyon ${name}`;
  const [ya, yb] = lay.band(side);

  // ---------- Toplama tablası ----------
  const tx0 = lay.E - 1;
  const tx1 = lay.ZEND + 1;
  const tbl = new Parts({
    title: `${name} toplama tablası`,
    detail: `6 × 4 = 24 tuğla ≈ 96 × 82 cm. Enine bantlar ön hazırlıktan gelen 3 × 4 bloğu alır: katın ilk bloğu uzak yarıya, ` +
      'ikincisi yakın yarıya. Yarım kalmış tabla önce tamamlanır. Boyuna pop-up dolan katı tampona gönderir. (Çapraz bant düzeni şematik.)',
  });
  const cols = tableColumnY(lay, side);
  const boyY = cols.flatMap((y) => [y - 4, y + 4]).sort((m, n) => m - n);
  const cut = 1.1;
  for (const bx of popupBandX(lay)) {
    let y = ya + 0.5;
    for (const b of [...boyY, yb - 0.5 + cut]) {
      const e = b - cut;
      if (e - y > 0.4) tbl.box(M.beltA, bx - 0.8, bx + 0.8, y, e, Z.tablaEnine - 3, Z.tablaEnine);
      y = b + cut;
    }
    tbl.box(M.popupFrame, bx - 1, bx + 1, ya + 1, yb - 1, zr - 6, zr - 4);
  }
  for (const v of [ya, yb - 3]) tbl.box(M.frame, tx0, tx1, v, v + 3, zr - 13, zr - 9);
  for (const x of [tx0, tx1 - 3]) tbl.box(M.frame, x, x + 3, ya, yb, zr - 13, zr - 9);
  for (const x of [tx0, tx1 - 4]) for (const y of [ya, yb - 4]) tbl.box(M.frame, x, x + 4, y, y + 4, 0, zr - 13);
  for (const v of [-30, 30]) tbl.box(M.frame, tx0, tx1, c + v - 2, c + v + 2, zr - 38, zr - 35);
  for (const x of [tx0, tx1 - 3]) for (const v of [-30, 30]) tbl.box(M.frame, x, x + 3, c + v - 2, c + v + 2, zr - 35, zr - 13);
  const tcylX = [lay.rowBack(2) - 1, lay.rowBack(0) - 1];
  for (const x of tcylX) for (const v of [-30, 30]) tbl.cyl(M.pneu, 'z', x, c + v, zr - 24, 2, 22, 12);
  tbl.box(M.motor, tx0 + 6, tx0 + 16, out(37), out(46), zr - 22, zr - 14);
  tbl.box(M.motor, tx1 - 16, tx1 - 6, out(-37), out(-46), zr - 22, zr - 14);
  tbl.cyl(M.rollerSteel, 'y', lay.ZEND + 2, c, Z.plakaUst - 1, 1, yb - ya - 2, 10);
  group.add(tbl.build());

  const bl = new Parts({ title: `${name} tablası boyuna pop-up`, detail: 'Dolan katı enine bantların 4 mm üstüne kaldırıp tampon banda gönderir.' });
  for (const b of boyY) bl.belt(M.popup, tx0, tx1, b - 0.8, b + 0.8, Z.tablaBoyunaAlt, 1.5, 8);
  const bbot = Z.tablaBoyunaAlt - 3;
  for (const x of [lay.rowBack(2) - 1, lay.rowBack(1) - 1, lay.rowBack(0) - 1]) bl.box(M.popupFrame, x - 1, x + 1, ya + 2, yb - 2, bbot - 2.4, bbot);
  for (const v of [ya + 2, yb - 4]) bl.box(M.popupFrame, tx0 + 3, tx1 - 3, v, v + 2, bbot - 4.4, bbot - 2.4);
  for (const x of tcylX) for (const v of [-30, 30]) bl.cyl(M.chrome, 'z', x, c + v, (zr - 13 + bbot - 4.4) / 2, 0.8, bbot - 4.4 - (zr - 13), 8);
  const tablePopup = bl.build(`${name} boyuna pop-up`);
  group.add(tablePopup);

  // ---------- Tampon ----------
  if (lay.BL > 0) {
    const tp = new Parts({
      title: `${name} tamponu`,
      detail: `${p.Bcap} katlık bölgeli bant, ${lay.BL} cm, ${p.exitSpeed} cm/s. Bant durur, tuğla altından kaymaz. Plakanın üst yüzüyle aynı yükseklikte.`,
    });
    const nb = Math.max(1, p.Bcap);
    const ml = lay.BL / nb;
    for (let k = 0; k < nb; k++) {
      const m0 = lay.BUF0 + k * ml;
      const m1 = k === nb - 1 ? lay.PL0 - 1 : m0 + ml - 0.5;
      tp.belt(M.beltA, m0 + (k ? 0.5 : 0), m1, c - 49, c + 49, Z.tampon, 3, 16);
      for (const v of [-1, 1]) tp.box(M.frame, m0 + 1, k === nb - 1 ? m1 - 8 : m1, c + v * 49.2, c + v * 50.4, Z.tampon - 9.5, Z.tampon - 3);
      for (const x of [m0 + 4, m0 + 33]) {
        tp.box(M.frame, x, x + 3, c - 49.2, c + 49.2, Z.tampon - 12, Z.tampon - 9.5);
        for (const v of [-1, 1]) tp.box(M.frame, x, x + 4, c + v * 45, c + v * 49, 0, Z.tampon - 9.5);
      }
      tp.box(M.motor, m0 + 20, m0 + 32, out(-50.6), out(-61), Z.tampon - 14, Z.tampon - 4);
      tp.box(M.frame, m0 + 23, m0 + 29, out(-49.2), out(-50.6), Z.tampon - 10, Z.tampon - 6);
    }
    group.add(tp.build());
  }

  // ---------- Yükleyici şasesi ve yan raylar ----------
  const railX0 = lay.PL0 - 52;
  const railX1 = lay.RK0 - 2;
  const rz0 = Z.plakaAlt + 0.5;
  const rz1 = Z.plakaAlt + 4.5;
  const ch = new Parts({
    title: `${name} yükleyici şasesi + yan raylar`,
    detail: `Plakanın iki yanında sabit çelik profil ray (X ${railX0}–${railX1}), ranzanın DIŞINDA biter. ` +
      'Plakanın kollarındaki makara çiftleri rayı alttan ve üstten kavrar. Plakanın altında araba yok.',
  });
  const postX = [railX0 + 1, railX1 - 16];
  for (const v of [-1, 1]) {
    const yi = c + v * 52.2, yo = c + v * 55.2;
    ch.box(M.rail, railX0, railX1, yi, yo, rz0, rz1);
    for (const x of postX) ch.box(M.rail, x, x + 4, yi, yo, 0, rz0);
    ch.strut(M.rail, [postX[0] + 2, (yi + yo) / 2, 40], [postX[0] + 40, (yi + yo) / 2, rz0 - 1], 2);
    ch.strut(M.rail, [postX[1] + 2, (yi + yo) / 2, 40], [postX[1] - 36, (yi + yo) / 2, rz0 - 1], 2);
  }
  for (const x of postX) ch.box(M.rail, x, x + 4, c - 55.2, c + 55.2, 0, 6);
  group.add(ch.build());

  // ---------- Fırıncı plakası (hareketli) ----------
  const R0 = lay.PL0;
  const za = Z.plakaAlt;
  const zu = Z.plakaUst;
  const half = PLAKA.en / 2;
  const pl = new Parts({
    title: `${name} fırıncı plakası`,
    detail: `${PLAKA.boy} × ${PLAKA.en} cm, toplam ${PLAKA.kalinlik} cm (${PLAKA.profilAdet} adet 40×20×2 kutu profil + üst/alt bant), uçta ~1,4 mm sehim. ` +
      `Burun makarası Ø${PLAKA.burunCap * 10} mm. Çıtaların ${tr(PLAKA.citaBoslugu * 10)} mm üstünden geçer. Strok ${lay.DX} cm, ${p.vPlate} cm/s; ` +
      'geri çekilirken bant aynı hızda ileri sarar, tuğla zemine göre durup çıtaya iner. ' +
      `Arkadan iki yana ${PLAKA.kolBoy} cm kol, her kolda ${PLAKA.makaraArasi} cm arayla 2 makara çifti (sarı olan eksantrik milli). Bant motoru arkada, altta.`,
  });
  for (let k = 0; k < PLAKA.profilAdet; k++) {
    const y = c - 45 + 10 * k;
    pl.box(M.plate, R0 + 2, R0 + 80, y - 1, y + 1, za + 0.3, zu - 0.6);
  }
  pl.box(M.plate, R0, R0 + 86.5, c - half, c + half, zu - 0.6, zu - 0.3);
  for (const v of [-1, 1]) pl.box(M.plate, R0, R0 + 80, c + v * (half - 0.5), c + v * half, za + 0.3, zu - 0.6);
  pl.box(M.plate, R0 + 80, R0 + 86, c - half, c + half, za + 2.4, zu - 0.6);
  pl.slopeXZ(M.plate, c - half, c + half, R0 + 80, za + 0.55, R0 + 86, za + 2.4, 0.5);
  pl.box(M.plateBelt, R0 + 2.3, R0 + 87, c - 49, c + 49, zu - 0.3, zu);
  pl.box(M.plateBelt, R0 + 2.3, R0 + 80, c - 49, c + 49, za, za + 0.3);
  pl.cyl(M.plateBelt, 'y', R0 + PLAKA.boy - 1, c, zu - 1.15, 1.15, 98, 14);
  pl.cyl(M.steelDark, 'y', R0 + 2.3, c, (za + zu) / 2, 2.2, 98, 16);
  // arka kiriş, bağlantı levhaları, bant motoru (hepsi plakanın arkasında: ranzaya hiç girmez)
  pl.box(M.steel, R0 - 8, R0, c - 51.8, c + 51.8, 140, 148);
  for (const v of [-1, 1]) pl.box(M.steel, R0 - 0.8, R0, c + v * 44, c + v * 49, 148, za + 0.3);
  pl.box(M.motor, R0 - 20, R0 - 8, c - 7, c + 7, 128, 140);
  // kollar ve makara çiftleri
  const fu = rz1 + 1.75;
  const fl = rz0 - 1.75;
  for (const v of [-1, 1]) {
    pl.box(M.arm, R0 - PLAKA.kolBoy, R0, c + v * 50.8, c + v * 51.8, fl - 4.25, fu + 3.25);
    for (const xr of [R0 - 5, R0 - 5 - PLAKA.makaraArasi]) {
      const ecc = xr === R0 - 5 && v === 1;
      pl.cyl(ecc ? M.eccentric : M.follower, 'y', xr, c + v * 53.7, fu, 1.75, 2.6, 14);
      pl.cyl(M.follower, 'y', xr, c + v * 53.7, fl, 1.75, 2.6, 14);
      for (const z of [fu, fl]) pl.cyl(M.steelDark, 'y', xr, c + v * 52.1, z, 0.5, 0.6, 8);
    }
  }
  // plaka ucunda 2 lazer mesafe sensörü
  for (const v of [-1, 1]) {
    pl.box(M.sensor, R0 + 81, R0 + 85, c + v * 36 - 2, c + v * 36 + 2, za + 1.1, za + 2.2);
    pl.box(M.lens, R0 + 82, R0 + 84, c + v * 36 - 1, c + v * 36 + 1, za + 0.9, za + 1.1);
  }
  const plate = pl.build(`${name} plaka düzeneği`);
  group.add(plate);

  // ---------- Ranza ve kaldırıcı ----------
  const rx0 = lay.RK0;
  const rx1 = lay.RK0 + RANZA.derinlikX;
  const pf0 = [rx0 - 12, rx0 - 4];
  const pb0 = [rx1 + 2, rx1 + 10];
  const lfInfo = {
    title: `${name} ranza kaldırıcı`,
    detail: `Hidrolik, ${p.liftSpeed} cm/s. Plaka sabit; kaldırıcı ranzanın sıradaki katını plaka hizasına getirir. ` +
      'En alt kat önce: kaldırma = (4 − dolu kat) × 30 cm, ranza boşken 120 cm. Zincirli konveyör, pnömatik durdurma pimi (sarı), ' +
      'iki yandan senkron kendinden merkezli çene. Kaldırıcı en altta iken platform zeminle aynı hizada (çukurda). Kolon düzeni şematik.',
  };
  const lf = new Parts(lfInfo);
  for (const [a, b] of [pf0, pb0]) for (const v of [-1, 1]) lf.box(M.lifter, a, b, c + v * 64, c + v * 72, -34, 140);
  group.add(lf.build());

  const pf = new Parts(lfInfo);
  for (const v of [-1, 1]) {
    pf.box(M.lifter, pf0[0], pb0[1], c + v * 60.5, c + v * 64, CROSS_BOTTOM, -4);
    for (const [a, b] of [pf0, pb0]) pf.box(M.steelDark, a - 1, b + 1, c + v * 63.5, c + v * 72.6, CROSS_BOTTOM - 1, -3);
  }
  for (const x of [rx0, rx1 - 8]) {
    pf.box(M.lifter, x, x + 8, c - 60.5, c + 60.5, -4, -0.6);
    pf.box(M.chain, x + 2.5, x + 5.5, c - 60.5, c + 60.5, -0.6, 0);
    for (const v of [-1, 1]) pf.cyl(M.chain, 'x', x + 4, c + v * 58.5, -2, 2, 4, 12);
  }
  pf.box(M.motor, rx0 + 2, rx0 + 14, out(64), out(71), -11, -3);
  for (const v of [-1, 1]) {
    pf.box(M.pneu, rx0 - 4, rx0 - 0.3, c + v * 53, c + v * 59, 0, 7);
    pf.box(M.pneu, rx1 + 0.3, rx1 + 4, c + v * 53, c + v * 59, 0, 7);
    pf.cyl(M.pneu, 'x', rx0 - 8, c + v * 56, 3.5, 1.5, 8, 10);
    pf.cyl(M.pneu, 'x', rx1 + 8, c + v * 56, 3.5, 1.5, 8, 10);
  }
  pf.cyl(M.amber, 'z', rx0 + 4, out(-61.8), 2.5, 1, 5, 10);
  const platform = pf.build(`${name} kaldırıcı platformu`);
  group.add(platform);

  const rodGeo = new THREE.CylinderGeometry(2, 2, 1, 14);
  rodGeo.rotateX(Math.PI / 2);
  rodGeo.translate(0, 0, 0.5);
  const rods: THREE.Mesh[] = [];
  for (const x of [(pf0[0] + pf0[1]) / 2, (pb0[0] + pb0[1]) / 2]) {
    for (const v of [-1, 1]) {
      const rod = new THREE.Mesh(rodGeo, M.chrome);
      rod.position.set(x, c + v * 62, ROD_BASE_Z);
      rod.castShadow = true;
      rod.userData.info = lfInfo;
      rods.push(rod);
      group.add(rod);
    }
  }

  const rack = buildRack(name);
  rack.group.position.set(rx0, c - RANZA.boyY / 2, 0);
  group.add(rack.group);

  const lifter: LifterModel = {
    platform,
    lift: 0,
    setLift(l: number) {
      this.lift = l;
      platform.position.z = l;
      rack.group.position.z = l;
      for (const rod of rods) rod.scale.z = Math.max(0.01, l + CROSS_BOTTOM - ROD_BASE_Z);
    },
  };
  lifter.setLift(rackLiftFor(0));

  labels.push({ text: `${name} tablası`, pos: [(tx0 + tx1) / 2, c, zr + 26] });
  if (lay.BL > 0) labels.push({ text: `Tampon ${name}`, pos: [lay.BUF0 + lay.BL / 2 - 10, c, zr + 26] });
  labels.push({ text: `Plaka ${name}`, pos: [R0 + PLAKA.boy / 2, c, zr + 30] });
  labels.push({ text: `Ranza ${name} · ${tr(rackLiftFor(0))} cm kalkık`, pos: [(rx0 + rx1) / 2, c, rackLiftFor(0) + RANZA.cerceveYuk + 26] });

  return { group, handles: { side, tablePopup, plate, rack, lifter } };
}
