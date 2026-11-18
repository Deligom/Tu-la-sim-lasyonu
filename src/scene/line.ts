// Kalıptan ön hazırlığa kadar: vakumlu pres + kalıp, kesici tablası ve çoklu tel kesici, hızlandırma,
// bölgeli birikme, dozaj (şerit başına ayrı bant parçaları), uç sensörleri, artık iticiler, dönüş
// bantları ve şerit kapakları. X konumları geometry.ts'den, yükseklikler dims.ts'den.

import * as THREE from 'three';
import { Parts, tr } from './parts';
import { M } from './materials';
import type { LabelSpec } from './labels';
import type { PlanLayout, ZoneKind } from '../sim/geometry';
import type { Params } from '../sim/params';
import { TUGLA, Z } from '../sim/dims';

/** Şerit bantlarının tambur yarıçapı (Ø6) ve yarı genişliği (14 cm bant). */
const BELT_R = 3;
const BELT_HALF = 7;

export interface LineHandles {
  /** Tel demeti (kesimde aşağı iner) */
  harp: THREE.Group;
  /** Şerit kapağı bıçakları (kapanınca 21 cm aşağı iner) */
  gates: THREE.Group[];
  /** Artık itici kolları: [Ş1 (−Y'ye iter), Ş3 (+Y'ye iter)] */
  pushers: THREE.Group[];
}

export function buildPress(lay: PlanLayout, labels: LabelSpec[]): THREE.Group {
  const zr = Z.hat;
  const H = TUGLA.yukseklik;
  const zc = zr + H / 2;
  const p = new Parts({
    title: 'Vakumlu pres + kalıp',
    detail: `3 sütun yan yana, kesintisiz basıyor. Kalıp ağzı ${tr(TUGLA.en)} × ${H} cm, şerit aralığı ${tr(lay.PITCH)} cm. ` +
      'Orta çıkış kalıpta bilerek %2–3 frenleniyor, artık hep kenar şeritlerde oluşuyor. (Pres gövdesi şematik.)',
  });
  // kalıp kafası ve ağızlar
  p.box(M.die, -30, 0, -36, 36, zc - 24, zc + 24);
  for (let i = 0; i < 3; i++) {
    const y = lay.laneCenterY(i);
    p.box(M.dark, -0.4, 0.12, y - TUGLA.en / 2, y + TUGLA.en / 2, zr, zr + H);
  }
  // flanş ve cıvatalar
  p.box(M.dieRed, -36, -30, -42, 42, zc - 30, zc + 30);
  for (const y of [-38, 38]) for (const dz of [-24, -8, 8, 24]) p.cyl(M.steel, 'x', -29, y, zc + dz, 2, 3, 6);
  for (const z of [zc - 27, zc + 27]) for (const y of [-26, -9, 9, 26]) p.cyl(M.steel, 'x', -29, y, z, 2, 3, 6);
  // helezon gövdesi, vakum odası, besleme ağzı, redüktör, motor, kaide
  p.cyl(M.die, 'x', -111, 0, zc, 28, 150, 28);
  p.cyl(M.dieRed, 'x', -189, 0, zc, 33, 6, 28);
  p.box(M.die, -262, -192, -46, 46, zc - 32, zc + 64);
  p.box(M.die, -252, -202, -36, 36, zc + 64, zc + 100);
  p.box(M.dieRed, -332, -262, -40, 40, zc - 30, zc + 30);
  p.cyl(M.motor, 'x', -362, 0, zc, 19, 60, 20);
  p.box(M.frame, -392, -28, -48, 48, 0, zc - 32);
  labels.push({ text: 'Vakumlu pres + kalıp', pos: [-150, 0, zc + 120] });
  return p.build();
}

