// Düşürme denemesi (sahadaki kalibrasyonun benzeri): npx tsx scripts/phys-drop.ts
// Tuğlayı 0 / 1 / 3 / 5,5 cm'den düz ve 17° eğik çıtaya bırakır; çarpma hızı, sekme, kenar ve yüz izi (mm).
// Sahada ölçülen iz derinlikleriyle karşılaştırıp src/phys/config.ts'deki kW ve pY ayarlanır.

import { physConfig } from '../src/phys/config';
import { World } from '../src/phys/world';
// paralel çıtalar: y = -0.6+0.01+k*pitch; tuğla y=0 çevresinde
function drop(h: number, pitch = 0, label = '') {
  const cfg = physConfig({});
  const hz = cfg.H / 2, hx = cfg.L / 2;
  // en alçak noktası h yüksekte olacak şekilde
  const low = hz * Math.cos(pitch) + hx * Math.sin(Math.abs(pitch));
  const w = new World(cfg, { drop: [{ x: 0.45, y: 0.0, z: h + low, pitch }] });
  const b = w.bricks[0];
  let minVz = 0, maxUp = -1, touched = false, tTouch = 0, zAtTouch = 0, vzAfter = 0, maxN = 0;
  while (w.t < 1.0) {
    w.step();
    if (b.nSlat > 0 && !touched) { touched = true; tTouch = w.t; zAtTouch = b.pz; }
    if (!touched) minVz = Math.min(minVz, b.vz);
    else { vzAfter = Math.max(vzAfter, b.vz); maxN = Math.max(maxN, b.nSlat); }
  }
  console.log(label, 'h', (h*100).toFixed(1), 'cm pitch', (pitch*57.3).toFixed(0), 'v_impact(cm/s)', (-minVz*100).toFixed(1), 'expected', (Math.sqrt(2*9.81*h)*100).toFixed(1),
    'rebound vz', (vzAfter*100).toFixed(1), 'maxN', maxN.toFixed(0), 'final z', ((b.pz - hz)*1000).toFixed(2), 'mm pitch', (b.pitch*57.3).toFixed(2), 'dent mm', (b.maxDent()*1000).toFixed(2), 'face', (Math.max(...b.m.faceDent)*1000).toFixed(2), 'state', b.state, 'dx mm', ((b.px-0.45)*1000).toFixed(2), 'steps', w.steps);
}
const t0 = Date.now();
drop(0.0); drop(0.01); drop(0.03); drop(0.055);
drop(0.0, 0.3, 'edge'); drop(0.01, 0.3, 'edge'); drop(0.03, 0.3, 'edge');
console.log('ms', Date.now() - t0);
