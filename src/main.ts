import './ui/style.css';
import { Simulation } from './sim/sim';
import { SimLoop } from './sim/loop';
import { createViewer } from './scene/viewer';
import { initPanel } from './ui/panel';

const sim = new Simulation();
const loop = new SimLoop(sim);
const viewer = createViewer(document.getElementById('view')!, sim.layout, sim.params);
const panel = initPanel(loop, viewer, sim);

let last = performance.now();
let lastUI = 0;
function frame(now: number) {
  loop.advance((now - last) / 1000);
  last = now;
  viewer.frame(now);
  if (now - lastUI > 100) {
    panel.update();
    lastUI = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Geliştirirken konsoldan bakmak için
Object.assign(window as unknown as Record<string, unknown>, { sim, loop, viewer });
