// Senaryo karşılaştırması (fizikli yükleme): npx tsx scripts/phys-cmp.ts [tarak|genel|burun]
// tarak: yükleyici (2026-11-22 kesin); genel / burun: önceki bantlı plaka (karşılaştırma).
// Her senaryo için tam kat çevrimi; sıra başına en büyük eğim (1→4. sıra değil, ranza önünden dibe), çarpma, ezilme, temas.

import { physConfig } from '../src/phys/config';
import { runLoading } from '../src/phys/run';
const GENEL: [string, any][] = [
  ['varsayılan (eğilir, 50 cm/s)', {}],
  ['sabit burun', { nose: 'sabit' }],
  ['eğilir, 25 cm/s', { vPlate: 0.25 }],
  ['eğilir, Ø12 uç', { tipRollerDia: 0.012 }],
  ['dik çıta', { slat: 'dik' }],
  ['çıta sapması ±4 mm', { slatDev: 0.004 }],
  ['boşluk 2 mm', { clearance: 0.002 }],
  ['bant %3 hızlı', { syncErr: 0.03 }],
];
// 2026-11-22: uzun burun (30–40 cm) ve ince plaka (2–3 cm) önerisi; kullanıcı 5 cm + 35 cm burun + Ø12 uç seçti
// (varsayılan). Makaralar plaka kalınlığına sığmalı.
const r = (d: number) => ({ tipRollerDia: d, hingeRollerDia: d });
const BURUN: [string, any][] = [
  ['ilk taslak 5cm, eğilir 11cm, Ø20', { noseLen: 0.11, ...r(0.02) }],
  ['5cm, eğilir 30cm, Ø20', { noseLen: 0.30, ...r(0.02) }],
  ['5cm, eğilir 40cm, Ø20', { noseLen: 0.40, ...r(0.02) }],
  ['VARSAYILAN 5cm, eğilir 35cm, uç Ø12', {}],
  ['3cm, eğilir 35cm, uç Ø12, sehim 1,8', { plateThk: 0.03, sagFull: 0.0018 }],
  ['3cm, sabit, Ø12', { plateThk: 0.03, nose: 'sabit', ...r(0.012) }],
  ['2,5cm, eğilir 35cm, Ø16/Ø12, sehim 3,6', { plateThk: 0.025, hingeRollerDia: 0.016, sagFull: 0.0036 }],
  ['2cm, sabit, Ø12', { plateThk: 0.02, nose: 'sabit', ...r(0.012) }],
];
const TARAK: [string, any][] = [
  ['tarak varsayılan', {}],
  ['sütun hizasızlığı 4 mm', { colErr: 0.004 }],
  ['sütun hizasızlığı 8 mm', { colErr: 0.008 }],
  ['ped sürtünmesi 0,15', { muPad: 0.15 }],
  ['0,02 bar', { padP: 2000 }],
  ['çıta ±4 mm', { slatDev: 0.004 }],
  ['bırakma 5 mm', { setGap: 0.005 }],
  ['80 cm/s, 4 m/s²', { vPlate: 0.8, aPlate: 4 }],
];
if (process.argv[2] === 'tarak' || !process.argv[2]) {
  for (const [n, o] of TARAK) {
    const s = runLoading(physConfig(o)).summary, B = s.bricks, C = s.comb!;
    const mx = (f: (b: any) => number) => Math.max(...B.map(f));
    console.log(n.padEnd(26), 'güvenlik', C.sf.toFixed(1), 'oturma', mx((b) => b.impact).toFixed(0), 'cm/s eğim', mx((b) => b.maxPitchDeg).toFixed(1),
      'kenar', mx((b) => b.dent).toFixed(2), 'mm pedKayma', C.slipPadMax.toFixed(1), 'mm diş', Math.max(C.toothPickMax, C.toothCarryMax, C.toothOutMax).toFixed(0),
      'N komşu', mx((b) => b.brickF).toFixed(0), 'N sıraAra', s.rowGapMin.toFixed(0), 'mm çevrim', C.cycle.toFixed(1), 's');
  }
  process.exit(0);
}
const cases = (process.argv[2] === 'burun' ? BURUN : GENEL).map(([n, o]) => [n, { loader: 'plaka', ...o }] as [string, any]);
for (const [name, o] of cases) {
  const t0 = Date.now();
  const { summary: s } = runLoading(physConfig(o));
  const B = s.bricks;
  const mx = (f: (b: any) => number) => Math.max(...B.map(f));
  const byRow = [0,1,2,3].map(r => B.filter(b => b.row === r));
  const c = physConfig(o);
  const zu = (c.clearance + c.plateThk) * 100;
  // sabit burunda uç makarasının üstü plaka üstüyle aynı hizada: uç alçalmaz
  const tip = c.nose === 'sabit' ? zu : (c.clearance + c.tipRollerDia + 2 * c.beltThk) * 100;
  console.log(name.padEnd(32), `${Date.now()-t0}ms`, `üst ${zu.toFixed(1)} uç ${tip.toFixed(1)} cm β ${s.betaMaxDeg.toFixed(1)}°`,
    'eğim', byRow.map(r => Math.max(...r.map(b => b.maxPitchDeg)).toFixed(0)).join('/'),
    'çarpma', mx(b => b.impact).toFixed(0), 'cm/s',
    'kenar', mx(b => Math.max(b.dentSlat, b.dentPlate)).toFixed(1), 'tuğla-iz', mx(b => b.dentBrick).toFixed(1), 'mm',
    'tuğlaF', mx(b => b.brickF).toFixed(0), 'N temaslı', B.filter(b => b.touched.length).length,
    'kayma', mx(b => Math.hypot(b.dx, b.dy)).toFixed(0), 'mm sıraAra', s.rowGapMin.toFixed(1),
    'yüzP', mx(b => b.faceP).toFixed(0), 'kPa bant-çıta', s.belt.minGapMm.toFixed(1), 'mm', s.belt.maxN.toFixed(0), 'N', s.belt.maxFric.toFixed(0), 'N',
    'oturmayan', B.filter(b => !b.settled).length);
}
