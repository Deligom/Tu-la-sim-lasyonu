// Ön hazırlık (4'lü): şerit başına servo tahrikli kısa makaralar, 12 enine pop-up bandı ve onları
// taşıyan tek rijit çerçeve (4 kılavuzlu pnömatik silindir), sayım kamerası ve direği.

import * as THREE from 'three';
import { Parts, tr } from './parts';
import { M } from './materials';
import type { LabelSpec } from './labels';
import { popupBandX, prepRollerX, type PlanLayout } from '../sim/geometry';
import type { Params } from '../sim/params';
import { POP_INIS, POP_KALKIS, Z } from '../sim/dims';

const ROLLER_R = 1.25;
const POP_BAND_HALF_Y = 27;

export function buildPrep(lay: PlanLayout, p: Readonly<Params>, labels: LabelSpec[]): { group: THREE.Group; popup: THREE.Group } {
  const zr = Z.hat;
  const group = new THREE.Group();
  const x0 = lay.E - 1;
  const x1 = lay.ZEND + 1;
  const rowGap = lay.rowBack(2) - 1; // 1. ve 2. sıra arası (servo tahriki buradan çıkar)

  const fix = new Parts({
    title: "Ön hazırlık (4'lü)",
    detail: `Şerit başına bağımsız servo ile dönen kısa makaralar (Ø${tr(ROLLER_R * 2)}, 14 cm). Her bırakmada servo, tuğlanın arka kenarı ` +
      `fotoselden geçince +2 cm daha ilerleyip durur: sıra aralığı 21 cm, tuğlalar arası 2 cm, durdurucuya çarpma yok. 4 sıra, ${lay.ZEND - lay.GATE} cm.`,
  });
  for (const x of prepRollerX(lay)) {
    for (let i = 0; i < 3; i++) fix.cyl(M.rollerSteel, 'y', x, lay.laneCenterY(i), zr - ROLLER_R, ROLLER_R, 14, 12);
  }
  // makara yatak levhaları (şerit aralarında ve iki dışta)
  const plates = [-24.1, -lay.PITCH / 2, lay.PITCH / 2, 24.1];
  for (const yb of plates) {
    fix.box(M.steelDark, lay.E - 0.5, lay.ZEND + 0.5, yb - 0.3, yb + 0.3, zr - 3.2, zr - 1.0);
    for (const [a, b] of [[x0, x0 + 0.6], [x1 - 0.6, x1]]) fix.box(M.steelDark, a, b, yb - 0.3, yb + 0.3, zr - 34, zr - 3.2);
  }
  // şerit servoları + triger kapakları
  for (let i = 0; i < 3; i++) {
    const y = lay.laneCenterY(i);
    fix.box(M.servo, rowGap - 5, rowGap + 5, y - 4.5, y + 4.5, zr - 19, zr - 11);
    fix.box(M.servo, rowGap - 0.8, rowGap + 0.8, y - 1.5, y + 1.5, zr - 11, zr - 2.6);
  }
  // alt şase ve ayaklar
  for (const s of [-1, 1]) {
    fix.box(M.frame, x0, x1, s * 22, s * 26, zr - 38, zr - 34);
    for (const x of [x0, x1 - 4]) fix.box(M.frame, x, x + 4, s * 22, s * 26, 0, zr - 38);
  }
  for (const x of [x0, x1 - 3]) fix.box(M.frame, x, x + 3, -22, 22, zr - 38, zr - 34);
  // pop-up silindir gövdeleri (sabit)
  const cylX = [lay.E + 6, lay.ZEND - 6];
  for (const x of cylX) {
    for (const s of [-1, 1]) {
      fix.cyl(M.pneu, 'z', x, s * 14, zr - 23, 2, 22, 14);
      fix.cyl(M.pneu, 'z', x + 3, s * 14, zr - 30, 1, 8, 10);
    }
    fix.box(M.frame, x - 3, x + 6, -22, 22, zr - 36, zr - 34);
  }
  group.add(fix.build());

  // Pop-up çerçevesi (hareketli, dinlenme konumunda)
  const pop = new Parts({
    title: 'Pop-up 90° transfer',
    detail: `12 enine bant (her sıranın arkasından 3 / 9,5 / 16 cm), tek rijit çerçeve, 4 kılavuzlu pnömatik silindir. ` +
      `Dinlenmede makara yüzeyinin ${tr(POP_INIS * 10)} mm altında, kalkınca ${tr(POP_KALKIS * 10)} mm üstünde. ` +
      `Çift yönlü: motor yönüne göre +Y → A tablası, −Y → B tablası, ${p.tSpeed} cm/s.`,
  });
  const bandBottom = Z.popAlt - 3;
  for (const bx of popupBandX(lay)) {
    pop.beltY(M.popup, bx - 0.8, bx + 0.8, -POP_BAND_HALF_Y, POP_BAND_HALF_Y, Z.popAlt, 1.5);
    pop.box(M.popupFrame, bx - 1, bx + 1, -22, 22, bandBottom - 2, bandBottom);
  }
  for (const s of [-1, 1]) pop.box(M.popupFrame, lay.E, lay.ZEND, s * 18, s * 21, bandBottom - 4, bandBottom - 2);
  const shaftLen = lay.ZEND - lay.E + 8;
  pop.cyl(M.steel, 'x', lay.E + shaftLen / 2, POP_BAND_HALF_Y - 1.5, Z.popAlt - 1.5, 0.5, shaftLen, 8);
  pop.box(M.motor, lay.ZEND + 1, lay.ZEND + 9, 21, 29, zr - 9, zr - 2.5);
  for (const x of cylX) {
    for (const s of [-1, 1]) {
      pop.cyl(M.chrome, 'z', x, s * 14, zr - 10.2, 0.8, 4, 8);
      pop.cyl(M.chrome, 'z', x + 3, s * 14, (zr - 34 + bandBottom - 4) / 2, 0.5, bandBottom - 4 - (zr - 34), 8);
    }
    pop.box(M.popupFrame, x - 2, x + 5, -16, 16, bandBottom - 6, bandBottom - 4);
  }
  const popup = pop.build('Pop-up çerçevesi');
  group.add(popup);

  // Sayım kamerası
  const cx = (lay.E + lay.ZEND) / 2;
  const px = lay.ZEND + 8;
  const cam = new Parts({
    title: 'Sayım kamerası',
    detail: "Şerit başına tuğla sayar. 4 olunca o şeridin dozajı durur, şerit kapağı kapanır. Direk A ve B tamponlarının arasında.",
  });
  cam.box(M.frameDark, px - 2, px + 2, -2, 2, 0, zr + 150);
  cam.box(M.frameDark, px - 14, px + 14, -14, 14, 0, 1.5);
  cam.box(M.frameDark, cx - 4, px + 2, -1.5, 1.5, zr + 146, zr + 150);
  cam.box(M.sensor, cx - 5, cx + 5, -4, 4, zr + 138, zr + 146);
  cam.cyl(M.dark, 'z', cx, 0, zr + 136.5, 2.2, 3, 16);
  group.add(cam.build());

  labels.push({ text: "Ön hazırlık 4'lü + kamera", pos: [cx, 0, zr + 168] });
  return { group, popup };
}
