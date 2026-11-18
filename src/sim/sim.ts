// Simülasyon durumu. Aşama 0–1'de yalnızca zaman ilerliyor; Aşama 2'de referans-2d-simulasyon.html
// içindeki step() mantığı buraya taşınacak (aynı parametreler, aynı sonuçlar).
// Bu klasör (src/sim) three.js'e ve DOM'a bağımlı değildir; Node'da çalışır.

import { cloneParams, type Params } from './params';
import { planLayout, type PlanLayout } from './geometry';
import type { Steppable } from './loop';

export class Simulation implements Steppable {
  params: Params;
  layout: PlanLayout;
  /** Simülasyon zamanı, s */
  t = 0;
  steps = 0;

  constructor(params?: Partial<Params>) {
    this.params = { ...cloneParams(), ...params };
    this.layout = planLayout(this.params);
  }

  reset(): void {
    this.layout = planLayout(this.params);
    this.t = 0;
    this.steps = 0;
  }

  step(dt: number): void {
    this.t += dt;
    this.steps++;
  }
}
