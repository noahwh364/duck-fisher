// Procedural SVG art for the pole-upgrade system: the test-tube "Upgrades"
// entry point and an icon per attachment (automatic / blast / laser).

export function testTubeSVG(): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <!-- tube glass -->
    <path d="M40 12 L40 74 a10 10 0 0 0 20 0 L60 12 Z"
      fill="rgba(180,225,255,0.25)" stroke="#cfeaff" stroke-width="4"
      stroke-linejoin="round"/>
    <!-- liquid -->
    <path d="M40 46 L40 74 a10 10 0 0 0 20 0 L60 46 Z" fill="#39d98a"/>
    <ellipse cx="50" cy="46" rx="10" ry="3" fill="#7cf0b5"/>
    <!-- bubbles -->
    <circle cx="47" cy="60" r="2.4" fill="#eafff4" opacity="0.9"/>
    <circle cx="54" cy="66" r="1.8" fill="#eafff4" opacity="0.8"/>
    <circle cx="49" cy="70" r="1.4" fill="#eafff4" opacity="0.7"/>
    <!-- lip -->
    <rect x="36" y="8" width="28" height="7" rx="3" fill="#e7f5ff"/>
  </svg>`;
}

// Attachment glyphs, drawn on a rounded square by the caller.
export function attachmentSVG(kind: "automatic" | "blast" | "laser"): string {
  switch (kind) {
    case "automatic":
      // rapid-fire chevrons
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <g fill="none" stroke="#ffe08a" stroke-width="10" stroke-linecap="round"
           stroke-linejoin="round">
          <path d="M26 30 L48 50 L26 70"/>
          <path d="M50 30 L72 50 L50 70"/>
        </g>
      </svg>`;
    case "blast":
      // shotgun spread of pellets
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <circle cx="22" cy="50" r="8" fill="#ffb347"/>
        <g fill="#ffd23f">
          <circle cx="52" cy="26" r="7"/>
          <circle cx="60" cy="50" r="7"/>
          <circle cx="52" cy="74" r="7"/>
          <circle cx="80" cy="34" r="5"/>
          <circle cx="84" cy="58" r="5"/>
          <circle cx="76" cy="78" r="4"/>
        </g>
        <path d="M30 50 L52 26 M30 50 L60 50 M30 50 L52 74"
          stroke="#ffb347" stroke-width="3" opacity="0.5"/>
      </svg>`;
    case "laser":
      // focused beam
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%">
        <circle cx="24" cy="50" r="10" fill="#ff5d73"/>
        <path d="M30 50 L92 50" stroke="#ff2d55" stroke-width="10"
          stroke-linecap="round"/>
        <path d="M30 50 L92 50" stroke="#ffd0d8" stroke-width="3"
          stroke-linecap="round"/>
        <circle cx="90" cy="50" r="4" fill="#fff"/>
      </svg>`;
  }
}

// Small clock glyph for the cooldown/duration rows in the skill tree.
export function clockSVG(): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
    width="100%" height="100%">
    <circle cx="50" cy="52" r="34" fill="none" stroke="#cfe3ff" stroke-width="8"/>
    <path d="M50 32 L50 52 L66 62" fill="none" stroke="#cfe3ff" stroke-width="8"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
