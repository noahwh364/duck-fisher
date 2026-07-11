import { Color } from "three";

// World is measured in abstract units. The pool sits centered at the origin on
// the XZ plane, with +Y up. The camera looks down at an isometric angle.
export const CONFIG = {
  // ---- Pool geometry (XZ plane, centered at origin) ----
  pool: {
    width: 9, // along X
    depth: 13, // along Z
    wallHeight: 0.9,
    wallThickness: 0.28,
    rimInset: 0.25, // how far inside the walls the water/spiral lives
    waterY: 0.0, // water surface height
  },

  // ---- Black hole at pool center ----
  blackHole: {
    radius: 0.9,
  },

  // ---- Ducks ----
  ducks: {
    spawnIntervalMin: 0.9,
    spawnIntervalMax: 1.8,
    maxAlive: 16,
    radius: 0.42, // rough duck body radius, used for catch tests
    // Spiral: ducks start near the rim and wind inward to the black hole.
    spiralStartRadiusFrac: 0.99, // fraction of the max in-pool radius
    spiralTurns: 3.2, // sets the base (rim) angular speed
    // Vortex spin-up: angular speed scales with (startR / r)^exp, so ducks
    // swirl slowly at the rim and accelerate as they near the center.
    spiralSpinExp: 1.35,
    spiralDuration: 21.54, // seconds from rim to black hole (35% slower)
    fallDuration: 1.38, // seconds falling down the waterfall onto the rim (35% slower)
    bobAmplitude: 0.08,
    bobSpeed: 2.5,
    palette: [
      new Color("#ffd23f"),
      new Color("#ff6b6b"),
      new Color("#4ecdc4"),
      new Color("#a06cd5"),
      new Color("#ff9f1c"),
      new Color("#8ac926"),
      new Color("#f15bb5"),
      new Color("#00bbf9"),
    ],
  },

  // ---- Casting / hook ----
  cast: {
    dragActivateDist: 24, // px of downward drag to enter aiming
    catchRadius: 1.4, // world radius of the landing ring
    minRange: 2.5, // nearest the hook can land (from rod tip, along ground)
    maxRange: 12.0, // farthest the hook can land
    travelTime: 0.55, // seconds for the hook to fly to target
    arcHeight: 4.5, // apex height of the cast arc
    arcDots: 16, // number of red preview dots
    yankTime: 0.28, // seconds for the pole yank after landing
    duckFlyTime: 0.7, // seconds for a caught duck to fly to the basket
    // When the basket grid AND storage are both full, a caught duck bounces off
    // the basket and tumbles off the bottom of the screen, lost forever.
    bounceUpSpeed: 9, // initial upward pop of the rejected duck
    bounceOutSpeed: 7, // initial speed toward the camera (off-screen bottom)
    bounceGravity: 22, // downward accel applied during the bounce-away
    // Slingshot input mapping: drag down to power the cast, sideways to aim.
    maxDragPx: 240, // downward drag (px) that maps to max range
    maxLatPx: 170, // sideways drag (px) that maps to max aim angle
    maxAimAngle: 0.95, // radians of left/right aim swing
  },

  // ---- Pole upgrades (test-tube skill tree) ----
  // Three unlockable attachments, each activatable for a timed window then a
  // cooldown. They stack as orthogonal modifiers of the cast: Automatic = fire
  // cadence, Blast = casts per fire, Laser = beam capture shape.
  // Each track: value(level) = base + step*level (level 0..max). Buying
  // level -> level+1 costs round(cost.base * cost.growth^level) hearts.
  upgrades: {
    automatic: {
      unlockCost: 150,
      // shots per second while holding/aiming
      fireRate: { base: 2.2, step: 0.8, max: 5, cost: { base: 50, growth: 1.55 } },
      // bonus added to the circular catch radius
      catchArea: { base: 0.0, step: 0.28, max: 4, cost: { base: 55, growth: 1.6 } },
      duration: { base: 15, step: 3, max: 3, cost: { base: 70, growth: 1.7 } },
      cooldown: { base: 120, step: -18, max: 4, cost: { base: 70, growth: 1.7 } },
    },
    blast: {
      unlockCost: 180,
      // number of casts fired at once (2..6)
      casts: { base: 2, step: 1, max: 4, cost: { base: 80, growth: 1.7 } },
      catchArea: { base: 0.0, step: 0.22, max: 4, cost: { base: 55, growth: 1.6 } },
      duration: { base: 15, step: 3, max: 3, cost: { base: 70, growth: 1.7 } },
      cooldown: { base: 120, step: -18, max: 4, cost: { base: 70, growth: 1.7 } },
      spreadAngle: 0.5, // radians half-spread of the shotgun pattern
    },
    laser: {
      unlockCost: 220,
      // half-width of the capture beam
      rayWidth: { base: 0.7, step: 0.35, max: 4, cost: { base: 60, growth: 1.6 } },
      duration: { base: 15, step: 3, max: 3, cost: { base: 70, growth: 1.7 } },
      cooldown: { base: 120, step: -18, max: 4, cost: { base: 70, growth: 1.7 } },
    },
  },

  // ---- Carnival building layer (passive-heart economy) ----
  // The final heart sink: build attractions on a field that generate passive
  // hearts/min, moderated by a happiness multiplier (1 + happiness/100).
  carnival: {
    // Passive payout: rates are per-minute; hearts accrue continuously and pay
    // out as whole hearts at most every `payoutMinInterval` seconds.
    payoutMinInterval: 3,

    happiness: {
      start: 60, // starting happiness %
      drainPerMin: 2, // slow natural drain (= 1% / 30 s); also the post-cap rate
      capHoldSeconds: 300, // hold at 100 for 5 min after hitting 100
    },

    // Ambient NPC crowd: base + per generator building, capped.
    npc: { base: 3, perBuilding: 2, max: 24 },

    // Buildings. kind "generator" makes hearts; kind "amenity" raises the floor.
    // Generator rate(level) = baseRate * rateGrowth^(level-1) (hearts/min).
    // Upgrade cost(level->level+1) = round(upgradeBase * upgradeGrowth^(level-1)).
    buildings: [
      {
        id: "ring-toss",
        name: "Ring Toss",
        kind: "generator",
        buildCost: 40,
        baseRate: 3,
        rateGrowth: 1.5,
        maxLevel: 5,
        upgradeBase: 30,
        upgradeGrowth: 1.7,
      },
      {
        id: "food-stand",
        name: "Food Stand",
        kind: "generator",
        buildCost: 90,
        baseRate: 7,
        rateGrowth: 1.5,
        maxLevel: 5,
        upgradeBase: 60,
        upgradeGrowth: 1.7,
      },
      {
        id: "carousel",
        name: "Carousel",
        kind: "generator",
        buildCost: 200,
        baseRate: 16,
        rateGrowth: 1.5,
        maxLevel: 5,
        upgradeBase: 130,
        upgradeGrowth: 1.7,
      },
      {
        id: "ferris-wheel",
        name: "Ferris Wheel",
        kind: "generator",
        buildCost: 450,
        baseRate: 36,
        rateGrowth: 1.5,
        maxLevel: 5,
        upgradeBase: 280,
        upgradeGrowth: 1.7,
      },
      {
        id: "porta-potty",
        name: "Porta Potty",
        kind: "amenity",
        buildCost: 60,
        happinessFloor: 1, // +1% permanent floor each
      },
    ],

    // Special events: buy for hearts, add happiness (clamped to 100).
    events: [
      { id: "cotton-candy", name: "Free Cotton Candy", cost: 50, happiness: 15 },
      { id: "juggler", name: "Juggling Act", cost: 120, happiness: 35 },
      { id: "fireworks", name: "Fireworks Show", cost: 260, happiness: 60 },
      { id: "headliner", name: "Headliner Concert", cost: 500, happiness: 100 },
    ],
  },

  // ---- Camera (orthographic isometric) ----
  camera: {
    // Vertical extent of the ortho frustum in world units; width derived from
    // the portrait aspect. Larger = more zoomed out.
    viewHeight: 20,
    // Tilted-down view along the pool's long axis: waterfall at the top of the
    // screen, player at the bottom. Elevated + slightly behind the near edge.
    position: [0, 15.5, 15] as [number, number, number],
    lookAt: [0, 0, 1.5] as [number, number, number],
  },

  // ---- Player + basket ----
  // Anchor sits in front of the near pool corner, on the camera->target axis so
  // it reads as "bottom center" of the portrait screen.
  player: {
    anchor: [0, 0, 8.0] as [number, number, number],
    basketOffset: [-2.4, 0, 0.2] as [number, number, number],
    handHeight: 1.15,
    restPoleAngle: -0.5, // radians, pole tilted up toward the pool at rest
    // More negative = rod swings further up and back over the shoulder. Must stay
    // negative so pulling rears the rod backward rather than dipping it forward
    // into the pond.
    pullbackPoleAngle: -1.8, // pole reared back over the shoulder while aiming
    color: "#e8b98a",
    shirt: "#d64550",
    pants: "#2f4b7c",
  },

  colors: {
    bgTop: "#20314f",
    bgBottom: "#0b1020",
    ground: "#16233d",
    poolWall: "#3a5a86",
    poolWallTop: "#5b83b8",
    basket: "#8a5a2b",
  },
};
