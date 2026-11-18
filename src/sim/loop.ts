// Sabit adımlı simülasyon döngüsü. Ekran ne kadar hızlı ya da yavaş çizerse çizsin simülasyon hep
// DT = 5 ms'lik adımlarla ilerler; hız çarpanı yalnızca gerçek saniye başına kaç adım atılacağını
// değiştirir. Böylece sonuçlar deterministik ve tarayıcısız test edilebilir.

export const DT = 0.005;
export const SPEEDS = [0.25, 1, 3, 10] as const;
export type Speed = (typeof SPEEDS)[number];

export interface Steppable {
  step(dt: number): void;
  reset(): void;
}

export class SimLoop {
  speed: number = 1;
  running = true;
  /** Toplam atılan adım (sıfırlamada sıfırlanır) */
  steps = 0;
  private acc = 0;

  /**
   * @param target adım adım ilerletilecek simülasyon
   * @param maxFrame tek karede en fazla kaç gerçek saniye işlenir (sekme arka plandayken birikmesin)
   */
  constructor(
    readonly target: Steppable,
    readonly maxFrame = 0.1,
  ) {}

  /** Simülasyon zamanı (adım × DT, kayan nokta birikmesi yok). */
  get simTime(): number {
    return this.steps * DT;
  }

  /** Gerçek zamanda `realDt` saniye geçti: gereken sayıda sabit adım at. Atılan adım sayısını döndürür. */
  advance(realDt: number): number {
    if (!this.running) return 0;
    const dt = Math.min(Math.max(realDt, 0), this.maxFrame);
    this.acc += dt * this.speed;
    const n = Math.floor(this.acc / DT + 1e-9);
    this.acc -= n * DT;
    if (this.acc < 0) this.acc = 0;
    for (let i = 0; i < n; i++) this.target.step(DT);
    this.steps += n;
    return n;
  }

  /** Durdurulmuşken (ya da her an) tam olarak n adım ilerlet. */
  stepN(n: number): void {
    for (let i = 0; i < n; i++) this.target.step(DT);
    this.steps += n;
  }

  reset(): void {
    this.acc = 0;
    this.steps = 0;
    this.target.reset();
  }
}
