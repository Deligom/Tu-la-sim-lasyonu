// Açılır panel (Aşama 4): Durum (uyarı satırı, darboğaz, kartlar, şerit teşhisi), Ayarlar (2D'deki sürgüler,
// değişenler, varsayılana dön, teşhisi kopyala), Hesap (teorik tablo). Hesaplar 2D'deki updateUI() / calc()
// ile aynı; yükleyici artık tarak (mantık modeli 2D'nin plaka evreleriyle çalışıyor).

import type { SimLoop } from '../sim/loop';
import type { Simulation } from '../sim/sim';
import { DEFAULT_PARAMS, cloneParams, type AccMode, type Params } from '../sim/params';
import { avg, theory } from '../sim/stats';
import { Rig } from '../phys/rig';
import { physConfig } from '../phys/config';
import { LAYOUT_KEYS, changedParams, reloadWith, saveStored, type Stored } from './settings';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Key = Exclude<keyof Params, 'rate' | 'acc'> | 'r0' | 'r1' | 'r2';
interface Slider {
  k: Key;
  lab: string;
  min: number;
  max: number;
  step: number;
  u: string;
}
type Item = Slider | { g: string };

const SL: Item[] = [
  { g: 'Pres' },
  { k: 'r0', lab: 'Şerit 1 hızı', min: 20, max: 200, step: 1, u: 'tuğla/dk' },
  { k: 'r1', lab: 'Şerit 2 (orta) hızı', min: 20, max: 200, step: 1, u: 'tuğla/dk' },
  { k: 'r2', lab: 'Şerit 3 hızı', min: 20, max: 200, step: 1, u: 'tuğla/dk' },
  { k: 'N', lab: 'Kesimde şerit başına tuğla', min: 4, max: 12, step: 1, u: 'adet' },
  { g: 'Birikme ve ön hazırlık' },
  { k: 'nZones', lab: 'Birikme bölgesi sayısı (şerit başına)', min: 1, max: 10, step: 1, u: 'bölge' },
  { k: 'vb', lab: 'Hızlandırma bölgesi', min: 40, max: 400, step: 5, u: 'cm/s' },
  { k: 'va', lab: 'Birikme / dozaj bölgeleri', min: 40, max: 400, step: 5, u: 'cm/s' },
  { k: 'vz', lab: 'Ön hazırlık indeksleme', min: 40, max: 500, step: 5, u: 'cm/s' },
  { k: 'gateT', lab: 'Kapak kapanma / açılma', min: 0.05, max: 1.5, step: 0.05, u: 's' },
  { k: 'liftT', lab: 'Pop-up kalkma / inme', min: 0.05, max: 1, step: 0.05, u: 's' },
  { k: 'tSpeed', lab: 'Pop-up yan transfer', min: 30, max: 400, step: 5, u: 'cm/s' },
  { k: 'pushV', lab: 'Artık itici hızı', min: 30, max: 300, step: 10, u: 'cm/s' },
  { g: 'Yükleme istasyonları' },
  { k: 'exitSpeed', lab: 'Kat transfer / tampon bandı', min: 20, max: 300, step: 5, u: 'cm/s' },
  { k: 'Bcap', lab: 'Tampon (kat)', min: 0, max: 3, step: 1, u: 'kat' },
  { k: 'vPlate', lab: 'Tarak giriş / çıkış hızı', min: 15, max: 150, step: 5, u: 'cm/s' },
  { k: 'liftSpeed', lab: 'Ranza kaldırıcı hızı', min: 5, max: 60, step: 1, u: 'cm/s' },
  { k: 'swapT', lab: 'Ranza değişim süresi', min: 2, max: 30, step: 1, u: 's' },
  { k: 'badLevel', lab: 'Yamuk kat oranı (lazer görür, kat atlanır)', min: 0, max: 50, step: 1, u: '%' },
  { g: 'Ranza taşıma' },
  { k: 'inCap', lab: 'Boş ranza giriş kapasitesi', min: 1, max: 8, step: 1, u: 'ranza' },
  { k: 'outCap', lab: 'Dolu ranza çıkış kapasitesi', min: 1, max: 8, step: 1, u: 'ranza' },
  { k: 'nVeh', lab: 'Taşıyıcı sayısı (AGV)', min: 1, max: 8, step: 1, u: 'araç' },
  { k: 'tripT', lab: 'Taşıyıcı tur süresi', min: 15, max: 300, step: 5, u: 's' },
];
const SLIDERS = SL.filter((o): o is Slider => 'k' in o);
const isLayout = (k: Key) => (LAYOUT_KEYS as readonly string[]).includes(k);

