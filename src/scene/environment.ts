// Zemin (1 m ızgaralı beton), kaldırıcı çukuru, ışıklar ve ölçek için 1,75 m'lik insan.

import * as THREE from 'three';
import { Parts } from './parts';
import { M } from './materials';
import type { LabelSpec } from './labels';
import type { PlanLayout } from '../sim/geometry';
import { PIT_DEPTH, RANZA, RANZA_AKIS, Z, tr0 } from '../sim/dims';

export interface Environment {
  group: THREE.Group;
  setColors(floor: string, grid: string): void;
}

export function buildEnvironment(lay: PlanLayout, labels: LabelSpec[]): Environment {
  const group = new THREE.Group();
  group.name = 'Zemin';

  // Kaldırıcı çukuru: iki istasyonun kolonları ve platformları burada. Kaldırma 0'da platform zeminle aynı hizada.
  const pitX0 = lay.RK0 - RANZA_AKIS.cukurOn;
  const pitX1 = lay.RK0 + RANZA.derinlikX + RANZA_AKIS.cukurArka;
  const pitY = lay.sideCenterY(0) + RANZA_AKIS.cukurDis;
  const pitDepth = PIT_DEPTH;

  const shape = new THREE.Shape();
  const fx0 = -520, fx1 = 1760, fy = 540;
  shape.moveTo(fx0, -fy).lineTo(fx1, -fy).lineTo(fx1, fy).lineTo(fx0, fy).closePath();
  const hole = new THREE.Path();
  hole.moveTo(pitX0, -pitY).lineTo(pitX0, pitY).lineTo(pitX1, pitY).lineTo(pitX1, -pitY).closePath();
  shape.holes.push(hole);
  const floorGeo = new THREE.ShapeGeometry(shape);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.01, 0.01); // 1 doku = 100 cm
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.userData.info = { title: 'Zemin', detail: 'Izgara 1 m × 1 m. Sahnede 1 birim = 1 cm.' };
  group.add(floor);

  const pit = new THREE.Mesh(new THREE.BoxGeometry(pitX1 - pitX0, 2 * pitY, pitDepth), M.pit);
  pit.position.set((pitX0 + pitX1) / 2, 0, -pitDepth / 2);
  pit.receiveShadow = true;
  pit.userData.info = { title: 'Kaldırıcı çukuru', detail: `Derinlik ${pitDepth} cm. Hat 1 m'de olduğu için ranza son katlarda çukura iner; değişim zeminde yapılır. Kenar korkuluğu ve su tahliyesi (pis su çukuru) gerekecek.` };
  group.add(pit);

  // Ölçek: 1,75 m
  const h = new Parts({ title: 'Ölçek: 1,75 m', detail: `Boyut karşılaştırması için. Bant yüzeyi zeminden ${tr0(Z.hat)} cm.` });
  const hx = (lay.X_CUT + lay.X_BELT) / 2 - 12;
  const hy = -118;
  const body = new THREE.CapsuleGeometry(15, 112, 6, 14);
  body.rotateX(Math.PI / 2);
  body.translate(hx, hy, 71);
  h.add(M.human, body);
  const head = new THREE.SphereGeometry(10.5, 16, 12);
  head.translate(hx, hy, 164.5);
  h.add(M.skin, head);
  group.add(h.build());
  labels.push({ text: '1,75 m', pos: [hx, hy, 190] });

  const setColors = (floorCol: string, gridCol: string) => {
    const g = canvas.getContext('2d');
    if (!g) return;
    g.fillStyle = floorCol;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = gridCol;
    g.fillRect(0, 0, 256, 2);
    g.fillRect(0, 0, 2, 256);
    g.globalAlpha = 0.35;
    g.fillRect(0, 127, 256, 1);
    g.fillRect(127, 0, 1, 256);
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  setColors('#bdb7ab', '#a29b8e');

  return { group, setColors };
}

export function addLights(scene: THREE.Scene, center: THREE.Vector3): THREE.DirectionalLight {
  const hemi = new THREE.HemisphereLight(0xf4f2ec, 0x7a7469, 1.5);
  hemi.position.set(0, 0, 1);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.copy(center).add(new THREE.Vector3(-380, -520, 900));
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -760;
  cam.right = 760;
  cam.top = 520;
  cam.bottom = -520;
  cam.near = 50;
  cam.far = 3000;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  return sun;
}
