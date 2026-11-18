import { describe, expect, it } from 'vitest';
import { PLAKA, RANZA, TUGLA, Z, rackLiftFor, slatTopZ, upperLevelClearance } from '../src/sim/dims';

describe('ranza kaldırıcı', () => {
  it('kaldırma = (4 − dolu kat) × 30; boş ranza en yukarıda', () => {
    expect([0, 1, 2, 3, 4].map(rackLiftFor)).toEqual([120, 90, 60, 30, 0]);
  });
  it('sıradaki katın çıtası her zaman plaka hizasında', () => {
    for (let j = 0; j < RANZA.katSayisi; j++) expect(slatTopZ(j, rackLiftFor(j))).toBe(Z.aktifCita);
  });
  it('en üst kat çerçevenin üstünde, zarf 180 cm içinde', () => {
    expect(slatTopZ(RANZA.katSayisi - 1, 0)).toBe(RANZA.cerceveYuk);
    const tuglaUst = RANZA.cerceveYuk + PLAKA.citaBoslugu + PLAKA.kalinlik + TUGLA.yukseklik;
    expect(tuglaUst).toBeLessThanOrEqual(RANZA.zarf);
  });
});

describe('plaka ve kat boşlukları', () => {
  it('plaka ≤ 5 cm, çıtaların 5 mm üstünden geçiyor', () => {
    expect(PLAKA.kalinlik).toBeLessThanOrEqual(5);
    expect(Z.plakaAlt - Z.aktifCita).toBeCloseTo(0.5, 9);
    expect(Z.plakaUst - Z.plakaAlt).toBeCloseTo(PLAKA.kalinlik, 9);
    expect(PLAKA.burunCap).toBeLessThanOrEqual(2);
  });
  it('kullanılabilir kat yüksekliği 28 cm (çıta üstünden üst kat çıtasının altına)', () => {
    expect(RANZA.katArasi - RANZA.citaKalinlik).toBe(28);
  });
  it('plakadaki tuğla üst katın rayına çarpmıyor', () => {
    expect(upperLevelClearance()).toBeGreaterThan(2);
  });
});

describe('taşıma yüzeyleri', () => {
  it('her aktarmada alan taraf 4 mm yukarıdan alıyor, tampon = plaka üstü', () => {
    expect(Z.popUst - Z.hat).toBeCloseTo(0.4, 9);
    expect(Z.tablaEnine).toBeCloseTo(Z.popUst, 9);
    expect(Z.tablaBoyunaUst - Z.tablaEnine).toBeCloseTo(0.4, 9);
    expect(Z.tampon).toBe(Z.plakaUst);
    expect(Z.popAlt).toBeLessThan(Z.hat);
  });
});
