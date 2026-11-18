// Görüntüleyici: WebGL çizici, orbit kamera + hazır açılar, yazı katmanı, dokunarak parça seçme.
// Yalnızca bir şey değiştiğinde çizer (kamera, seçim, tema...), telefonda pil dostu.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildPlant, type Plant } from './plant';
import { createMotion } from './motion';
import { addLights, buildEnvironment } from './environment';
import { camPose, type CamName, type CamPose, type ViewBox } from './cameras';
import type { PartInfo } from './parts';
import type { SlatType } from './rack';
import type { Simulation } from '../sim/sim';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export interface Viewer {
  plant: Plant;
  readonly currentCam: CamName | null;
  setCamera(name: CamName, instant?: boolean): void;
  /** Üst şerit ve alt rafın kapladığı piksel; kamera görünür alana ortalanır. */
  setInsets(top: number, bottom: number): void;
  setLabels(on: boolean): void;
  setSlatType(t: SlatType): void;
  onPick(cb: (info: PartInfo | null) => void): void;
  onCameraChange(cb: (name: CamName | null) => void): void;
  clearSelection(): void;
  /** Her karede: simülasyon ilerlediyse sahneyi güncelle, gerekiyorsa çiz. */
  frame(now: number): void;
  requestRender(): void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createViewer(host: HTMLElement, sim: Simulation): Viewer {
  const lay = sim.layout;
  const params = sim.params;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const css = new CSS2DRenderer();
  css.domElement.className = 'labels';
  host.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 2, 30000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.minDistance = 3;
  controls.maxDistance = 7000;

  const plant = buildPlant(lay, params);
  scene.add(plant.root);
  const env = buildEnvironment(lay, plant.labels);
  scene.add(env.group);
  const sun = addLights(scene, new THREE.Vector3(330, 0, 0));
  const motion = createMotion(plant, lay, params, scene);

  const labelDivs = new Map<string, HTMLDivElement>();
  const labelObjs = plant.labels.map((l) => {
    const div = document.createElement('div');
    div.className = 'lbl';
    div.textContent = l.text;
    if (l.key) labelDivs.set(l.key, div);
    const o = new CSS2DObject(div);
    o.position.set(...l.pos);
    scene.add(o);
    return o;
  });

  // Etiketler ranzanın içinden bakarken gizlenir (her şeyin önüne çıkıp görüşü kapatıyorlar).
  let labelsOn = true;
  const syncLabels = () => {
    const vis = labelsOn && current !== 'ranzaIci';
    for (const o of labelObjs) o.visible = vis;
    // Yan görünümde girişte bekleyen boş ranzalar istasyonun önünü kapatıyor: saydamlaştır.
    const ghost = current === 'aYan' || current === 'bYan';
    for (const m of plant.waitingMats) {
      m.transparent = ghost;
      m.opacity = ghost ? 0.12 : 1;
      m.depthWrite = !ghost;
      m.needsUpdate = true;
    }
  };

  let needsRender = true;
  const requestRender = () => {
    needsRender = true;
  };
  controls.addEventListener('change', requestRender);

  // ---- tema ----
  const applyTheme = () => {
    const cs = getComputedStyle(document.documentElement);
    const get = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
    scene.background = new THREE.Color(get('--scene', '#dcdad3'));
    env.setColors(get('--floor', '#bdb7ab'), get('--grid', '#a29b8e'));
    sun.intensity = parseFloat(get('--sun', '2.1')) || 2.1;
    requestRender();
  };
  applyTheme();
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  } catch {
    /* eski tarayıcı */
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  // ---- kamera açıları ----
  let current: CamName | null = 'genel';
  let tween: { from: CamPose; to: CamPose; t0: number; dur: number } | null = null;
  let camCb: (n: CamName | null) => void = () => {};
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let insets = { top: 0, bottom: 0 };
  let viewBox: ViewBox = { w: 1, F: 1, V: 1 };
  const applyPose = (p: CamPose) => {
    camera.position.copy(p.pos);
    camera.fov = p.fov;
    camera.near = p.near;
    camera.updateProjectionMatrix();
    controls.target.copy(p.target);
    camera.lookAt(p.target);
  };
  const setCamera = (name: CamName, instant = false) => {
    const to = camPose(name, lay, viewBox);
    current = name;
    syncLabels();
    camCb(name);
    if (instant || reduceMotion) {
      tween = null;
      applyPose(to);
      controls.update();
    } else {
      const from: CamPose = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov, near: camera.near };
      tween = { from, to, t0: performance.now(), dur: 750 };
      camera.near = Math.min(from.near, to.near);
      camera.updateProjectionMatrix();
      controls.enabled = false;
    }
    requestRender();
  };
  controls.addEventListener('start', () => {
    if (tween) return;
    if (current !== null) {
      current = null;
      camCb(null);
    }
    syncLabels();
  });

  // ---- boyut ----
  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    css.setSize(w, h);
    // Projeksiyon merkezini görünür alanın ortasına kaydır (alt raf ve üst şerit sahneyi örtüyor).
    const shift = Math.round((insets.bottom - insets.top) / 2);
    const F = h + 2 * Math.abs(shift);
    camera.setViewOffset(w, F, 0, shift > 0 ? 2 * shift : 0, w, h);
    camera.aspect = w / F;
    camera.updateProjectionMatrix();
    viewBox = { w, F, V: Math.max(80, h - insets.top - insets.bottom) };
    if (current && !tween) setCamera(current, true);
    requestRender();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  setCamera('genel', true);

  // ---- dokunarak seçme ----
  const ray = new THREE.Raycaster();
  let picked: THREE.Object3D | null = null;
  const box = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xff7a1a));
  box.visible = false;
  scene.add(box);
  let pickCb: (info: PartInfo | null) => void = () => {};
  const shown = (o: THREE.Object3D | null): boolean => {
    for (let x = o; x; x = x.parent) if (!x.visible) return false;
    return true;
  };
  const select = (o: THREE.Object3D | null) => {
    picked = o;
    if (o) {
      box.box.setFromObject(o);
      box.visible = true;
    } else box.visible = false;
    pickCb(o ? (o.userData.info as PartInfo) : null);
    requestRender();
  };
  let down: { x: number; y: number; t: number } | null = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  });
  el.addEventListener('pointerup', (e) => {
    if (!down || !e.isPrimary) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 6 || !quick) return;
    const r = el.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    motion.prepPick();
    for (const h of ray.intersectObjects([plant.root, ...motion.pickables, env.group], true)) {
      if (!shown(h.object)) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.info) o = o.parent;
      if (o) {
        select(o === picked ? null : o);
        return;
      }
    }
    select(null);
  });

  return {
    plant,
    get currentCam() {
      return current;
    },
    setCamera,
    setInsets(top, bottom) {
      if (Math.abs(top - insets.top) < 1 && Math.abs(bottom - insets.bottom) < 1) return;
      insets = { top, bottom };
      resize();
    },
    setLabels(on) {
      labelsOn = on;
      syncLabels();
      requestRender();
    },
    setSlatType(t) {
      motion.setDefaultSlat(t);
      if (picked) select(picked);
      requestRender();
    },
    onPick(cb) {
      pickCb = cb;
    },
    onCameraChange(cb) {
      camCb = cb;
    },
    clearSelection() {
      select(null);
    },
    requestRender,
    frame(now) {
      if (motion.update(sim.S)) {
        needsRender = true;
        for (const [k, text] of motion.labelTexts()) {
          const d = labelDivs.get(k);
          if (d && d.textContent !== text) d.textContent = text;
        }
      }
      if (tween) {
        const k = Math.min(1, (now - tween.t0) / tween.dur);
        const e = ease(k);
        camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
        controls.target.lerpVectors(tween.from.target, tween.to.target, e);
        camera.fov = THREE.MathUtils.lerp(tween.from.fov, tween.to.fov, e);
        camera.updateProjectionMatrix();
        camera.lookAt(controls.target);
        if (k >= 1) {
          applyPose(tween.to);
          tween = null;
          controls.enabled = true;
          controls.update();
        }
        needsRender = true;
      } else if (controls.update()) needsRender = true;
      if (!needsRender) return;
      needsRender = false;
      renderer.render(scene, camera);
      css.render(scene, camera);
    },
  };
}
