// Parça oluşturucu: kutu, silindir, çubuk ekler; build() aynı malzemeli her şeyi tek mesh'te birleştirir.
// Böylece yüzlerce parça telefonda da az sayıda çizim çağrısıyla çizilir.
// Tüm ölçüler dünya koordinatında, cm. Kutular sınır değerleriyle verilir (x0, x1, y0, y1, z0, z1).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface PartInfo {
  title: string;
  detail?: string;
}

export type Axis = 'x' | 'y' | 'z';
export type V3 = [number, number, number];

const X_AXIS = new THREE.Vector3(1, 0, 0);

export class Parts {
  private byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();

  constructor(readonly info?: PartInfo) {}

  add(mat: THREE.Material, g: THREE.BufferGeometry): this {
    let geo = g;
    if (g.index) {
      geo = g.toNonIndexed();
      g.dispose();
    }
    geo.clearGroups();
    let arr = this.byMat.get(mat);
    if (!arr) this.byMat.set(mat, (arr = []));
    arr.push(geo);
    return this;
  }

  box(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): this {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    const g = new THREE.BoxGeometry(Math.max(bx - ax, 0.01), Math.max(by - ay, 0.01), Math.max(bz - az, 0.01));
    g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    return this.add(mat, g);
  }

  /** Eksene paralel silindir; (cx, cy, cz) merkez. rTop verilirse konik (eksenin + ucu). */
  cyl(mat: THREE.Material, axis: Axis, cx: number, cy: number, cz: number, r: number, len: number, seg = 16, rTop = r): this {
    const g = new THREE.CylinderGeometry(rTop, r, len, seg);
    if (axis === 'x') g.rotateZ(-Math.PI / 2);
    else if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(cx, cy, cz);
    return this.add(mat, g);
  }

  /** İki nokta arasında kare kesitli çubuk (çapraz destek, kol vb.). */
  strut(mat: THREE.Material, a: V3, b: V3, w: number, h = w): this {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const d = B.clone().sub(A);
    const len = d.length();
    const g = new THREE.BoxGeometry(len, w, h);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(X_AXIS, d.normalize()));
    const m = A.add(B).multiplyScalar(0.5);
    g.translate(m.x, m.y, m.z);
    return this.add(mat, g);
  }

  /** X'te [x0, x1] genişliğinde, YZ düzleminde (y0, z0)'dan (y1, z1)'e eğik levha (oluk, kanal). */
  slopeYZ(mat: THREE.Material, x0: number, x1: number, y0: number, z0: number, y1: number, z1: number, t: number): this {
    const len = Math.hypot(y1 - y0, z1 - z0);
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), len, t);
    g.rotateX(Math.atan2(z1 - z0, y1 - y0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mat, g);
  }

  /** Y'de [y0, y1] genişliğinde, XZ düzleminde (x0, z0)'dan (x1, z1)'e eğik levha (plaka burnu). */
  slopeXZ(mat: THREE.Material, y0: number, y1: number, x0: number, z0: number, x1: number, z1: number, t: number): this {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(len, Math.abs(y1 - y0), t);
    g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mat, g);
  }

  /** Bant modülü: üstü zTop'ta, iki ucunda r yarıçaplı tambur, X boyunca. */
  belt(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, zTop: number, r: number, seg = 14): this {
    const cy = (y0 + y1) / 2, w = Math.abs(y1 - y0);
    this.box(mat, x0 + r, x1 - r, y0, y1, zTop - 2 * r, zTop);
    this.cyl(mat, 'y', x0 + r, cy, zTop - r, r, w, seg);
    this.cyl(mat, 'y', x1 - r, cy, zTop - r, r, w, seg);
    return this;
  }

  /** Bant modülü, Y boyunca (enine bantlar). */
  beltY(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, zTop: number, r: number, seg = 10): this {
    const cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    this.box(mat, x0, x1, ay + r, by - r, zTop - 2 * r, zTop);
    this.cyl(mat, 'x', cx, ay + r, zTop - r, r, w, seg);
    this.cyl(mat, 'x', cx, by - r, zTop - r, r, w, seg);
    return this;
  }

  get empty(): boolean {
    return this.byMat.size === 0;
  }

  build(name?: string): THREE.Group {
    const grp = new THREE.Group();
    grp.name = name ?? this.info?.title ?? '';
    for (const [mat, geos] of this.byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) throw new Error(`Geometri birleştirilemedi: ${grp.name}`);
      if (merged !== geos[0]) geos.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      const transparent = (mat as THREE.Material).transparent;
      mesh.castShadow = !transparent;
      mesh.receiveShadow = !transparent;
      grp.add(mesh);
    }
    if (this.info) grp.userData.info = this.info;
    this.byMat.clear();
    return grp;
  }
}

/** Sayıyı Türkçe ondalıkla yaz (13.5 → "13,5"). */
export const tr = (v: number, digits = 1): string => {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(digits).replace(/\.?0+$/, '');
  return s.replace('.', ',');
};
