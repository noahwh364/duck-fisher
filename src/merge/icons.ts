import { CONFIG } from "../config";

// Procedural SVG art for the merge layer. Ducks are drawn as a stylized side
// profile (facing right) in their palette color. As they level up they gain a
// hat (L2), a full costume on the body (L3), and an accessory (L4). Each color
// maps to a themed costume so a duck's color reads as its "role".

export const paletteHex: string[] = CONFIG.ducks.palette.map(
  (c) => "#" + c.getHexString()
);

// Costume theme per color index.
export const COSTUMES = [
  "chef", // 0 yellow
  "fireman", // 1 red
  "doctor", // 2 teal
  "ninja", // 3 purple  (gets a mask instead of a hat)
  "builder", // 4 orange (construction)
  "pirate", // 5 green
  "wizard", // 6 pink
  "police", // 7 blue
] as const;

export type Costume = (typeof COSTUMES)[number];

export function costumeFor(colorIndex: number): Costume {
  return COSTUMES[colorIndex % COSTUMES.length];
}

// Darken a #rrggbb hex by mixing toward black by `amt` (0..1).
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// The base duck body/head/beak/eye, drawn in the given color. Faces right.
function baseDuck(color: string, hideEyes = false): string {
  const dark = shade(color, 0.22);
  const eye = hideEyes
    ? ""
    : `<circle cx="67" cy="35" r="3" fill="#15161b"/>
       <circle cx="68" cy="34" r="1" fill="#fff"/>`;
  return `
    <!-- tail -->
    <path d="M20 62 Q10 58 14 70 Q22 70 26 66 Z" fill="${dark}"/>
    <!-- body -->
    <ellipse cx="46" cy="64" rx="30" ry="22" fill="${color}"/>
    <ellipse cx="46" cy="70" rx="30" ry="16" fill="${dark}" opacity="0.35"/>
    <!-- head -->
    <circle cx="62" cy="40" r="18" fill="${color}"/>
    <!-- beak -->
    <path d="M78 37 L94 40 L78 46 Z" fill="#ff9f1c"/>
    <path d="M78 43 L90 42 L78 46 Z" fill="#e07d0a"/>
    ${eye}
  `;
}

// ---- Hats (level >= 2). Ninja returns a mask instead. ----
function hat(costume: Costume, color: string): string {
  const dark = shade(color, 0.3);
  switch (costume) {
    case "chef":
      return `
        <rect x="50" y="24" width="24" height="8" rx="2" fill="#fff"/>
        <circle cx="54" cy="20" r="7" fill="#fff"/>
        <circle cx="62" cy="17" r="8" fill="#fff"/>
        <circle cx="70" cy="20" r="7" fill="#fff"/>`;
    case "fireman":
      return `
        <path d="M46 30 Q62 8 80 30 Z" fill="#c1121f"/>
        <rect x="46" y="29" width="34" height="5" rx="2" fill="#8d0801"/>
        <circle cx="63" cy="20" r="3" fill="#ffd23f"/>`;
    case "doctor":
      return `
        <rect x="48" y="26" width="28" height="7" rx="2" fill="#fff"/>
        <rect x="59" y="18" width="6" height="12" fill="#e63946"/>
        <rect x="56" y="21" width="12" height="6" fill="#e63946"/>`;
    case "ninja":
      // Mask band across the eyes instead of a hat.
      return `
        <rect x="47" y="33" width="34" height="10" rx="2" fill="#1b1b22"/>
        <circle cx="67" cy="38" r="2.6" fill="#fff"/>
        <path d="M47 33 L40 30 L44 36 Z" fill="#1b1b22"/>`;
    case "builder":
      return `
        <path d="M45 30 Q62 12 79 30 Z" fill="#ffca3a"/>
        <rect x="43" y="29" width="38" height="5" rx="2" fill="#f4a300"/>
        <rect x="60" y="16" width="4" height="12" fill="#f4a300"/>`;
    case "pirate":
      return `
        <path d="M44 30 Q62 6 80 30 Q62 24 44 30 Z" fill="#141414"/>
        <circle cx="62" cy="21" r="3.2" fill="#fff"/>
        <path d="M60 19 l4 4 M64 19 l-4 4" stroke="#141414" stroke-width="1"/>`;
    case "wizard":
      return `
        <path d="M62 4 L50 30 L74 30 Z" fill="#3a0ca3"/>
        <path d="M48 29 h28 v4 h-28 Z" fill="#240046"/>
        <path d="M60 16 l2 4 2-4 -2-4 Z" fill="#ffd23f"/>
        <circle cx="57" cy="24" r="1.4" fill="#ffd23f"/>
        <circle cx="67" cy="22" r="1.4" fill="#ffd23f"/>`;
    case "police":
      return `
        <path d="M46 30 h32 v-3 q-16 -10 -32 0 Z" fill="#1d3557"/>
        <rect x="46" y="29" width="32" height="5" rx="1" fill="#14213d"/>
        <rect x="56" y="22" width="12" height="5" rx="1" fill="#14213d"/>
        <circle cx="62" cy="24" r="1.6" fill="#ffd23f"/>`;
    default:
      return `<rect x="50" y="24" width="24" height="7" rx="2" fill="${dark}"/>`;
  }
}

