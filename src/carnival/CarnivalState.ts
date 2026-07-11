import { CONFIG } from "../config";
import type { MergeState } from "../merge/MergeState";
import type { System } from "../main";

// Pure logic/data model for the carnival building layer. Owns the placed
// buildings, the happiness state machine, and a passive-heart accumulator that
// pays into the shared MergeState wallet. The CarnivalLayer renders from this
// and mutates via its API; it also ticks as a System.

export interface BuildingDef {
  id: string;
  name: string;
  kind: "generator" | "amenity";
  buildCost: number;
  // generator-only:
  baseRate?: number; // hearts/min at level 1
  rateGrowth?: number;
  maxLevel?: number;
  upgradeBase?: number;
  upgradeGrowth?: number;
  // amenity-only:
  happinessFloor?: number; // permanent floor % added per unit
}

export interface EventDef {
  id: string;
  name: string;
  cost: number;
  happiness: number;
}

export interface PlacedBuilding {
  instanceId: number;
  defId: string;
  kind: "generator" | "amenity";
  x: number; // 0..1 normalized field coords
  y: number; // 0..1
  level: number; // 1..maxLevel (amenities stay at 1)
}

const C = CONFIG.carnival;

export class CarnivalState implements System {
  readonly placed: PlacedBuilding[] = [];
  happiness = C.happiness.start;
  capHoldRemaining = 0;
  // Running count of special events bought (a monotonic tutorial/analytics hook).
  eventsBought = 0;

  private heartAccum = 0;
  private payoutTimer = 0;
  private elapsed = 0;
  private lastEmitHappyPct = Math.round(C.happiness.start);
  private lastEmitHold = false;

  private nextInstanceId = 1;
  private listeners = new Set<() => void>();

  constructor(private merge: MergeState) {}

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  // ---- Definitions ----
  defs(): BuildingDef[] {
    return C.buildings as BuildingDef[];
  }
  defById(id: string): BuildingDef | undefined {
    return this.defs().find((d) => d.id === id);
  }
  events(): EventDef[] {
    return C.events as EventDef[];
  }
  eventById(id: string): EventDef | undefined {
    return this.events().find((e) => e.id === id);
  }

  // ---- Derived ----
  get happinessFloor(): number {
    let f = 0;
    for (const pb of this.placed) {
      if (pb.kind === "amenity") {
        const d = this.defById(pb.defId);
        f += d?.happinessFloor ?? 0;
      }
    }
    return Math.min(100, f);
  }

  get multiplier(): number {
    return 1 + this.happiness / 100;
  }

  buildingRate(pb: PlacedBuilding): number {
    const d = this.defById(pb.defId);
    if (!d || d.kind !== "generator") return 0;
    const base = d.baseRate ?? 0;
    const growth = d.rateGrowth ?? 1;
    return base * Math.pow(growth, pb.level - 1);
  }

  get totalRatePerMin(): number {
    let r = 0;
    for (const pb of this.placed) r += this.buildingRate(pb);
    return r;
  }
  get effectiveRatePerMin(): number {
    return this.totalRatePerMin * this.multiplier;
  }

  isMaxed(pb: PlacedBuilding): boolean {
    const d = this.defById(pb.defId);
    if (!d || d.kind !== "generator") return true;
    return pb.level >= (d.maxLevel ?? 1);
  }

  upgradeCost(pb: PlacedBuilding): number | null {
    const d = this.defById(pb.defId);
    if (!d || d.kind !== "generator" || this.isMaxed(pb)) return null;
    const base = d.upgradeBase ?? 0;
    const growth = d.upgradeGrowth ?? 1;
    return Math.round(base * Math.pow(growth, pb.level - 1));
  }

  get generatorCount(): number {
    let n = 0;
    for (const pb of this.placed) if (pb.kind === "generator") n++;
    return n;
  }
  get npcTarget(): number {
    const { base, perBuilding, max } = C.npc;
    return Math.min(max, base + perBuilding * this.generatorCount);
  }

  byInstance(instanceId: number): PlacedBuilding | undefined {
    return this.placed.find((p) => p.instanceId === instanceId);
  }

