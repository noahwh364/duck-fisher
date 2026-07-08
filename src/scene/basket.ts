import {
  Group,
  Mesh,
  CylinderGeometry,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { CONFIG } from "../config";

// A small basket beside the player where caught ducks land.
export function createBasket(): { group: Group; dropPoint: Vector3 } {
  const g = new Group();
  const p = CONFIG.player;
  g.position.set(
    p.anchor[0] + p.basketOffset[0],
    0,
    p.anchor[2] + p.basketOffset[2]
  );

  const mat = new MeshStandardMaterial({
    color: CONFIG.colors.basket,
    roughness: 0.9,
  });
  const rim = new MeshStandardMaterial({ color: "#a9743a", roughness: 0.85 });

  const body = new Mesh(new CylinderGeometry(0.55, 0.42, 0.7, 16, 1, true), mat);
  body.position.y = 0.35;
  g.add(body);

  const bottom = new Mesh(new CylinderGeometry(0.42, 0.42, 0.05, 16), mat);
  bottom.position.y = 0.03;
  g.add(bottom);

  const ring = new Mesh(new CylinderGeometry(0.57, 0.57, 0.1, 16), rim);
  ring.position.y = 0.68;
  g.add(ring);

  const dropPoint = new Vector3(g.position.x, 0.6, g.position.z);
  return { group: g, dropPoint };
}
