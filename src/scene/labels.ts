import type { V3 } from './parts';

/** Sahnede bir parçanın üstünde duran yazı. */
export interface LabelSpec {
  text: string;
  pos: V3;
  /** Hareket katmanı yazıyı bu anahtarla günceller */
  key?: string;
}
