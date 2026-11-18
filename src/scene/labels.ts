import type { V3 } from './parts';

/** Sahnede bir parçanın üstünde duran yazı. */
export interface LabelSpec {
  text: string;
  pos: V3;
}
