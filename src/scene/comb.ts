// Tarak tutucu modeli (cm), ana sahne ve yükleme detayı ortak. Yerel çerçeve: diş alt ucu z = 0, x ranza / istasyon
// çerçevesinde. Arka kiriş dişlerin arkasında (ranzanın dışında kalır). Her diş iki U profil; araya şişen yastık
// (yassı hortum) U'ları dışa açar, kauçuk pedler tuğlanın yan yüzüne bastırır. Dış dişler tek yanlı.

import * as THREE from 'three';
import { Parts, type PartInfo } from './parts';
import { M } from './materials';

export interface CombSpec {
  teeth: { y: number; padNeg: boolean; padPos: boolean }[];
  /** Diş boyu (x) */
  x0: number;
  x1: number;
  /** Sönük dişin yarı kalınlığı ve diş yüksekliği */
  ht: number;
  H: number;
  /** Sıra başına ped x aralıkları ve ped z aralığı (diş altına göre) */
  padX: [number, number][];
  padZ0: number;
  padZ1: number;
  info: PartInfo;
}

export interface CombModel {
  group: THREE.Group;
  /** Yastık şişme oranı 0..1: çeneler dışa açılır (tam şişince ~5,5 mm) */
  setInfl(k: number): void;
}

const bladderMat = new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.6 });
const padMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.95 });

export function buildCombModel(spec: CombSpec): CombModel {
  const { teeth, x0, x1, ht, H, padX, padZ0, padZ1, info } = spec;
  const group = new THREE.Group();
  group.name = info.title;
  const wall = 0.4, padT = 0.3;
  const yMin = Math.min(...teeth.map((t) => t.y)), yMax = Math.max(...teeth.map((t) => t.y));
  const jaws: { g: THREE.Group; dir: number }[] = [];
  const bladders: THREE.Mesh[] = [];
  const fixed = new Parts(info);
  // arka kiriş
  fixed.box(M.steel, x0 - 7, x0 - 0.5, yMin - 2, yMax + 2, 1, H);
  for (const t of teeth) {
    const y = t.y;
    fixed.box(M.steelDark, x0 - 0.5, x0 + 1, y - ht, y + ht, 0, H);
    if (!t.padNeg) fixed.box(M.steel, x0, x1, y - ht, y - ht + wall, 0, H);
    if (!t.padPos) fixed.box(M.steel, x0, x1, y + ht - wall, y + ht, 0, H);
    // kılavuz pimleri: U'lar yalnızca yana kayar
    for (const gx of [x0 + 12, (x0 + x1) / 2, x1 - 12]) fixed.cyl(M.amber, 'y', gx, y, H - 2, 0.35, 2 * ht - 0.2, 8);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 4, 1, H - 3), bladderMat);
    bl.position.set((x0 + x1) / 2, y, H / 2);
    bl.userData.base = Math.max(0.2, 2 * ht - 2 * wall - 2 * padT);
    bl.scale.y = bl.userData.base;
    bl.userData.info = info;
    group.add(bl);
    bladders.push(bl);
    for (const dir of [-1, 1]) {
      if ((dir < 0 && !t.padNeg) || (dir > 0 && !t.padPos)) continue;
      const jp = new Parts(info);
      const wy = y + dir * (ht - padT - wall / 2);
      jp.box(M.steel, x0 + 1, x1, wy - wall / 2, wy + wall / 2, 0, H);
      jp.box(M.steel, x0 + 1, x1, wy - dir * 0.6 - wall / 2, wy + wall / 2, 0, wall);
      jp.box(M.steel, x0 + 1, x1, wy - dir * 0.6 - wall / 2, wy + wall / 2, H - wall, H);
      for (const [p0, p1] of padX) jp.box(padMat, p0, p1, y + dir * (ht - padT), y + dir * ht, padZ0, padZ1);
      const g = jp.build('Tarak çenesi');
      group.add(g);
      jaws.push({ g, dir });
    }
  }
  group.add(fixed.build(info.title));
  return {
    group,
    setInfl(k) {
      const off = 0.55 * Math.max(0, Math.min(1, k));
      for (const j of jaws) j.g.position.y = j.dir * off;
      for (const bl of bladders) bl.scale.y = bl.userData.base + 2 * off;
    },
  };
}
