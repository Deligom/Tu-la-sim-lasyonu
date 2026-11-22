// Yükleme detayı sayfası: fizikli iniş simülasyonunu (src/phys) parça parça hesaplar, kareleri 3D'de oynatır,
// ölçümleri kart ve tabloda gösterir. Ayar değişince yeniden hesaplar.

import '../ui/style.css';
import './detail.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PHYS_DEFAULT, physConfig, type PhysConfig } from '../phys/config';
import { LoadingRun, type BrickSummary, type Summary } from '../phys/run';
import { buildDetailScene, type ColorMode } from './scene';
import { layerLayout } from '../phys/rig';
import { checkLanding } from '../sim/landing';

/** Aynı ayarlarla yarı-statik iniş (src/sim/landing.ts, ana sahnedeki model): en büyük eğim, derece */
function quasiStaticTilt(c: PhysConfig): number {
  const { rowsX0 } = layerLayout(c.rowGap);
  const r = checkLanding(
    { nose: c.nose, noseLen: c.noseLen * 100, rollerDia: c.tipRollerDia * 100, beltThk: c.beltThk * 100, clearance: c.clearance * 100, plateThk: c.plateThk * 100, slat: c.slat },
    rowsX0.map((x) => x * 100),
    c.plateLen * 100,
  );
  return r.maxTiltDeg;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const tr = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
const DEG = 180 / Math.PI;

// ---------- ayar tanımları ----------
type Val = number | string;
interface Def {
  key: keyof PhysConfig;
  label: string;
  unit?: string;
  /** seçenekli */
  opts?: [Val, string][];
  /** sürgü: arayüz değeri = fizik değeri × k */
  k?: number;
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  group: string;
  help?: string;
  /** yalnız bu yükleyicide göster */
  only?: 'plaka' | 'tarak';
}
const DEFS: Def[] = [
  { key: 'loader', label: 'Yükleyici', group: 'Yükleyici', opts: [['tarak', 'Tarak tutucu'], ['plaka', 'Bantlı plaka (önceki)']] },
  { key: 'padP', label: 'Yastık basıncı', unit: 'bar', k: 1e-5, min: 0.01, max: 0.2, step: 0.01, digits: 2, group: 'Tarak tutucu', only: 'tarak', help: 'ped kuvveti = basınç × 16 × 13 cm' },
  { key: 'muPad', label: 'Sürtünme ped – yaş kil', k: 1, min: 0.15, max: 0.8, step: 0.05, digits: 2, group: 'Tarak tutucu', only: 'tarak', help: 'tahmin; elle iki tuğla kaldırılabildiğine göre ≥ ~0,3' },
  { key: 'colErr', label: 'Sütun hizasızlığı (en fazla)', unit: 'mm', k: 1000, min: 0, max: 12, step: 1, digits: 0, group: 'Tarak tutucu', only: 'tarak', help: 'sütunlara sabit desenle dağılır; iki komşu birbirine 1,6 × bu kadar yaklaşabilir' },
  { key: 'setGap', label: 'Bırakma yüksekliği', unit: 'mm', k: 1000, min: 0, max: 6, step: 0.5, digits: 1, group: 'Tarak tutucu', only: 'tarak', help: 'yastıklar sönerken tuğla altı ile çıta arası' },
  { key: 'vSet', label: 'Son 1 cm iniş hızı', unit: 'cm/s', k: 100, min: 1, max: 10, step: 1, digits: 0, group: 'Tarak tutucu', only: 'tarak' },
  { key: 'nose', label: 'Burun', group: 'Plaka', only: 'plaka', opts: [['egilir', 'Eğilir'], ['sabit', 'Sabit']] },
  { key: 'noseLen', label: 'Burun boyu (menteşeden uca)', unit: 'cm', k: 100, min: 8, max: 40, step: 1, digits: 0, group: 'Plaka', only: 'plaka', help: 'uzun burun tuğlayı yavaş indirir; menteşedeki tuğlalar burun inerken biraz eğilir' },
  { key: 'plateThk', label: 'Plaka kalınlığı', unit: 'cm', k: 100, min: 2, max: 5, step: 0.5, digits: 1, group: 'Plaka', only: 'plaka', help: 'makaralar sığmazsa küçülür; incelirse sehim artar (aşağıda)' },
  { key: 'tipRollerDia', label: 'Uç makarası', group: 'Plaka', only: 'plaka', opts: [[0.012, 'Ø12'], [0.016, 'Ø16'], [0.02, 'Ø20']], unit: 'mm' },
  { key: 'hingeRollerDia', label: 'Menteşe makarası', group: 'Plaka', only: 'plaka', opts: [[0.012, 'Ø12'], [0.016, 'Ø16'], [0.02, 'Ø20']], unit: 'mm' },
  { key: 'vPlate', label: 'Strok hızı', unit: 'cm/s', k: 100, min: 20, max: 80, step: 5, digits: 0, group: 'Strok (zincir tahriki)' },
  { key: 'aPlate', label: 'Strok ivmesi', unit: 'm/s²', k: 1, min: 1, max: 5, step: 0.5, digits: 1, group: 'Strok (zincir tahriki)' },
  { key: 'noseT', label: 'Burnun inme süresi', unit: 's', k: 1, min: 0.1, max: 0.6, step: 0.05, digits: 2, group: 'Plaka', only: 'plaka' },
  { key: 'clearance', label: 'Plaka altı – çıta boşluğu', unit: 'mm', k: 1000, min: 2, max: 10, step: 0.5, digits: 1, group: 'Plaka', only: 'plaka' },
  { key: 'sagFull', label: 'Uç sehimi (tam yükte)', unit: 'mm', k: 1000, min: 0, max: 5, step: 0.2, digits: 1, group: 'Plaka', only: 'plaka', help: '5 cm plaka (10 dik 40×20×2) 1,4 · 3 cm (24 yatık 40×20×2) ~1,8 · 2,5 cm ~3,6 mm' },
  { key: 'syncErr', label: 'Bant hız hatası', unit: '%', k: 100, min: -5, max: 5, step: 0.5, digits: 1, group: 'Plaka', only: 'plaka', help: '+ ise bant plakadan hızlı sarar' },
  { key: 'rowGap', label: 'Sıra aralığı', unit: 'cm', k: 100, min: 1, max: 3, step: 0.5, digits: 1, group: 'Kat düzeni', help: 'hatta 2 cm; 3 cm\'de kat 85 cm olur, arka sıra plakanın arka ucuna 1 cm kalır' },
  { key: 'slat', label: 'Çıtalar', group: 'Ranza', opts: [['paralel', 'Paralel'], ['dik', 'Dik']] },
  { key: 'slatDev', label: 'Çıta yükseklik sapması', unit: 'mm', k: 1000, min: 0, max: 6, step: 0.5, digits: 1, group: 'Ranza', help: 'en fazla; çıtalara sabit bir desenle dağılır' },
  { key: 'kW', label: 'İz rijitliği k', unit: 'N/cm³', k: 1e-6, min: 50, max: 800, step: 25, digits: 0, group: 'Yaş kil (tahmin)', help: 'basınç = k × batma' },
  { key: 'pY', label: 'Akma basıncı', unit: 'kPa', k: 1e-3, min: 50, max: 600, step: 25, digits: 0, group: 'Yaş kil (tahmin)' },
  { key: 'muBelt', label: 'Sürtünme kil – bant', k: 1, min: 0.2, max: 1, step: 0.05, digits: 2, group: 'Yaş kil (tahmin)' },
  { key: 'muWood', label: 'Sürtünme kil – çıta', k: 1, min: 0.2, max: 1, step: 0.05, digits: 2, group: 'Yaş kil (tahmin)' },
  { key: 'muClay', label: 'Sürtünme kil – kil', k: 1, min: 0.2, max: 1, step: 0.05, digits: 2, group: 'Yaş kil (tahmin)' },
];
const fmtVal = (d: Def, v: Val): string => {
  if (d.opts) return d.opts.find((o) => o[0] === v)?.[1] ?? String(v);
  return `${tr((v as number) * (d.k ?? 1), d.digits ?? 1)}${d.unit ? ' ' + d.unit : ''}`;
};

const STORE = 'yukleme-ayar-v2';
/** Sayfanın başlangıç ayarları: tarak tutucu; önceki bantlı plaka karşılaştırma için seçilebilir */
const PAGE_DEFAULT: Readonly<PhysConfig> = PHYS_DEFAULT;
function loadSaved(): Partial<PhysConfig> {
  try {
    const s = localStorage.getItem(STORE);
    return s ? (JSON.parse(s) as Partial<PhysConfig>) : {};
  } catch {
    return {};
  }
}
function save(c: Partial<PhysConfig>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(c));
  } catch {
    /* özel pencere */
  }
}
const diffFromDefault = (c: PhysConfig): Partial<PhysConfig> => {
  const o: Partial<PhysConfig> = {};
  for (const d of DEFS) if (c[d.key] !== PAGE_DEFAULT[d.key]) (o as Record<string, Val>)[d.key] = c[d.key] as Val;
  return o;
};

