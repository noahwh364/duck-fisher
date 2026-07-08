import {
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Color,
  DoubleSide,
  BoxGeometry,
  MeshStandardMaterial,
} from "three";
import { CONFIG } from "../config";
import type { System } from "../main";

// A waterfall that pours down at the far (-Z) edge of the pool, feeding it.
// Ducks are dropped from the top of this waterfall by the DuckManager.
export const WATERFALL = {
  topY: 4.6,
  get z() {
    return -CONFIG.pool.depth / 2 + 0.4;
  },
  width: 4.2,
};

export function createWaterfall(): { group: Group; system: System } {
  const g = new Group();
  const topY = WATERFALL.topY;
  const z = WATERFALL.z;
  const width = WATERFALL.width;
  const height = topY - CONFIG.pool.waterY + 0.3;

  // Falling sheet of water.
  const mat = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new Color("#bfeaff") },
      uBottom: { value: new Color("#2b8fd0") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uTop, uBottom;
      void main() {
        // Vertical streaks scrolling downward.
        float x = vUv.x;
        float y = vUv.y;
        float streak = sin(x * 40.0 + sin(x * 7.0) * 3.0);
        float flow = fract(y * 3.0 + uTime * 1.8 + streak * 0.05);
        float bright = 0.5 + 0.5 * smoothstep(0.2, 0.9, flow);
        vec3 col = mix(uBottom, uTop, bright);
        // Fade the very bottom into foam where it hits the pool.
        float foam = smoothstep(0.12, 0.0, y);
        col = mix(col, vec3(1.0), foam * 0.5);
        gl_FragColor = vec4(col, 0.92);
      }
    `,
  });
  const sheet = new Mesh(new PlaneGeometry(width, height, 1, 1), mat);
  sheet.position.set(0, CONFIG.pool.waterY + height / 2, z);
  g.add(sheet);

  // A little chute/lip at the top the water spills from.
  const lip = new Mesh(
    new BoxGeometry(width + 0.8, 0.5, 1.2),
    new MeshStandardMaterial({ color: "#4a6f9e", roughness: 0.8 })
  );
  lip.position.set(0, topY + 0.1, z - 0.4);
  g.add(lip);

  const system: System = {
    update(_dt, elapsed) {
      mat.uniforms.uTime.value = elapsed;
    },
  };

  return { group: g, system };
}
