import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ExtrudeGeometry,
} from "three";
import { CONFIG } from "../config";

// Builds the rectangular kiddie-pool basin: four walls with a slightly lighter
// rounded top rim. Water and the black hole are added by other modules.
export function createPool(): Group {
  const g = new Group();
  const { width, depth, wallHeight, wallThickness } = CONFIG.pool;

  const wallMat = new MeshStandardMaterial({
    color: CONFIG.colors.poolWall,
    roughness: 0.85,
    metalness: 0.0,
  });
  const rimMat = new MeshStandardMaterial({
    color: CONFIG.colors.poolWallTop,
    roughness: 0.6,
    metalness: 0.0,
  });

  const halfW = width / 2;
  const halfD = depth / 2;
  const t = wallThickness;

  // Outer footprint of the basin (walls sit on the outside of the water area).
  const outerW = width + t * 2;
  const outerD = depth + t * 2;

  const makeWall = (w: number, d: number, x: number, z: number) => {
    const geo = new BoxGeometry(w, wallHeight, d);
    const m = new Mesh(geo, wallMat);
    m.position.set(x, wallHeight / 2 - 0.1, z);
    m.castShadow = false;
    m.receiveShadow = false;
    g.add(m);
  };

  // North (-Z) and South (+Z) walls span the full outer width.
  makeWall(outerW, t, 0, -halfD - t / 2);
  makeWall(outerW, t, 0, halfD + t / 2);
  // East (+X) and West (-X) walls span only the inner depth.
  makeWall(t, depth, halfW + t / 2, 0);
  makeWall(t, depth, -halfW - t / 2, 0);

  // Rounded top rim as a single extruded frame for a friendlier look.
  const rim = createRim(outerW, outerD, t, rimMat);
  rim.position.y = wallHeight - 0.1;
  g.add(rim);

  return g;
}

function createRim(
  outerW: number,
  outerD: number,
  thickness: number,
  mat: MeshStandardMaterial
): Mesh {
  const ow = outerW / 2;
  const od = outerD / 2;
  const iw = ow - thickness;
  const id = od - thickness;

  const outer = roundedRectShape(ow, od, 0.35);
  const inner = roundedRectShape(iw, id, 0.2);
  outer.holes.push(inner);

  const geo = new ExtrudeGeometry(outer, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  // Extrude builds on XY; rotate flat onto XZ.
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, mat);
  return mesh;
}

function roundedRectShape(halfW: number, halfD: number, r: number): Shape {
  const s = new Shape();
  const x = -halfW;
  const y = -halfD;
  const w = halfW * 2;
  const h = halfD * 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