// ---------- durum ----------
let cfg = physConfig(loadSaved());
let pending = { ...cfg };
let run = new LoadingRun(cfg);
let summary: Summary | null = null;
let tPlay = 0;
let playing = true;
let speed = 0.25;
let colorMode: ColorMode = 'iz';
let focusCol: number | null = null;
let selected: number | null = null;

// ---------- 3D ----------
const host = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
host.appendChild(renderer.domElement);
const ds = buildDetailScene(cfg, run.frames.nb);
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = true;
controls.zoomToCursor = true;
let dirty = true;
controls.addEventListener('change', () => (dirty = true));

type Cam = 'yan' | 'burun' | 'genel' | 'ustten' | 'arka';
const CAMS: [Cam, string][] = [
  ['burun', 'Yakın (izler)'],
  ['yan', 'Yandan'],
  ['genel', 'Genel'],
  ['arka', 'Ranza içinden'],
  ['ustten', 'Üstten'],
];
let cam: Cam | null = 'burun';
const camPose = (c: Cam): { pos: THREE.Vector3; target: THREE.Vector3 } => {
  const narrow = host.clientWidth < host.clientHeight;
  const k = narrow ? 1.7 : 1;
  switch (c) {
    case 'yan':
      return { pos: new THREE.Vector3(45, -300 * k, 18), target: new THREE.Vector3(45, 0, 8) };
    case 'burun': {
      // ranzanın içinden, köşe dikmelerinin arasından: burnu ve o anda inen sırayı izler
      const x = Math.max(14, Math.min(80, ds.tipX - 6));
      return { pos: new THREE.Vector3(x - 45, -150 * k, 34), target: new THREE.Vector3(x - 4, -28, 4) };
    }
    case 'genel':
      return { pos: new THREE.Vector3(-110, -190 * k, 150 * k), target: new THREE.Vector3(40, 0, 5) };
    case 'arka':
      return { pos: new THREE.Vector3(140, -38, 22), target: new THREE.Vector3(30, -20, 8) };
    case 'ustten':
      return { pos: new THREE.Vector3(45, -1, 330 * k), target: new THREE.Vector3(45, 0, 0) };
  }
};
let tween: { from: { pos: THREE.Vector3; target: THREE.Vector3 }; c: Cam; t0: number } | null = null;
// Üstten bakarken üst katların çıtaları aktif katı örter: aktif katın 26 cm üstünü kes.
const topClip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 26)];
const setCam = (c: Cam, instant = false) => {
  cam = c;
  renderer.clippingPlanes = c === 'ustten' ? topClip : [];
  document.querySelectorAll<HTMLButtonElement>('#cams button').forEach((b) => {
    const on = b.dataset.cam === c;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if (instant) {
    const p = camPose(c);
    camera.position.copy(p.pos);
    controls.target.copy(p.target);
    controls.update();
  } else tween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, c, t0: performance.now() };
  dirty = true;
};
controls.addEventListener('start', () => {
  if (tween) return;
  cam = null;
  document.querySelectorAll<HTMLButtonElement>('#cams button').forEach((b) => b.classList.remove('on'));
});

const resize = () => {
  const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (cam && !tween) setCam(cam, true);
  dirty = true;
};
new ResizeObserver(resize).observe(host);

const applyTheme = () => {
  const cs = getComputedStyle(document.documentElement);
  const g = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
  ds.setTheme(g('--scene', '#dcd9d1'), g('--floor', '#c2bcb0'), parseFloat(g('--sun', '2.1')) || 2.1);
  dirty = true;
  drawChart();
};
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
} catch {
  /* eski tarayıcı */
}