export function buildCutter(lay: PlanLayout, labels: LabelSpec[]): { group: THREE.Group; harp: THREE.Group } {
  const zr = Z.hat;
  const L = lay.L;
  const N = Math.round((lay.X_BELT - lay.X_CUT) / L);
  const group = new THREE.Group();

  const table = new Parts({
    title: 'Kesici tablası',
    detail: `${lay.X_BELT - lay.X_CUT} cm = ${N} tuğla × ${L} cm. Makara Ø5; her tuğla boyunda 2 makara, teller makara aralarından geçer. ` +
      `Kalıp ile kesici arasında ${lay.X_CUT} cm çıkış masası. Kesimden sonra tuğlalar sütun hızıyla itilir.`,
  });
  const rx = [5, 15, 25];
  for (let k = 0; k < N; k++) rx.push(lay.X_CUT + k * L + L / 4, lay.X_CUT + k * L + (3 * L) / 4);
  rx.forEach((x, i) => {
    table.cyl(i % 5 === 3 ? M.rollerGreen : M.rollerBlue, 'y', x, 0, zr - 2.5, 2.5, 54, 16);
    table.cyl(M.steel, 'y', x, 0, zr - 2.5, 0.7, 57.4, 8);
  });
  const legsX = [3, (lay.X_CUT + lay.X_BELT) / 2 - 14, lay.X_BELT - 4];
  for (const s of [-1, 1]) {
    table.box(M.frame, 0, lay.X_BELT, s * 27, s * 28.6, zr - 10, zr - 1.2);
    table.box(M.frame, 0, lay.X_BELT, s * 26, s * 29, zr - 14, zr - 10);
    table.box(M.frame, legsX[0], legsX[2], s * 26.5, s * 28.5, 18, 22);
    for (const x of legsX) table.box(M.frame, x - 2.5, x + 2.5, s * 25.5, s * 29.5, 0, zr - 14);
  }
  for (const x of legsX) table.box(M.frame, x - 1.5, x + 1.5, -26, 26, 18, 21);
  group.add(table.build());

  // Sabit portal + aşağı inen tel demeti
  const xm = (lay.X_CUT + lay.X_BELT) / 2;
  const portal = new Parts({
    title: 'Çoklu tel kesici',
    detail: `${N + 1} tel: 1 ayırma + ${N} tuğla. 3 sütunu birlikte, yukarıdan aşağı keser. ` +
      `En yavaş sütun ${N * L} cm'ye ulaşınca keser; hızlı sütunlardaki fazla boy artık olur. Bir kesim = ${3 * N} tuğla = 1 ranza katı.`,
  });
  for (const s of [-1, 1]) portal.box(M.orange, xm - 6, xm + 6, s * 46, s * 50, 0, zr + 96);
  portal.box(M.orange, xm - 6, xm + 6, -50, 50, zr + 90, zr + 96);
  portal.cyl(M.hyd, 'z', xm, 0, zr + 112, 5, 32, 16);
  group.add(portal.build());

  const h = new Parts(portal.info);
  for (const s of [-1, 1]) {
    h.box(M.orange, lay.X_CUT - 3, lay.X_BELT + 3, s * 40, s * 43, zr + 23, zr + 27);
    h.box(M.orange, xm - 1.5, xm + 1.5, s * 40.5, s * 42.5, zr + 27, zr + 60);
  }
  h.box(M.orange, xm - 4, xm + 4, -43, 43, zr + 60, zr + 63);
  h.cyl(M.chrome, 'z', xm, 0, zr + 76.5, 1.5, 27, 10);
  for (let k = 0; k <= N; k++) h.cyl(M.steelDark, 'y', lay.X_CUT + k * L, 0, zr + 24, 0.15, 80, 4);
  const harp = h.build('Tel demeti');
  group.add(harp);

  labels.push({ text: `Kesici (${N}'li)`, pos: [xm, 0, zr + 140] });
  return { group, harp };
}

