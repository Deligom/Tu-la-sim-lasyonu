// Yükleme detayı sahnesi (cm): aktif kat (çıta üstü z = 0), ranza çerçevesi, plaka + eğilir burun + servo kolu,
// 24 tuğla. Fizik kareleri m cinsinden; burada ×100.

import * as THREE from 'three';
import { Parts, tr } from '../scene/parts';
import { M } from '../scene/materials';
import { buildRack, type RackModel } from '../scene/rack';
import { RANZA } from '../sim/dims';
import type { PhysConfig } from '../phys/config';
import { PLATE_STRIDE, type Frames } from '../phys/run';
import { Rig, TOOTH_H, PAD_Z0, PAD_Z1 } from '../phys/rig';
import { buildCombModel, type CombModel } from '../scene/comb';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const CM = 100;

export interface DetailScene {
  scene: THREE.Scene;
  bricks: THREE.Mesh[];
  rack: RackModel;
  sun: THREE.DirectionalLight;
  /** Plakayı ve tuğlaları t anına (s) getir */
  show(frames: Frames, t: number, mode: ColorMode, focusCol: number | null, selected: number | null): void;
  /** Yapılandırma değişince plaka geometrisini yeniden kur */
  rebuild(cfg: PhysConfig): void;
  setTheme(scene: string, floor: string, sun: number): void;
  /** Uç ucunun o anki x'i (cm), kamera takibi için */
  tipX: number;
}

export type ColorMode = 'iz' | 'sira' | 'temas';

