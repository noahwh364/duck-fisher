import {
  Group,
  Mesh,
  SphereGeometry,
  ConeGeometry,
  MeshStandardMaterial,
  Color,
  Vector3,
} from "three";
import { CONFIG } from "../config";

export type DuckState = "falling" | "spiraling" | "caught" | "dead";

// Shared geometries (created once, reused per duck).
const bodyGeo = new SphereGeometry(0.4, 16, 12);
bodyGeo.scale(1.25, 0.85, 1.0); // squashed egg-ish body
const headGeo = new SphereGeometry(0.24, 14, 10);
const beakGeo = new ConeGeometry(0.09, 0.22, 10);
beakGeo.rotateX(Math.PI / 2); // point along +Z
const beakMat = new MeshStandardMaterial({
  color: "#ff9f1c",
  roughness: 0.5,
});
const eyeGeo = new SphereGeometry(0.045, 8, 8);
const eyeMat = new MeshStandardMaterial({ color: "#101014" });

export class Duck {
  readonly group = new Group();
  state: DuckState = "falling";
  readonly color: Color;
  readonly colorIndex: number;

  // Falling phase (down the waterfall onto the rim).
  private fallT = 0;
  private fallFrom = new Vector3();
  private fallTo = new Vector3();
  private fallArc = 1.4;

  // Spiral phase.
  private spiralT = 0;
  private spiralTheta = 0; // accumulated angle (advanced by a radius-based speed)
  private readonly theta0: number;
  private readonly startR: number;
  private readonly endR: number;
  private readonly baseOmega: number; // rim angular speed (rad/s)
  private bobPhase = Math.random() * Math.PI * 2;

  constructor(opts: {
    from: Vector3;
    theta0: number;
    startR: number;
    endR: number;
    turns: number;
  }) {
    this.colorIndex = Math.floor(
      Math.random() * CONFIG.ducks.palette.length
    );
    this.color = CONFIG.ducks.palette[this.colorIndex].clone();
    this.theta0 = opts.theta0;
    this.startR = opts.startR;
    this.endR = opts.endR;
    // Base (rim) angular speed derived from the desired rim turn count.
    this.baseOmega = (opts.turns * Math.PI * 2) / CONFIG.ducks.spiralDuration;

    this.fallFrom.copy(opts.from);
    this.fallTo.set(
      Math.cos(opts.theta0) * opts.startR,
      CONFIG.pool.waterY + 0.12,
      Math.sin(opts.theta0) * opts.startR
    );

    this.build();
    const s = 0.9 + Math.random() * 0.3;
    this.group.scale.setScalar(s);
    this.group.position.copy(this.fallFrom);
  }

  private build() {
    const bodyMat = new MeshStandardMaterial({
      color: this.color,
      roughness: 0.55,
      metalness: 0.0,
    });
    const body = new Mesh(bodyGeo, bodyMat);
    this.group.add(body);

    const head = new Mesh(headGeo, bodyMat);
    head.position.set(0.32, 0.28, 0);
    this.group.add(head);

    const beak = new Mesh(beakGeo, beakMat);
    beak.position.set(0.55, 0.24, 0);
    beak.rotation.z = -Math.PI / 2; // point forward (+X)
    this.group.add(beak);

    for (const dz of [-0.11, 0.11]) {
      const eye = new Mesh(eyeGeo, eyeMat);
      eye.position.set(0.44, 0.34, dz);
      this.group.add(eye);
    }
  }

  // Returns true while alive; false once it has vanished into the hole.
  update(dt: number, elapsed: number): boolean {
    if (this.state === "falling") {
      this.fallT += dt / CONFIG.ducks.fallDuration;
      const t = Math.min(this.fallT, 1);
      const e = t * t * (3 - 2 * t); // smoothstep
      this.group.position.lerpVectors(this.fallFrom, this.fallTo, e);
      // Parabolic arc height on the way down.
      this.group.position.y += Math.sin(e * Math.PI) * this.fallArc * (1 - e);
      this.group.rotation.y = this.theta0 + Math.PI; // face inward-ish
      this.group.rotation.z = (1 - e) * 0.6; // tumble flattening out
      if (t >= 1) {
        this.state = "spiraling";
        this.spiralT = 0;
      }
      return true;
    }

    if (this.state === "spiraling") {
      this.spiralT += dt / CONFIG.ducks.spiralDuration;
      const t = Math.min(this.spiralT, 1);
      // Ease the radius inward (t^2) so ducks linger near the rim before
      // accelerating toward the hole -> denser ring around the edge.
      const rT = t * t;
      const r = this.startR + (this.endR - this.startR) * rT;
      // Vortex spin-up: angular speed grows as the radius shrinks, so ducks
      // drift slowly at the rim and whip around faster near the center.
      const omega =
        this.baseOmega *
        Math.pow(this.startR / Math.max(r, this.endR), CONFIG.ducks.spiralSpinExp);
      this.spiralTheta += omega * dt;
      const theta = this.theta0 + this.spiralTheta;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      this.group.position.set(
        x,
        CONFIG.pool.waterY +
          0.12 +
          Math.sin(elapsed * CONFIG.ducks.bobSpeed + this.bobPhase) *
            CONFIG.ducks.bobAmplitude,
        z
      );
      // Face along the direction of travel (tangent of the spiral).
      const tangent = theta + Math.PI / 2;
      this.group.rotation.set(0, -tangent, 0);

      if (t >= 1) {
        this.state = "dead";
        return false;
      }
      return true;
    }

    // caught / dead are driven externally or ignored.
    return this.state !== "dead";
  }

  get position(): Vector3 {
    return this.group.position;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as MeshStandardMaterial;
        // Only dispose per-duck body material; shared ones are reused.
        if (mat !== beakMat && mat !== eyeMat) mat.dispose();
      }
    });
  }
}
