// Malzemeler. Renkler fabrika fotoğraflarından: soluk sarı makine şasesi, turuncu kesici, mavi/yeşil
// makaralar, galvaniz-paslı ranza köşebendi, yıpranmış ahşap çıta. Hareketli düzenekler (pop-up, plaka
// kolları) 2D simülasyondaki renklerini koruyor.

import * as THREE from 'three';

const std = (color: number, roughness = 0.7, metalness = 0.1, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const M = {
  frame: std(0xc8bd86, 0.75, 0.15),
  frameDark: std(0x8e865e, 0.75, 0.2),
  orange: std(0xd6721e, 0.6, 0.15),
  steel: std(0x9aa1a9, 0.45, 0.6),
  steelDark: std(0x5d6269, 0.5, 0.5),
  chrome: std(0xdde1e6, 0.18, 0.95),
  beltR: std(0x2f3135, 0.88, 0),
  beltA: std(0x232528, 0.9, 0),
  beltD: std(0x22362f, 0.9, 0),
  rollerBlue: std(0x2f5fa7, 0.5, 0.1),
  rollerGreen: std(0x2e8466, 0.5, 0.1),
  rollerSteel: std(0xb9bfc6, 0.32, 0.75),
  popup: std(0x2f6fd6, 0.6, 0.05),
  popupFrame: std(0x3b4a5e, 0.6, 0.4),
  pneu: std(0xc3c9d0, 0.35, 0.7),
  motor: std(0x3c4b5c, 0.6, 0.3),
  servo: std(0x1e2125, 0.5, 0.3),
  sensor: std(0x25282c, 0.6, 0.2),
  lens: std(0xd2362c, 0.4, 0, { emissive: 0x8a1a12, emissiveIntensity: 0.7 }),
  amber: std(0xe3a52b, 0.5, 0.1, { emissive: 0x7a4a00, emissiveIntensity: 0.35 }),
  beam: new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.55, depthWrite: false }),
  die: std(0xd2cbb1, 0.8, 0.15),
  dieRed: std(0xb8473d, 0.75, 0.1),
  dark: std(0x1b1c1f, 0.9, 0),
  rack: std(0xa8a59b, 0.72, 0.35),
  wood: std(0xb7a588, 0.95, 0),
  woodDark: std(0x9b8b70, 0.95, 0),
  plate: std(0xa3acb6, 0.38, 0.75),
  plateBelt: std(0x27303c, 0.85, 0.05),
  hyd: std(0x2e4a6b, 0.5, 0.4),
  lifter: std(0x56697c, 0.6, 0.4),
  chain: std(0x34363a, 0.5, 0.6),
  rail: std(0x5f5e5a, 0.5, 0.6),
  arm: std(0x185fa5, 0.55, 0.3),
  follower: std(0x0c447c, 0.4, 0.5),
  eccentric: std(0xe3a52b, 0.4, 0.5),
  floor: std(0xbdb7ab, 1, 0),
  pit: std(0x6d6961, 1, 0, { side: THREE.BackSide }),
  human: std(0x3f6c9c, 0.85, 0),
  skin: std(0xc9a07e, 0.8, 0),
};

export type MatKey = keyof typeof M;
