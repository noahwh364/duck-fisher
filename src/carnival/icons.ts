// Procedural SVG art for the carnival building layer: the tent nav button, a
// glyph per building type, and a tiny carnival-goer for the wandering crowd.
// Inline-SVG strings, same idiom as src/upgrades/icons.ts.

// Striped big-top tent for the fishing-layer nav button.
export function tentSVG(): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <!-- flag -->
    <path d="M50 8 L50 24" stroke="#ffd23f" stroke-width="3"/>
    <path d="M50 9 L64 13 L50 18 Z" fill="#ff5d73"/>
    <!-- canopy -->
    <path d="M50 20 C24 22 12 34 10 44 L90 44 C88 34 76 22 50 20 Z"
      fill="#ff5d73"/>
    <!-- body -->
    <path d="M14 44 L14 84 L86 84 L86 44 Z" fill="#fff3e0"/>
    <!-- vertical stripes -->
    <g fill="#ff8fa3">
      <path d="M14 44 L26 44 L22 84 L14 84 Z"/>
      <path d="M38 44 L50 44 L50 84 L42 84 Z"/>
      <path d="M62 44 L74 44 L78 84 L70 84 Z"/>
    </g>
    <!-- entrance -->
    <path d="M42 84 L42 62 a8 8 0 0 1 16 0 L58 84 Z" fill="#7a3b1d"/>
    <!-- scalloped valance -->
    <g fill="#ffd23f">
      <path d="M10 44 a6 6 0 0 0 12 0 a6 6 0 0 0 12 0 a6 6 0 0 0 12 0
               a6 6 0 0 0 12 0 a6 6 0 0 0 12 0 a6 6 0 0 0 12 0 L86 50 L10 50 Z"/>
    </g>
  </svg>`;
}

// Building glyphs, drawn on a rounded square by the caller.
export function buildingSVG(id: string): string {
  switch (id) {
    case "ring-toss":
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <rect x="20" y="78" width="60" height="8" rx="3" fill="#7a3b1d"/>
        <g fill="none" stroke-width="7">
          <circle cx="34" cy="52" r="16" stroke="#ff5d73"/>
          <circle cx="62" cy="46" r="14" stroke="#4ecdc4"/>
          <circle cx="52" cy="66" r="12" stroke="#ffd23f"/>
        </g>
        <rect x="47" y="30" width="6" height="50" rx="3" fill="#c98a3a"/>
      </svg>`;
    case "food-stand":
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <rect x="18" y="46" width="64" height="38" rx="4" fill="#fff3e0"/>
        <rect x="18" y="46" width="64" height="40" fill="none"/>
        <!-- awning -->
        <path d="M14 46 L86 46 L86 34 L14 34 Z" fill="#ff5d73"/>
        <g fill="#fff3e0">
          <path d="M14 46 a6 6 0 0 0 12 0 a6 6 0 0 0 12 0 a6 6 0 0 0 12 0
                   a6 6 0 0 0 12 0 a6 6 0 0 0 12 0 a6 6 0 0 0 12 0 L86 40 L14 40 Z"/>
        </g>
        <rect x="42" y="60" width="16" height="24" rx="2" fill="#7a3b1d"/>
        <circle cx="50" cy="26" r="6" fill="#ffd23f"/>
      </svg>`;
    case "carousel":
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <!-- roof -->
        <path d="M50 10 L84 40 L16 40 Z" fill="#ff5d73"/>
        <circle cx="50" cy="10" r="4" fill="#ffd23f"/>
        <rect x="18" y="40" width="64" height="6" fill="#ffd23f"/>
        <!-- poles -->
        <g stroke="#c98a3a" stroke-width="5">
          <path d="M28 46 L28 80"/><path d="M50 46 L50 80"/><path d="M72 46 L72 80"/>
        </g>
        <rect x="16" y="80" width="68" height="7" rx="3" fill="#4ecdc4"/>
        <circle cx="28" cy="62" r="6" fill="#a06cd5"/>
        <circle cx="72" cy="62" r="6" fill="#8ac926"/>
      </svg>`;
    case "ferris-wheel":
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <circle cx="50" cy="44" r="34" fill="none" stroke="#4ecdc4" stroke-width="5"/>
        <circle cx="50" cy="44" r="6" fill="#ffd23f"/>
        <g stroke="#4ecdc4" stroke-width="4">
          <path d="M50 44 L50 10"/><path d="M50 44 L50 78"/>
          <path d="M50 44 L16 44"/><path d="M50 44 L84 44"/>
          <path d="M50 44 L26 20"/><path d="M50 44 L74 68"/>
          <path d="M50 44 L74 20"/><path d="M50 44 L26 68"/>
        </g>
        <g fill="#ff5d73">
          <circle cx="50" cy="10" r="5"/><circle cx="50" cy="78" r="5"/>
          <circle cx="16" cy="44" r="5"/><circle cx="84" cy="44" r="5"/>
        </g>
        <path d="M38 78 L50 50 L62 78 Z" fill="#7a3b1d"/>
      </svg>`;
    case "porta-potty":
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <rect x="28" y="18" width="44" height="68" rx="4" fill="#4ea1d3"/>
        <rect x="30" y="20" width="40" height="10" rx="2" fill="#3a7fae"/>
        <rect x="34" y="34" width="32" height="46" rx="3" fill="#5fb4e6"/>
        <circle cx="62" cy="58" r="2.5" fill="#2c5c7a"/>
        <rect x="40" y="40" width="20" height="12" rx="2" fill="#eaf6ff"/>
        <circle cx="50" cy="46" r="3" fill="#4ea1d3"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <rect x="24" y="34" width="52" height="50" rx="6" fill="#c98a3a"/>
        <path d="M20 34 L50 14 L80 34 Z" fill="#ff5d73"/>
      </svg>`;
  }
}

const NPC_SHIRTS = ["#ff5d73", "#4ecdc4", "#ffd23f", "#a06cd5", "#8ac926", "#00bbf9"];

// Tiny carnival-goer. `variant` picks a shirt color deterministically.
export function npcSVG(variant = 0): string {
  const shirt = NPC_SHIRTS[variant % NPC_SHIRTS.length];
  return `<svg viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <circle cx="20" cy="12" r="9" fill="#e8b98a"/>
    <path d="M8 54 L8 34 a12 12 0 0 1 24 0 L32 54 Z" fill="${shirt}"/>
    <rect x="10" y="46" width="8" height="12" rx="3" fill="#2f4b7c"/>
    <rect x="22" y="46" width="8" height="12" rx="3" fill="#2f4b7c"/>
  </svg>`;
}

// Small sparkle glyph for the special-events button.
export function sparkleSVG(): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <path d="M50 10 L58 42 L90 50 L58 58 L50 90 L42 58 L10 50 L42 42 Z"
      fill="#ffd23f"/>
  </svg>`;
}