// dokunarak tuğla seçme
const ray = new THREE.Raycaster();
let down: [number, number] | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(ds.bricks.filter((b) => b.visible), false)[0];
  select(hit ? (hit.object.userData.brick as number) : null);
});

// ---------- arayüz ----------
const camsEl = $('cams');
for (const [c, label] of CAMS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.cam = c;
  b.textContent = label;
  b.addEventListener('click', () => setCam(c));
  camsEl.appendChild(b);
}
const bPlay = $<HTMLButtonElement>('bPlay');
const scrub = $<HTMLInputElement>('scrub');
const syncPlay = () => {
  bPlay.textContent = playing ? 'Durdur' : 'Oynat';
  bPlay.setAttribute('aria-pressed', String(playing));
};
bPlay.addEventListener('click', () => {
  if (!playing && tPlay >= run.world.rig.tl.end - 1e-3) tPlay = 0;
  playing = !playing;
  syncPlay();
});
scrub.addEventListener('input', () => {
  tPlay = (Number(scrub.value) / 1000) * run.world.rig.tl.end;
  playing = false;
  syncPlay();
  dirty = true;
});
document.querySelectorAll<HTMLButtonElement>('#speeds button').forEach((b) =>
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll<HTMLButtonElement>('#speeds button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
  }),
);
document.querySelectorAll<HTMLButtonElement>('#colors button').forEach((b) =>
  b.addEventListener('click', () => {
    colorMode = b.dataset.mode as ColorMode;
    document.querySelectorAll<HTMLButtonElement>('#colors button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    $('legend').dataset.mode = colorMode;
    dirty = true;
  }),
);
const bCol = $<HTMLButtonElement>('bCol');
bCol.addEventListener('click', () => {
  focusCol = focusCol === null ? 0 : focusCol >= 5 ? null : focusCol + 1;
  bCol.textContent = focusCol === null ? 'Sütun: hepsi' : `Sütun: ${focusCol + 1}`;
  bCol.classList.toggle('on', focusCol !== null);
  if (selected !== null && focusCol !== null && selected % 6 !== focusCol) select(null);
  dirty = true;
});

// sonuç / ayar paneli
const sheet = $('sheet');
const bSheet = $<HTMLButtonElement>('bSheet');
const wide = () => matchMedia('(min-width: 1000px)').matches;
const setSheet = (open: boolean) => {
  sheet.classList.toggle('open', open);
  bSheet.classList.toggle('on', open);
  bSheet.setAttribute('aria-expanded', String(open));
};
bSheet.addEventListener('click', () => setSheet(!sheet.classList.contains('open')));
$('sheetClose').addEventListener('click', () => setSheet(false));
setSheet(wide());
document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    $('tabSonuc').hidden = b.dataset.tab !== 'sonuc';
    $('tabAyar').hidden = b.dataset.tab !== 'ayar';
  }),
);

