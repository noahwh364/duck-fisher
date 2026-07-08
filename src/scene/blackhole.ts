import {
  Group,
  Mesh,
  CircleGeometry,
  ConeGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  Color,
  DoubleSide,
  AdditiveBlending,
} from "three";
import { CONFIG } from "../config";
import type { System } from "../main";

// The vortex throat at the pool center: a dark funnel sinking below the water,
// with a faint spinning accretion ring on the surface.
export function createBlackHole(): { group: Group; system: System } {
  const g = new Group();
  const R = CONFIG.blackHole.radius;
  const y = CONFIG.pool.waterY;

  // Funnel going down (points below the surface).
  const funnel = new Mesh(
    new ConeGeometry(R * 1.05, 2.4, 32, 1, true),
    new MeshBasicMaterial({ color: 0x000000, side: DoubleSide })
  );
  funnel.rotation.x = Math.PI; // tip downward
  funnel.position.y = y - 1.2;
  g.add(funnel);

  // Flat black cap at the mouth to hide the cone interior seam.
  const cap = new Mesh(
    new CircleGeometry(R * 1.05, 32),
    new MeshBasicMaterial({ color: 0x000000 })
  );
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = y - 0.02;
  g.add(cap);

  // Spinning glow ring just above the surface.
  const ringMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color("#63e2ff") },
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
      uniform vec3 uColor;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float ring = smoothstep(0.55, 0.8, r) * smoothstep(1.0, 0.8, r);
        float streaks = 0.5 + 0.5 * sin(a * 8.0 + uTime * 6.0);
        float alpha = ring * (0.25 + 0.75 * streaks);
        gl_FragColor = vec4(uColor, alpha * 0.7);
      }
    `,
  });
  const ring = new Mesh(new CircleGeometry(R * 1.9, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y + 0.03;
  g.add(ring);

  const system: System = {
    update(_dt, elapsed) {
      ringMat.uniforms.uTime.value = elapsed;
    },
  };

  return { group: g, system };
}