const ACC_NOTE: Record<AccMode, string> = {
  zpa: 'Her şeritte bölgeler ayrı motorlu (ya da tek motor + bölge başına elektromanyetik kavrama). Önündeki bölge doluysa bölge, tuğlası uçtaki sensöre gelince durur. Tuğla hiç kaymaz, hiç değmez.',
  single: 'Kuyruk oluşunca bant dönmeye devam eder, tuğlalar birbirine dayanır ve altlarından bant kayar. Yaş tuğlada köşe ezilmesi ve alt yüzey aşınması demek.',
};

const num = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
const pct = (v: number) => `%${Math.round(v * 100)}`;
const fmtT = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmtVal = (v: number, step: number) => (step < 1 ? num(v, 2).replace(/0$/, '') : String(v));

export type Tab = 'durum' | 'ayarlar' | 'hesap';

export interface Sheet {
  /** Paneli aç (aynı sekme açıksa kapat) */
  toggle(tab: Tab): void;
  readonly open: Tab | null;
  onChange(cb: (open: Tab | null) => void): void;
  update(): void;
}

/**
 * @param stored kalıcı ayarlar (raf düğmeleri dahil; burada yalnızca parametreler yazılır)
 */
export function initSheet(loop: SimLoop, sim: Simulation, stored: Stored): Sheet {
  const P = sim.params;
  const sheet = $('sheet');
  const tabs = [...sheet.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const panes = [...sheet.querySelectorAll<HTMLElement>('[data-pane]')];
  let open: Tab | null = null;
  const listeners: ((t: Tab | null) => void)[] = [];

  const show = (t: Tab | null) => {
    open = t;
    sheet.hidden = !t;
    document.getElementById('app')!.classList.toggle('sheet-open', !!t);
    for (const b of tabs) {
      b.classList.toggle('on', b.dataset.tab === t);
      b.setAttribute('aria-selected', String(b.dataset.tab === t));
    }
    for (const p of panes) p.hidden = p.dataset.pane !== t;
    for (const cb of listeners) cb(t);
    if (t) update(true);
  };
  for (const b of tabs) b.addEventListener('click', () => show(b.dataset.tab as Tab));
  $('sheetClose').addEventListener('click', () => show(null));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) show(null);
  });

  // ---------- ayarlar ----------
  const getP = (k: Key): number => (k[0] === 'r' && k.length === 2 ? P.rate[+k[1]] : (P[k as keyof Params] as number));
  const setP = (k: Key, v: number) => {
    if (k[0] === 'r' && k.length === 2) P.rate[+k[1]] = v;
    else (P as unknown as Record<string, number>)[k] = v;
  };
  const defP = (k: Key): number =>
    k[0] === 'r' && k.length === 2 ? DEFAULT_PARAMS.rate[+k[1]] : (DEFAULT_PARAMS[k as keyof Params] as number);

  const persist = () => {
    stored.params = changedParams(P);
    saveStored(stored);
  };

  const acc = $<HTMLSelectElement>('acc');
  const accNote = $('accNote');
  acc.value = P.acc;
  accNote.textContent = ACC_NOTE[P.acc];
  acc.addEventListener('change', () => {
    P.acc = acc.value as AccMode;
    accNote.textContent = ACC_NOTE[P.acc];
    persist();
    loop.reset();
    update(true);
  });

  const sliders = $('sliders');
  const outs = new Map<Key, HTMLOutputElement>();
  const inputs = new Map<Key, HTMLInputElement>();
  const showVal = (o: Slider) => {
    const v = getP(o.k);
    const extra = o.k[0] === 'r' && o.k.length === 2 ? ` (${num((v * P.L) / 60)} cm/s)` : '';
    outs.get(o.k)!.textContent = `${fmtVal(v, o.step)} ${o.u}${extra}`;
    outs.get(o.k)!.classList.toggle('chg', v !== defP(o.k));
  };
  const buildSliders = () => {
    sliders.textContent = '';
    for (const o of SL) {
      if ('g' in o) {
        const h = document.createElement('div');
        h.className = 'grp';
        h.textContent = o.g;
        sliders.appendChild(h);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'srow';
      const lab = document.createElement('label');
      lab.htmlFor = `i_${o.k}`;
      lab.textContent = o.lab + (isLayout(o.k) ? ' ·' : '');
      if (isLayout(o.k)) lab.title = 'Değişince sahne yeniden kurulur';
      const out = document.createElement('output');
      out.id = `o_${o.k}`;
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.id = `i_${o.k}`;
      inp.min = String(o.min);
      inp.max = String(o.max);
      inp.step = String(o.step);
      inp.value = String(getP(o.k));
      row.append(lab, out, inp);
      sliders.appendChild(row);
      outs.set(o.k, out);
      inputs.set(o.k, inp);
      showVal(o);
      if (isLayout(o.k)) {
        // yerleşim değişiyor: bırakınca sahneyi yeniden kur
        inp.addEventListener('input', () => {
          setP(o.k, +inp.value);
          showVal(o);
        });
        inp.addEventListener('change', () => {
          setP(o.k, +inp.value);
          stored.params = changedParams(P);
          $('rebuildNote').hidden = false;
          reloadWith(stored);
        });
      } else {
        inp.addEventListener('input', () => {
          setP(o.k, +inp.value);
          showVal(o);
          persist();
          update(true);
        });
      }
    }
  };
  buildSliders();

  $('bDefaults').addEventListener('click', () => {
    const layoutChanged = LAYOUT_KEYS.some((k) => P[k] !== DEFAULT_PARAMS[k]);
    Object.assign(P, cloneParams());
    stored.params = {};
    if (layoutChanged) {
      $('rebuildNote').hidden = false;
      reloadWith(stored);
      return;
    }
    saveStored(stored);
    acc.value = P.acc;
    accNote.textContent = ACC_NOTE[P.acc];
    for (const o of SLIDERS) {
      inputs.get(o.k)!.value = String(getP(o.k));
      showVal(o);
    }
    loop.reset();
    update(true);
  });

  const bDiag = $<HTMLButtonElement>('bDiag');
  const diagOut = $<HTMLTextAreaElement>('diagOut');
  bDiag.addEventListener('click', () => {
    const txt = diagJSON();
    diagOut.hidden = false;
    diagOut.value = txt;
    diagOut.select();
    const done = (ok: boolean) => (bDiag.textContent = ok ? 'Kopyalandı ✓' : 'Kutudan kopyala');
    try {
      navigator.clipboard.writeText(txt).then(() => done(true), () => done(false));
    } catch {
      done(false);
    }
  });

  $('bFF').addEventListener('click', () => {
    loop.stepN(Math.round(600 / 0.005));
    update(true);
  });

  const changedText = () => {
    const out: string[] = [];
    for (const o of SLIDERS) {
      const a = getP(o.k), b = defP(o.k);
      if (a !== b) out.push(`${o.lab}: ${fmtVal(a, o.step)} ${o.u} (varsayılan ${fmtVal(b, o.step)})`);
    }
    if (P.acc !== DEFAULT_PARAMS.acc) out.push('Birikme bandı: tek parça');
    return out.length ? 'Değiştirilen ayarlar: ' + out.join(' · ') : 'Tüm ayarlar varsayılan.';
  };

  // ---------- durum ----------
  const G = () => sim.layout;
  const laneDiag = (): string[] => {
    const S = sim.S, L = P.L, GATE = G().GATE;
    const GATE_TR = { open: 'açık', closing: 'kapanıyor', closed: 'kapalı', opening: 'açılıyor' } as const;
    return S.lanes.map((ln, i) => {
      const lb = S.bricks.filter((b) => b.lane === i && b.st === 'belt');
      const rel = lb.filter((b) => b.x + L > GATE + 0.5).length;
      const w = lb.some((b) => b.x + L >= GATE - 0.3 && b.x + L <= GATE + 0.3);
      const gate = GATE_TR[ln.gate];
      let why: string;
      if (!w) why = rel >= 4 ? '4 tamam' : 'dozajda tuğla yok, bekliyor';
      else if (!ln.meter) why = '4 tamam, 5. bekliyor';
      else if (ln.gate !== 'open') why = 'kapak ' + gate;
      else if (S.zone.phase !== 'fill') why = 'blok aktarılıyor';
      else why = 'bırakılıyor';
      return `Ş${i + 1}: ${rel}/4 · kapak ${gate} · ${why}`;
    });
  };

  const stEst = () => {
    const recv = 82 / P.exitSpeed, lift = 30 / P.liftSpeed, ins = G().DX / P.vPlate;
    return { lvl: Math.max(recv, lift) + 2 * ins, ins };
  };
  let combCache = { v: NaN, cycle: 0 };
  const combCycle = () => {
    if (combCache.v !== P.vPlate) {
      const r = new Rig(physConfig({ vPlate: P.vPlate / 100 }));
      combCache = { v: P.vPlate, cycle: r.ctl ? r.ctl.outEnd - r.ctl.descStart : NaN };
    }
    return combCache.cycle;
  };

  const status = (): { cls: '' | 'ok' | 'warn' | 'bad'; text: string } => {
    const S = sim.S, t = S.t, th = theory(P);
    if (S.anomaly)
      return { cls: 'bad', text: `✗ Simülasyon hatası: Ş${S.anomaly.lane + 1} ${S.anomaly.t}. saniyede bırakma izni olduğu halde tuğlayı bırakmadı. "Teşhis bilgisini kopyala"ya basıp bana yapıştırır mısın?` };
    const rw = S.sides.some((x) => t > 60 && x.rackWait / t > 0.05);
    const mx = Math.max(...S.qmax);
    if (S.lost > 0) return { cls: 'bad', text: `✗ Hat taşıyor: ${S.lost} tuğla kesiciye dayanan kuyruk yüzünden kaybedildi.` };
    if (t < 12) return { cls: '', text: 'Isınıyor… (ilk kesimler banda iniyor)' };
    if (S.contacts > 0 && P.acc === 'zpa') return { cls: 'warn', text: `⚠ Kuyruk birikme bölgelerini aştı: tuğlalar ${S.contacts} kez birbirine değdi.` };
    if (S.contacts > 0) return { cls: 'warn', text: `⚠ Tek parça bantta kuyrukta bekleyen tuğlalar ${S.contacts} kez birbirine çarptı, bant ${S.slips} kez altlarından kaydı.` };
    if (S.midScrap > 0) return { cls: 'warn', text: `⚠ Orta şerit en yavaş değil: ortada ${S.midScrap} artık oluştu, yandan itilemez. Kalıpta orta çıkışı biraz daha frenle.` };
    if (t > 60 && S.wTable / t > 0.05) return { cls: 'warn', text: '⚠ Ön hazırlık, dolu tablaları bekliyor: yükleme istasyonları ya da ranza taşıma yetişmiyor, kuyruk geriye doğru büyüyor.' };
    if (rw) return { cls: 'warn', text: '⚠ Taraklar ranza bekliyor: taşıyıcılar ya da ranza değişimi yetişmiyor.' };
    if (mx >= P.nZones) return { cls: 'warn', text: '⚠ Sınırda: birikme bölgeleri neredeyse doldu.' };
    return { cls: 'ok', text: `✓ Hat dengede: dakikada ${th.bpm} tuğla, temas yok, iki istasyon ve ranza taşıma yetişiyor.` };
  };

  /** Ölçülen doluluklar; en doluyu darboğaz say */
  const bottleneck = () => {
    const S = sim.S, t = Math.max(S.t, 1e-6);
    const rows: { name: string; v: number; sub: string; res: boolean }[] = [];
    if (P.acc === 'zpa') rows.push({ name: 'Birikme (en dolu şerit)', v: Math.max(...S.qmax) / (P.nZones + 1), sub: `en çok ${Math.max(...S.qmax)} / ${P.nZones + 1} tuğla`, res: true });
    rows.push({ name: 'Ön hazırlık tabla bekliyor', v: S.wTable / t, sub: 'zamanın payı (0 olmalı)', res: false });
    S.sides.forEach((x, k) => rows.push({ name: `Tarak ${k ? 'B' : 'A'} (giriş + çıkış)`, v: x.loadBusy / t, sub: `kat bekleme ${pct(x.starve / t)} · ranza bekleme ${pct(x.rackWait / t)}`, res: true }));
    const vb = S.veh.reduce((a, v) => a + v.busyT, 0);
    rows.push({ name: 'Taşıyıcılar', v: vb / (t * Math.max(1, S.veh.length)), sub: `${S.veh.length} araç, tur ${P.tripT} s`, res: true });
    let top = -1;
    rows.forEach((r, i) => {
      if (r.res && (top < 0 || r.v > rows[top].v)) top = i;
    });
    return { rows, top };
  };

  const cards = $('cards');
  const card = (k: string, v: string, s: string) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;

  const renderDurum = () => {
    const S = sim.S, t = S.t, m = t / 60, ok = t > 8, th = theory(P);
    const st = status();
    const stEl = $('status');
    stEl.className = `status ${st.cls}`;
    stEl.textContent = st.text;

    const bn = bottleneck();
    $('bneck').innerHTML = bn.rows
      .map((r, i) => {
        const w = Math.max(0, Math.min(1, r.v));
        const hot = i === bn.top && t > 30;
        return `<div class="bn${hot ? ' hot' : ''}${!r.res && r.v > 0.05 ? ' warn' : ''}"><div class="bn-h"><span>${r.name}${hot ? ' · darboğaz' : ''}</span><b>${t > 1 ? pct(r.v) : '–'}</b></div>` +
          `<div class="bar"><i style="width:${(w * 100).toFixed(1)}%"></i></div><div class="bn-s">${r.sub}</div></div>`;
      })
      .join('');

    const bt = avg(S.blockTimes);
    const nb = S.blockDir[0] + S.blockDir[1];
    const racks = S.sides[0].racks + S.sides[1].racks;
    const skipped = S.sides[0].skipped + S.sides[1].skipped;
    const rejected = S.sides[0].rejected + S.sides[1].rejected;
    const vb = S.veh.reduce((a, v) => a + v.busyT, 0);
    const av = S.scrap.map((x) => (S.cuts ? x / S.cuts : 0));
    const pc = S.scrap.map((x) => {
      const tot = x + S.cuts * P.N * P.L;
      return tot ? (x / tot) * 100 : 0;
    });
    const needRacks = (th.bpm * 60) / 24 / (5 * Math.max(0.01, 1 - P.badLevel / 100));
    const html = [
      card('Süre', fmtT(t), 'simülasyon zamanı'),
      card('Üretim (tuğla/dk)', ok ? String(Math.round(S.produced / m)) : '–', `kesim her ${num(th.cutT, 2)} s`),
      card('Tuğla teması / bant kayması', `${S.contacts} / ${S.slips}`, P.acc === 'zpa' ? 'bölgeli bantta 0 olmalı' : 'tek bantta kuyruk = çarpışma'),
      card('Birikme kuyruğu (Ş1 · Ş2 · Ş3)', S.q.join(' · '), `en çok: ${S.qmax.join(' · ')} · kapasite ${P.acc === 'zpa' ? P.nZones + 1 : '—'}/şerit`),
      card('Blok çevrimi (3×4)', bt ? `${num(bt, 2)} s` : '–', `gereken ≤ ${num(th.blockT, 2)} s · doldurma ${nb ? num(S.wFill / nb, 2) : '–'} s, tabla bekleme ${nb ? num(S.wTable / nb, 2) : '–'} s · A ${S.blockDir[0]} / B ${S.blockDir[1]}`),
      card('Hazır kat (A + B)', String(S.levels), ok ? `${num(S.levels / m)} kat/dk · gereken ${num(th.bpm / 24)}` : ''),
      ...S.sides.map((x, k) => card(`İstasyon ${k ? 'B' : 'A'}`, `${x.loaded} kat · tampon ${x.groups.length}/${P.Bcap}`, t > 1 ? `tarak ${pct(x.loadBusy / t)} dolu · kat bekleme ${pct(x.starve / t)} · ranza bekleme ${pct(x.rackWait / t)}` : '')),
      card('Dolan ranza', String(racks), (t > 30 ? `${Math.round(racks / (t / 3600))} ranza/saat · gereken ${Math.round(needRacks)}` : '') + (skipped || P.badLevel ? ` · yamuk kat atlandı ${skipped}${rejected ? ` · boş çıkan ${rejected}` : ''}` : '')),
      card('Taşıyıcılar', t > 1 ? pct(vb / (t * S.veh.length)) : '–', t > 30 ? `${Math.round(S.tripsV / (t / 3600))} sefer/saat · ${S.veh.length} araç` : ''),
      card('Artık / kesim (Ş1 · Ş2 · Ş3)', av.map((a) => num(a)).join(' · ') + ' cm', `çamur %${pc.map((p) => num(p)).join(' · %')} · yandan itilen ${S.scrapPushed} · ortada artık ${S.midScrap}`),
      card('Taşan tuğla', String(S.lost), `kapak sensörü tetik: ${S.trips}`),
    ];
    cards.innerHTML = html.join('');
    $('laneDiag').innerHTML = laneDiag().map((l) => `<div>${l}</div>`).join('');
    $('changed').textContent = changedText();
  };

  const renderHesap = () => {
    const th = theory(P), e = stEst(), S = sim.S;
    const bt = avg(S.blockTimes);
    const rackNeed = 5 * e.lvl + P.swapT + 120 / P.liftSpeed;
    const keep = Math.max(0.01, 1 - P.badLevel / 100);
    const racksH = (th.bpm * 60) / 24 / (5 * keep);
    const cc = combCycle();
    const rows: [string, string][] = [
      ['Kesim aralığı (en yavaş şerit 8 tuğla boyuna ulaşınca)', `${num(th.cutT, 2)} s`],
      ['Üretim', `${th.bpm} tuğla/dk · ${(th.bpm * 60).toLocaleString('tr-TR')}/saat`],
      ['3×4 blok geliş aralığı (ön hazırlığın sınırı)', `${num(th.blockT, 2)} s`],
      ['Ölçülen ortalama blok çevrimi', bt ? `${num(bt, 2)} s` : '–'],
      ['Her istasyona kat gelme aralığı', `${num(2 * th.levelT, 2)} s`],
      ['Yükleyici çevrimi, mantık modeli (2D plaka evreleri): max(kat alma, kaldırıcı 30 cm) + giriş + çıkış', `${num(e.lvl, 2)} s`],
      [`Tarak çevrimi, fizikli model (${P.vPlate} cm/s): in, şişir, gir, indir, söndür, çık · 3D'de ~8,8 s'yi geçince hat taşmaya başlıyor (240/dk)`, isFinite(cc) ? `${num(cc)} s` : '–'],
      ['Ranza başına: 5 kat + değişim + boş ranzayı 120 cm kaldırma / kullanılabilir', `${num(rackNeed)} s / ${num(2 * th.rackT)} s`],
      [`Ranza ihtiyacı (A + B)${P.badLevel ? `, yamuk kat %${P.badLevel} ile ranza başına ~${num(5 * keep)} kat` : ''}`, `${Math.round(racksH)} ranza/saat`],
      ['Gereken taşıyıcı (sefer = 1 dolu götür + 1 boş getir)', `${num((racksH * P.tripT) / 3600, 2)} araç`],
      ['Artık oranı (Ş1 · Ş2 · Ş3)', P.rate.map((r) => `%${num(((r - th.rmin) / r) * 100)}`).join(' · ')],
    ];
    $('calc').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  };

  const diagJSON = () => {
    const S = sim.S, GATE = G().GATE;
    const rel = (x: number) => +(x - GATE).toFixed(3);
    return JSON.stringify({
      v: 'sim3d-2026-11-23', t: +S.t.toFixed(2), P, anomaly: S.anomaly, zone: S.zone.phase,
      lanes: S.lanes.map((ln, i) => ({
        meter: ln.meter, gate: ln.gate, gt: +(ln.gt || 0).toFixed(3), prepRun: !!ln.prepRun, run: ln.run.map((x) => (x ? 1 : 0)).join(''),
        bricks: S.bricks.filter((b) => b.lane === i && b.st === 'belt').sort((a, b) => b.x - a.x).slice(0, 10).map((b) => rel(b.x)),
      })),
      tables: S.tables.map((T) => ({ next: T.next, exiting: !!T.exiting, halves: T.halves.map((h) => !!h) })),
      sides: S.sides.map((sd) => ({ plate: sd.plate.phase, rack: sd.rack.phase, levels: sd.rack.levels, filled: sd.rack.filled, bad: sd.rack.bad, groups: sd.groups.length, skipped: sd.skipped })),
      lost: S.lost, contacts: S.contacts,
    });
  };

  let lastT = -1;
  function update(force = false) {
    if (!open) return;
    const t = sim.S.t;
    if (!force && t === lastT) return;
    lastT = t;
    if (open === 'durum') renderDurum();
    else if (open === 'hesap') renderHesap();
    else $('changed2').textContent = changedText();
  }

  return {
    toggle(tab) {
      show(open === tab ? null : tab);
    },
    get open() {
      return open;
    },
    onChange(cb) {
      listeners.push(cb);
    },
    update: () => update(),
  };
}
