import './ui/style.css';
import { Simulation } from './sim/sim';
import { SimLoop } from './sim/loop';
import { createViewer } from './scene/viewer';
import { initPanel } from './ui/panel';
import { initSheet } from './ui/sheet';
import { loadStored } from './ui/settings';

// Hatırlanan ayarlarla başla (yerleşimi değiştiren ayarlar sahne kurulmadan önce uygulanmalı)
const stored = loadStored();
const sim = new Simulation(stored.params);
const loop = new SimLoop(sim);
const viewer = createViewer(document.getElementById('view')!, sim);
const sheet = initSheet(loop, sim, stored);
const panel = initPanel(loop, viewer, sim, sheet, stored);

let last = performance.now();
let lastUI = 0;
let lastSheet = 0;
function frame(now: number) {
  loop.advance((now - last) / 1000);
  last = now;
  viewer.frame(now);
  if (now - lastUI > 100) {
    panel.update();
    lastUI = now;
  }
  if (now - lastSheet > 250) {
    sheet.update();
    lastSheet = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Geliştirirken konsoldan bakmak için
Object.assign(window as unknown as Record<string, unknown>, { sim, loop, viewer });
