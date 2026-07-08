import { CONFIG } from "../config";
import type { MergeState } from "../merge/MergeState";
import type { System } from "../main";

// Pure logic/data model for the pole-upgrade system. Owns unlock flags,
// per-track upgrade levels, and per-attachment active/cooldown timers. Spends
// hearts through the shared MergeState wallet. The CastController reads the
// derived getters; the UpgradeLayer renders from it and mutates via its API.

export type Attachment = "automatic" | "blast" | "laser";
export const ATTACHMENTS: Attachment[] = ["automatic", "blast", "laser"];

// Upgradeable tracks per attachment (keys into CONFIG.upgrades[att]).
export const TRACKS: Record<Attachment, string[]> = {
  automatic: ["fireRate", "catchArea", "duration", "cooldown"],
  blast: ["casts", "catchArea", "duration", "cooldown"],
  laser: ["rayWidth", "duration", "cooldown"],
};

export const ATTACH_LABEL: Record<Attachment, string> = {
  automatic: "Automatic",
  blast: "Blast",
  laser: "Laser",
};

export const TRACK_LABEL: Record<string, string> = {
  fireRate: "Fire rate",
  casts: "Casts",
  rayWidth: "Beam width",
  catchArea: "Catch area",
  duration: "Duration",
  cooldown: "Cooldown",
};

interface TrackCfg {
  base: number;
  step: number;
  max: number;
  cost: { base: number; growth: number };
}

interface Runtime {
  unlocked: boolean;
  levels: Record<string, number>;
  activeUntil: number; // elapsed-clock seconds; <= 0 means not active
  cooldownUntil: number; // elapsed-clock seconds; <= 0 means not cooling
}

function cfgFor(att: Attachment): Record<string, unknown> {
  return (CONFIG.upgrades as unknown as Record<Attachment, Record<string, unknown>>)[
    att
  ];
}
function trackCfg(att: Attachment, track: string): TrackCfg {
  return cfgFor(att)[track] as TrackCfg;
}

export class UpgradeState implements System {
  private elapsed = 0;
  private rt: Record<Attachment, Runtime>;
  private listeners = new Set<() => void>();

