// Ana sahnenin kalıcı ayarları (Aşama 4): değiştirilen parametreler ve rafın düğmeleri tarayıcıda saklanır.
// Depolama yoksa (gizli pencere, önizleme) sayfa varsayılanlarla açılır. Yerleşimi değiştiren ayarlarda sahne
// yeniden kurulur (sayfa yenilenir); depolama yazılamıyorsa ayarlar o yenileme için adresin #'inden taşınır.

import { DEFAULT_PARAMS, type Params } from '../sim/params';
import type { LoaderKind } from '../phys/config';
import type { SlatType } from '../scene/rack';

const KEY = 'tugla-hat-ayar-v1';
const HASH = '#ayar=';

export interface Stored {
  /** Yalnızca varsayılandan farklı olanlar */
  params?: Partial<Params>;
  loader?: LoaderKind;
  slat?: SlatType;
  labels?: boolean;
}

/** Hattın yerleşimini (sahnedeki parçaları) değiştiren parametreler: değişince sahne yeniden kurulur. */
export const LAYOUT_KEYS = ['N', 'nZones', 'Bcap', 'nVeh'] as const;

function clean(raw: unknown): Stored {
  const out: Stored = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (r.loader === 'plaka' || r.loader === 'tarak') out.loader = r.loader;
  if (r.slat === 'paralel' || r.slat === 'dik') out.slat = r.slat;
  if (typeof r.labels === 'boolean') out.labels = r.labels;
  const p = r.params as Record<string, unknown> | undefined;
  if (p && typeof p === 'object') {
    const q: Partial<Params> = {};
    const D = DEFAULT_PARAMS as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(p)) {
      if (!(k in D)) continue;
      if (k === 'rate') {
        if (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && isFinite(x) && x > 0))
          q.rate = [v[0], v[1], v[2]];
      } else if (k === 'acc') {
        if (v === 'zpa' || v === 'single') q.acc = v;
      } else if (typeof v === 'number' && isFinite(v) && typeof D[k] === 'number') {
        (q as Record<string, number>)[k] = v;
      }
    }
    out.params = q;
  }
  return out;
}

export function loadStored(): Stored {
  try {
    if (location.hash.startsWith(HASH)) {
      const s = clean(JSON.parse(decodeURIComponent(location.hash.slice(HASH.length))));
      history.replaceState(null, '', location.pathname + location.search);
      return s;
    }
  } catch {
    /* bozuk adres: yok say */
  }
  try {
    const t = localStorage.getItem(KEY);
    return t ? clean(JSON.parse(t)) : {};
  } catch {
    return {};
  }
}

/** Kaydet; yazılabildiyse true. */
export function saveStored(s: Stored): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** Sahneyi yeniden kurmak için sayfayı yenile (ayarlar depoya ya da adrese yazılmış olmalı). */
export function reloadWith(s: Stored): void {
  if (saveStored(s)) location.reload();
  else {
    location.hash = HASH.slice(1) + encodeURIComponent(JSON.stringify(s));
    location.reload();
  }
}

/** Varsayılandan farklı parametreler */
export function changedParams(P: Readonly<Params>): Partial<Params> {
  const out: Partial<Params> = {};
  const D = DEFAULT_PARAMS as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(P)) {
    const d = D[k];
    if (k === 'rate') {
      const a = v as number[], b = d as number[];
      if (a.some((x, i) => x !== b[i])) out.rate = [a[0], a[1], a[2]];
    } else if (v !== d) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