// ayar denetimleri
const form = $('ayarForm');
const inputs = new Map<keyof PhysConfig, (v: Val) => void>();
let lastGroup = '';
for (const d of DEFS) {
  if (d.group !== lastGroup) {
    const h = document.createElement('h3');
    h.textContent = d.group;
    const same = DEFS.filter((x) => x.group === d.group);
    if (same.every((x) => x.only && x.only === same[0].only)) h.dataset.only = same[0].only;
    form.appendChild(h);
    lastGroup = d.group;
  }
  const row = document.createElement('div');
  row.className = 'field';
  if (d.only) row.dataset.only = d.only;
  const lab = document.createElement('label');
  lab.textContent = d.label;
  const out = document.createElement('output');
  row.append(lab, out);
  if (d.opts) {
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', d.label);
    const btns = d.opts.map(([v, t]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t;
      b.addEventListener('click', () => setPending(d.key, v));
      seg.appendChild(b);
      return [v, b] as const;
    });
    row.appendChild(seg);
    inputs.set(d.key, (v) => {
      for (const [x, b] of btns) {
        b.classList.toggle('on', x === v);
        b.setAttribute('aria-pressed', String(x === v));
        if (d.key === 'tipRollerDia' || d.key === 'hingeRollerDia') {
          b.disabled = (x as number) + 2 * pending.beltThk > pending.plateThk + 1e-9;
        }
      }
      out.textContent = d.unit ? d.unit : '';
    });
  } else {
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = String(d.min);
    inp.max = String(d.max);
    inp.step = String(d.step);
    inp.setAttribute('aria-label', d.label);
    inp.addEventListener('input', () => setPending(d.key, Number(inp.value) / (d.k ?? 1)));
    row.appendChild(inp);
    inputs.set(d.key, (v) => {
      inp.value = String((v as number) * (d.k ?? 1));
      out.textContent = fmtVal(d, v);
    });
  }
  if (d.help) {
    const s = document.createElement('small');
    s.textContent = d.help;
    row.appendChild(s);
  }
  form.appendChild(row);
}
const bCalc = $<HTMLButtonElement>('bCalc');
const bDefault = $<HTMLButtonElement>('bDefault');
const ROLLERS = [0.02, 0.016, 0.012];
function setPending(key: keyof PhysConfig, v: Val) {
  (pending as Record<string, Val>)[key] = v;
  // makaralar (bant dahil) plaka kalınlığına sığmalı
  const room = pending.plateThk - 2 * pending.beltThk + 1e-9;
  for (const k of ['tipRollerDia', 'hingeRollerDia'] as const) {
    if (pending[k] > room) pending[k] = ROLLERS.find((d) => d <= room) ?? 0.012;
  }
  if (pending.tipRollerDia + 2 * pending.beltThk > pending.plateThk + 1e-9) pending.plateThk = Math.ceil((pending.tipRollerDia + 2 * pending.beltThk) * 200) / 200;
  syncForm();
}
function syncForm() {
  form.querySelectorAll<HTMLElement>('[data-only]').forEach((el) => (el.hidden = el.dataset.only !== pending.loader));
  for (const d of DEFS) inputs.get(d.key)!(pending[d.key] as Val);
  const changedRun = DEFS.some((d) => pending[d.key] !== cfg[d.key]);
  bCalc.disabled = !changedRun;
  bCalc.textContent = changedRun ? 'Yeniden hesapla' : 'Hesaplandı';
  const diff = DEFS.filter((d) => pending[d.key] !== PAGE_DEFAULT[d.key] && (!d.only || d.only === pending.loader));
  $('changed').textContent = diff.length
    ? 'Varsayılandan farklı: ' + diff.map((d) => `${d.label} ${fmtVal(d, PAGE_DEFAULT[d.key] as Val)} → ${fmtVal(d, pending[d.key] as Val)}`).join(' · ')
    : 'Bütün ayarlar varsayılan (CLAUDE.md ölçüleri).';
  bDefault.disabled = !diff.length;
}
bCalc.addEventListener('click', () => restart(pending));
bDefault.addEventListener('click', () => {
  pending = { ...PAGE_DEFAULT };
  syncForm();
  restart(pending);
});