  // ---- Mutations ----
  canAfford(defId: string): boolean {
    const d = this.defById(defId);
    return !!d && this.merge.hearts >= d.buildCost;
  }

  place(defId: string, x: number, y: number): boolean {
    const d = this.defById(defId);
    if (!d) return false;
    if (!this.merge.trySpend(d.buildCost)) return false;
    this.placed.push({
      instanceId: this.nextInstanceId++,
      defId: d.id,
      kind: d.kind,
      x: clamp01(x),
      y: clamp01(y),
      level: 1,
    });
    // A new amenity may raise the floor above current happiness.
    if (d.kind === "amenity") this.happiness = Math.max(this.happiness, this.happinessFloor);
    this.emit();
    return true;
  }

  move(instanceId: number, x: number, y: number): boolean {
    const pb = this.byInstance(instanceId);
    if (!pb) return false;
    pb.x = clamp01(x);
    pb.y = clamp01(y);
    this.emit();
    return true;
  }

  upgrade(instanceId: number): boolean {
    const pb = this.byInstance(instanceId);
    if (!pb) return false;
    const cost = this.upgradeCost(pb);
    if (cost == null || !this.merge.trySpend(cost)) return false;
    pb.level++;
    this.emit();
    return true;
  }

  buyEvent(eventId: string): boolean {
    const ev = this.eventById(eventId);
    if (!ev) return false;
    if (!this.merge.trySpend(ev.cost)) return false;
    this.addHappiness(ev.happiness);
    this.eventsBought++;
    this.emit();
    return true;
  }

  private addHappiness(n: number) {
    this.happiness = Math.min(100, this.happiness + n);
    if (this.happiness >= 100) {
      this.happiness = 100;
      this.capHoldRemaining = C.happiness.capHoldSeconds;
    }
  }

  // Test/debug hook.
  setHappiness(n: number) {
    this.happiness = Math.max(this.happinessFloor, Math.min(100, n));
    this.capHoldRemaining = 0;
    this.emit();
  }

  // ---- System ----
  update(dt: number) {
    this.elapsed += dt;

    // Passive hearts.
    this.heartAccum += (this.effectiveRatePerMin / 60) * dt;
    this.payoutTimer += dt;
    if (this.payoutTimer >= C.payoutMinInterval && this.heartAccum >= 1) {
      const paid = Math.floor(this.heartAccum);
      this.heartAccum -= paid;
      this.payoutTimer = 0;
      this.merge.addHearts(paid); // emits the wallet change (badge/HUD update)
    }

    // Happiness state machine.
    if (this.capHoldRemaining > 0) {
      this.capHoldRemaining = Math.max(0, this.capHoldRemaining - dt);
      this.happiness = 100;
    } else {
      const floor = this.happinessFloor;
      this.happiness = Math.max(floor, this.happiness - (C.happiness.drainPerMin / 60) * dt);
    }

    // Emit only when the displayed value / hold-state actually changes.
    const pct = Math.round(this.happiness);
    const hold = this.capHoldRemaining > 0;
    if (pct !== this.lastEmitHappyPct || hold !== this.lastEmitHold) {
      this.lastEmitHappyPct = pct;
      this.lastEmitHold = hold;
      this.emit();
    }
  }

  // ---- Debug snapshot ----
  snapshot() {
    return {
      hearts: this.merge.hearts,
      happiness: +this.happiness.toFixed(2),
      happinessFloor: this.happinessFloor,
      multiplier: +this.multiplier.toFixed(3),
      capHoldRemaining: +this.capHoldRemaining.toFixed(1),
      totalRatePerMin: +this.totalRatePerMin.toFixed(2),
      effectiveRatePerMin: +this.effectiveRatePerMin.toFixed(2),
      npcTarget: this.npcTarget,
      placed: this.placed.map((p) => ({
        instanceId: p.instanceId,
        defId: p.defId,
        level: p.level,
        rate: +this.buildingRate(p).toFixed(2),
        x: +p.x.toFixed(2),
        y: +p.y.toFixed(2),
      })),
    };
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
