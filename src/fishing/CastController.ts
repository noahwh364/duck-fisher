import {
  Scene,
  Vector3,
  Vector2,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Group,
  BufferGeometry,
  LineBasicMaterial,
  Line,
  Float32BufferAttribute,
  MathUtils,
  Raycaster,
  Camera,
  Object3D,
} from "three";
import { CONFIG } from "../config";
import type { System } from "../main";
import type { DuckManager } from "../ducks/DuckManager";
import type { Duck } from "../ducks/Duck";
import type { Character } from "../scene/character";

type Phase = "idle" | "aiming";

// Minimal view of the upgrade system the cast needs. Kept as an interface so the
// controller has no hard dependency on UpgradeState (and works with none).
export interface CastUpgrades {
  autoActive(): boolean;
  autoFireInterval(): number;
  blastCasts(): number;
  laserActive(): boolean;
  laserHalfWidth(): number;
  areaBonus(): number;
  spreadAngle(): number;
}

// Highest possible casts-per-fire (blast base 2 + step 1 * max 4 = 6); sizes the
// preview ring/beam pools.
const MAX_CASTS = 6;

interface FlyingDuck {
  duck: Duck;
  from: Vector3;
  spin: number;
  t: number;
  // Present once the duck has been rejected (basket + storage full): a ballistic
  // velocity that flings it off the screen instead of into the basket.
  bounceVel?: Vector3;
}

// A hook in flight: arcs from the rod tip to its target, then captures ducks
// (circle or beam) and is disposed. Multiple can be airborne at once.
interface Projectile {
  hook: Mesh;
  line: Line;
  lineGeo: BufferGeometry;
  from: Vector3;
  target: Vector3;
  t: number;
  height: number;
  laser: boolean;
  radius: number;
  halfWidth: number;
}

// Parabolic arc from a to b with apex `height` above the straight line midpoint.
function arcPoint(a: Vector3, b: Vector3, t: number, height: number, out: Vector3) {
  out.lerpVectors(a, b, t);
  out.y += 4 * height * t * (1 - t);
  return out;
}