  constructor(private merge: MergeState) {
    const mk = (att: Attachment): Runtime => {
      const levels: Record<string, number> = {};
      for (const t of TRACKS[att]) levels[t] = 0;
      return { unlocked: false, levels, activeUntil: 0, cooldownUntil: 0 };
    };
    this.rt = {
      automatic: mk("automatic"),
      blast: mk("blast"),
      laser: mk("laser"),
    };
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  // ---- System: advance active/cooldown timers ----
  update(dt: number) {
    this.elapsed += dt;
    let changed = false;
    for (const att of ATTACHMENTS) {
      const r = this.rt[att];
      if (r.activeUntil > 0 && this.elapsed >= r.activeUntil) {
        r.activeUntil = 0;
        r.cooldownUntil = this.elapsed + this.trackValue(att, "cooldown");
        changed = true;
      }
      if (r.cooldownUntil > 0 && this.elapsed >= r.cooldownUntil) {
        r.cooldownUntil = 0;
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  // ---- Queries ----
  isUnlocked(att: Attachment): boolean {
    return this.rt[att].unlocked;
  }
  unlockCost(att: Attachment): number {
    return cfgFor(att).unlockCost as number;
  }
  level(att: Attachment, track: string): number {
    return this.rt[att].levels[track] ?? 0;
  }
  maxLevel(att: Attachment, track: string): number {
    return trackCfg(att, track).max;
  }
  maxed(att: Attachment, track: string): boolean {
    return this.level(att, track) >= trackCfg(att, track).max;
  }
  trackValue(att: Attachment, track: string): number {
    const c = trackCfg(att, track);
    return c.base + c.step * this.level(att, track);
  }
  upgradeCost(att: Attachment, track: string): number | null {
    if (this.maxed(att, track)) return null;
    const c = trackCfg(att, track).cost;
    return Math.round(c.base * Math.pow(c.growth, this.level(att, track)));
  }

  // ---- Mutations (spend hearts via the shared wallet) ----
  unlock(att: Attachment): boolean {
    const r = this.rt[att];
    if (r.unlocked) return false;
    if (!this.merge.trySpend(this.unlockCost(att))) return false;
    r.unlocked = true;
    this.emit();
    return true;
  }
  buyUpgrade(att: Attachment, track: string): boolean {
    const r = this.rt[att];
    if (!r.unlocked || this.maxed(att, track)) return false;
    const cost = this.upgradeCost(att, track);
    if (cost == null || !this.merge.trySpend(cost)) return false;
    r.levels[track] = this.level(att, track) + 1;
    this.emit();
    return true;
  }

  // ---- Activation / timers ----
  canActivate(att: Attachment): boolean {
    const r = this.rt[att];
    return r.unlocked && r.activeUntil <= 0 && r.cooldownUntil <= 0;
  }
  activate(att: Attachment): boolean {
    if (!this.canActivate(att)) return false;
    this.rt[att].activeUntil = this.elapsed + this.trackValue(att, "duration");
    this.emit();
    return true;
  }
  // Clear all active windows + cooldowns so every attachment is ready again
  // (dev/debug helper).
  resetCooldowns() {
    for (const att of ATTACHMENTS) {
      this.rt[att].activeUntil = 0;
      this.rt[att].cooldownUntil = 0;
    }
    this.emit();
  }
  isActive(att: Attachment): boolean {
    return this.rt[att].activeUntil > 0;
  }
  activeRemaining(att: Attachment): number {
    return Math.max(0, this.rt[att].activeUntil - this.elapsed);
  }
  isCoolingDown(att: Attachment): boolean {
    return this.rt[att].cooldownUntil > 0;
  }
  cooldownRemaining(att: Attachment): number {
    return Math.max(0, this.rt[att].cooldownUntil - this.elapsed);
  }
  // Fraction 0..1 of the cooldown that has elapsed (for the sweep ring).
  cooldownProgress(att: Attachment): number {
    const total = this.trackValue(att, "cooldown");
    if (this.rt[att].cooldownUntil <= 0 || total <= 0) return 1;
    return 1 - this.cooldownRemaining(att) / total;
  }

  // ---- Derived stats read by the CastController ----
  autoActive(): boolean {
    return this.isActive("automatic");
  }
  autoFireInterval(): number {
    return 1 / this.trackValue("automatic", "fireRate");
  }
  blastActive(): boolean {
    return this.isActive("blast");
  }
  blastCasts(): number {
    return this.blastActive() ? Math.round(this.trackValue("blast", "casts")) : 1;
  }
  spreadAngle(): number {
    return (cfgFor("blast").spreadAngle as number) ?? 0.5;
  }
  laserActive(): boolean {
    return this.isActive("laser");
  }
  laserHalfWidth(): number {
    return this.trackValue("laser", "rayWidth");
  }
  // Bonus added to catch radius / beam half-width from active area upgrades.
  areaBonus(): number {
    let b = 0;
    if (this.isActive("automatic")) b += this.trackValue("automatic", "catchArea");
    if (this.isActive("blast")) b += this.trackValue("blast", "catchArea");
    return b;
  }

  // ---- Debug snapshot ----
  snapshot() {
    const out: Record<string, unknown> = { elapsed: +this.elapsed.toFixed(2) };
    for (const att of ATTACHMENTS) {
      out[att] = {
        unlocked: this.rt[att].unlocked,
        active: this.isActive(att),
        activeRemaining: +this.activeRemaining(att).toFixed(1),
        cooling: this.isCoolingDown(att),
        cooldownRemaining: +this.cooldownRemaining(att).toFixed(1),
        levels: { ...this.rt[att].levels },
      };
    }
    return out;
  }
}