// ---- Costume clothes on the body (level >= 3). ----
function clothes(costume: Costume): string {
  switch (costume) {
    case "chef":
      return `
        <path d="M30 60 Q46 54 62 60 L60 84 Q46 88 34 84 Z" fill="#fff"/>
        <circle cx="42" cy="66" r="1.6" fill="#c9c9c9"/>
        <circle cx="42" cy="74" r="1.6" fill="#c9c9c9"/>`;
    case "fireman":
      return `
        <path d="M28 58 Q46 52 64 58 L62 84 Q46 88 32 84 Z" fill="#ffb703"/>
        <rect x="30" y="70" width="34" height="4" fill="#adb5bd"/>
        <rect x="44" y="58" width="4" height="26" fill="#c1121f"/>`;
    case "doctor":
      return `
        <path d="M28 58 Q46 52 64 58 L62 86 Q46 90 32 86 Z" fill="#fff"/>
        <path d="M50 56 q4 12 -2 20" stroke="#4a4e69" stroke-width="2" fill="none"/>
        <circle cx="48" cy="78" r="2.4" fill="#4a4e69"/>`;
    case "ninja":
      return `
        <path d="M28 58 Q46 52 64 58 L62 86 Q46 90 32 86 Z" fill="#22232b"/>
        <rect x="28" y="70" width="36" height="5" fill="#5a189a"/>`;
    case "builder":
      return `
        <path d="M28 58 Q46 52 64 58 L62 86 Q46 90 32 86 Z" fill="#fb8500"/>
        <rect x="30" y="66" width="34" height="6" fill="#ffd23f"/>
        <rect x="30" y="76" width="34" height="4" fill="#adb5bd"/>`;
    case "pirate":
      return `
        <path d="M28 58 Q46 52 64 58 L62 86 Q46 90 32 86 Z" fill="#e9ecef"/>
        <rect x="28" y="62" width="36" height="4" fill="#c1121f"/>
        <rect x="28" y="72" width="36" height="4" fill="#c1121f"/>
        <rect x="28" y="82" width="36" height="4" fill="#c1121f"/>`;
    case "wizard":
      return `
        <path d="M26 58 Q46 50 66 58 L64 88 Q46 92 30 88 Z" fill="#3a0ca3"/>
        <path d="M40 60 l2 6 2-6 M52 66 l1.5 4 1.5-4" fill="#ffd23f"/>
        <circle cx="46" cy="76" r="1.6" fill="#ffd23f"/>`;
    case "police":
      return `
        <path d="M28 58 Q46 52 64 58 L62 86 Q46 90 32 86 Z" fill="#1d3557"/>
        <path d="M52 74 l3 4 4-8" stroke="#ffd23f" stroke-width="2" fill="none"/>
        <rect x="34" y="64" width="4" height="20" fill="#14213d"/>`;
    default:
      return "";
  }
}