function restart(c: PhysConfig) {
  cfg = { ...c };
  pending = { ...c };
  save(diffFromDefault(cfg));
  run = new LoadingRun(cfg);
  summary = null;
  tPlay = 0;
  playing = true;
  syncPlay();
  ds.rebuild(cfg);
  ds.rack.setSlatType(cfg.slat);
  select(null);
  syncForm();
  renderResults();
  dirty = true;
}

// ---------- seçili tuğla kartı + grafik ----------
const rowName = (r: number) => `${4 - r}. sıra`;
const rowHint = (r: number) => (r === 3 ? 'ranzanın dibi, ilk iner' : r === 0 ? 'ranza önü, son iner' : '');
function select(i: number | null) {
  selected = i;
  const info = $('info');
  info.hidden = i === null;
  if (i !== null) {
    const row = Math.floor(i / 6), col = i % 6;
    $('infoTitle').textContent = `Tuğla · ${rowName(row)}, ${col + 1}. sütun`;
    fillInfo();
  }
  drawChart();
  dirty = true;
}
$('infoClose').addEventListener('click', () => select(null));
function fillInfo() {
  if (selected === null) return;
  const el = $('infoDetail');
  const b = summary?.bricks[selected];
  if (!b) {
    el.textContent = 'Hesap bitince ölçümler burada.';
    return;
  }
  el.innerHTML = '';
  const items: [string, string][] = summary?.comb
    ? [
      ['Oturma hızı', `${tr(b.impact, 0)} cm/s`],
      ['En büyük eğim', `${tr(b.maxPitchDeg)}°`],
      ['Kenar ezilmesi', `${tr(b.dent, 2)} mm`],
      ['Pedde kayma', `${tr(b.slipPad, 1)} mm`],
      ['Dişe değme', Math.max(b.toothPick, b.toothCarry, b.toothOut) > 0.5 ? `${tr(Math.max(b.toothPick, b.toothCarry, b.toothOut), 0)} N` : 'değmedi'],
      ['Yer değiştirme', `${tr(Math.hypot(b.dx, b.dy), 1)} mm`],
    ]
    : [
      ['Çarpma', `${tr(b.impact, 0)} cm/s`],
      ['En büyük eğim', `${tr(b.maxPitchDeg)}°`],
      ['Kenar ezilmesi', `${tr(b.dent, 1)} mm`],
      ['Alt yüz izi', `${tr(b.faceDent, 2)} mm`],
      ['Komşuya kuvvet', b.brickF > 0.5 ? `${tr(b.brickF, 0)} N` : 'değmedi'],
      ['Yer değiştirme', `${tr(Math.hypot(b.dx, b.dy), 0)} mm`],
    ];
  for (const [k, v] of items) {
    const d = document.createElement('div');
    d.innerHTML = `<span>${k}</span><b>${v}</b>`;
    el.appendChild(d);
  }
}
const chart = $<HTMLCanvasElement>('chart');
function drawChart() {
  const F = run.frames;
  const wrap = chart.parentElement!;
  if (selected === null || !F.n) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = wrap.clientWidth || 300, H = 92;
  chart.width = W * dpr;
  chart.height = H * dpr;
  chart.style.height = H + 'px';
  const g = chart.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const cs = getComputedStyle(document.documentElement);
  const col = (k: string) => cs.getPropertyValue(k).trim();
  const T = run.world.rig.tl.end;
  const nb = F.nb, k = selected;
  const pitch: number[] = [], fb: number[] = [], fs: number[] = [];
  for (let i = 0; i < F.n; i++) {
    const o = (i * nb + k) * 7;
    const qw = F.pose[o + 3], qx = F.pose[o + 4], qy = F.pose[o + 5], qz = F.pose[o + 6];
    pitch.push(Math.asin(Math.max(-1, Math.min(1, -2 * (qx * qz - qw * qy)))) * DEG);
    fb.push(F.force[(i * nb + k) * 3 + 2]);
    fs.push(F.force[(i * nb + k) * 3 + 1]);
  }
  const pMax = Math.max(10, ...pitch.map(Math.abs));
  const fMax = Math.max(50, ...fb, ...fs.map((x) => Math.min(x, 400)));
  const x = (i: number) => (F.t[i] / T) * (W - 8) + 4;
  const top = 14, bot = H - 14;
  g.strokeStyle = col('--line');
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(4, bot);
  g.lineTo(W - 4, bot);
  g.stroke();
  const line = (arr: number[], max: number, color: string, w = 1.5) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    arr.forEach((v, i) => {
      const y = bot - (Math.max(0, Math.min(max, v)) / max) * (bot - top);
      if (i) g.lineTo(x(i), y);
      else g.moveTo(x(i), y);
    });
    g.stroke();
  };
  line(fs, fMax, col('--muted'), 1);
  line(fb, fMax, col('--bad'), 1.5);
  line(pitch, pMax, col('--accent'), 2);
  g.fillStyle = col('--muted');
  g.font = '500 10px ' + col('--font-num');
  g.fillText(`eğim ≤ ${tr(pMax, 0)}°`, 6, 10);
  g.fillStyle = col('--bad');
  g.fillText(`komşu ≤ ${tr(fMax, 0)} N`, W / 2 - 30, 10);
  g.fillStyle = col('--muted');
  g.fillText('çıta', W - 30, 10);
  const xp = (Math.min(tPlay, T) / T) * (W - 8) + 4;
  g.strokeStyle = col('--fg');
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(xp, top - 4);
  g.lineTo(xp, bot + 4);
  g.stroke();
}

