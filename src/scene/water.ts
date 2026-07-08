import { Mesh, PlaneGeometry, ShaderMaterial, Color } from "three";
import { CONFIG } from "../config";
import type { System } from "../main";

// Swirling water surface: a flat plane at the pool's water level running a
// procedural vortex shader that spins inward toward a hole at the center.
export function createWater(): { mesh: Mesh; system: System } {
  const { width, depth, waterY } = CONFIG.pool;
  const inset = CONFIG.pool.rimInset;
  const w = width - inset;
  const d = depth - inset;

  const mat = new ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: w / d },
      uHoleR: { value: CONFIG.blackHole.radius / (Math.min(w, d) / 2) },
      uDeep: { value: new Color("#0a2540") },
      uMid: { value: new Color("#1d6fb8") },
      uShallow: { value: new Color("#57c4e5") },
      uFoam: { value: new Color("#cdf3ff") },
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
      uniform float uAspect; // width/depth, to keep the vortex circular
      uniform float uHoleR;  // normalized hole radius (0..1)
      uniform vec3 uDeep, uMid, uShallow, uFoam;

      void main() {
        // Center + correct aspect so the swirl is round, not stretched.
        vec2 p = (vUv - 0.5) * 2.0;      // -1..1
        p.x *= uAspect;
        float r = length(p);
        float a = atan(p.y, p.x);

        // Rotate faster toward the center (differential swirl).
        float swirl = uTime * (0.6 + 1.8 / (r + 0.35));
        float ang = a + swirl;

        // Spiral bands sweeping inward.
        float bands = sin(ang * 3.0 + r * 9.0 - uTime * 2.5);
        float fine  = sin(ang * 6.0 - r * 18.0 + uTime * 1.3);
        float wave = bands * 0.6 + fine * 0.4;

        // Depth color: shallow at the rim, deep near the hole.
        float depthT = smoothstep(0.15, 1.0, r);
        vec3 col = mix(uDeep, uMid, depthT);
        col = mix(col, uShallow, smoothstep(0.7, 1.05, r));

        // Foam highlights on the wave crests, stronger near center.
        float crest = smoothstep(0.55, 0.95, wave) * (0.35 + 0.65 * (1.0 - r));
        col = mix(col, uFoam, crest * 0.6);

        // Darken into the throat of the vortex.
        float throat = smoothstep(uHoleR + 0.25, uHoleR, r);
        col = mix(col, vec3(0.0), throat * 0.85);

        // Cut the hole for the black hole.
        if (r < uHoleR) discard;

        // Water fills the whole rectangular basin (opaque).
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new Mesh(new PlaneGeometry(w, d, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = waterY;
  mesh.renderOrder = 0;

  const system: System = {
    update(_dt, elapsed) {
      mat.uniforms.uTime.value = elapsed;
    },
  };

  return { mesh, system };
}