export function buildConveyors(lay: PlanLayout, p: Readonly<Params>, labels: LabelSpec[]): THREE.Group {
  const zr = Z.hat;
  const group = new THREE.Group();
  const nA = lay.zones.filter((z) => z.k === 'A').length;
  const ZL = lay.zones[1]?.e - lay.zones[1]?.s;
  const beltMat: Record<ZoneKind, THREE.Material> = { R: M.beltR, A: M.beltA, D: M.beltD };
  const parts: Record<ZoneKind, Parts> = {
    R: new Parts({
      title: 'Hızlandırma bölgesi',
      detail: `${lay.R_END - lay.X_BELT} cm, ${p.vb} cm/s, hiç durmaz: kesiciden itilen tuğlayı karşılar, sütundan ayırır. Şerit başına ayrı bant.`,
    }),
    A: new Parts({
      title: 'Bölgeli birikme (sıfır basınçlı)',
      detail: `Şerit başına ${nA} bölge × ${ZL} cm, ${p.va} cm/s, her bölge ayrı tahrikli. ` +
        'Önündeki bölge doluysa bölge, tuğlası uç sensörüne gelince durur: tuğlalar birbirine değmez.',
    }),
    D: new Parts({
      title: 'Dozaj bölgesi',
      detail: `${ZL} cm. Tuğlayı uçta bekletir, ön hazırlık servosuyla senkron bırakır. Önceki tuğla çekilirken sıradaki dozaja ilerleyebilir.`,
    }),
  };
  for (const zn of lay.zones) {
    const pp = parts[zn.k];
    for (let i = 0; i < 3; i++) {
      const y = lay.laneCenterY(i);
      pp.belt(beltMat[zn.k], zn.s + 0.5, zn.e - 0.5, y - BELT_HALF, y + BELT_HALF, zr, BELT_R, 16);
      pp.box(M.motor, zn.e - 10.5, zn.e - 2.5, y - 4, y + 4, zr - 14, zr - 6.5);
    }
  }
  for (const k of ['R', 'A', 'D'] as ZoneKind[]) group.add(parts[k].build());

  const frame = new Parts({ title: 'Bant hattı şasesi', detail: 'Üç şerit ortak şasede; bant parçaları şerit ve bölge başına ayrı.' });
  const x0 = lay.X_BELT, x1 = lay.GATE;
  const legs = [x0 + 4, (x0 + x1) / 2, x1 - 4];
  for (const s of [-1, 1]) {
    frame.box(M.frame, x0, x1, s * 25, s * 28, zr - 10, zr - 4);
    frame.box(M.frame, legs[0], legs[2], s * 25.5, s * 27.5, 15, 19);
    for (const x of legs) frame.box(M.frame, x - 2.5, x + 2.5, s * 25, s * 28, 0, zr - 10);
  }
  for (const x of [x0, ...lay.zones.map((z) => z.e)]) frame.box(M.frame, x - 1, x + 1, -25, 25, zr - 12, zr - 10);
  group.add(frame.build());

  // Bölge uç sensörleri (birikme + dozaj) ve ilk birikme bölgesinde "kuyruk dolu" sensörü
  const sens = new Parts({
    title: 'Bölge uç sensörü',
    detail: 'Her birikme ve dozaj bölgesinin ucunda, şerit başına bir tane. Önündeki bölge doluysa bölge, tuğla bu sensöre gelince durur.',
  });
  const bridge = (pp: Parts, x: number, lens: THREE.Material) => {
    for (const s of [-1, 1]) pp.box(M.sensor, x - 1, x + 1, s * 25.6, s * 27.4, zr - 4, zr + 27);
    pp.box(M.sensor, x - 1, x + 1, -27.4, 27.4, zr + 25, zr + 27);
    for (let i = 0; i < 3; i++) {
      const y = lay.laneCenterY(i);
      pp.box(M.sensor, x - 1.5, x + 1.5, y - 1.5, y + 1.5, zr + 22, zr + 25);
      pp.box(lens, x - 0.8, x + 0.8, y - 0.8, y + 0.8, zr + 21.6, zr + 22);
    }
  };
  for (const zn of lay.zones) if (zn.k !== 'R') bridge(sens, zn.e - 1.5, M.lens);
  group.add(sens.build());
  const first = lay.zones.find((z) => z.k === 'A');
  if (first) {
    const q = new Parts({
      title: '"Kuyruk dolu" sensörü',
      detail: 'İlk birikme bölgesinde. Kuyruk buraya kadar uzanırsa PLC presi otomatik durdurur.',
    });
    bridge(q, (first.s + first.e) / 2, M.amber);
    group.add(q.build());
  }

  labels.push({ text: 'Hızlandırma', pos: [(lay.X_BELT + lay.R_END) / 2 + 8, 0, zr + 52] });
  labels.push({ text: `Birikme ${nA} × ${ZL}`, pos: [(lay.R_END + lay.GATE - ZL) / 2, 0, zr + 52] });
  return group;
}