// Shortest distance in the XZ plane from point (px,pz) to the segment a->b.
function segDistXZ(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = MathUtils.clamp(t, 0, 1);
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

export class CastController implements System {
  private phase: Phase = "idle";

  private pointerId: number | null = null;
  private startPx = { x: 0, y: 0 };
  private curPx = { x: 0, y: 0 };

  private landing = new Vector3(); // central aim point
  private aimAngle = 0; // radians, left/right swing of the aim
  private aimRange = 0; // world distance from the anchor to the landing
  private rodTip = new Vector3();
  private power = 0; // 0..1

  private autoTimer = 0; // countdown between autofire shots

  // Preview visuals.
  private dots: Mesh[] = [];
  private rings: Mesh[] = [];
  private beams: Group[] = [];
  private previewGroup = new Group();

  // Rest hook + line at the rod tip (shown while idle/aiming).
  private hook: Mesh;
  private line: Line;
  private lineGeo: BufferGeometry;

  // Shared assets for airborne projectiles.
  private hookGeo = new SphereGeometry(0.12, 10, 10);
  private hookMat = new MeshBasicMaterial({ color: 0x22252b });
  private projLineMat = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
  });

  private projectiles: Projectile[] = [];
  private flying: FlyingDuck[] = [];
  private score = 0;

  private raycaster = new Raycaster();
  private ndc = new Vector2();

  constructor(
    private canvas: HTMLCanvasElement,
    private scene: Scene,
    private camera: Camera,
    private character: Character,
    private ducks: DuckManager,
    private basketDrop: Vector3,
    private basketObject: Object3D,
    private scoreEl: HTMLElement | null,
    private onCollect: (colorIndex: number) => boolean,
    private onOpenMerge: () => void,
    private upg?: CastUpgrades
  ) {
    const red = new MeshBasicMaterial({ color: 0xff3b3b });

    for (let i = 0; i < CONFIG.cast.arcDots; i++) {
      const d = new Mesh(new SphereGeometry(0.09, 8, 8), red);
      d.visible = false;
      this.previewGroup.add(d);
      this.dots.push(d);
    }

    // Preview ring pool (blast fires a spread of rings).
    for (let i = 0; i < MAX_CASTS; i++) {
      const r = new Mesh(
        new TorusGeometry(CONFIG.cast.catchRadius, 0.08, 8, 40),
        red
      );
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      this.rings.push(r);
      this.previewGroup.add(r);
    }

    // Preview beam pool (laser draws a rectangle from the fisherman to the aim).
    const beamMat = new MeshBasicMaterial({
      color: 0xff3b3b,
      transparent: true,
      opacity: 0.22,
      side: DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < MAX_CASTS; i++) {
      const g = new Group();
      const m = new Mesh(new PlaneGeometry(1, 1), beamMat);
      m.rotation.x = -Math.PI / 2; // lay flat in XZ (local Y -> world Z length)
      g.add(m);
      g.visible = false;
      this.beams.push(g);
      this.previewGroup.add(g);
    }

    this.scene.add(this.previewGroup);

    // Rest hook (small dark bob) + fishing line at the rod tip.
    this.hook = new Mesh(this.hookGeo, this.hookMat);
    this.scene.add(this.hook);

    this.lineGeo = new BufferGeometry();
    this.lineGeo.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)
    );
    this.line = new Line(this.lineGeo, this.projLineMat);
    this.scene.add(this.line);

    this.character.getRodTipWorld(this.rodTip);
    this.hook.position.copy(this.rodTip);
    this.updateLine();

    this.attach();
  }

  private attach() {
    this.canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    if (this.phase !== "idle") return;
    // Tapping the 3D basket opens the merge layer instead of casting.
    if (this.hitsBasket(e.clientX, e.clientY)) {
      this.onOpenMerge();
      return;
    }
    this.pointerId = e.pointerId;
    this.startPx = { x: e.clientX, y: e.clientY };
    this.curPx = { ...this.startPx };
    this.phase = "aiming";
    this.autoTimer = 0; // fire on the first frame past the drag threshold
    this.updateAim();
  };

  private onMove = (e: PointerEvent) => {
    if (this.phase !== "aiming" || e.pointerId !== this.pointerId) return;
    this.curPx = { x: e.clientX, y: e.clientY };
    this.updateAim();
  };

  private onUp = (e: PointerEvent) => {
    if (this.phase !== "aiming" || e.pointerId !== this.pointerId) return;
    this.pointerId = null;

    // Automatic: shots already fired while the player held past the threshold.
    if (this.upg?.autoActive()) {
      this.resetToIdle();
      return;
    }

    // Manual: launch one cast if the player actually pulled back a bit.
    const dy = this.curPx.y - this.startPx.y;
    if (dy < CONFIG.cast.dragActivateDist || this.power <= 0.02) {
      this.resetToIdle();
      return;
    }
    this.fire(false);
    this.phase = "idle";
    this.power = 0;
    this.hidePreview();
  };

  // Raycast a screen point against the basket mesh group.
  private hitsBasket(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.intersectObject(this.basketObject, true).length > 0;
  }

  // Map the slingshot drag to a landing point + pull-back power.
  private updateAim() {
    const c = CONFIG.cast;
    const dx = this.curPx.x - this.startPx.x;
    const dy = this.curPx.y - this.startPx.y; // + = dragged downward

    this.power = MathUtils.clamp(dy / c.maxDragPx, 0, 1);
    this.aimRange = MathUtils.lerp(c.minRange, c.maxRange, this.power);
    this.aimAngle = MathUtils.clamp(dx / c.maxLatPx, -1, 1) * c.maxAimAngle;

    // Direction from the player into the pool (world -Z) rotated by aim angle.
    const dir = new Vector3(Math.sin(this.aimAngle), 0, -Math.cos(this.aimAngle));
    const anchor = new Vector3(...CONFIG.player.anchor);
    this.landing.copy(anchor).addScaledVector(dir, this.aimRange);
    this.clampToPool(this.landing);
    this.landing.y = CONFIG.pool.waterY + 0.02;

    this.character.setPullback(this.power);
    this.character.getRodTipWorld(this.rodTip);
    this.showPreview();
  }

  private clampToPool(v: Vector3) {
    const hw = CONFIG.pool.width / 2 - 0.4;
    const hd = CONFIG.pool.depth / 2 - 0.4;
    v.x = MathUtils.clamp(v.x, -hw, hw);
    v.z = MathUtils.clamp(v.z, -hd, hd);
  }

  // Angular offsets for a spread of `n` casts, symmetric about the aim.
  private spreadOffsets(n: number): number[] {
    if (n <= 1) return [0];
    const spread = this.upg?.spreadAngle() ?? 0.5;
    const res: number[] = [];
    for (let i = 0; i < n; i++) res.push(spread * ((i / (n - 1)) * 2 - 1));
    return res;
  }

  // Landing points for the current aim, one per cast. `jitter` adds a little
  // scatter on a real fire so a blast pattern isn't perfectly regular.
  private computeTargets(casts: number, jitter: boolean): Vector3[] {
    const anchor = new Vector3(...CONFIG.player.anchor);
    const offsets = this.spreadOffsets(casts);
    const out: Vector3[] = [];
    for (const off of offsets) {
      let a = this.aimAngle + off;
      if (jitter && casts > 1) a += (Math.random() - 0.5) * 0.08;
      const dir = new Vector3(Math.sin(a), 0, -Math.cos(a));
      const p = anchor.clone().addScaledVector(dir, this.aimRange);
      this.clampToPool(p);
      p.y = CONFIG.pool.waterY + 0.02;
      out.push(p);
    }
    return out;
  }

  private showPreview() {
    for (const d of this.dots) d.visible = false;
    for (const r of this.rings) r.visible = false;
    for (const b of this.beams) b.visible = false;

    const laser = this.upg?.laserActive() ?? false;
    const casts = this.upg?.blastCasts() ?? 1;
    const areaBonus = this.upg?.areaBonus() ?? 0;
    const radius = CONFIG.cast.catchRadius + areaBonus;
    const halfWidth = (this.upg?.laserHalfWidth() ?? 0) + areaBonus;

    const targets = this.computeTargets(casts, false);

    if (laser) {
      for (let i = 0; i < targets.length; i++) {
        this.configureBeam(this.beams[i], targets[i], halfWidth * 2);
        this.beams[i].visible = true;
      }
    } else {
      for (let i = 0; i < targets.length; i++) {
        const r = this.rings[i];
        r.position.set(targets[i].x, CONFIG.pool.waterY + 0.05, targets[i].z);
        r.scale.setScalar(radius / CONFIG.cast.catchRadius);
        r.visible = true;
      }
    }

    // Arc dots trace the flight to the central landing point.
    const h = CONFIG.cast.arcHeight * (0.5 + this.power * 0.5);
    const tmp = new Vector3();
    for (let i = 0; i < this.dots.length; i++) {
      const t = (i + 1) / (this.dots.length + 1);
      arcPoint(this.rodTip, this.landing, t, h, tmp);
      this.dots[i].position.copy(tmp);
      this.dots[i].visible = true;
    }
  }

  // Orient/scale a beam-preview group to span the fisherman->target segment.
  private configureBeam(group: Group, target: Vector3, width: number) {
    const ax = CONFIG.player.anchor[0];
    const az = CONFIG.player.anchor[2];
    const dx = target.x - ax;
    const dz = target.z - az;
    const len = Math.hypot(dx, dz);
    group.position.set(
      (ax + target.x) / 2,
      CONFIG.pool.waterY + 0.04,
      (az + target.z) / 2
    );
    group.rotation.y = Math.atan2(dx, dz);
    const mesh = group.children[0] as Mesh;
    mesh.scale.set(width, len, 1);
  }

  private hidePreview() {
    for (const d of this.dots) d.visible = false;
    for (const r of this.rings) r.visible = false;
    for (const b of this.beams) b.visible = false;
  }

  // Launch one volley of projectiles from the rod tip.
  private fire(auto: boolean) {
    const casts = this.upg?.blastCasts() ?? 1;
    const areaBonus = this.upg?.areaBonus() ?? 0;
    const radius = CONFIG.cast.catchRadius + areaBonus;
    const halfWidth = (this.upg?.laserHalfWidth() ?? 0) + areaBonus;
    const laser = this.upg?.laserActive() ?? false;
    const height = CONFIG.cast.arcHeight * (0.5 + this.power * 0.5);

    this.character.getRodTipWorld(this.rodTip);
    const targets = this.computeTargets(casts, true);
    for (const target of targets)
      this.spawnProjectile(target, laser, radius, halfWidth, height);

    // A manual cast yanks the pole; the recoil eases back once idle. Autofire
    // keeps the aiming pose so the pole isn't yanked on every shot.
    if (!auto) this.character.setPullback(1);
  }

  private spawnProjectile(
    target: Vector3,
    laser: boolean,
    radius: number,
    halfWidth: number,
    height: number
  ) {
    const hook = new Mesh(this.hookGeo, this.hookMat);
    hook.position.copy(this.rodTip);
    this.scene.add(hook);

    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)
    );
    const line = new Line(lineGeo, this.projLineMat);
    this.scene.add(line);

    this.projectiles.push({
      hook,
      line,
      lineGeo,
      from: this.rodTip.clone(),
      target: target.clone(),
      t: 0,
      height,
      laser,
      radius,
      halfWidth,
    });
  }

  private resetToIdle() {
    this.phase = "idle";
    this.power = 0;
    this.hidePreview();
  }

  // Ease the pole back toward its resting angle (after a yank or a cancelled aim).
  private easePoleToRest(dt: number) {
    const p = CONFIG.player;
    const span = p.pullbackPoleAngle - p.restPoleAngle;
    const pull = (this.character.poleAngleValue - p.restPoleAngle) / span;
    if (pull > 0.01) this.character.setPullback(Math.max(0, pull - dt * 4));
  }

  update(dt: number) {
    // Rest hook/line tracks the rod tip.
    this.character.getRodTipWorld(this.rodTip);
    this.hook.position.copy(this.rodTip);

    if (this.phase === "aiming") {
      // Automatic: fire on a cadence while held past the drag threshold.
      if (this.upg?.autoActive()) {
        const dy = this.curPx.y - this.startPx.y;
        if (dy >= CONFIG.cast.dragActivateDist && this.power > 0.02) {
          this.autoTimer -= dt;
          if (this.autoTimer <= 0) {
            this.fire(true);
            this.autoTimer = this.upg.autoFireInterval();
          }
        }
      }
    } else {
      this.easePoleToRest(dt);
    }

    this.updateProjectiles(dt);
    this.updateFlying(dt);
    this.updateLine();
  }

  private updateProjectiles(dt: number) {
    this.character.getRodTipWorld(this.rodTip);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt / CONFIG.cast.travelTime;
      const t = Math.min(p.t, 1);
      arcPoint(p.from, p.target, t, p.height, p.hook.position);

      const pos = p.lineGeo.getAttribute("position") as Float32BufferAttribute;
      pos.setXYZ(0, this.rodTip.x, this.rodTip.y, this.rodTip.z);
      pos.setXYZ(1, p.hook.position.x, p.hook.position.y, p.hook.position.z);
      pos.needsUpdate = true;
      p.lineGeo.computeBoundingSphere();

      if (t >= 1) {
        this.doCapture(p.target, p.laser, p.radius, p.halfWidth);
        this.scene.remove(p.hook);
        this.scene.remove(p.line);
        p.lineGeo.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // Catch live ducks under a landed projectile: a circle around the target, or a
  // beam from the fisherman to the target when the laser is active.
  private doCapture(
    target: Vector3,
    laser: boolean,
    radius: number,
    halfWidth: number
  ) {
    const beamOx = CONFIG.player.anchor[0];
    const beamOz = CONFIG.player.anchor[2];
    const caught: Duck[] = [];
    for (const d of [...this.ducks.ducks]) {
      if (d.state !== "spiraling" && d.state !== "falling") continue;
      const hit = laser
        ? segDistXZ(
            d.position.x,
            d.position.z,
            beamOx,
            beamOz,
            target.x,
            target.z
          ) <= halfWidth
        : Math.hypot(d.position.x - target.x, d.position.z - target.z) <= radius;
      if (hit) {
        d.state = "caught";
        this.ducks.takeCaught(d);
        caught.push(d);
      }
    }

    for (const duck of caught) {
      this.flying.push({
        duck,
        from: duck.position.clone(),
        spin: (Math.random() - 0.5) * 20,
        t: 0,
      });
    }
  }

  private updateFlying(dt: number) {
    const drop = this.basketDrop;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];

      // Rejected duck: ballistic tumble off the bottom of the screen, gone.
      if (f.bounceVel) {
        f.bounceVel.y -= CONFIG.cast.bounceGravity * dt;
        f.duck.position.addScaledVector(f.bounceVel, dt);
        f.duck.group.rotation.x += f.spin * dt;
        f.duck.group.rotation.z += f.spin * 0.5 * dt;
        if (f.duck.position.y < -4) {
          this.scene.remove(f.duck.group);
          f.duck.dispose();
          this.flying.splice(i, 1);
        }
        continue;
      }

      f.t += dt / CONFIG.cast.duckFlyTime;
      const t = Math.min(f.t, 1);
      arcPoint(f.from, drop, t, 3.0, f.duck.position);
      f.duck.group.rotation.x += f.spin * dt;
      f.duck.group.rotation.z += f.spin * 0.5 * dt;
      const s = MathUtils.lerp(1, 0.7, t);
      f.duck.group.scale.setScalar(s);
      if (t >= 1) {
        const accepted = this.onCollect(f.duck.colorIndex);
        if (accepted) {
          this.scene.remove(f.duck.group);
          f.duck.dispose();
          this.flying.splice(i, 1);
          this.addScore(1);
        } else {
          // No room in the basket or storage — bounce off and fly away.
          f.duck.position.copy(drop);
          f.duck.group.scale.setScalar(1);
          f.bounceVel = new Vector3(
            (Math.random() - 0.5) * 6,
            CONFIG.cast.bounceUpSpeed,
            CONFIG.cast.bounceOutSpeed
          );
          f.spin = (Math.random() - 0.5) * 30;
        }
      }
    }
  }

  private addScore(n: number) {
    this.score += n;
    if (this.scoreEl) this.scoreEl.textContent = String(this.score);
  }

  private updateLine() {
    const pos = this.lineGeo.getAttribute("position") as Float32BufferAttribute;
    this.character.getRodTipWorld(this.rodTip);
    pos.setXYZ(0, this.rodTip.x, this.rodTip.y, this.rodTip.z);
    pos.setXYZ(1, this.hook.position.x, this.hook.position.y, this.hook.position.z);
    pos.needsUpdate = true;
    this.lineGeo.computeBoundingSphere();
  }

  // --- Debug hooks for headless verification ---
  get debug() {
    return {
      phase: this.phase,
      power: +this.power.toFixed(2),
      landing: {
        x: +this.landing.x.toFixed(2),
        z: +this.landing.z.toFixed(2),
      },
      hook: {
        x: +this.hook.position.x.toFixed(2),
        y: +this.hook.position.y.toFixed(2),
        z: +this.hook.position.z.toFixed(2),
      },
      projectiles: this.projectiles.length,
      flying: this.flying.length,
      score: this.score,
    };
  }

  // Enter and hold the aiming pose (for visual verification).
  debugAim(dxPx: number, dyPx: number) {
    this.phase = "aiming";
    this.pointerId = 1;
    this.startPx = { x: 200, y: 300 };
    this.curPx = { x: 200 + dxPx, y: 300 + dyPx };
    this.autoTimer = 0;
    this.updateAim();
  }

  // Instantly capture at a world point (no travel) for deterministic tests.
  debugLandAt(x: number, z: number) {
    const areaBonus = this.upg?.areaBonus() ?? 0;
    const radius = CONFIG.cast.catchRadius + areaBonus;
    const halfWidth = (this.upg?.laserHalfWidth() ?? 0) + areaBonus;
    const laser = this.upg?.laserActive() ?? false;
    this.doCapture(
      new Vector3(x, CONFIG.pool.waterY + 0.02, z),
      laser,
      radius,
      halfWidth
    );
  }

  // Aim directly at a world point and launch (for catch tests).
  debugCastAt(x: number, z: number) {
    const anchor = new Vector3(...CONFIG.player.anchor);
    const dx = x - anchor.x;
    const dz = z - anchor.z;
    this.aimRange = Math.hypot(dx, dz);
    this.aimAngle = Math.atan2(dx, -dz);
    this.power = 0.6;
    this.landing.set(x, CONFIG.pool.waterY + 0.02, z);
    this.character.getRodTipWorld(this.rodTip);
    this.fire(false);
    this.phase = "idle";
    this.power = 0;
    this.hidePreview();
  }

  // Simulate a full gesture by pixel deltas (for tests without a real pointer).
  debugCast(dxPx: number, dyPx: number) {
    this.phase = "aiming";
    this.pointerId = 1;
    this.startPx = { x: 200, y: 300 };
    this.curPx = { x: 200 + dxPx, y: 300 + dyPx };
    this.autoTimer = 0;
    this.updateAim();
    this.onUp({ pointerId: 1 } as PointerEvent);
  }
}

export function createCastController(args: {
  canvas: HTMLCanvasElement;
  scene: Scene;
  camera: Camera;
  character: Character;
  ducks: DuckManager;
  basketDrop: Vector3;
  basketObject: Object3D;
  scoreEl: HTMLElement | null;
  onCollect: (colorIndex: number) => boolean;
  onOpenMerge: () => void;
  upgrades?: CastUpgrades;
}): CastController {
  return new CastController(
    args.canvas,
    args.scene,
    args.camera,
    args.character,
    args.ducks,
    args.basketDrop,
    args.basketObject,
    args.scoreEl,
    args.onCollect,
    args.onOpenMerge,
    args.upgrades
  );
}
