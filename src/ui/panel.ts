// Kumanda rafı: oynat/durdur, sıfırla, hız, kamera açıları, etiket ve çıta tipi düğmeleri, parça kartı.

import { DT, type SimLoop } from '../sim/loop';
import type { Simulation } from '../sim/sim';
import { summarize } from '../sim/stats';
import { CAMS, CAM_LABELS, type CamName } from '../scene/cameras';
import type { Viewer } from '../scene/viewer';
import type { SlatType } from '../scene/rack';
import type { LandingResult, NoseKind } from '../sim/landing';

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

  const info = $('info');
  const showCard = (title: string, detail: string) => {
    info.hidden = false;
    $('infoTitle').textContent = title;
    $('infoDetail').textContent = detail;
  };
  viewer.onPick((p) => {
    info.hidden = !p;
    if (p) showCard(p.title, p.detail ?? '');
  });

  // İniş kontrolü: burun ve çıta tipine göre tuğlanın plakadan çıtaya inişi
  const num = (v: number) => v.toFixed(1).replace('.', ',');
  let nose: NoseKind = 'egilir';
  let slat: SlatType = 'paralel';
  let land: LandingResult = viewer.landing();
  const landingCard = () => {
    const other = nose === 'egilir' ? 'sabit' : 'egilir';
    const lines = [
      `Ön kenar en çok ${num(land.maxDrop)} cm düşüyor, tuğla en çok ${Math.round(land.maxTiltDeg)}° eğiliyor.`,
      nose === 'egilir'
        ? `Burun geri çekilirken ${num(land.noseDeg)}° iniyor: alt yüzü çıtalara paralel, üst yüzü rampa.`
        : 'Burun düz kalıyor: tuğla plakanın 5 cm kalınlığı + 5 mm boşluk kadar yüksekten iniyor.',
      slat === 'dik' ? `Dik çıtada ön kenar ${num(land.maxDip)} cm boşluğa dalıyor: ezilir, bu yüzden ranza reddediliyor.` : '',
      `Karşılaştırmak için "Burun: ${other === 'egilir' ? 'eğilir' : 'sabit'}" düğmesine bas; "A yan" ya da "Ranza içi"nden izle.`,
    ].filter(Boolean);
    showCard(`İniş kontrolü · ${nose === 'egilir' ? 'eğilir burun' : 'sabit burun'} · çıtalar ${slat}`, lines.join(' '));
  };

  const bSlats = $<HTMLButtonElement>('bSlats');
  bSlats.addEventListener('click', () => {
    slat = slat === 'paralel' ? 'dik' : 'paralel';
    viewer.setSlatType(slat);
    land = viewer.landing();
    bSlats.textContent = `Çıtalar: ${slat}`;
    bSlats.classList.toggle('on', slat === 'dik');
    bSlats.setAttribute('aria-pressed', String(slat === 'dik'));
    landingCard();
  });

  const bNose = $<HTMLButtonElement>('bNose');
  bNose.addEventListener('click', () => {
    nose = nose === 'egilir' ? 'sabit' : 'egilir';
    land = viewer.setNose(nose);
    bNose.textContent = `Burun: ${nose === 'egilir' ? 'eğilir' : 'sabit'}`;
    bNose.classList.toggle('on', nose === 'egilir');
    bNose.setAttribute('aria-pressed', String(nose === 'egilir'));
    landingCard();
    lastShown = -1;
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
      simStats2.textContent = `kat ${s.levels} · ranza ${s.racks} · iniş ${num(land.maxDrop)} cm${s.anomaly ? ' · ⚠ hata' : ''}`;
      simStats.classList.toggle('bad', s.contacts > 0 || s.lost > 0);
    },
  };
}