export function buildScrap(lay: PlanLayout, labels: LabelSpec[]): { group: THREE.Group; pushers: THREE.Group[] } {
  const zr = Z.hat;
  const group = new THREE.Group();
  const xp = lay.X_BELT + 12;
  const info = {
    title: 'Yandan artık iticiler',
    detail: `Hızlandırma başından +12 cm (X = ${xp}), artığın iki komşusundan ayrıldığı yerde. Ş1 artığı −Y'ye, Ş3 artığı +Y'ye pnömatik itilir; ` +
      'kollar beklerken şerit aralarında durur. Ortada artık oluşursa uyarı verilir (kalıp ayarı bozulmuş demek). İtici düzeni şematik.',
  };
  const fix = new Parts(info);
  for (const s of [-1, 1]) fix.box(M.frameDark, xp - 8, xp - 6, s * 25.6, s * 27.4, zr - 4, zr + 42);
  fix.box(M.frameDark, xp - 8, xp - 6, -27.4, 27.4, zr + 40, zr + 43);
  fix.box(M.frameDark, xp - 6, xp - 2.2, -11, 11, zr + 29, zr + 40);
  fix.cyl(M.pneu, 'y', xp, 2, zr + 31, 2, 20, 12); // Ş1 itici gövdesi (kolu −Y'ye uzar)
  fix.cyl(M.pneu, 'y', xp, -2, zr + 36, 2, 20, 12); // Ş3 itici gövdesi (kolu +Y'ye uzar)
  // oluklar
  for (const s of [-1, 1]) {
    fix.slopeYZ(M.steel, xp - 7, xp + 7, s * 24, zr - 0.8, s * 56, zr - 24, 0.4);
    for (const dx of [-7, 7]) fix.slopeYZ(M.steel, xp + dx - 0.2, xp + dx + 0.2, s * 24, zr + 2, s * 56, zr - 21, 6);
  }
  group.add(fix.build());

  const pushers: THREE.Group[] = [];
  for (const [y, zTop] of [[-(lay.PITCH / 2), zr + 31], [lay.PITCH / 2, zr + 36]] as const) {
    const k = new Parts(info);
    k.box(M.steel, xp - 4, xp + 4, y - 0.5, y + 0.5, zr + 1, zr + 27);
    k.box(M.steel, xp - 1, xp + 1, y - 0.75, y + 0.75, zr + 27, zTop);
    const g = k.build(y < 0 ? 'Ş1 artık itici kolu' : 'Ş3 artık itici kolu');
    pushers.push(g);
    group.add(g);
  }

  const ret = new Parts({ title: 'Yan dönüş bandı', detail: 'Yandan itilen artığı karıştırıcıya geri götürür.' });
  const rx0 = -20, rx1 = xp + 12;
  for (const s of [-1, 1]) {
    ret.belt(M.beltR, rx0, rx1, s * 52, s * 66, zr - 26, 2.5);
    ret.box(M.frame, rx0, rx1, s * 51, s * 52, zr - 33, zr - 27);
    ret.box(M.frame, rx0, rx1, s * 66, s * 67, zr - 33, zr - 27);
    for (const x of [rx0 + 8, 90, rx1 - 6]) ret.box(M.frame, x - 2, x + 2, s * 57, s * 61, 0, zr - 33);
  }
  group.add(ret.build());

  labels.push({ text: 'Artık itici', pos: [xp, -44, zr + 46] });
  labels.push({ text: 'Dönüş bandı', pos: [40, -59, zr - 12] });
  return { group, pushers };
}

export function buildGates(lay: PlanLayout, p: Readonly<Params>, labels: LabelSpec[]): { group: THREE.Group; gates: THREE.Group[] } {
  const zr = Z.hat;
  const group = new THREE.Group();
  const xg = lay.G2;
  const info = {
    title: 'Şerit kapakları + ışık bariyeri',
    detail: `Kapak çizgisi X = ${xg}. Pnömatik, ${tr(p.gateT)} s. Kamera o şeritte 4 tuğla sayınca dozaj durur ve kapak iner. ` +
      'Kapak çizgisindeki ışık bariyeri altında tuğla görürse kapak kapanmaz.',
  };
  const fx = new Parts(info);
  const px0 = xg - 10, px1 = xg - 6;
  for (const s of [-1, 1]) fx.box(M.frameDark, px0, px1, s * 29, s * 32, 0, zr + 64);
  fx.box(M.frameDark, px0, px1, -32, 32, zr + 60, zr + 64);
  for (let i = 0; i < 3; i++) {
    const y = lay.laneCenterY(i);
    fx.box(M.frameDark, px1, xg + 2.5, y - 2, y + 2, zr + 58, zr + 60);
    fx.cyl(M.pneu, 'z', xg, y, zr + 50, 2.2, 16, 12);
  }
  for (const s of [-1, 1]) {
    fx.box(M.sensor, xg - 0.6, xg + 0.6, s * 26, s * 28.5, zr + 1.5, zr + 5.5);
    fx.box(M.frameDark, px1, xg - 0.6, s * 27, s * 28.5, zr + 1.5, zr + 3);
  }
  fx.box(M.beam, xg - 0.1, xg + 0.1, -26, 26, zr + 3.4, zr + 3.6);
  group.add(fx.build());

  const gates: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const y = lay.laneCenterY(i);
    const b = new Parts(info);
    b.box(M.steel, xg - 0.4, xg + 0.4, y - BELT_HALF, y + BELT_HALF, zr + 21.5, zr + 41.5);
    b.cyl(M.chrome, 'z', xg, y, zr + 41.5 + 11, 0.7, 22, 8);
    const g = b.build(`Ş${i + 1} kapağı`);
    gates.push(g);
    group.add(g);
  }
  labels.push({ text: 'Dozaj + kapaklar', pos: [xg - 22, 0, zr + 96] });
  return { group, gates };
}
