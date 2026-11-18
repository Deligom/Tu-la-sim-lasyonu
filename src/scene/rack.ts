// Ranza: 5 mm köşebent çerçeve, 5 kat, ahşap çıtalar. Fotoğraflardaki gibi 4 köşe dikmesi, en alt
// katın altında dikme dibinden kata uzanan çapraz destekler. Kat rayları L25×25×5: yatay kol içe
// bakar, çıtalar onun üstüne oturur; dik kolun üstü çıta üstüyle aynı hizada (plaka 5 mm üstten geçer).
// Yerel koordinat: X 0..90 (derinlik, plaka +X'e girer), Y 0..120 (boy), Z 0 = ranza ayağı.

import * as THREE from 'three';
import { Parts, tr } from './parts';
import { M } from './materials';
import { RANZA } from '../sim/dims';

export type SlatType = 'paralel' | 'dik';

export interface RackModel {
  group: THREE.Group;
  slats: Record<SlatType, THREE.Group>;
  setSlatType(t: SlatType): void;
}

export function buildRack(name: string): RackModel {
  const D = RANZA.derinlikX;
  const B = RANZA.boyY;
  const a = RANZA.dikmeKenar;
  const r = RANZA.rayKenar;
  const t = RANZA.sac;
  const ct = RANZA.citaKalinlik;
  const levels = Array.from({ length: RANZA.katSayisi }, (_, j) => RANZA.ilkKat + j * RANZA.katArasi);

  const baseInfo = (type: SlatType) => ({
    title: `Ranza ${name} · çıtalar ${type}`,
    detail:
      `${B} (boy, Y) × ${D} (derinlik, X) × ${RANZA.cerceveYuk} cm, ${RANZA.katSayisi} kat, kat arası ${RANZA.katArasi} cm, ` +
      `kullanılabilir ${RANZA.katArasi - ct} cm. 5 mm köşebent, ahşap çıta (${ct} cm). ` +
      (type === 'paralel'
        ? `Çıtalar plaka giriş yönüne paralel (${RANZA.paralel.adet} adet × ${RANZA.paralel.en} cm): doğru tip.`
        : `Çıtalar plaka giriş yönüne dik (${RANZA.dik.adet} adet × ${RANZA.dik.en} cm): tuğla ucu boşluğa düşüp ezilir, plaka ucundaki lazer görüp reddeder.`),
  });

  const frame = new Parts(baseInfo('paralel'));
  // dikmeler L40×40×5, kanatları dış yüzlerde
  for (const [cx, sx] of [[0, 1], [D, -1]] as const) {
    for (const [cy, sy] of [[0, 1], [B, -1]] as const) {
      frame.box(M.rack, cx, cx + sx * a, cy, cy + sy * t, 0, RANZA.cerceveYuk);
      frame.box(M.rack, cx, cx + sx * t, cy, cy + sy * a, 0, RANZA.cerceveYuk);
    }
  }
  // kat rayları
  for (const zt of levels) {
    const zb = zt - r;
    for (const [x, s] of [[0, 1], [D, -1]] as const) {
      frame.box(M.rack, x, x + s * t, 0, B, zb, zt);
      frame.box(M.rack, x, x + s * r, 0, B, zb, zb + t);
    }
    for (const [y, s] of [[0, 1], [B, -1]] as const) {
      frame.box(M.rack, 0, D, y, y + s * t, zb, zt);
      frame.box(M.rack, 0, D, y, y + s * r, zb, zb + t);
    }
  }
  // alt köşe destekleri (uzun yüzlerde: plaka giriş yüzü ve arka yüz)
  const z0 = levels[0] - r;
  for (const x of [t / 2 + 0.4, D - t / 2 - 0.4]) {
    for (const [y0, s] of [[a, 1], [B - a, -1]] as const) frame.strut(M.rack, [x, y0, 2], [x, y0 + s * 22, z0], 1.6);
  }

  const paralel = new Parts(baseInfo('paralel'));
  const dik = new Parts(baseInfo('dik'));
  levels.forEach((zt) => {
    const nP = RANZA.paralel.adet, wP = RANZA.paralel.en;
    const pitchP = (B - 2 - wP) / (nP - 1);
    for (let k = 0; k < nP; k++) {
      const y0 = 1 + k * pitchP;
      paralel.box(k % 3 === 1 ? M.woodDark : M.wood, t, D - t, y0, y0 + wP, zt - ct, zt);
    }
    const nD = RANZA.dik.adet, wD = RANZA.dik.en;
    const pitchD = (D - 2 - wD) / (nD - 1);
    for (let k = 0; k < nD; k++) {
      const x0 = 1 + k * pitchD;
      dik.box(k % 3 === 1 ? M.woodDark : M.wood, x0, x0 + wD, t, B - t, zt - ct, zt);
    }
  });

  const group = new THREE.Group();
  group.name = `Ranza ${name}`;
  const frameG = frame.build('Ranza çerçevesi');
  group.add(frameG);
  const slats = { paralel: paralel.build('Paralel çıtalar'), dik: dik.build('Dik çıtalar') };
  group.add(slats.paralel, slats.dik);
  slats.dik.visible = false;

  return {
    group,
    slats,
    setSlatType(type) {
      slats.paralel.visible = type === 'paralel';
      slats.dik.visible = type === 'dik';
      frameG.userData.info = baseInfo(type);
    },
  };
}

export const rackSummary = (): string =>
  `${RANZA.boyY} × ${RANZA.derinlikX} × ${RANZA.cerceveYuk} cm · ${RANZA.katSayisi} kat × ${RANZA.katArasi} cm · kullanılabilir ${tr(RANZA.katArasi - RANZA.citaKalinlik)} cm`;
