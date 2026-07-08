import { Scene, Vector3 } from "three";
import { CONFIG } from "../config";
import { WATERFALL } from "../scene/waterfall";
import { Duck } from "./Duck";
import type { System } from "../main";

// Spawns ducks at the top of the waterfall and manages their fall + spiral.
// Exposes the live ducks so the casting system can catch them.
export class DuckManager implements System {
  readonly ducks: Duck[] = [];
  private timer = 1.0;

  // Spiral geometry, sized to fit inside the rectangular pool.
  private readonly startR: number;
  private readonly endR: number;

  constructor(private scene: Scene) {
    const halfW = CONFIG.pool.width / 2;
    const halfD = CONFIG.pool.depth / 2;
    const maxR = Math.min(halfW, halfD) - 0.35;
    this.startR = maxR * CONFIG.ducks.spiralStartRadiusFrac;
    this.endR = CONFIG.blackHole.radius * 0.6;
  }

  update(dt: number, elapsed: number) {
    this.timer -= dt;
    if (this.timer <= 0 && this.ducks.length < CONFIG.ducks.maxAlive) {
      this.spawn();
      const { spawnIntervalMin: a, spawnIntervalMax: b } = CONFIG.ducks;
      this.timer = a + Math.random() * (b - a);
    }

    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i];
      if (d.state === "caught") continue; // owned by the cast controller
      const alive = d.update(dt, elapsed);
      if (!alive) this.remove(i);
    }
  }

  private spawn() {
    const from = new Vector3(
      (Math.random() - 0.5) * (WATERFALL.width * 0.6),
      WATERFALL.topY - 0.3,
      WATERFALL.z + 0.1
    );
    // theta0 = -PI/2 places the spiral entry near the waterfall (-Z side).
    const duck = new Duck({
      from,
      theta0: -Math.PI / 2,
      startR: this.startR,
      endR: this.endR,
      turns: CONFIG.ducks.spiralTurns,
    });
    this.ducks.push(duck);
    this.scene.add(duck.group);
  }

  // Remove ducks caught by the cast so the manager stops touching them; the
  // caller takes ownership of the group for the fly-to-basket animation.
  takeCaught(duck: Duck) {
    const i = this.ducks.indexOf(duck);
    if (i >= 0) this.ducks.splice(i, 1);
  }

  private remove(i: number) {
    const d = this.ducks[i];
    this.scene.remove(d.group);
    d.dispose();
    this.ducks.splice(i, 1);
  }
}

export function createDuckManager(scene: Scene): DuckManager {
  return new DuckManager(scene);
}
