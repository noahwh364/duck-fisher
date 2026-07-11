import {
  Group,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Vector3,
  MathUtils,
} from "three";
import { CONFIG } from "../config";

// A stylized little fisher at the near edge of the pool, holding a pole. The
// pole pivots at the hands so it can be pulled back (aiming) and yanked (catch).
export class Character {
  readonly group = new Group();
  private readonly polePivot = new Group();
  private readonly rodTip = new Mesh(); // marker at the end of the rod
  private poleAngle = CONFIG.player.restPoleAngle;

  constructor() {
    const p = CONFIG.player;
    this.group.position.set(...p.anchor);
    // Face the pool center.
    const toCenter = new Vector3(-p.anchor[0], 0, -p.anchor[2]);
    this.group.rotation.y = Math.atan2(toCenter.x, toCenter.z);

    this.buildBody();
    this.buildPole();
    this.setPullback(0);
  }

  private buildBody() {
    const p = CONFIG.player;
    const skin = new MeshStandardMaterial({ color: p.color, roughness: 0.7 });
    const shirt = new MeshStandardMaterial({ color: p.shirt, roughness: 0.8 });
    const pants = new MeshStandardMaterial({ color: p.pants, roughness: 0.8 });

    const legs = new Mesh(new BoxGeometry(0.5, 0.6, 0.35), pants);
    legs.position.y = 0.3;
    this.group.add(legs);

    const torso = new Mesh(new BoxGeometry(0.6, 0.7, 0.4), shirt);
    torso.position.y = 0.95;
    this.group.add(torso);

    const head = new Mesh(new SphereGeometry(0.28, 16, 12), skin);
    head.position.y = 1.55;
    this.group.add(head);

    // Simple brimmed hat.
    const hatMat = new MeshStandardMaterial({ color: "#3c6e47", roughness: 0.8 });
    const brim = new Mesh(new CylinderGeometry(0.42, 0.42, 0.06, 16), hatMat);
    brim.position.y = 1.72;
    this.group.add(brim);
    const crown = new Mesh(new CylinderGeometry(0.26, 0.26, 0.22, 16), hatMat);
    crown.position.y = 1.83;
    this.group.add(crown);

    // Arms angled toward the pole in front.
    const armGeo = new BoxGeometry(0.16, 0.5, 0.16);
    const lArm = new Mesh(armGeo, shirt);
    lArm.position.set(0.28, 1.0, 0.28);
    lArm.rotation.x = -0.9;
    this.group.add(lArm);
    const rArm = new Mesh(armGeo, shirt);
    rArm.position.set(-0.28, 1.0, 0.28);
    rArm.rotation.x = -0.9;
    this.group.add(rArm);
  }

  private buildPole() {
    const p = CONFIG.player;
    // Pivot at the hands, in front of the body (+Z is "forward toward pool").
    this.polePivot.position.set(0, p.handHeight, 0.35);
    this.group.add(this.polePivot);

    const rodMat = new MeshStandardMaterial({ color: "#6b3f1d", roughness: 0.6 });
    const rodLen = 3.2;
    const rod = new Mesh(
      new CylinderGeometry(0.035, 0.06, rodLen, 8),
      rodMat
    );
    // Rod lies along +Z from the pivot, angled by poleAngle (rotation.x).
    rod.rotation.x = Math.PI / 2;
    rod.position.z = rodLen / 2;
    this.polePivot.add(rod);

    // Rod tip marker (invisible) at the far end, used to launch the line.
    this.rodTip.position.set(0, 0, rodLen);
    this.polePivot.add(this.rodTip);
  }

  // pull in 0..1: 0 = rest (pointed at pool), 1 = fully reared back over shoulder.
  setPullback(pull: number) {
    const p = CONFIG.player;
    this.poleAngle = MathUtils.lerp(p.restPoleAngle, p.pullbackPoleAngle, pull);
    // The rod points along local +Z, so rotation.x rotates its tip in the Y/Z
    // plane: more negative lifts the tip up and swings it back over the shoulder,
    // while positive would dip it down and forward into the pond.
    this.polePivot.rotation.x = this.poleAngle;
  }

  get poleAngleValue() {
    return this.poleAngle;
  }

  getRodTipWorld(target = new Vector3()): Vector3 {
    return this.rodTip.getWorldPosition(target);
  }
}

export function createCharacter(): Character {
  return new Character();
}
