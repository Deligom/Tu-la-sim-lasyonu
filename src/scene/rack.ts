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
  /** Yamuk katlar (bit k = alttan k. kat): o katta iki çıta eğri görünür */
  setBad(mask: number): void;
}

export interface RackMats {
  rack: THREE.Material;
  wood: THREE.Material;
  woodDark: THREE.Material;
  /** Yamuk kattaki eğri çıtalar (verilmezse M.woodBad) */
  woodBad?: THREE.Material;
}

/** Yamuk katta çıtanın bir ucu bu kadar yukarıda (görsel; tolerans öneri ±4 mm) */
const BENT = 1.5;

export function buildRack(name: string, mats: RackMats = { rack: M.rack, wood: M.wood, woodDark: M.woodDark }): RackModel {
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
        ? `Çıtalar tarak giriş yönüne paralel (${RANZA.paralel.adet} adet × ${RANZA.paralel.en} cm).`
        : `Çıtalar tarak giriş yönüne dik (${RANZA.dik.adet} adet × ${RANZA.dik.en} cm). Tarak tuğlayı düz koyduğu için bu tip ` +
          'de kullanılıyor (önceki bantlı plakada tuğla ucu boşluğa düşüp eziliyordu).') +
      ' Tarağın arka kirişindeki 2 lazer her katı ölçer; yamuk kat atlanır, ranza reddedilmez.',
  });
  const badInfo = {
    title: `Ranza ${name} · yamuk kat`,
    detail:
      'Bu katın çıtaları eğri ya da yükseklikleri farklı (tolerans öneri ±4 mm; fazlasında yüksek çıtaya önce değen tuğla ' +
      'pedde kayıyor). Lazer ölçünce kaldırıcı bu katı atlayıp sıradakine geçer; ranzanın geri kalanı dolar.',
  };

  const frame = new Parts(baseInfo('paralel'));
  // dikmeler L40×40×5, kanatları dış yüzlerde
  for (const [cx, sx] of [[0, 1], [D, -1]] as const) {
    for (const [cy, sy] of [[0, 1], [B, -1]] as const) {
      frame.box(mats.rack, cx, cx + sx * a, cy, cy + sy * t, 0, RANZA.cerceveYuk);
      frame.box(mats.rack, cx, cx + sx * t, cy, cy + sy * a, 0, RANZA.cerceveYuk);
    }
  }
  // kat rayları
  for (const zt of levels) {
    const zb = zt - r;
    for (const [x, s] of [[0, 1], [D, -1]] as const) {
      frame.box(mats.rack, x, x + s * t, 0, B, zb, zt);
      frame.box(mats.rack, x, x + s * r, 0, B, zb, zb + t);
    }
    for (const [y, s] of [[0, 1], [B, -1]] as const) {
      frame.box(mats.rack, 0, D, y, y + s * t, zb, zt);
      frame.box(mats.rack, 0, D, y, y + s * r, zb, zb + t);
    }
  }
  // alt köşe destekleri (uzun yüzlerde: plaka giriş yüzü ve arka yüz)
  const z0 = levels[0] - r;
  for (const x of [t / 2 + 0.4, D - t / 2 - 0.4]) {
    for (const [y0, s] of [[a, 1], [B - a, -1]] as const) frame.strut(mats.rack, [x, y0, 2], [x, y0 + s * 22, z0], 1.6);
  }

  // Çıtalar: bir kat (zt) için; bent = yamuk kat (iki çıtanın birer ucu BENT kadar yukarıda)
  const woodBad = mats.woodBad ?? M.woodBad;
  const addLevel = (p: Parts, type: SlatType, zt: number, bent: boolean) => {
    const zc = zt - ct / 2;
    if (type === 'paralel') {
      const nP = RANZA.paralel.adet, wP = RANZA.paralel.en;
      const pitchP = (B - 2 - wP) / (nP - 1);
      for (let k = 0; k < nP; k++) {
        const y0 = 1 + k * pitchP;
        if (bent && (k === 1 || k === nP - 2)) {
          const up = k === 1 ? [0, BENT] : [BENT, 0];
          p.slopeXZ(woodBad, y0, y0 + wP, t, zc + up[0], D - t, zc + up[1], ct);
        } else p.box(k % 3 === 1 ? mats.woodDark : mats.wood, t, D - t, y0, y0 + wP, zt - ct, zt);
      }
    } else {
      const nD = RANZA.dik.adet, wD = RANZA.dik.en;
      const pitchD = (D - 2 - wD) / (nD - 1);
      for (let k = 0; k < nD; k++) {
        const x0 = 1 + k * pitchD;
        if (bent && (k === 1 || k === nD - 2)) {
          const up = k === 1 ? [0, BENT] : [BENT, 0];
          p.slopeYZ(woodBad, x0, x0 + wD, t, zc + up[0], B - t, zc + up[1], ct);
        } else p.box(k % 3 === 1 ? mats.woodDark : mats.wood, x0, x0 + wD, t, B - t, zt - ct, zt);
      }
    }
  };
  const TYPES: SlatType[] = ['paralel', 'dik'];
  const TITLE: Record<SlatType, string> = { paralel: 'Paralel çıtalar', dik: 'Dik çıtalar' };
  // Hepsi düz: tek birleşik grup (az çizim çağrısı). Yamuk kat varsa kat kat gruplar (ilk gerektiğinde kurulur).
  const full = {} as Record<SlatType, THREE.Group>;
  const slats = {} as Record<SlatType, THREE.Group>;
  for (const type of TYPES) {
    const p = new Parts(baseInfo(type));
    levels.forEach((zt) => addLevel(p, type, zt, false));
    full[type] = p.build(TITLE[type]);
    slats[type] = new THREE.Group();
    slats[type].name = TITLE[type];
    slats[type].add(full[type]);
  }
  let perLevel: Record<SlatType, { ok: THREE.Group; bad: THREE.Group }[]> | null = null;
  const ensurePerLevel = () => {
    if (perLevel) return perLevel;
    perLevel = { paralel: [], dik: [] };
    for (const type of TYPES) {
      levels.forEach((zt, j) => {
        const ok = new Parts(baseInfo(type));
        addLevel(ok, type, zt, false);
        const bad = new Parts(badInfo);
        addLevel(bad, type, zt, true);
        const e = { ok: ok.build(`${TITLE[type]} · kat ${j + 1}`), bad: bad.build(`Yamuk kat ${j + 1}`) };
        e.ok.visible = e.bad.visible = false;
        slats[type].add(e.ok, e.bad);
        perLevel![type].push(e);
      });
    }
    return perLevel;
  };

  const group = new THREE.Group();
  group.name = `Ranza ${name}`;
  const frameG = frame.build('Ranza çerçevesi');
  group.add(frameG);
  group.add(slats.paralel, slats.dik);
  slats.dik.visible = false;
  let badMask = 0;

  return {
    group,
    slats,
    setSlatType(type) {
      slats.paralel.visible = type === 'paralel';
      slats.dik.visible = type === 'dik';
      frameG.userData.info = baseInfo(type);
    },
    setBad(mask) {
      if (mask === badMask) return;
      badMask = mask;
      const pl = mask ? ensurePerLevel() : perLevel;
      for (const type of TYPES) {
        full[type].visible = !mask;
        pl?.[type].forEach((e, j) => {
          const b = !!mask && ((mask >> j) & 1) === 1;
          e.ok.visible = !!mask && !b;
          e.bad.visible = b;
        });
      }
    },
  };
}

export const rackSummary = (): string =>
  `${RANZA.boyY} × ${RANZA.derinlikX} × ${RANZA.cerceveYuk} cm · ${RANZA.katSayisi} kat × ${RANZA.katArasi} cm · kullanılabilir ${tr(RANZA.katArasi - RANZA.citaKalinlik)} cm`;