// ---- Accessory (level >= 4). ----
function accessory(costume: Costume): string {
  switch (costume) {
    case "chef":
      // frying pan
      return `
        <ellipse cx="20" cy="52" rx="9" ry="4" fill="#343a40"/>
        <rect x="26" y="50" width="16" height="3" rx="1.5" fill="#6c757d"/>`;
    case "fireman":
      // hose
      return `
        <path d="M14 74 q-6 -10 6 -14 t8 -2" stroke="#e63946" stroke-width="3" fill="none"/>
        <rect x="26" y="54" width="8" height="5" rx="1" fill="#adb5bd"/>`;
    case "doctor":
      // clipboard
      return `
        <rect x="10" y="60" width="14" height="18" rx="1.5" fill="#f1faee"/>
        <rect x="14" y="57" width="6" height="4" rx="1" fill="#adb5bd"/>
        <rect x="13" y="65" width="8" height="1.6" fill="#adb5bd"/>
        <rect x="13" y="69" width="8" height="1.6" fill="#adb5bd"/>`;
    case "ninja":
      // throwing star
      return `
        <path d="M16 54 l3 5 5 -1 -3 5 3 5 -5 -1 -3 5 -3 -5 -5 1 3 -5 -3 -5 5 1 Z"
          fill="#adb5bd" stroke="#495057" stroke-width="0.6"/>`;
    case "builder":
      // wrench
      return `
        <path d="M12 68 l10 -10 3 3 -10 10 Z" fill="#adb5bd"/>
        <circle cx="12" cy="68" r="4" fill="none" stroke="#adb5bd" stroke-width="3"/>`;
    case "pirate":
      // sword
      return `
        <rect x="10" y="50" width="20" height="3" rx="1.5" fill="#dee2e6"
          transform="rotate(35 20 52)"/>
        <rect x="12" y="60" width="6" height="3" fill="#8d5524"/>`;
    case "wizard":
      // wand with star
      return `
        <rect x="12" y="50" width="16" height="2.6" rx="1.3" fill="#6c757d"
          transform="rotate(40 20 52)"/>
        <path d="M12 46 l1.2 2.6 2.8 .3 -2 2 .6 2.8 -2.6 -1.4 -2.6 1.4 .6 -2.8 -2 -2 2.8 -.3 Z"
          fill="#ffd23f"/>`;
    case "police":
      // whistle
      return `
        <circle cx="16" cy="64" r="5" fill="#495057"/>
        <rect x="20" y="62" width="6" height="4" rx="1" fill="#495057"/>
        <path d="M16 64 q-8 -8 -2 -14" stroke="#adb5bd" stroke-width="1.5" fill="none"/>`;
    default:
      return "";
  }
}

// Compose the full duck SVG markup for a color + level (1..4).
export function buildDuckSVG(colorIndex: number, level: number): string {
  const color = paletteHex[colorIndex % paletteHex.length];
  const costume = costumeFor(colorIndex);
  const isNinja = costume === "ninja";

  const parts: string[] = [];
  // Ninja mask covers the eyes, so hide them when the mask is on.
  parts.push(baseDuck(color, isNinja && level >= 2));
  if (level >= 3) parts.push(clothes(costume));
  if (level >= 4) parts.push(accessory(costume));
  if (level >= 2) parts.push(hat(costume, color));

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">${parts.join("")}</svg>`;
}

// Data-URL variant (handy for CSS background-image or <img>).
export function duckDataURL(colorIndex: number, level: number): string {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(buildDuckSVG(colorIndex, level))
  );
}

// A small child NPC face for orders. A few skin tones + hair colors cycle.
const SKIN = ["#f2c9a0", "#e0ac69", "#c68642", "#8d5524"];
const HAIR = ["#3b2a1a", "#6b4423", "#111", "#a8631b", "#d9a441"];

export function buildChildSVG(index: number): string {
  const skin = SKIN[index % SKIN.length];
  const hair = HAIR[(index * 2 + 1) % HAIR.length];
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <!-- shoulders -->
    <path d="M22 96 Q50 70 78 96 Z" fill="#5390d9"/>
    <!-- head -->
    <circle cx="50" cy="46" r="26" fill="${skin}"/>
    <!-- hair -->
    <path d="M24 46 Q26 16 50 16 Q74 16 76 46 Q66 32 50 32 Q34 32 24 46 Z"
      fill="${hair}"/>
    <!-- eyes -->
    <circle cx="41" cy="46" r="3.2" fill="#15161b"/>
    <circle cx="59" cy="46" r="3.2" fill="#15161b"/>
    <!-- smile -->
    <path d="M40 56 Q50 64 60 56" stroke="#b5651d" stroke-width="2.4"
      fill="none" stroke-linecap="round"/>
  </svg>`;
}

// Suitcase icon for the storage feature.
export function suitcaseSVG(): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <!-- handle -->
    <rect x="36" y="24" width="28" height="16" rx="6" fill="none"
      stroke="#c9873a" stroke-width="6"/>
    <!-- body -->
    <rect x="18" y="36" width="64" height="50" rx="9" fill="#b5793a"
      stroke="#7a4f1f" stroke-width="4"/>
    <!-- straps -->
    <rect x="30" y="36" width="7" height="50" fill="#8a5a2b"/>
    <rect x="63" y="36" width="7" height="50" fill="#8a5a2b"/>
    <!-- latch -->
    <rect x="44" y="56" width="12" height="9" rx="2" fill="#ffd23f"
      stroke="#7a4f1f" stroke-width="1.5"/>
  </svg>`;
}

// Heart icon for the currency HUD.
export function heartSVG(): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <path d="M50 84 C18 60 20 30 40 30 C48 30 50 38 50 40
      C50 38 52 30 60 30 C80 30 82 60 50 84 Z" fill="#ff4d6d"
      stroke="#c9184a" stroke-width="3"/>
  </svg>`;
}
