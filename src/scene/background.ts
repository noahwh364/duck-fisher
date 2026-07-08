import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Color,
  BackSide,
} from "three";
import { CONFIG } from "../config";

// A large plane that always renders behind everything with a vertical gradient.
// It is added to the scene but rendered first via renderOrder + depthWrite off.
export function createBackground(): Mesh {
  const mat = new ShaderMaterial({
    uniforms: {
      top: { value: new Color(CONFIG.colors.bgTop) },
      bottom: { value: new Color(CONFIG.colors.bgBottom) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 top;
      uniform vec3 bottom;
      void main() {
        float t = smoothstep(0.0, 1.0, vUv.y);
        gl_FragColor = vec4(mix(bottom, top, t), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    side: BackSide,
  });
  // Fullscreen triangle-ish quad in clip space (positions overridden in shader).
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