// ---------- sonuçlar ----------
function card(title: string, value: string, sub: string, bad = false): string {
  return `<div class="card${bad ? ' bad' : ''}"><div class="ct">${title}</div><div class="cv">${value}</div><div class="cs">${sub}</div></div>`;
}
function renderResults() {
  const el = $('results');
  if (!summary) {
    el.innerHTML = `<p class="muted">Hesaplanıyor… ${Math.round(run.progress * 100)} %</p>`;
    return;
  }
  const S = summary, B = S.bricks;
  if (S.comb) {
    renderCombResults(el, S);
    return;
  }
  const arg = (f: (b: BrickSummary) => number) => B.reduce((a, b) => (f(b) > f(a) ? b : a));
  const hard = arg((b) => b.impact);
  const tilt = arg((b) => b.maxPitchDeg);
  const dent = arg((b) => b.dent);
  const face = arg((b) => b.faceDent);
  const push = arg((b) => b.brickF);
  const slide = arg((b) => Math.hypot(b.dx, b.dy));
  const lineP = arg((b) => b.faceP);
  const nTouch = B.filter((b) => b.brickF > 1).length;
  const where = (b: BrickSummary) => `${rowName(b.row)}, ${b.col + 1}. sütun`;
  const hEq = (hard.impact / 100) ** 2 / (2 * 9.81) * 100;
  const beltTxt = S.belt.maxN > 0
    ? `Temas: ${tr(S.belt.maxN, 0)} N bastırma, ${tr(S.belt.maxFric, 0)} N sürtünme; alt bant çıtaya ${tr(S.belt.slipV * 100, 0)} cm/s ters yönde kayar, ranzayı plakaya doğru çeker.`
    : `Temas yok. Plaka sehimi dahil (uçta tam yükte ${tr(S.sagFullMm, 1)} mm).`;
  const dY = cfg.pY / 1000;
  const html = [
    '<div class="cards">',
    card('Çıtaya çarpma, en sert', `${tr(hard.impact, 0)} cm/s`, `${where(hard)} · ≈ ${tr(hEq, 1)} cm'den serbest düşüş`),
    card('En büyük öne eğim', `${tr(tilt.maxPitchDeg, 0)}°`, `${where(tilt)} · yarı-statik hesap ${tr(quasiStaticTilt(cfg), 0)}° (komşusuz, hızsız)`),
    card('Kenar ezilmesi, en derin', `${tr(dent.dent, 1)} mm`, `${where(dent)} · çıta ${tr(dent.dentSlat, 1)} / plaka ${tr(dent.dentPlate, 1)} / komşu ${tr(dent.dentBrick, 1)} mm`, dent.dent > 3),
    card('Alt yüz izi, en derin', `${tr(face.faceDent, 2)} mm`, `${where(face)} · çıta izi`),
    card('Tuğla – tuğla teması', nTouch ? `${tr(push.brickF, 0)} N` : 'yok', nTouch ? `${nTouch}/24 tuğla komşusuna değdi · en çok ${where(push)}` : 'Hiçbir tuğla komşusuna değmedi', nTouch > 0),
    card('Yer değiştirme, en çok', `${tr(Math.hypot(slide.dx, slide.dy), 0)} mm`, `${where(slide)} · sıra arası en az ${tr(S.rowGapMin, 0)} mm (başta ${tr(cfg.rowGap * 1000, 0)})`, S.rowGapMin < 5),
    card('Alt bant – çıta, en az boşluk', `${tr(S.belt.minGapMm, 1)} mm`, beltTxt, S.belt.maxN > 0),
    card('Makara çizgisi / yüz basıncı', `${tr(lineP.faceP, 0)} kPa`, `${where(lineP)} · akma sınırı ${tr(dY, 0)} kPa`, lineP.faceP > dY * 1.02),
    '</div>',
    '<table class="rows"><thead><tr><th>Sıra</th><th>Eğim</th><th>Çarpma</th><th>Ezilme</th><th>Komşu</th></tr></thead><tbody>',
    ...[3, 2, 1, 0].map((r) => {
      const R = B.filter((b) => b.row === r);
      const mx = (f: (b: BrickSummary) => number) => Math.max(...R.map(f));
      return `<tr><td>${rowName(r)}<small>${rowHint(r)}</small></td><td>${tr(mx((b) => b.maxPitchDeg), 0)}°</td><td>${tr(mx((b) => b.impact), 0)} cm/s</td><td>${tr(mx((b) => b.dent), 1)} mm</td><td>${mx((b) => b.brickF) > 1 ? tr(mx((b) => b.brickF), 0) + ' N' : '–'}</td></tr>`;
    }),
    '</tbody></table>',
    `<p class="muted">Burun ${cfg.nose === 'egilir' ? `eğilir, ${tr(S.betaMaxDeg, 1)}° iner` : 'sabit'} · ${S.steps.toLocaleString('tr-TR')} adım × ${tr(cfg.dt * 1000, 1)} ms · hesap ${tr(S.wallMs / 1000, 1)} s.</p>`,
  ];
  el.innerHTML = html.join('');
  fillInfo();
}

