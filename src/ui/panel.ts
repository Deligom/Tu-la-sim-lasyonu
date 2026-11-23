// Kumanda rafı: oynat/durdur, sıfırla, hız, kamera açıları, etiket ve çıta tipi düğmeleri, parça kartı,
// Durum / Ayarlar panelinin düğmeleri. Raf düğmelerinin durumu tarayıcıda hatırlanır.

import { DT, type SimLoop } from '../sim/loop';
import type { Simulation } from '../sim/sim';
import { summarize } from '../sim/stats';
import { CAMS, CAM_LABELS, type CamName } from '../scene/cameras';
import type { Viewer } from '../scene/viewer';
import type { SlatType } from '../scene/rack';
import type { LandingResult, NoseKind } from '../sim/landing';
import type { LoaderKind } from '../phys/config';
import { saveStored, type Stored } from './settings';
import type { Sheet } from './sheet';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0').replace('.', ',')}`;
};
const fmtInt = (n: number) => n.toLocaleString('tr-TR');

export function initPanel(loop: SimLoop, viewer: Viewer, sim: Simulation, sheet: Sheet, stored: Stored) {
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
  const setLabels = (on: boolean) => {
    labels = on;
    viewer.setLabels(labels);
    bLabels.classList.toggle('on', labels);
    bLabels.setAttribute('aria-pressed', String(labels));
  };
  bLabels.addEventListener('click', () => {
    setLabels(!labels);
    stored.labels = labels;
    saveStored(stored);
  });

  // Durum / Ayarlar paneli
  const bDurum = $<HTMLButtonElement>('bSheetDurum');
  const bAyar = $<HTMLButtonElement>('bSheetAyar');
  bDurum.addEventListener('click', () => sheet.toggle(sheet.open === 'hesap' ? 'hesap' : 'durum'));
  bAyar.addEventListener('click', () => sheet.toggle('ayarlar'));
  sheet.onChange((t) => {
    const d = t === 'durum' || t === 'hesap';
    bDurum.classList.toggle('on', d);
    bDurum.setAttribute('aria-pressed', String(d));
    bAyar.classList.toggle('on', t === 'ayarlar');
    bAyar.setAttribute('aria-pressed', String(t === 'ayarlar'));
    measure();
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
      slat === 'dik'
        ? `Dik çıtada plakayla ön kenar ${num(land.maxDip)} cm boşluğa dalıyordu (ezilir). Tarak tuğlayı düz koyduğu için artık dik çıtalı ranza da kullanılıyor.`
        : '',
      `Karşılaştırmak için "Burun: ${other === 'egilir' ? 'eğilir' : 'sabit'}" düğmesine bas; "A yan" ya da "Ranza içi"nden izle.`,
    ].filter(Boolean);
    showCard(`İniş kontrolü · ${nose === 'egilir' ? 'eğilir burun' : 'sabit burun'} · çıtalar ${slat}`, lines.join(' '));
  };

  const bSlats = $<HTMLButtonElement>('bSlats');
  const setSlat = (t: SlatType) => {
    slat = t;
    viewer.setSlatType(slat);
    land = viewer.landing();
    bSlats.textContent = `Çıtalar: ${slat}`;
    bSlats.classList.toggle('on', slat === 'dik');
    bSlats.setAttribute('aria-pressed', String(slat === 'dik'));
  };
  bSlats.addEventListener('click', () => {
    setSlat(slat === 'paralel' ? 'dik' : 'paralel');
    stored.slat = slat;
    saveStored(stored);
    if (loader === 'tarak')
      showCard(
        `Çıtalar ${slat} · tarak`,
        slat === 'dik'
          ? 'Tarak tuğlayı çıtanın ~1 mm üstüne düz indirip bırakıyor: dik çıtada da 0° eğim, ~0,07 mm iz (fizikli simülasyon). ' +
              'Bu yüzden dik çıtalı ranza reddedilmiyor. Lazer her katı ölçer; yalnızca yamuk kat atlanır.'
          : 'Paralel çıtalı ranza. Lazer her katı ölçer; yalnızca yamuk kat atlanır (Ayarlar → Yamuk kat oranı).',
      );
    else landingCard();
  });

  // Yükleyici: tarak tutucu (2026-11-22 kesin) ↔ önceki bantlı plaka (karşılaştırma)
  let loader: LoaderKind = 'tarak';
  const bLoader = $<HTMLButtonElement>('bLoader');
  const setLoader = (k: LoaderKind) => {
    loader = k;
    viewer.setLoader(loader);
    bLoader.textContent = `Yükleyici: ${loader === 'tarak' ? 'tarak' : 'plaka (önceki)'}`;
    bLoader.classList.toggle('on', loader === 'tarak');
    bLoader.setAttribute('aria-pressed', String(loader === 'tarak'));
    bNose.disabled = loader === 'tarak';
    lastShown = -1;
  };
  bLoader.addEventListener('click', () => {
    setLoader(loader === 'plaka' ? 'tarak' : 'plaka');
    stored.loader = loader;
    saveStored(stored);
    if (loader === 'tarak') {
      showCard(
        'Tarak tutucu (yükleyici)',
        'Dişler sütun aralıklarına iner, yastıklar şişip tuğlaları yandan tutar (~0,06 bar), tarak plakanın raylarında ' +
          've zincirinde ranzaya girer, tuğlaları çıtanın ~1 mm üstüne indirip bırakır, aynı aralıklardan geri çekilir. Fizikli ' +
          'simülasyonda: çıtaya ~9 cm/s oturma, 0° eğim, komşu teması yok, sıra aralığı korunuyor. Ayrıntı ve ayarlar yükleme detayı ' +
          'sayfasında. Bu sahnede zamanlama 2D modelin plaka evrelerinden; ranzada indirme girişin son 4 cm\'sine sıkıştırıldı.',
      );
    } else landingCard();
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
  // Panel geniş ekranda sağda (sahne daralır), telefonda alttan açılır (sahnenin görünen kısmı panelin üstü).
  const hud = $('hud');
  const dock = $('dock');
  const app = $('app');
  const sheetEl = $('sheet');
  const wide = matchMedia('(min-width: 900px)');
  const measure = () => {
    const a = app.getBoundingClientRect();
    const dockTop = dock.getBoundingClientRect().top;
    app.style.setProperty('--dock-h', `${Math.round(a.bottom - dockTop)}px`);
    const bottomEdge = !sheetEl.hidden && !wide.matches ? Math.min(dockTop, sheetEl.getBoundingClientRect().top) : dockTop;
    viewer.setInsets(hud.getBoundingClientRect().bottom - a.top, a.bottom - bottomEdge);
  };
  const ro = new ResizeObserver(measure);
  ro.observe(hud);
  ro.observe(dock);
  ro.observe(app);
  ro.observe(sheetEl);
  measure();

  const simTime = $('simTime');
  const simSteps = $('simSteps');
  const simStats = $('simStats');
  const simStats2 = $('simStats2');
  let lastShown = -1;

  // hatırlanan raf düğmeleri (kart göstermeden)
  if (stored.labels === false) setLabels(false);
  if (stored.slat === 'dik') setSlat('dik');
  if (stored.loader === 'plaka') setLoader('plaka');
  return {
    update() {
      if (loop.steps === lastShown) return;
      lastShown = loop.steps;
      simTime.textContent = fmtTime(loop.simTime);
      simSteps.textContent = `${fmtInt(loop.steps)} adım × ${DT * 1000} ms`;
      const s = summarize(sim.S);
      simStats.textContent = `${s.perMin === null ? '–' : Math.round(s.perMin)}/dk · temas ${s.contacts} · taşan ${s.lost}`;
      const inis = loader === 'tarak' ? 'iniş ~0,1 cm (tarak)' : `iniş ${num(land.maxDrop)} cm`;
      const yamuk = s.skipped ? ` · yamuk ${s.skipped}` : '';
      simStats2.textContent = `kat ${s.levels} · ranza ${s.racks}${yamuk} · ${inis}${s.anomaly ? ' · ⚠ hata' : ''}`;
      simStats.classList.toggle('bad', s.contacts > 0 || s.lost > 0);
    },
  };
}
