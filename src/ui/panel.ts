// Kumanda rafı: oynat/durdur, sıfırla, hız, kamera açıları, etiket ve çıta tipi düğmeleri, parça kartı.

import { DT, type SimLoop } from '../sim/loop';
import type { Simulation } from '../sim/sim';
import { summarize } from '../sim/stats';
import { CAMS, CAM_LABELS, type CamName } from '../scene/cameras';
import type { Viewer } from '../scene/viewer';
import type { SlatType } from '../scene/rack';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0').replace('.', ',')}`;
};
const fmtInt = (n: number) => n.toLocaleString('tr-TR');

export function initPanel(loop: SimLoop, viewer: Viewer, sim: Simulation) {
  const bPlay = $<HTMLButtonElement>('bPlay');
  const syncPlay = () => {
    bPlay.textContent = loop.running ? 'Durdur' : 'Oynat';
    bPlay.setAttribute('aria-pressed', String(!loop.running));
  };
  bPlay.addEventListener('click', () => {
    loop.running = !loop.running;
    syncPlay();
  });
  $('bReset').addEventListener('click', () => loop.reset());

  const speedBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];
  for (const b of speedBtns) {
    b.addEventListener('click', () => {
      loop.speed = Number(b.dataset.speed);
      for (const x of speedBtns) {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      }
    });
  }

  const cams = $('cams');
  const camBtns = new Map<CamName, HTMLButtonElement>();
  for (const name of CAMS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = CAM_LABELS[name];
    b.addEventListener('click', () => viewer.setCamera(name));
    cams.appendChild(b);
    camBtns.set(name, b);
  }
  const syncCam = (name: CamName | null) => {
    for (const [n, b] of camBtns) {
      b.classList.toggle('on', n === name);
      b.setAttribute('aria-pressed', String(n === name));
    }
  };
  viewer.onCameraChange(syncCam);
  syncCam(viewer.currentCam);

  const bLabels = $<HTMLButtonElement>('bLabels');
  let labels = true;
  bLabels.addEventListener('click', () => {
    labels = !labels;
    viewer.setLabels(labels);
    bLabels.classList.toggle('on', labels);
    bLabels.setAttribute('aria-pressed', String(labels));
  });

  const bSlats = $<HTMLButtonElement>('bSlats');
  let slat: SlatType = 'paralel';
  bSlats.addEventListener('click', () => {
    slat = slat === 'paralel' ? 'dik' : 'paralel';
    viewer.setSlatType(slat);
    bSlats.textContent = `Çıtalar: ${slat}`;
    bSlats.classList.toggle('on', slat === 'dik');
    bSlats.setAttribute('aria-pressed', String(slat === 'dik'));
  });

  const info = $('info');
  viewer.onPick((p) => {
    info.hidden = !p;
    if (p) {
      $('infoTitle').textContent = p.title;
      $('infoDetail').textContent = p.detail ?? '';
    }
  });
  $('infoClose').addEventListener('click', () => viewer.clearSelection());

  // Kamera kadrajı, üst şerit ve alt rafın örtmediği alana göre yapılır.
  const hud = $('hud');
  const dock = $('dock');
  const app = $('app');
  const measure = () => {
    const a = app.getBoundingClientRect();
    viewer.setInsets(hud.getBoundingClientRect().bottom - a.top, a.bottom - dock.getBoundingClientRect().top);
  };
  const ro = new ResizeObserver(measure);
  ro.observe(hud);
  ro.observe(dock);
  ro.observe(app);
  measure();

  const simTime = $('simTime');
  const simSteps = $('simSteps');
  const simStats = $('simStats');
  const simStats2 = $('simStats2');
  let lastShown = -1;
  return {
    update() {
      if (loop.steps === lastShown) return;
      lastShown = loop.steps;
      simTime.textContent = fmtTime(loop.simTime);
      simSteps.textContent = `${fmtInt(loop.steps)} adım × ${DT * 1000} ms`;
      const s = summarize(sim.S);
      simStats.textContent = `${s.perMin === null ? '–' : Math.round(s.perMin)}/dk · temas ${s.contacts} · taşan ${s.lost}`;
      simStats2.textContent = `kat ${s.levels} · ranza ${s.racks}${s.anomaly ? ' · ⚠ hata' : ''}`;
      simStats.classList.toggle('bad', s.contacts > 0 || s.lost > 0);
    },
  };
}
