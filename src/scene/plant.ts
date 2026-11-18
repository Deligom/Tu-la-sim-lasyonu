// Tüm hattı bir araya getirir. Hareketli parçaların tutamakları Aşama 3'te simülasyondan sürülecek.

import * as THREE from 'three';
import type { LabelSpec } from './labels';
import { buildConveyors, buildCutter, buildGates, buildPress, buildScrap, type LineHandles } from './line';
import { buildPrep } from './prep';
import { buildStation, type StationHandles } from './station';
import { buildRackFlow, type RackFlowModel } from './rackflow';
import { M } from './materials';
import type { PlanLayout } from '../sim/geometry';
import type { Params } from '../sim/params';

export interface Plant {
  root: THREE.Group;
  labels: LabelSpec[];
  line: LineHandles;
  prepPopup: THREE.Group;
  stations: StationHandles[];
  rackFlows: RackFlowModel[];
  /** Girişte bekleyen ranzaların kendi malzemeleri (yan görünümde saydamlaştırmak için) */
  waitingMats: THREE.MeshStandardMaterial[];
}

export function buildPlant(lay: PlanLayout, p: Readonly<Params>): Plant {
  const labels: LabelSpec[] = [];
  const root = new THREE.Group();
  root.name = 'Hat';
  root.add(buildPress(lay, labels));
  const cutter = buildCutter(lay, labels);
  root.add(cutter.group);
  root.add(buildConveyors(lay, p, labels));
  const scrap = buildScrap(lay, labels);
  root.add(scrap.group);
  const gates = buildGates(lay, p, labels);
  root.add(gates.group);
  const prep = buildPrep(lay, p, labels);
  root.add(prep.group);
  const stations = ([0, 1] as const).map((s) => buildStation(lay, p, s, labels));
  for (const st of stations) root.add(st.group);
  const wm = { rack: M.rack.clone(), wood: M.wood.clone(), woodDark: M.woodDark.clone() };
  const rackFlows = ([0, 1] as const).map((s) => buildRackFlow(lay, s, labels, wm));
  for (const rf of rackFlows) root.add(rf.group);
  return {
    rackFlows,
    waitingMats: [wm.rack, wm.wood, wm.woodDark],
    root,
    labels,
    line: { harp: cutter.harp, gates: gates.gates, pushers: scrap.pushers },
    prepPopup: prep.popup,
    stations: stations.map((s) => s.handles),
  };
}
