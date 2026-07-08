import {
  MergeState,
  GRID_COLS,
  GRID_ROWS,
  STORAGE_UNLOCK_COST,
} from "./MergeState";
import { buildDuckSVG, buildChildSVG, heartSVG, suitcaseSVG } from "./icons";

// DOM overlay that renders and drives the merge board. Lives inside #game so it
// shares the portrait frame. Hidden until the player opens the basket.

const STYLE_ID = "merge-layer-style";

const CSS = `
#merge-layer {
  position: absolute; inset: 0; z-index: 20;
  display: none; flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #fff; user-select: none; touch-action: none;
  background:
    radial-gradient(120% 80% at 50% 0%, #4a6da7 0%, #2b3f6b 55%, #1a2544 100%);
}
#merge-layer.open { display: flex; }

#merge-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 8px) + 8px) 12px 8px;
  gap: 8px;
}
#merge-hearts {
  display: flex; align-items: center; gap: 6px;
  background: rgba(0,0,0,0.28); border-radius: 999px;
  padding: 5px 12px 5px 8px; font-weight: 800; font-size: 18px;
}
#merge-hearts .ico { width: 22px; height: 22px; }
#merge-back {
  border: none; cursor: pointer;
  background: #ffd23f; color: #3a2a00;
  font-weight: 800; font-size: 15px;
  border-radius: 999px; padding: 8px 16px;
  box-shadow: 0 3px 0 #c99700;
}
#merge-back:active { transform: translateY(2px); box-shadow: 0 1px 0 #c99700; }

#merge-orders {
  display: flex; gap: 8px; padding: 4px 12px 10px;
  overflow-x: auto; overflow-y: hidden;
}
.order-card {
  flex: 0 0 auto; width: 92px;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.18);
  border-radius: 14px; padding: 6px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.order-card.hot { border-color: #ffd23f; box-shadow: 0 0 0 2px #ffd23f inset; }
.order-card .npc { width: 40px; height: 40px; }
.order-card .want {
  position: relative; width: 52px; height: 52px;
  background: rgba(0,0,0,0.22); border-radius: 10px;
}
.order-card .badge {
  position: absolute; right: -4px; bottom: -4px;
  background: #ffd23f; color: #3a2a00; font-weight: 800;
  font-size: 11px; border-radius: 999px; padding: 1px 6px;
  border: 2px solid #2b3f6b;
}
.order-card .reward {
  display: flex; align-items: center; gap: 3px;
  font-size: 12px; font-weight: 700;
}
.order-card .reward .ico { width: 14px; height: 14px; }

#merge-grid-wrap {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 4px 10px 14px; min-height: 0;
}
#merge-grid {
  display: grid;
  grid-template-columns: repeat(${GRID_COLS}, 1fr);
  grid-template-rows: repeat(${GRID_ROWS}, 1fr);
  gap: 5px; width: 100%; height: 100%;
  background: rgba(0,0,0,0.22);
  border-radius: 16px; padding: 8px;
}
.cell {
  position: relative;
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.cell.drop-target { background: rgba(255,210,63,0.35); }
.cell.merge-target { background: rgba(120,255,150,0.4); }
.cell .duck { width: 88%; height: 88%; pointer-events: none; }
.cell.dragging .duck { opacity: 0.25; }
.cell .lvl {
  position: absolute; left: 2px; top: 2px;
  background: rgba(0,0,0,0.5); color: #fff;
  font-size: 9px; font-weight: 800;
  border-radius: 6px; padding: 0 4px; pointer-events: none;
}

#merge-ghost {
  position: fixed; z-index: 40; width: 56px; height: 56px;
  pointer-events: none; transform: translate(-50%, -50%) scale(1.15);
  filter: drop-shadow(0 6px 8px rgba(0,0,0,0.5));
  display: none;
}

/* Storage suitcase (bottom-left of the merge layer). */
#storage-suitcase {
  position: absolute; z-index: 22;
  left: 14px; bottom: calc(env(safe-area-inset-bottom, 12px) + 14px);
  width: 66px; height: 66px; border-radius: 16px;
  border: 3px solid #ffd23f; cursor: pointer;
  background: rgba(20,30,55,0.85);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.45);
}
#storage-suitcase:active { transform: translateY(2px); }
#storage-suitcase .sico { width: 46px; height: 46px; pointer-events: none; }
#storage-suitcase.drop-hot { border-color: #7dff9a; box-shadow: 0 0 0 3px #7dff9a; }
#storage-suitcase .lock {
  position: absolute; inset: 0; border-radius: 13px;
  background: rgba(0,0,0,0.55);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1px; color: #fff; font-weight: 800; font-size: 12px;
}
#storage-suitcase .lock .price {
  display: flex; align-items: center; gap: 2px; font-size: 11px;
}
#storage-suitcase .lock .price .ico { width: 12px; height: 12px; }
#storage-suitcase .scount {
  position: absolute; top: -8px; right: -8px;
  min-width: 22px; height: 20px; padding: 0 5px;
  background: #4cc9f0; color: #03303f; font-weight: 800; font-size: 12px;
  border-radius: 999px; border: 2px solid #14213d;
  display: flex; align-items: center; justify-content: center;
}

/* Storage modal panel. */
#storage-panel {
  position: absolute; inset: 0; z-index: 30;
  display: flex; align-items: center; justify-content: center;
  background: rgba(6,10,22,0.6);
}
#storage-panel.hidden { display: none; }
#storage-panel .box {
  width: 82%; max-width: 320px;
  background: linear-gradient(180deg, #3a5487, #26365c);
  border: 3px solid #ffd23f; border-radius: 18px;
  padding: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
#storage-panel .head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
#storage-panel .head h3 { font-size: 18px; font-weight: 800; }
#storage-panel .close {
  border: none; cursor: pointer; background: rgba(0,0,0,0.3);
  color: #fff; font-weight: 800; font-size: 16px; line-height: 1;
  width: 30px; height: 30px; border-radius: 999px;
}
#storage-panel .hint { font-size: 12px; opacity: 0.75; margin-bottom: 10px; }
#storage-slots {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
  margin-bottom: 12px; max-height: 46vh; overflow-y: auto;
}
#storage-slots .sslot {
  aspect-ratio: 1 / 1; border-radius: 10px;
  background: rgba(0,0,0,0.28);
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
#storage-slots .sslot.filled { cursor: pointer; background: rgba(255,255,255,0.08); }
#storage-slots .sslot .duck { width: 86%; height: 86%; pointer-events: none; }
#storage-slots .sslot .lvl {
  position: absolute; left: 2px; top: 2px;
  background: rgba(0,0,0,0.5); color: #fff; font-size: 9px; font-weight: 800;
  border-radius: 6px; padding: 0 4px;
}
#storage-buy {
  width: 100%; border: none; cursor: pointer;
  background: #ffd23f; color: #3a2a00; font-weight: 800; font-size: 14px;
  border-radius: 12px; padding: 10px; box-shadow: 0 3px 0 #c99700;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
#storage-buy:active { transform: translateY(2px); box-shadow: 0 1px 0 #c99700; }
#storage-buy .ico { width: 16px; height: 16px; }

/* Transient toast message. */
#merge-toast {
  position: absolute; z-index: 45; left: 50%; top: 40%;
  transform: translate(-50%, -50%) scale(0.9);
  background: rgba(10,14,28,0.92); color: #fff;
  font-weight: 800; font-size: 15px; padding: 10px 16px;
  border-radius: 12px; border: 2px solid #ffd23f;
  opacity: 0; pointer-events: none; transition: opacity 0.15s, transform 0.15s;
}
#merge-toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

export class MergeLayer {
  readonly root: HTMLDivElement;
  private grid: HTMLDivElement;
  private ordersBar: HTMLDivElement;
  private heartsEl: HTMLSpanElement;
  private ghost: HTMLDivElement;
  private cellEls: HTMLDivElement[] = [];

  // Storage suitcase UI.
  private suitcase!: HTMLButtonElement;
  private storagePanel!: HTMLDivElement;
  private storageSlots!: HTMLDivElement;
  private buyBtn!: HTMLButtonElement;
  private toastEl!: HTMLDivElement;
  private toastTimer: number | undefined;

  // Active drag.
  private dragFrom = -1;
  private pointerId: number | null = null;

  constructor(
    parent: HTMLElement,
    private state: MergeState,
    private onBack: () => void
  ) {
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement("style");
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    this.root = document.createElement("div");
    this.root.id = "merge-layer";
    this.root.innerHTML = `
      <div id="merge-topbar">
        <div id="merge-hearts">
          <span class="ico">${heartSVG()}</span>
          <span id="merge-hearts-count">0</span>
        </div>
        <button id="merge-back">← Pond</button>
      </div>
      <div id="merge-orders"></div>
      <div id="merge-grid-wrap"><div id="merge-grid"></div></div>
      <button id="storage-suitcase"></button>
      <div id="storage-panel" class="hidden">
        <div class="box">
          <div class="head">
            <h3>Storage</h3>
            <button class="close" data-close-storage>×</button>
          </div>
          <div class="hint">Tap a duck to send it to the basket. Drag ducks here to store them.</div>
          <div id="storage-slots"></div>
          <button id="storage-buy"></button>
        </div>
      </div>
      <div id="merge-toast"></div>
    `;
    parent.appendChild(this.root);

    this.grid = this.root.querySelector("#merge-grid") as HTMLDivElement;
    this.ordersBar = this.root.querySelector("#merge-orders") as HTMLDivElement;
    this.heartsEl = this.root.querySelector(
      "#merge-hearts-count"
    ) as HTMLSpanElement;
    this.suitcase = this.root.querySelector(
      "#storage-suitcase"
    ) as HTMLButtonElement;
    this.storagePanel = this.root.querySelector(
      "#storage-panel"
    ) as HTMLDivElement;
    this.storageSlots = this.root.querySelector(
      "#storage-slots"
    ) as HTMLDivElement;
    this.buyBtn = this.root.querySelector("#storage-buy") as HTMLButtonElement;
    this.toastEl = this.root.querySelector("#merge-toast") as HTMLDivElement;

    this.ghost = document.createElement("div");
    this.ghost.id = "merge-ghost";
    parent.appendChild(this.ghost);

    (this.root.querySelector("#merge-back") as HTMLButtonElement).addEventListener(
      "click",
      () => this.onBack()
    );

    // Suitcase: unlock when locked, otherwise open/close the storage panel.
    this.suitcase.addEventListener("click", () => {
      if (!this.state.storageUnlocked) {
        if (this.state.unlockStorage()) this.openStorage();
        else this.toast(`Need ${STORAGE_UNLOCK_COST} hearts to unlock`);
      } else {
        this.toggleStorage();
      }
    });

    // Storage panel: retrieve a duck, buy a slot, or close.
    this.storagePanel.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-close-storage]")) {
        this.closeStorage();
        return;
      }
      if (t.closest("#storage-buy")) {
        if (!this.state.buyStorageSlot()) this.toast("Not enough hearts");
        return;
      }
      const slot = t.closest("[data-storage-index]") as HTMLElement | null;
      if (slot) {
        const r = this.state.retrieveToGrid(Number(slot.dataset.storageIndex));
        if (r === "no-room") this.toast("No room in the basket!");
      }
    });

    // Build grid cells once.
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = String(i);
      this.grid.appendChild(cell);
      this.cellEls.push(cell);
    }

    this.grid.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);

    this.state.onChange(() => this.render());
    this.render();
  }

  get isOpen(): boolean {
    return this.root.classList.contains("open");
  }
  open() {
    this.root.classList.add("open");
    this.render();
  }
  close() {
    this.root.classList.remove("open");
  }

  private render() {
    this.heartsEl.textContent = String(this.state.hearts);

    // Grid.
    for (let i = 0; i < this.cellEls.length; i++) {
      const cell = this.cellEls[i];
      const item = this.state.cells[i];
      if (item) {
        cell.innerHTML =
          `<div class="duck">${buildDuckSVG(item.colorIndex, item.level)}</div>` +
          (item.level > 1 ? `<span class="lvl">L${item.level}</span>` : "");
      } else {
        cell.innerHTML = "";
      }
    }

    // Orders.
    this.ordersBar.innerHTML = this.state.orders
      .map(
        (o, idx) => `
        <div class="order-card" data-order="${idx}">
          <div class="npc">${buildChildSVG(o.npc)}</div>
          <div class="want" data-order="${idx}">
            ${buildDuckSVG(o.colorIndex, o.level)}
            <span class="badge">L${o.level}</span>
          </div>
          <div class="reward"><span class="ico">${heartSVG()}</span>${o.reward}</div>
        </div>`
      )
      .join("");

    this.renderStorage();
  }

  private renderStorage() {
    const s = this.state;
    // Suitcase button (locked price vs. unlocked count badge).
    if (!s.storageUnlocked) {
      this.suitcase.innerHTML = `
        <span class="sico">${suitcaseSVG()}</span>
        <span class="lock">
          🔒<span class="price"><span class="ico">${heartSVG()}</span>${STORAGE_UNLOCK_COST}</span>
        </span>`;
    } else {
      this.suitcase.innerHTML = `
        <span class="sico">${suitcaseSVG()}</span>
        <span class="scount">${s.storageFilled}/${s.storageCapacity}</span>`;
    }

    // Storage panel slots + buy button.
    this.storageSlots.innerHTML = s.storage
      .map((item, i) =>
        item
          ? `<div class="sslot filled" data-storage-index="${i}">
               <div class="duck">${buildDuckSVG(item.colorIndex, item.level)}</div>
               ${item.level > 1 ? `<span class="lvl">L${item.level}</span>` : ""}
             </div>`
          : `<div class="sslot"></div>`
      )
      .join("");
    this.buyBtn.innerHTML = `+1 slot &nbsp;<span class="ico">${heartSVG()}</span>${s.nextStorageSlotCost()}`;
  }

  openStorage() {
    this.storagePanel.classList.remove("hidden");
    this.renderStorage();
  }
  closeStorage() {
    this.storagePanel.classList.add("hidden");
  }
  private toggleStorage() {
    if (this.storagePanel.classList.contains("hidden")) this.openStorage();
    else this.closeStorage();
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => this.toastEl.classList.remove("show"),
      1400
    );
  }

  // ---- Drag & drop ----
  private onPointerDown = (e: PointerEvent) => {
    const cell = (e.target as HTMLElement).closest(".cell") as HTMLElement | null;
    if (!cell || cell.dataset.index === undefined) return;
    const i = Number(cell.dataset.index);
    const item = this.state.cells[i];
    if (!item) return;

    this.dragFrom = i;
    this.pointerId = e.pointerId;
    this.cellEls[i].classList.add("dragging");
    this.ghost.innerHTML = buildDuckSVG(item.colorIndex, item.level);
    this.ghost.style.display = "block";
    this.moveGhost(e.clientX, e.clientY);
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.dragFrom < 0 || e.pointerId !== this.pointerId) return;
    this.moveGhost(e.clientX, e.clientY);
    this.highlight(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragFrom < 0 || e.pointerId !== this.pointerId) return;
    const from = this.dragFrom;

    // Resolve the drop target under the pointer.
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const orderEl = el?.closest("[data-order]") as HTMLElement | null;
    const suitcaseEl = el?.closest("#storage-suitcase");
    const cellEl = el?.closest(".cell") as HTMLElement | null;

    if (orderEl) {
      this.state.fulfillWith(Number(orderEl.dataset.order), from);
    } else if (suitcaseEl) {
      const r = this.state.storeFromGrid(from);
      if (r === "no-room") this.toast("No room in storage!");
    } else if (cellEl && cellEl.dataset.index !== undefined) {
      this.state.drop(from, Number(cellEl.dataset.index));
    }

    this.endDrag();
  };

  private endDrag() {
    if (this.dragFrom >= 0) this.cellEls[this.dragFrom]?.classList.remove("dragging");
    this.clearHighlights();
    this.dragFrom = -1;
    this.pointerId = null;
    this.ghost.style.display = "none";
  }

  private moveGhost(x: number, y: number) {
    this.ghost.style.left = x + "px";
    this.ghost.style.top = y + "px";
  }

  private clearHighlights() {
    for (const c of this.cellEls)
      c.classList.remove("drop-target", "merge-target");
    for (const o of Array.from(this.ordersBar.children))
      (o as HTMLElement).classList.remove("hot");
    this.suitcase.classList.remove("drop-hot");
  }

  private highlight(x: number, y: number) {
    this.clearHighlights();
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const orderEl = el?.closest(".order-card") as HTMLElement | null;
    if (orderEl) {
      orderEl.classList.add("hot");
      return;
    }
    if (el?.closest("#storage-suitcase")) {
      this.suitcase.classList.add("drop-hot");
      return;
    }
    const cellEl = el?.closest(".cell") as HTMLElement | null;
    if (!cellEl || cellEl.dataset.index === undefined) return;
    const to = Number(cellEl.dataset.index);
    if (to === this.dragFrom) return;
    const a = this.state.cells[this.dragFrom];
    const b = this.state.cells[to];
    const isMerge =
      a && b && a.colorIndex === b.colorIndex && a.level === b.level && a.level < 4;
    cellEl.classList.add(isMerge ? "merge-target" : "drop-target");
  }
}