function renderCombResults(el: HTMLElement, S: Summary) {
  const B = S.bricks, C = S.comb!;
  const arg = (f: (b: BrickSummary) => number) => B.reduce((a, b) => (f(b) > f(a) ? b : a));
  const where = (b: BrickSummary) => `${rowName(b.row)}, ${b.col + 1}. sütun`;
  const hard = arg((b) => b.impact);
  const tilt = arg((b) => b.maxPitchDeg);
  const dent = arg((b) => b.dent);
  const push = arg((b) => b.brickF);
  const slide = arg((b) => Math.hypot(b.dx, b.dy));
  const nTouch = B.filter((b) => b.brickF > 1).length;
  const hEq = ((hard.impact / 100) ** 2 / (2 * 9.81)) * 1000;
  const padKPa = cfg.padP / 1000;
  const tooth = Math.max(C.toothPickMax, C.toothCarryMax, C.toothOutMax);
  const toothTxt = tooth > 0
    ? `Alırken ${tr(C.toothPickMax, 0)} · taşırken ${tr(C.toothCarryMax, 0)} · çekerken ${tr(C.toothOutMax, 0)} N. Kamera / strok sensörü durdurmalı.`
    : 'Dişler tuğlaya hiç değmedi (alırken, taşırken, çekerken).';
  const html = [
    '<div class="cards">',
    card('Çıtaya oturma hızı', `${tr(hard.impact, 0)} cm/s`, `${where(hard)} · ≈ ${tr(hEq, 1)} mm'den düşüşe denk (plakada 48–79 cm/s)`),
    card('Tutma güvenliği', `${tr(C.sf, 1)}×`, `Ped ${tr(C.padForce, 0)} N (${tr(padKPa, 1)} kPa = ${tr(cfg.padP / 1e5, 2)} bar), μ ${tr(cfg.muPad, 2)}; ağırlık + ivme ${tr(cfg.mass * Math.hypot(9.81, cfg.aPlate), 0)} N`, C.sf < 1.5),
    card('Pedde kayma (taşırken)', `${tr(C.slipPadMax, 1)} mm`, C.slipPadMax > 1 ? 'Tuğla pedlere göre kaydı: basınç ya da sürtünme az' : 'Tuğlalar pedlerde yerinden oynamadı', C.slipPadMax > 1),
    card('Diş – tuğla teması', tooth > 0 ? `${tr(tooth, 0)} N` : 'yok', toothTxt, tooth > 0),
    card('En büyük eğim', `${tr(tilt.maxPitchDeg, 1)}°`, `${where(tilt)} · plakada 10–27°`),
    card('Kenar ezilmesi, en derin', `${tr(dent.dent, 2)} mm`, `${where(dent)} · yüz izi en çok ${tr(Math.max(...B.map((b) => b.faceDent)), 2)} mm`, dent.dent > 1),
    card('Tuğla – tuğla teması', nTouch ? `${tr(push.brickF, 0)} N` : 'yok', nTouch ? `${nTouch}/24 tuğla komşusuna değdi` : 'Hiçbir tuğla komşusuna değmedi', nTouch > 0),
    card('Yer değiştirme, en çok', `${tr(Math.hypot(slide.dx, slide.dy), 1)} mm`, `${where(slide)} · sıra arası en az ${tr(S.rowGapMin, 0)} mm (başta ${tr(cfg.rowGap * 1000, 0)}), sütun arası ${tr(S.colGapMin, 0)} mm`, S.rowGapMin < 10),
    '</div>',
    '<table class="rows"><thead><tr><th>Sıra</th><th>Eğim</th><th>Oturma</th><th>Ezilme</th><th>Komşu</th></tr></thead><tbody>',
    ...[3, 2, 1, 0].map((r) => {
      const R = B.filter((b) => b.row === r);
      const mx = (f: (b: BrickSummary) => number) => Math.max(...R.map(f));
      return `<tr><td>${rowName(r)}<small>${rowHint(r)}</small></td><td>${tr(mx((b) => b.maxPitchDeg), 1)}°</td><td>${tr(mx((b) => b.impact), 0)} cm/s</td><td>${tr(mx((b) => b.dent), 2)} mm</td><td>${mx((b) => b.brickF) > 1 ? tr(mx((b) => b.brickF), 0) + ' N' : '–'}</td></tr>`;
    }),
    '</tbody></table>',
    `<p class="muted">Tarak tutucu · çevrim ${tr(C.cycle, 1)} s (iniş → geri çekilme sonu) · ${S.steps.toLocaleString('tr-TR')} adım × ${tr(cfg.dt * 1000, 1)} ms · hesap ${tr(S.wallMs / 1000, 1)} s.</p>`,
  ];
  el.innerHTML = html.join('');
  fillInfo();
}

