// Simülasyon: parametreler + plan yerleşimi + durum. Mantık model.ts'de (2D step()'in birebir karşılığı).
// Bu klasör (src/sim) three.js'e ve DOM'a bağımlı değildir; Node'da çalışır.

import { cloneParams, type Params } from './params';
import { planLayout, type PlanLayout } from './geometry';
import { createState, step, type SimState } from './model';
import type { Steppable } from './loop';

export class Simulation implements Steppable {
  params: Params;
  layout: PlanLayout;
  S: SimState;
  steps = 0;

  constructor(params?: Partial<Params>) {
    this.params = { ...cloneParams(), ...params };
    this.layout = planLayout(this.params);
    this.S = createState(this.params, this.layout);
  }

  /** Simülasyon zamanı, s */
  get t(): number {
    return this.S.t;
  }

  reset(): void {
    this.layout = planLayout(this.params);
    this.S = createState(this.params, this.layout);
    this.steps = 0;
  }

  step(dt: number): void {
    step(this.S, this.params, this.layout, dt);
    this.steps++;
  }
}
