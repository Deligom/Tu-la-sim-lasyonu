// Ranza akışı (2026-11-18): boş ranzalar hattın iki yanındaki zemin konveyöründe pres tarafından tuğlayla aynı
// yönde (+X) gelir, istasyonda yandan içe kaldırıcıya kayar; dolu ranza düz ileri (+X) çıkış konveyörüne gider.
// Konveyörler zemine gömülü (üstü Z = 0), AGV zincirlerin arasından ranzanın altına girer.

import * as THREE from 'three';
import { Parts } from './parts';
import { M } from './materials';
import type { LabelSpec } from './labels';
import { buildRack, type RackMats, type RackModel } from './rack';
import type { PlanLayout, Side } from '../sim/geometry';
import { RANZA, RANZA_AKIS } from '../sim/dims';

export interface RackFlowModel {
  group: THREE.Group;
  /** Girişte bekleyen boş ranzalar (Aşama 3'te konveyörle ilerleyecek) */
  waiting: RackModel[];
}

/** Zemine boyalı ok: (x, y) ucu, `dir` yönünde, uzunluk len, genişlik w. */
function arrow(len: number, w: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const hl = Math.min(len * 0.45, w * 1.6);
  s.moveTo(0, 0);
  s.lineTo(-hl, w);
  s.lineTo(-hl, w * 0.38);
  s.lineTo(-len, w * 0.38);
  s.lineTo(-len, -w * 0.38);
  s.lineTo(-hl, -w * 0.38);
  s.lineTo(-hl, -w);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

function paintArrow(p: Parts, mat: THREE.Material, x: number, y: number, angle: number, len = 60, w = 14) {
  const g = arrow(len, w);
  g.rotateZ(angle);
  g.translate(x, y, 0.12);
  p.add(mat, g);
}

/** Zemine gömülü iki zincir kolu (ranza ayaklarının altında), X boyunca. */
function chainLaneX(p: Parts, x0: number, x1: number, yc: number) {
  const half = RANZA.boyY / 2 - 2;
  for (const v of [-1, 1]) {
    const y = yc + v * half;
    p.box(M.dark, x0, x1, y - 3, y + 3, -0.2, 0.05);
    p.box(M.chain, x0, x1, y - 1.2, y + 1.2, 0.05, 0.9);
    for (const x of [x0 + 3, x1 - 3]) p.cyl(M.steelDark, 'y', x, y, -1, 3, 2.6, 14);
  }
}

/** Y boyunca iki zincir kolu (yandan içe aktarma), ranzanın ön ve arka ayaklarının altında. */
function chainLaneY(p: Parts, xFront: number, y0: number, y1: number) {
  for (const x of [xFront + 4, xFront + RANZA.derinlikX - 4]) {
    p.box(M.dark, x - 3, x + 3, y0, y1, -0.2, 0.06);
    p.box(M.chain, x - 1.2, x + 1.2, y0, y1, 0.06, 1.0);
  }
}

export function buildRackFlow(lay: PlanLayout, side: Side, labels: LabelSpec[], waitingMats: RackMats): RackFlowModel {
  const name = side === 0 ? 'A' : 'B';
  const c = lay.sideCenterY(side);
  const sy = side === 0 ? 1 : -1;
  const yIn = c + sy * RANZA_AKIS.girisY;
  const D = RANZA.derinlikX;
  const rx0 = lay.RK0;
  const pitX1 = lay.RK0 + D + RANZA_AKIS.cukurArka;
  const step = RANZA_AKIS.adim;
  const group = new THREE.Group();
  group.name = `${name} ranza akışı`;

  // Giriş konveyörü: kalıp hizasından aktarma yerine kadar (+X), sonda yandan içe aktarma
  const inP = new Parts({
    title: `${name} boş ranza girişi`,
    detail:
      'Boş ranzalar pres (kalıp) hizasından, hattın yanındaki zemin konveyöründe tuğlayla aynı yönde gelir. ' +
      `En öndeki yer aktarma yeri: ranza buradan yandan içe, kaldırıcıya kayar (kaldırıcı zemin hizasındayken). ` +
      `Girişte ${RANZA_AKIS.girisTampon} boş ranza bekler. Zincirler zemine gömülü, AGV aralarından ranzanın altına girer.`,
  });
  const xStart = 0;
  chainLaneX(inP, xStart, rx0 + D, yIn);
  chainLaneY(inP, rx0, yIn - RANZA.boyY / 2, yIn + RANZA.boyY / 2);
  inP.box(M.motor, xStart - 18, xStart - 4, yIn - 8, yIn + 8, 0, 12);
  // yer işaretleri: aktarma + bekleme yerleri
  for (let k = 0; k <= RANZA_AKIS.girisTampon; k++) {
    const x0 = rx0 - k * step;
    for (const x of [x0 - 2, x0 + D + 2]) inP.box(M.paintYellow, x - 0.8, x + 0.8, yIn - 62, yIn + 62, 0.08, 0.14);
  }
  for (let x = 160; x < rx0 - RANZA_AKIS.girisTampon * step; x += 160) paintArrow(inP, M.paintYellow, x, yIn, 0);
  paintArrow(inP, M.paintYellow, rx0 + D / 2, c + sy * (RANZA_AKIS.zincirDis + 4), sy > 0 ? -Math.PI / 2 : Math.PI / 2, 40, 12);
  group.add(inP.build());

  // Çıkış konveyörü: çukurun arka kenarından düz ileri
  const outP = new Parts({
    title: `${name} dolu ranza çıkışı`,
    detail: `Dolu ranza kaldırıcı zemin hizasına kalkınca düz ileri (+X) çıkar. ${RANZA_AKIS.cikisTampon} dolu ranza yeri; AGV sondan alır.`,
  });
  const ox0 = pitX1 + 0.5;
  const ox1 = ox0 + RANZA_AKIS.cikisTampon * step + 10;
  chainLaneX(outP, ox0, ox1, c);
  outP.box(M.motor, ox1 + 4, ox1 + 18, c - 8, c + 8, 0, 12);
  for (let k = 0; k <= RANZA_AKIS.cikisTampon; k++) {
    const x = ox0 + 8 + k * step - 10;
    outP.box(M.paintGreen, x - 0.8, x + 0.8, c - 62, c + 62, 0.08, 0.14);
  }
  for (let k = 0; k < RANZA_AKIS.cikisTampon; k++) paintArrow(outP, M.paintGreen, ox0 + 8 + k * step + 75, c, 0, 50, 12);
  group.add(outP.build());

  // Girişte bekleyen boş ranzalar (aktarma yerinin hemen arkasındaki bekleme yerleri)
  const waiting: RackModel[] = [];
  for (let k = 1; k <= RANZA_AKIS.girisTampon; k++) {
    const r = buildRack(`${name} (boş, girişte)`, waitingMats);
    r.group.position.set(rx0 - k * step, yIn - RANZA.boyY / 2, 0);
    waiting.push(r);
    group.add(r.group);
  }

  labels.push({ text: `Boş ranza girişi ${name} →`, pos: [70, yIn, 30] });
  labels.push({ text: `Dolu ranza çıkışı ${name}`, pos: [(ox0 + ox1) / 2, c, 30] });
  return { group, waiting };
}
