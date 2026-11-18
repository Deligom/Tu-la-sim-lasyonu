// Simülasyon parametreleri. Anahtarlar ve varsayılanlar referans-2d-simulasyon.html içindeki `P`
// nesnesiyle birebir aynı (test/params.test.ts bunu dosyanın kendisinden okuyup karşılaştırır).
// Birimler: uzunluk cm, hız cm/s, süre s, oran tuğla/dk.

export type AccMode = 'zpa' | 'single';

export interface Params {
  /** Şerit hızları (tuğla/dk): Ş1, Ş2 (orta, en yavaş), Ş3 */
  rate: [number, number, number];
  /** Kesimde şerit başına tuğla */
  N: number;
  /** Tuğla boyu (akış yönü) */
  L: number;
  /** Tuğla eni */
  W: number;
  /** Şeritler arası boşluk */
  gap: number;
  /** Birikme bandı: bölgeli (zpa) ya da tek parça */
  acc: AccMode;
  /** Şerit başına birikme bölgesi sayısı */
  nZones: number;
  /** Bölge boyu */
  ZL: number;
  /** Hızlandırma bölgesi hızı */
  vb: number;
  /** Birikme / dozaj bölgeleri hızı */
  va: number;
  /** Ön hazırlık indeksleme hızı */
  vz: number;
  /** Kapak kapanma / açılma süresi */
  gateT: number;
  /** Pop-up kalkma / inme süresi */
  liftT: number;
  /** Pop-up yan transfer hızı */
  tSpeed: number;
  /** Kat transfer / tampon bandı hızı */
  exitSpeed: number;
  /** Tampon kapasitesi (kat) */
  Bcap: number;
  /** Fırıncı plaka giriş / çıkış hızı */
  vPlate: number;
  /** Ranza kaldırıcı hızı */
  liftSpeed: number;
  /** Ranza değişim süresi */
  swapT: number;
  /** İstasyon başına boş ranza giriş tamponu */
  inCap: number;
  /** İstasyon başına dolu ranza çıkış tamponu */
  outCap: number;
  /** Taşıyıcı (AGV) sayısı */
  nVeh: number;
  /** Taşıyıcı tur süresi */
  tripT: number;
  scrapDelay: number;
  /** Artık itici hızı */
  pushV: number;
  /** Çıtası dik (uyumsuz) ranza oranı, % */
  badRack: number;
}

const DEFAULTS: Params = {
  rate: [85, 80, 83],
  N: 8,
  L: 19,
  W: 13.5,
  gap: 3,
  acc: 'zpa',
  nZones: 5,
  ZL: 30,
  vb: 150,
  va: 150,
  vz: 200,
  gateT: 0.3,
  liftT: 0.2,
  tSpeed: 120,
  exitSpeed: 100,
  Bcap: 1,
  vPlate: 50,
  liftSpeed: 20,
  swapT: 6,
  inCap: 3,
  outCap: 3,
  nVeh: 3,
  tripT: 60,
  scrapDelay: 1.0,
  pushV: 120,
  badRack: 0,
};

export const DEFAULT_PARAMS: Readonly<Params> = Object.freeze(DEFAULTS);

export function cloneParams(p: Readonly<Params> = DEFAULT_PARAMS): Params {
  return { ...p, rate: [p.rate[0], p.rate[1], p.rate[2]] };
}