const CLAY = new THREE.Color(0xb6633f);
const AMBER = new THREE.Color(0xe3a52b);
const RED = new THREE.Color(0xd2362c);
const ROWC = [0x9d5a3c, 0xb8744d, 0xc98d5f, 0xd9a877].map((c) => new THREE.Color(c));

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d')!;
  g.fillStyle = '#27303c';
  g.fillRect(0, 0, 64, 8);
  g.fillStyle = '#3d4a5a';
  for (let i = 0; i < 64; i += 16) g.fillRect(i, 0, 5, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildDetailScene(cfg0: PhysConfig, nBricks: number): DetailScene {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xf4f2ec, 0x7a7469, 1.4);
  scene.add(hemi, new THREE.AmbientLight(0xffffff, 0.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-120, -220, 320);
  sun.target.position.set(45, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 50, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  scene.add(sun, sun.target);

  // zemin (ranza ayağı aktif katın 30 cm altında; kaldırıcı platformu şematik)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xbdb7ab, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 700), floorMat);
  floor.position.set(0, 0, -RANZA.ilkKat - 12);
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(900, 90, 0xa39c8f, 0xa39c8f);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = floor.position.z + 0.05;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  // ranza: yerel X 0..90, Y 0..120, Z 0 = ayak → aktif kat (en alt) çıta üstü z = 0
  const rack = buildRack('yükleme');
  rack.group.position.set(0, -RANZA.boyY / 2, -RANZA.ilkKat);
  rack.setSlatType(cfg0.slat);
  scene.add(rack.group);
  // kaldırıcı platformu
  const pf = new Parts({ title: 'Ranza kaldırıcı platformu (şematik)' });
  pf.box(M.lifter, -6, RANZA.derinlikX + 6, -66, 66, -RANZA.ilkKat - 12, -RANZA.ilkKat);
  scene.add(pf.build());

  // yan raylar (sabit, ranzanın dışında biter) ve tampon ucu
  const fixed = new Parts({ title: 'Plaka kılavuz rayları', detail: 'Plakanın iki yanında sabit çelik profil; ranzanın dışında biter. Kolların makara çiftleri rayı alttan ve üstten kavrar.' });
  for (const v of [-1, 1]) fixed.box(M.rail, -260, -2, v * 52.6, v * 54.8, 1.2, 4.8);
  fixed.box(M.beltA, -300, -150, -48, 48, 5.1, 5.9);
  scene.add(fixed.build());

  // ---------- plaka ----------
  const plate = new THREE.Group();
  plate.name = 'Fırıncı plakası';
  scene.add(plate);
  const nose = new THREE.Group();
  const linkBar = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 0.5), M.servo);
  const crank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1, 18), M.steel);
  crank.rotation.x = Math.PI / 2;
  const beltTex = stripeTexture();
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.85 });
  const noseBeltTex = beltTex.clone();
  noseBeltTex.needsUpdate = true;
  const noseBeltMat = new THREE.MeshStandardMaterial({ map: noseBeltTex, roughness: 0.85 });
  let geo = { zu: 0, Rh: 0, Rt: 0, Ln: 0, len: 0, clr: 0 };
  let leverLocal = new THREE.Vector3();

  // ---------- tarak tutucu (aday tasarım) ----------
  const carriage = new THREE.Group();
  carriage.name = 'Tarak arabası';
  const comb = new THREE.Group();
  comb.name = 'Tarak tutucu';
  const pick = new THREE.Group();
  scene.add(carriage, comb, pick);
  let combModel: CombModel | null = null;
  let tarak = false;
  let layerFront = 86;

  const buildComb = (cfg: PhysConfig) => {
    const r = new Rig(cfg);
    const x0 = r.toothX0 * CM;
    layerFront = (r.rowsX0[r.rowsX0.length - 1] + cfg.L) * CM;
    const info = {
      title: 'Tarak tutucu',
      detail: `Arkada ranzanın dışında kalan kiriş, sütun aralıklarında ${r.teeth.length} diş (${r.teeth.length - 2} çift yanlı, 2 dış tek yanlı). ` +
        `Her diş iki U profil; araya şişen yastık (yassı hortum) U'ları dışa açar, kauçuk pedler tuğlanın yan yüzüne ` +
        `${tr(cfg.padP / 1e5, 2)} bar ile bastırır. Sönükken ${tr(cfg.toothT * 1000, 0)} mm kalınlık, 3 cm aralıkta her yanda ~5 mm boşluk. ` +
        'Tamponda yukarıdan iner, şişirir, 5 mm kaldırır, ranzaya girer, çıtaya indirir, vakumla söndürür, aynı aralıklardan geri çekilir.',
    };
    combModel = buildCombModel({
      teeth: r.teeth.map((t) => ({ ...t, y: t.y * CM })),
      x0, x1: r.toothX1 * CM, ht: r.ht * CM, H: TOOTH_H * CM,
      padX: r.padX.map(([a, b]) => [a * CM, b * CM] as [number, number]),
      padZ0: PAD_Z0 * CM, padZ1: PAD_Z1 * CM, info,
    });
    comb.add(combModel.group);
    // araba: kollar raylarda, düşey kılavuz direkleri
    const car = new Parts({ title: 'Tarak arabası', detail: 'Plakanın kolları, makara çiftleri ve zinciri aynen kullanılır; araba üstünde iki düşey kılavuz ve servo tarağı indirip kaldırır.' });
    for (const v of [-1, 1]) {
      car.box(M.arm, x0 - 57, x0 - 7, v * 50.8, v * 51.8, -0.5, 7);
      for (const xr of [x0 - 12, x0 - 52]) {
        car.cyl(xr === x0 - 12 && v === 1 ? M.eccentric : M.follower, 'y', xr, v * 53.7, 6.5, 1.75, 2.6, 14);
        car.cyl(M.follower, 'y', xr, v * 53.7, -0.5, 1.75, 2.6, 14);
      }
      car.box(M.steelDark, x0 - 10, x0 - 7, v * 50.8, v * 52.8, -0.5, 44);
    }
    car.box(M.steelDark, x0 - 10, x0 - 7, -52.8, 52.8, 41, 44);
    car.box(M.servo, x0 - 14, x0 - 8, -6, 6, 36, 44);
    carriage.add(car.build('Tarak arabası'));
    // alma bandı (tampon ucu): kat burada beklerken tarak yukarıdan iner
    const pb = new Parts({ title: 'Alma bandı (tamponun 2. bölgesi)', detail: 'Kendi motoruyla dönen bant; kat tampondan buraya bütün olarak, tamponla aynı hızda gelir ve durur. Tarak yukarıdan iner, dişler sütun aralıklarına girer.' });
    const zb = r.zBuf * CM;
    pb.box(M.beltA, (r.rowsX0[0] - cfg.stroke) * CM - 6, -0.5, -49, 49, zb - 1, zb);
    for (const v of [-1, 1]) pb.box(M.frame, (r.rowsX0[0] - cfg.stroke) * CM - 6, -0.5, v * 49, v * 50.2, zb - 6, zb - 1);
    pick.add(pb.build('Alma bandı'));
  };

  const rebuild = (cfg: PhysConfig) => {
    plate.clear();
    nose.clear();
    carriage.clear();
    comb.clear();
    pick.clear();
    tarak = cfg.loader === 'tarak';
    plate.visible = !tarak;
    carriage.visible = comb.visible = pick.visible = tarak;
    if (tarak) {
      buildComb(cfg);
      return;
    }
    const zu = (cfg.clearance + cfg.plateThk) * CM;
    const clr = cfg.clearance * CM;
    const Rh = (cfg.hingeRollerDia / 2 + cfg.beltThk) * CM;
    const Rt = (cfg.tipRollerDia / 2 + cfg.beltThk) * CM;
    const Ln = cfg.noseLen * CM;
    const len = cfg.plateLen * CM;
    const bt = cfg.beltThk * CM;
    geo = { zu, Rh, Rt, Ln, len, clr };
    // plaka yerel: uç x = 0 (düz burnun ucu), menteşe x = −Ln
    const xh = -Ln;
    const body = new Parts({
      title: 'Fırıncı plakası',
      detail: `${Math.round(len)} cm bırakma boyu, 100 cm en, ${Math.round(cfg.plateThk * CM)} cm kalınlık; çıtaların ${Math.round(clr * 10)} mm üstünden geçer. Geri çekilirken bant aynı hızda ileri sarar: üst bant zemine göre durur, alt bant 2× hızla geri gider.`,
    });
    for (let k = 0; k < 10; k++) {
      const y = -45 + 10 * k;
      body.box(M.plate, -len + 2, xh - Rh, y - 1, y + 1, clr + bt + 0.2, zu - bt - 0.3);
    }
    for (const v of [-1, 1]) body.box(M.plate, -len, xh, v * 49.5, v * 50, clr + bt, zu - bt);
    body.cyl(M.steelDark, 'y', -len + 2.3, 0, (clr + zu) / 2, (zu - clr) / 2 - bt, 98, 16);
    // arka kiriş, kollar, makara çiftleri, bant motoru (ranzaya girmez)
    body.box(M.steel, -len - 8, -len, -51.8, 51.8, clr - 8, clr);
    body.box(M.motor, -len - 20, -len - 8, -7, 7, clr - 18, clr - 6);
    for (const v of [-1, 1]) {
      body.box(M.arm, -len - 50, -len, v * 50.8, v * 51.8, -0.5, 7);
      for (const xr of [-len - 5, -len - 45]) {
        body.cyl(xr === -len - 5 && v === 1 ? M.eccentric : M.follower, 'y', xr, v * 53.7, 6.5, 1.75, 2.6, 14);
        body.cyl(M.follower, 'y', xr, v * 53.7, -0.5, 1.75, 2.6, 14);
      }
    }
    // servo (kolun tahriki): arkada, plakanın altında
    body.box(M.servo, -len - 6, -len + 4, -6, 6, clr - 6, clr - 0.5);
    plate.add(body.build('Fırıncı plakası'));
    const top = new THREE.Mesh(new THREE.BoxGeometry(xh - -len - 2.3, 98, bt), beltMat);
    top.position.set((-len + 2.3 + xh) / 2, 0, zu - bt / 2);
    top.receiveShadow = true;
    plate.add(top);
    beltTex.repeat.set((xh + len) / 16, 1);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(xh - -len - 2.3, 98, bt), M.plateBelt);
    bottom.position.set((-len + 2.3 + xh) / 2, 0, clr + bt / 2);
    plate.add(bottom);
    // menteşe makarası
    const hr = new Parts({ title: 'Menteşe makarası', detail: 'Bant burada bükülür; burun bu makaranın ekseni etrafında döner (bant boyu değişmez).' });
    hr.cyl(M.plateBelt, 'y', xh, 0, zu - Rh, Rh, 98, 16);
    hr.cyl(M.steel, 'y', xh, 0, zu - Rh, Rh - bt, 99.6, 12);
    plate.add(hr.build());

    // burun: menteşe ekseni (xh, zu − Rh) etrafında döner
    nose.position.set(xh, 0, zu - Rh);
    const a = Ln - Rt, b = Rh - Rt; // uç makarası merkezi (burun yerel)
    const nz = new Parts({
      title: cfg.nose === 'egilir' ? 'Eğilir burun' : 'Sabit burun',
      detail: cfg.nose === 'egilir'
        ? `Menteşe ekseninden uca ${Math.round(Ln)} cm. Ranzaya girerken düz; strok sonunda servo + metal plakalı kolla iner (uç makarasının altı çıtaların ${Math.round(clr * 10)} mm üstünde). Plaka ranzadan çıkınca kalkar.`
        : 'Plakanın düz devamı; uçta makara.',
    });
    const zb = clr - (zu - Rh); // burun yerel: plaka altı
    nz.slopeXZ(M.plate, -49, 49, 0, zb + 0.6, a, b - Rt + 0.5, 0.6);
    for (let k = 0; k < 10; k++) {
      const y = -45 + 10 * k;
      nz.slopeXZ(M.plate, y - 1, y + 1, Rh * 0.3, (zb + Rh) / 2, a - 0.2, b, 1.4);
    }
    nz.cyl(M.plateBelt, 'y', a, 0, b, Rt, 98, 16);
    nz.cyl(M.steel, 'y', a, 0, b, Rt - bt, 99.4, 12);
    // kol plakası (manivela): menteşenin altında, burna kaynaklı
    leverLocal = new THREE.Vector3(-1.2, 0, zb + 0.4);
    nz.box(M.steelDark, -1.6, 0.6, -30, -28, zb + 0.2, 0.6);
    nz.box(M.steelDark, -1.6, 0.6, 28, 30, zb + 0.2, 0.6);
    nose.add(nz.build());
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(a, 98, bt), noseBeltMat);
    ramp.position.set(a / 2, 0, Rh - bt / 2);
    ramp.receiveShadow = true;
    nose.add(ramp);
    noseBeltTex.repeat.set(a / 16, 1);
    plate.add(nose);
    plate.add(linkBar, crank);
    linkBar.castShadow = true;
  };
  rebuild(cfg0);

  // ---------- tuğlalar ----------
  const bgeo = new THREE.BoxGeometry(cfg0.L * CM, cfg0.W * CM, cfg0.H * CM);
  const bricks: THREE.Mesh[] = [];
  for (let i = 0; i < nBricks; i++) {
    const m = new THREE.Mesh(bgeo, new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.92 }));
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.brick = i;
    scene.add(m);
    bricks.push(m);
  }
  const edges = new THREE.EdgesGeometry(bgeo);
  const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff7a1a }));
  outline.visible = false;
  scene.add(outline);

  const tmp = new THREE.Color();
  const q = new THREE.Quaternion();
  const ds: DetailScene = {
    scene,
    bricks,
    rack,
    sun,
    tipX: 88,
    rebuild,
    setTheme(bg, fl, s) {
      scene.background = new THREE.Color(bg);
      floorMat.color.set(fl);
      sun.intensity = s;
    },
    show(F, t, mode, focusCol, selected) {
      if (!F.n) return;
      const f = Math.max(0, Math.min(F.n - 1, t * F.fps));
      const i0 = Math.floor(f), i1 = Math.min(F.n - 1, i0 + 1), u = f - i0;
      const P0 = i0 * PLATE_STRIDE, P1 = i1 * PLATE_STRIDE;
      const lerpP = (k: number) => F.plate[P0 + k] * (1 - u) + F.plate[P1 + k] * u;
      if (tarak) {
        const X = lerpP(0) * CM, Zc = lerpP(1) * CM, infl = lerpP(2);
        ds.tipX = X + layerFront;
        carriage.position.set(X, 0, 0);
        comb.position.set(X, 0, Zc);
        combModel?.setInfl(infl);
      }
      const xTip = lerpP(0) * CM, beta = lerpP(1), belt = lerpP(2) * CM;
      if (!tarak) {
      ds.tipX = xTip;
      plate.position.set(xTip, 0, 0);
      nose.rotation.y = beta;
      beltTex.offset.x = -belt / 16;
      noseBeltTex.offset.x = -belt / 16;
      }
      // servo kolu: manivela ucu ↔ arkadaki krank
      const lv = leverLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), beta).add(nose.position);
      const crankC = new THREE.Vector3(-geo.len - 1, -29, geo.clr - 3);
      crank.position.copy(crankC);
      crank.rotation.z = beta * 6;
      const pin = crankC.clone().add(new THREE.Vector3(1.8 * Math.cos(beta * 6 + 1), 0, 1.8 * Math.sin(beta * 6 + 1)));
      const end = new THREE.Vector3(lv.x, -29, lv.z);
      const mid = pin.clone().add(end).multiplyScalar(0.5);
      const d = end.clone().sub(pin);
      linkBar.position.copy(mid);
      linkBar.scale.set(d.length(), 1, 1);
      linkBar.rotation.set(0, -Math.atan2(d.z, d.x), 0);
      // tuğlalar
      const nb = F.nb;
      for (let k = 0; k < nb; k++) {
        const o0 = (i0 * nb + k) * 7, o1 = (i1 * nb + k) * 7;
        const m = bricks[k];
        m.position.set(
          (F.pose[o0] * (1 - u) + F.pose[o1] * u) * CM,
          (F.pose[o0 + 1] * (1 - u) + F.pose[o1 + 1] * u) * CM,
          (F.pose[o0 + 2] * (1 - u) + F.pose[o1 + 2] * u) * CM,
        );
        q.set(F.pose[o0 + 4], F.pose[o0 + 5], F.pose[o0 + 6], F.pose[o0 + 3]);
        const q1 = new THREE.Quaternion(F.pose[o1 + 4], F.pose[o1 + 5], F.pose[o1 + 6], F.pose[o1 + 3]);
        m.quaternion.copy(q).slerp(q1, u);
        const row = Math.floor(k / 6), col = k % 6;
        m.visible = focusCol === null || col === focusCol;
        const mat = m.material as THREE.MeshStandardMaterial;
        const dent = F.dent[i0 * nb + k] * 1000; // mm
        const fb = F.force[(i0 * nb + k) * 3 + 2];
        if (mode === 'iz') {
          if (dent < 1) tmp.copy(CLAY).lerp(AMBER, Math.max(0, dent - 0.2) / 0.8);
          else tmp.copy(AMBER).lerp(RED, Math.min(1, (dent - 1) / 2));
        } else if (mode === 'sira') tmp.copy(ROWC[row]);
        else tmp.copy(CLAY).lerp(RED, Math.min(1, fb / 150));
        mat.color.copy(tmp);
        mat.emissive.setRGB(mode === 'temas' && fb > 5 ? 0.25 : 0, 0, 0);
      }
      if (selected !== null && bricks[selected]?.visible) {
        outline.visible = true;
        outline.position.copy(bricks[selected].position);
        outline.quaternion.copy(bricks[selected].quaternion);
        outline.scale.setScalar(1.01);
      } else outline.visible = false;
    },
  };
  return ds;
}
