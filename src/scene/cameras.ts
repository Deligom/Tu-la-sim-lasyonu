// Hazır kamera açıları. Her açı ekran oranına göre kadrajı yeniden hesaplar (telefon dikey / yatay).
// Üstten görünüm: dikeyde akış aşağı doğru, A sağda (2D'nin telefon görünümü gibi); yatayda akış sağa, A yukarıda.

import * as THREE from 'three';
import type { PlanLayout } from '../sim/geometry';
import { RANZA, Z, rackFeetZ } from '../sim/dims';

export const CAMS = ['genel', 'ustten', 'hazirlik', 'aYan', 'bYan', 'ranzaIci'] as const;
export type CamName = (typeof CAMS)[number];

export const CAM_LABELS: Record<CamName, string> = {
  genel: 'Genel',
  ustten: 'Üstten',
  hazirlik: 'Ön hazırlık',
  aYan: 'A yan',
  bYan: 'B yan',
  ranzaIci: 'Ranza içi',
};

export interface CamPose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  near: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Görünür alan: tuval genişliği w, kamera çerçevesinin tam yüksekliği F (görüş kaydırması dahil) ve
 * üst şerit ile alt raf arasında kalan görünür yükseklik V (piksel).
 */
export interface ViewBox {
  w: number;
  F: number;
  V: number;
}

/** Hedeften `dir` yönünde, hw × hh (yarım genişlik × yarım yükseklik) kutusu görünür alana sığacak kadar uzaklaş. */
function fit(target: THREE.Vector3, dir: THREE.Vector3, hw: number, hh: number, fov: number, vb: ViewBox, depthPad = 0): CamPose {
  const near = 2;
  const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const tV = (t * vb.V) / vb.F;
  const tH = (t * vb.w) / vb.F;
  // depthPad: kadraj kutusunun kameraya en yakın noktası hedeften bu kadar önde (ör. ranza tepesi)
  const dist = Math.max(hh / tV, hw / tH) + depthPad;
  return { pos: target.clone().add(dir.clone().normalize().multiplyScalar(dist)), target, fov, near };
}

export function camPose(name: CamName, lay: PlanLayout, vb: ViewBox): CamPose {
  const aspect = vb.w / Math.max(1, vb.V);
  const portrait = aspect < 0.9;
  const zr = Z.hat;
  const cA = lay.sideCenterY(0);
  const cB = lay.sideCenterY(1);
  const xEnd = lay.RK0 + RANZA.derinlikX + 12;
  switch (name) {
    case 'genel':
      return portrait
        ? fit(v(360, 0, 40), v(-0.78, -0.34, 0.6), 230, 300, 45, vb)
        : fit(v(320, 0, 40), v(-0.36, -0.78, 0.55), 560, 200, 45, vb);
    case 'ustten': {
      const x0 = -400;
      const cx = (x0 + xEnd) / 2;
      const half = (xEnd - x0) / 2 + 20;
      const hy = cA + 75;
      // Tam tepeden bakışta yön belirsiz olmasın diye çok küçük bir eğim veriliyor.
      const top = rackFeetZ(0) + RANZA.cerceveYuk + 10; // boş ranzanın tepesi
      return portrait
        ? fit(v(cx, 0, 0), v(0.002, 0, 1), hy, half, 32, vb, top)
        : fit(v(cx, 0, 0), v(0, -0.002, 1), half, hy, 32, vb, top);
    }
    case 'hazirlik': {
      const cx = (lay.E + lay.ZEND) / 2;
      return portrait
        ? fit(v(cx, 0, zr - 10), v(-0.5, -0.55, 0.67), 130, 120, 45, vb)
        : fit(v(cx, 0, zr - 10), v(-0.42, -0.62, 0.66), 175, 95, 45, vb);
    }
    case 'aYan':
    case 'bYan': {
      const c = name === 'aYan' ? cA : cB;
      const s = name === 'aYan' ? 1 : -1;
      const cx = (lay.BUF0 + xEnd) / 2;
      return fit(v(cx, c, Z.hat - 10), v(-0.06, s, 0.12), 180, 150, 30, vb, 60);
    }
    case 'ranzaIci': {
      // A ranzasının içinde, aktif katın (en alt kat, plaka hizası) çıtalarının 10 cm üstünde, plakaya doğru bakış.
      const x = lay.RK0 + RANZA.derinlikX - 5;
      return { pos: v(x, cA + 18, Z.aktifCita + 10), target: v(lay.RK0 - 70, cA - 4, Z.aktifCita + 6), fov: portrait ? 80 : 68, near: 0.5 };
    }
  }
}
