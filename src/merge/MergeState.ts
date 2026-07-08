import { CONFIG } from "../config";

// Pure data/logic model for the merge-2 board. No DOM here — the MergeLayer
// renders from this and calls its mutators, then re-renders on change.

export const GRID_COLS = 7;
export const GRID_ROWS = 9;
export const CELL_COUNT = GRID_COLS * GRID_ROWS;
export const MAX_LEVEL = 4;

// Storage suitcase economy.
export const STORAGE_UNLOCK_COST = 100; // hearts to unlock the 2x2 suitcase
export const STORAGE_BASE_SLOTS = 4; // the initial 2x2 grid
export const STORAGE_FIRST_EXTRA_COST = 50; // cost of the 5th slot
export const STORAGE_EXTRA_COST_STEP = 25; // each further slot costs this much more

export interface Item {
  id: number;
  colorIndex: number;
  level: number; // 1..MAX_LEVEL
}

export interface Order {
  id: number;
  colorIndex: number;
  level: number; // requested duck level (2..4)
  npc: number; // which child face to show
  reward: number; // hearts granted on fulfilment
}

const PALETTE_LEN = CONFIG.ducks.palette.length;

export class MergeState {
  // Flat cell array; null = empty. Index = row * COLS + col.
  readonly cells: (Item | null)[] = new Array(CELL_COUNT).fill(null);
  readonly orders: Order[] = [];
  hearts = 0;

  // Storage suitcase: locked until bought; then a growable list of slots.
  storageUnlocked = false;
  storage: (Item | null)[] = [];

  private nextItemId = 1;
  private nextOrderId = 1;

  private listeners = new Set<() => void>();

  constructor() {
    // Start with a few orders to fulfil.
    for (let i = 0; i < 3; i++) this.orders.push(this.makeOrder());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  // Grant hearts (used by rewards and the dev console); notifies listeners.
  addHearts(n: number) {
    this.hearts += n;
    this.emit();
  }

  // Spend hearts if affordable (shared wallet used by the upgrade system).
  trySpend(n: number): boolean {
    if (n < 0 || this.hearts < n) return false;
    this.hearts -= n;
    this.emit();
    return true;
  }

  get filled(): number {
    let n = 0;
    for (const c of this.cells) if (c) n++;
    return n;
  }

  isFull(): boolean {
    return this.cells.every((c) => c !== null);
  }

  private firstEmpty(): number {
    return this.cells.findIndex((c) => c === null);
  }

  // Drop a freshly-caught duck onto the board. Overflows into storage once the
  // main grid is full. Returns false only if both the grid and storage are full.
  addDuck(colorIndex: number): boolean {
    const i = this.firstEmpty();
    if (i >= 0) {
      this.cells[i] = { id: this.nextItemId++, colorIndex, level: 1 };
      this.emit();
      return true;
    }
    // Main grid is full -> overflow into the storage suitcase if it has room.
    if (this.storageHasRoom()) {
      const s = this.firstEmptyStorage();
      this.storage[s] = { id: this.nextItemId++, colorIndex, level: 1 };
      this.emit();
      return true;
    }
    return false;
  }

  // ---- Storage suitcase ----
  get storageCapacity(): number {
    return this.storage.length;
  }
  get storageFilled(): number {
    let n = 0;
    for (const c of this.storage) if (c) n++;
    return n;
  }
  storageHasRoom(): boolean {
    return this.storageUnlocked && this.storage.some((c) => c === null);
  }
  private firstEmptyStorage(): number {
    return this.storage.findIndex((c) => c === null);
  }

  // Cost in hearts to add the next storage slot beyond the base 2x2.
  nextStorageSlotCost(): number {
    const extra = this.storage.length - STORAGE_BASE_SLOTS;
    return STORAGE_FIRST_EXTRA_COST + extra * STORAGE_EXTRA_COST_STEP;
  }

  unlockStorage(): boolean {
    if (this.storageUnlocked) return false;
    if (this.hearts < STORAGE_UNLOCK_COST) return false;
    this.hearts -= STORAGE_UNLOCK_COST;
    this.storageUnlocked = true;
    this.storage = new Array(STORAGE_BASE_SLOTS).fill(null);
    this.emit();
    return true;
  }

  buyStorageSlot(): boolean {
    if (!this.storageUnlocked) return false;
    const cost = this.nextStorageSlotCost();
    if (this.hearts < cost) return false;
    this.hearts -= cost;
    this.storage.push(null);
    this.emit();
    return true;
  }

  // Move a grid item into the next open storage slot.
  storeFromGrid(from: number): "ok" | "no-room" | "none" {
    const item = this.cells[from];
    if (!item) return "none";
    if (!this.storageHasRoom()) return "no-room";
    this.storage[this.firstEmptyStorage()] = item;
    this.cells[from] = null;
    this.emit();
    return "ok";
  }

  // Move a stored item into the next open grid cell.
  retrieveToGrid(storageIndex: number): "ok" | "no-room" | "none" {
    const item = this.storage[storageIndex];
    if (!item) return "none";
    const g = this.firstEmpty();
    if (g < 0) return "no-room";
    this.cells[g] = item;
    this.storage[storageIndex] = null;
    this.emit();
    return "ok";
  }

  // Handle dragging the item at `from` onto cell `to`.
  //  - empty target: move
  //  - same color + same level (< max): merge, leveling up
  //  - otherwise: swap
  drop(from: number, to: number): "move" | "merge" | "swap" | "none" {
    if (from === to || from < 0 || to < 0) return "none";
    const a = this.cells[from];
    if (!a) return "none";
    const b = this.cells[to];

    if (!b) {
      this.cells[to] = a;
      this.cells[from] = null;
      this.emit();
      return "move";
    }

    if (
      a.colorIndex === b.colorIndex &&
      a.level === b.level &&
      a.level < MAX_LEVEL
    ) {
      this.cells[to] = { id: b.id, colorIndex: b.colorIndex, level: b.level + 1 };
      this.cells[from] = null;
      this.emit();
      return "merge";
    }

    // swap
    this.cells[to] = a;
    this.cells[from] = b;
    this.emit();
    return "swap";
  }

  // Try to fulfil order `orderIndex` with the item at cell `from`.
  fulfillWith(orderIndex: number, from: number): boolean {
    const order = this.orders[orderIndex];
    const item = this.cells[from];
    if (!order || !item) return false;
    if (item.colorIndex !== order.colorIndex || item.level !== order.level)
      return false;

    this.hearts += order.reward;
    this.cells[from] = null;
    this.orders[orderIndex] = this.makeOrder();
    this.emit();
    return true;
  }

  makeOrder(): Order {
    const colorIndex = Math.floor(Math.random() * PALETTE_LEN);
    const level = 2 + Math.floor(Math.random() * 3); // 2..4
    return {
      id: this.nextOrderId++,
      colorIndex,
      level,
      npc: Math.floor(Math.random() * 16),
      reward: level * 5, // more hearts for higher-level requests
    };
  }

  // Debug/testing helper: place an item directly.
  debugSet(index: number, colorIndex: number, level: number) {
    this.cells[index] = { id: this.nextItemId++, colorIndex, level };
    this.emit();
  }
}