// ---------- döngü ----------
const phaseOf = (t: number) => {
  const ph = run.world.rig.tl.phases;
  let name = ph[0][1];
  for (const [t0, n] of ph) if (t >= t0) name = n;
  return name;
};
let last = performance.now();
let lastUi = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // hesap: kare başına ~35 ms (hesap sürerken sahne ~20 kare/s)
  if (!run.done) {
    run.advance(35);
    dirty = true;
  }
  if (run.done && !summary) {
    summary = run.summary();
    renderResults();
  }
  const T = run.world.rig.tl.end;
  const ready = run.world.t;
  if (playing) {
    tPlay += dt * speed;
    if (tPlay > ready) tPlay = ready;
    if (run.done && tPlay >= T) {
      tPlay = T;
      playing = false;
      syncPlay();
    }
    dirty = true;
  }
  if (tween) {
    const u = Math.min(1, (now - tween.t0) / 650);
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const to = camPose(tween.c);
    camera.position.lerpVectors(tween.from.pos, to.pos, e);
    controls.target.lerpVectors(tween.from.target, to.target, e);
    if (u >= 1) tween = null;
    dirty = true;
  } else if (cam === 'burun' && playing) {
    const to = camPose('burun');
    camera.position.lerp(to.pos, 0.08);
    controls.target.lerp(to.target, 0.08);
  }
  controls.update();
  if (dirty) {
    ds.show(run.frames, tPlay, colorMode, focusCol, selected);
    renderer.render(ds.scene, camera);
    dirty = false;
  }
  if (now - lastUi > 90) {
    lastUi = now;
    $('tNow').textContent = `${tr(tPlay, 2)} s`;
    $('phase').textContent = phaseOf(tPlay);
    const calc = $('calc');
    calc.textContent = run.done ? `hız ${tr(speed, 2).replace(/,?0+$/, '')}×` : `hesaplanıyor ${Math.round(run.progress * 100)} %`;
    calc.classList.toggle('busy', !run.done);
    $('progress').style.width = `${run.progress * 100}%`;
    scrub.value = String(Math.round((tPlay / T) * 1000));
    if (!summary) renderResults();
    if (selected !== null) drawChart();
  }
  requestAnimationFrame(frame);
}

syncPlay();
syncForm();
renderResults();
applyTheme();
resize();
setCam('burun', true);
requestAnimationFrame(frame);
Object.assign(window as unknown as Record<string, unknown>, { run, ds });
