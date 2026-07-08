import type { MergeState } from "../merge/MergeState";
import type { System } from "../main";
import { CarnivalState } from "./CarnivalState";
import { buildingSVG, npcSVG, sparkleSVG } from "./icons";
import { heartSVG } from "../merge/icons";

// DOM overlay for the carnival building layer. Lives inside #game, shares the
// portrait frame. Hidden until the player taps the tent button. Mirrors the
// MergeLayer patterns (self-injected CSS, onChange re-render, ghost drag-drop)
// and ticks as a System (happiness bar + NPC wander).

const STYLE_ID = "carnival-layer-style";

// Keep placed buildings a little inside the field edges.
const FIELD_INSET = 0.08;

interface Npc {
  el: HTMLDivElement;
  x: number; // 0..1 field coords
  y: number;
  tx: number;
  ty: number;
  speed: number;
  inside: number; // seconds remaining "inside" a building (hidden)
  targetIsBuilding: boolean;
  variant: number;
}

const CSS = `
#carnival-layer {
  position: absolute; inset: 0; z-index: 20;
  display: none; flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #fff; user-select: none; touch-action: none;
  background:
    linear-gradient(180deg, #8fd3ff 0%, #bfe9ff 26%, #a7e08a 46%, #7ec96a 100%);
}
#carnival-layer.open { display: flex; }

#carnival-top {
  display: flex; align-items: center; gap: 8px;
  padding: calc(env(safe-area-inset-top, 8px) + 8px) 12px 8px;
}
#carnival-back {
  border: none; cursor: pointer; flex: 0 0 auto;
  background: #ffd23f; color: #3a2a00; font-weight: 800; font-size: 15px;
  border-radius: 999px; padding: 8px 14px; box-shadow: 0 3px 0 #c99700;
}
#carnival-back:active { transform: translateY(2px); box-shadow: 0 1px 0 #c99700; }
#carnival-hearts {
  display: flex; align-items: center; gap: 6px; flex: 0 0 auto;
  background: rgba(0,0,0,0.28); border-radius: 999px;
  padding: 5px 12px 5px 8px; font-weight: 800; font-size: 17px;
}
#carnival-hearts .ico { width: 20px; height: 20px; }
#happy-wrap { flex: 1 1 auto; min-width: 0; }
#happy-label {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12px; font-weight: 800; margin: 0 2px 3px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
#happy-label .mult { color: #fff3a0; }
#happy-bar {
  position: relative; height: 16px; border-radius: 999px;
  background: rgba(0,0,0,0.3); overflow: hidden;
  border: 2px solid rgba(255,255,255,0.4);
}
#happy-fill {
  position: absolute; inset: 0; width: 60%;
  background: #6ad06a; border-radius: 999px;
  transition: width 0.2s linear, background-color 0.4s linear;
}

#carnival-field {
  position: relative; flex: 1; min-height: 0; overflow: hidden;
  margin: 4px 8px; border-radius: 16px;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.12), rgba(0,0,0,0.06)),
    repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 22px, rgba(255,255,255,0.03) 22px 44px);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.25);
}
#carnival-buildings, #carnival-npcs { position: absolute; inset: 0; }
#carnival-npcs { pointer-events: none; }

.cbuild {
  position: absolute; width: 60px; height: 60px;
  transform: translate(-50%, -50%);
  cursor: grab; touch-action: none;
  filter: drop-shadow(0 4px 5px rgba(0,0,0,0.35));
}
.cbuild.dragging { opacity: 0.4; }
.cbuild .glyph { width: 100%; height: 100%; pointer-events: none; }
.cbuild .lvl {
  position: absolute; right: -4px; top: -4px;
  background: #ffd23f; color: #3a2a00; font-weight: 800; font-size: 10px;
  border-radius: 999px; padding: 0 5px; border: 2px solid #2b3f6b;
  pointer-events: none;
}

.cnpc {
  position: absolute; width: 18px; height: 27px;
  transform: translate(-50%, -100%);
  transition: opacity 0.4s linear;
}

#carnival-events-btn {
  position: absolute; z-index: 22; right: 12px;
  top: 50%; transform: translateY(-50%);
  width: 60px; border: none; cursor: pointer;
  background: linear-gradient(180deg, #ff8fa3, #ff5d73);
  color: #fff; font-weight: 800; font-size: 11px;
  border-radius: 14px; padding: 8px 4px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.4);
}
#carnival-events-btn:active { transform: translateY(calc(-50% + 2px)); }
#carnival-events-btn .ico { width: 26px; height: 26px; }

#carnival-menu {
  display: flex; gap: 8px; padding: 8px 12px calc(env(safe-area-inset-bottom, 10px) + 10px);
  overflow-x: auto; overflow-y: hidden;
}
.menu-card {
  flex: 0 0 auto; width: 80px;
  background: rgba(0,0,0,0.28); border: 2px solid rgba(255,255,255,0.3);
  border-radius: 14px; padding: 6px 4px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: grab; touch-action: none;
}
.menu-card.cant { opacity: 0.45; }
.menu-card .mico { width: 44px; height: 44px; pointer-events: none; }
.menu-card .mname { font-size: 11px; font-weight: 700; text-align: center; line-height: 1.1; }
.menu-card .mcost {
  display: flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 800;
}
.menu-card .mcost .ico { width: 13px; height: 13px; }
.menu-card .mfloor { font-size: 10px; opacity: 0.85; }

#carnival-ghost {
  position: fixed; z-index: 40; width: 60px; height: 60px;
  pointer-events: none; transform: translate(-50%, -50%) scale(1.1);
  filter: drop-shadow(0 6px 8px rgba(0,0,0,0.5)); display: none;
}

/* Modal panels (events + upgrade) share this idiom with the merge panel. */
.carnival-modal {
  position: absolute; inset: 0; z-index: 30;
  display: flex; align-items: center; justify-content: center;
  background: rgba(6,10,22,0.55);
}
.carnival-modal.hidden { display: none; }
.carnival-modal .box {
  width: 84%; max-width: 340px;
  background: linear-gradient(180deg, #3a5487, #26365c);
  border: 3px solid #ffd23f; border-radius: 18px;
  padding: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.carnival-modal .head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.carnival-modal .head h3 { font-size: 18px; font-weight: 800; }
.carnival-modal .close {
  border: none; cursor: pointer; background: rgba(0,0,0,0.3);
  color: #fff; font-weight: 800; font-size: 16px; line-height: 1;
  width: 30px; height: 30px; border-radius: 999px;
}
.ev-row, .up-row {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.08); border-radius: 12px;
  padding: 8px 10px; margin-bottom: 8px;
}
.ev-row .ev-info, .up-row .up-info { flex: 1; min-width: 0; }
.ev-row .ev-name, .up-row .up-name { font-weight: 800; font-size: 14px; }
.ev-row .ev-sub, .up-row .up-sub { font-size: 12px; opacity: 0.8; }
.buy-btn {
  border: none; cursor: pointer; flex: 0 0 auto;
  background: #ffd23f; color: #3a2a00; font-weight: 800; font-size: 13px;
  border-radius: 10px; padding: 8px 12px; box-shadow: 0 3px 0 #c99700;
  display: flex; align-items: center; gap: 4px;
}
.buy-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #c99700; }
.buy-btn:disabled { background: #6b7690; color: #2a3348; box-shadow: none; cursor: default; }
.buy-btn .ico { width: 14px; height: 14px; }
.up-pips { display: flex; gap: 3px; margin-top: 3px; }
.up-pips .pip { width: 12px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.2); }
.up-pips .pip.on { background: #ffd23f; }

#carnival-toast {
  position: absolute; z-index: 45; left: 50%; top: 40%;
  transform: translate(-50%, -50%) scale(0.9);
  background: rgba(10,14,28,0.92); color: #fff;
  font-weight: 800; font-size: 15px; padding: 10px 16px;
  border-radius: 12px; border: 2px solid #ffd23f;
  opacity: 0; pointer-events: none; transition: opacity 0.15s, transform 0.15s;
}
#carnival-toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

export class CarnivalLayer implements System {
  readonly root: HTMLDivElement;
  private field!: HTMLDivElement;
  private buildingsEl!: HTMLDivElement;
  private npcsEl!: HTMLDivElement;
  private heartsEl!: HTMLSpanElement;
  private menu!: HTMLDivElement;
  private happyFill!: HTMLDivElement;
  private happyLabel!: HTMLDivElement;
  private eventsPanel!: HTMLDivElement;
  private popup!: HTMLDivElement;
  private toastEl!: HTMLDivElement;
  private ghost!: HTMLDivElement;
  private toastTimer: number | undefined;

  private npcs: Npc[] = [];

  // Active drag (from menu = place; from a placed building = move).
  private dragMode: "place" | "move" | null = null;
  private dragDefId = "";
  private dragInstanceId = -1;
  private pointerId: number | null = null;
  private downX = 0;
  private downY = 0;
  private moved = false;

  constructor(
    parent: HTMLElement,
    private state: CarnivalState,
    private merge: MergeState,
    private onBack: () => void
  ) {
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement("style");
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    this.root = document.createElement("div");
    this.root.id = "carnival-layer";
    this.root.innerHTML = `
      <div id="carnival-top">
        <button id="carnival-back">← Pond</button>
        <div id="carnival-hearts">
          <span class="ico">${heartSVG()}</span>
          <span id="carnival-hearts-count">0</span>
        </div>
        <div id="happy-wrap">
          <div id="happy-label"><span id="happy-text">Happiness 60%</span><span class="mult" id="happy-mult">×1.6</span></div>
          <div id="happy-bar"><div id="happy-fill"></div></div>
        </div>
      </div>
      <div id="carnival-field">
        <div id="carnival-buildings"></div>
        <div id="carnival-npcs"></div>
      </div>
      <button id="carnival-events-btn">
        <span class="ico">${sparkleSVG()}</span>
        Events
      </button>
      <div id="carnival-menu"></div>
      <div id="carnival-events-panel" class="carnival-modal hidden">
        <div class="box">
          <div class="head"><h3>Special Events</h3><button class="close" data-close-events>×</button></div>
          <div class="hint" style="font-size:12px;opacity:0.75;margin-bottom:10px;">Boost happiness. Reaching 100% holds for 5 minutes.</div>
          <div id="events-list"></div>
        </div>
      </div>
      <div id="carnival-popup" class="carnival-modal hidden">
        <div class="box">
          <div class="head"><h3 id="popup-title">Building</h3><button class="close" data-close-popup>×</button></div>
          <div id="popup-body"></div>
        </div>
      </div>
      <div id="carnival-toast"></div>
    `;
    parent.appendChild(this.root);

    this.field = this.root.querySelector("#carnival-field") as HTMLDivElement;
    this.buildingsEl = this.root.querySelector("#carnival-buildings") as HTMLDivElement;
    this.npcsEl = this.root.querySelector("#carnival-npcs") as HTMLDivElement;
    this.heartsEl = this.root.querySelector("#carnival-hearts-count") as HTMLSpanElement;
    this.menu = this.root.querySelector("#carnival-menu") as HTMLDivElement;
    this.happyFill = this.root.querySelector("#happy-fill") as HTMLDivElement;
    this.happyLabel = this.root.querySelector("#happy-label") as HTMLDivElement;
    this.eventsPanel = this.root.querySelector("#carnival-events-panel") as HTMLDivElement;
    this.popup = this.root.querySelector("#carnival-popup") as HTMLDivElement;
    this.toastEl = this.root.querySelector("#carnival-toast") as HTMLDivElement;

    this.ghost = document.createElement("div");
    this.ghost.id = "carnival-ghost";
    parent.appendChild(this.ghost);

    (this.root.querySelector("#carnival-back") as HTMLButtonElement).addEventListener(
      "click",
      () => this.onBack()
    );

    // Events button + panel.
    (this.root.querySelector("#carnival-events-btn") as HTMLButtonElement).addEventListener(
      "pointerdown",
      (e) => e.stopPropagation()
    );
    (this.root.querySelector("#carnival-events-btn") as HTMLButtonElement).addEventListener(
      "click",
      () => this.openEvents()
    );
    this.eventsPanel.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-close-events]")) return this.closeEvents();
      const row = t.closest("[data-event]") as HTMLElement | null;
      if (row) {
        const ok = this.state.buyEvent(row.dataset.event!);
        if (!ok) this.toast("Not enough hearts");
      }
    });

    // Upgrade popup.
    this.popup.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-close-popup]")) return this.closePopup();
      const up = t.closest("[data-upgrade]") as HTMLElement | null;
      if (up) {
        const id = Number(up.dataset.upgrade);
        const ok = this.state.upgrade(id);
        if (!ok) this.toast("Not enough hearts");
        else this.renderPopup(id);
      }
    });

    // Drag: menu cards start a "place"; placed buildings start a "move"/tap.
    this.menu.addEventListener("pointerdown", this.onMenuDown);
    this.buildingsEl.addEventListener("pointerdown", this.onBuildingDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);

    this.state.onChange(() => this.render());
    this.merge.onChange(() => this.renderHearts());
    this.render();
  }

  // ---- open/close ----
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
  hide() {
    this.root.style.display = "none";
  }
  show() {
    this.root.style.display = "";
  }

  // ---- render ----
  private render() {
    this.renderHearts();
    this.renderField();
    this.renderMenu();
    this.refreshHappiness();
  }

  private renderHearts() {
    this.heartsEl.textContent = String(this.merge.hearts);
    this.renderMenu(); // affordability shading depends on hearts
  }

  private renderField() {
    this.buildingsEl.innerHTML = this.state.placed
      .map((pb) => {
        const lvl =
          pb.kind === "generator" ? `<span class="lvl">L${pb.level}</span>` : "";
        return `<div class="cbuild" data-instance="${pb.instanceId}"
          style="left:${pb.x * 100}%; top:${pb.y * 100}%;">
          <div class="glyph">${buildingSVG(pb.defId)}</div>${lvl}
        </div>`;
      })
      .join("");
  }

  private renderMenu() {
    this.menu.innerHTML = this.state
      .defs()
      .map((d) => {
        const cant = this.merge.hearts < d.buildCost ? " cant" : "";
        const sub =
          d.kind === "amenity"
            ? `<div class="mfloor">+${d.happinessFloor}% floor</div>`
            : `<div class="mfloor">${d.baseRate}/min</div>`;
        return `<div class="menu-card${cant}" data-def="${d.id}">
          <div class="mico">${buildingSVG(d.id)}</div>
          <div class="mname">${d.name}</div>
          ${sub}
          <div class="mcost"><span class="ico">${heartSVG()}</span>${d.buildCost}</div>
        </div>`;
      })
      .join("");
  }

  private refreshHappiness() {
    const h = this.state.happiness;
    const pct = Math.round(h);
    this.happyFill.style.width = pct + "%";
    // Red (0) -> green (120) hue lerp.
    const hue = Math.round((h / 100) * 120);
    this.happyFill.style.backgroundColor = `hsl(${hue}, 70%, 52%)`;
    const hold = this.state.capHoldRemaining > 0;
    (this.happyLabel.querySelector("#happy-text") as HTMLElement).textContent =
      `Happiness ${pct}%` + (hold ? " (peak!)" : "");
    (this.happyLabel.querySelector("#happy-mult") as HTMLElement).textContent =
      "×" + this.state.multiplier.toFixed(2);
  }

  // ---- events panel ----
  private openEvents() {
    const list = this.eventsPanel.querySelector("#events-list") as HTMLDivElement;
    list.innerHTML = this.state
      .events()
      .map((ev) => {
        const cant = this.merge.hearts < ev.cost;
        return `<div class="ev-row" data-event="${ev.id}">
          <div class="ev-info">
            <div class="ev-name">${ev.name}</div>
            <div class="ev-sub">+${ev.happiness}% happiness</div>
          </div>
          <button class="buy-btn" ${cant ? "disabled" : ""}>
            <span class="ico">${heartSVG()}</span>${ev.cost}
          </button>
        </div>`;
      })
      .join("");
    this.eventsPanel.classList.remove("hidden");
  }
  private closeEvents() {
    this.eventsPanel.classList.add("hidden");
  }

  // ---- upgrade popup ----
  private openPopup(instanceId: number) {
    this.renderPopup(instanceId);
    this.popup.classList.remove("hidden");
  }
  private closePopup() {
    this.popup.classList.add("hidden");
  }
  private renderPopup(instanceId: number) {
    const pb = this.state.byInstance(instanceId);
    if (!pb) return this.closePopup();
    const def = this.state.defById(pb.defId)!;
    (this.popup.querySelector("#popup-title") as HTMLElement).textContent = def.name;
    const body = this.popup.querySelector("#popup-body") as HTMLDivElement;

    if (def.kind === "amenity") {
      body.innerHTML = `
        <div class="up-row">
          <div class="up-info">
            <div class="up-name">Comfort amenity</div>
            <div class="up-sub">Grants a permanent +${def.happinessFloor}% happiness floor.</div>
          </div>
        </div>
        <div style="font-size:12px;opacity:0.8;">Current floor: ${this.state.happinessFloor}%</div>`;
      return;
    }

    const cost = this.state.upgradeCost(pb);
    const maxed = cost == null;
    const rate = this.state.buildingRate(pb).toFixed(1);
    const nextRate = maxed
      ? null
      : (def.baseRate! * Math.pow(def.rateGrowth!, pb.level)).toFixed(1);
    const maxLevel = def.maxLevel ?? 1;
    const pips = Array.from({ length: maxLevel }, (_, i) =>
      `<span class="pip${i < pb.level ? " on" : ""}"></span>`
    ).join("");

    body.innerHTML = `
      <div class="up-row">
        <div class="up-info">
          <div class="up-name">Level ${pb.level}${maxed ? " (MAX)" : ""}</div>
          <div class="up-sub">${rate}/min${nextRate ? ` → ${nextRate}/min` : ""}</div>
          <div class="up-pips">${pips}</div>
        </div>
        ${
          maxed
            ? `<button class="buy-btn" disabled>MAX</button>`
            : `<button class="buy-btn" data-upgrade="${pb.instanceId}" ${
                this.merge.hearts < cost! ? "disabled" : ""
              }><span class="ico">${heartSVG()}</span>${cost}</button>`
        }
      </div>
      <div style="font-size:12px;opacity:0.8;">
        Generates hearts passively, boosted ×${this.state.multiplier.toFixed(2)} by happiness.
      </div>`;
  }

  // ---- drag & drop ----
  private onMenuDown = (e: PointerEvent) => {
    const card = (e.target as HTMLElement).closest(".menu-card") as HTMLElement | null;
    if (!card || !card.dataset.def) return;
    e.stopPropagation();
    e.preventDefault();
    const defId = card.dataset.def;
    if (!this.state.canAfford(defId)) {
      this.toast("Not enough hearts");
      return;
    }
    this.dragMode = "place";
    this.dragDefId = defId;
    this.pointerId = e.pointerId;
    this.moved = false;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.ghost.innerHTML = buildingSVG(defId);
    this.ghost.style.display = "block";
    this.moveGhost(e.clientX, e.clientY);
  };

  private onBuildingDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest(".cbuild") as HTMLElement | null;
    if (!el || el.dataset.instance === undefined) return;
    e.stopPropagation();
    e.preventDefault();
    this.dragMode = "move";
    this.dragInstanceId = Number(el.dataset.instance);
    this.pointerId = e.pointerId;
    this.moved = false;
    this.downX = e.clientX;
    this.downY = e.clientY;
    el.classList.add("dragging");
    this.ghost.innerHTML = buildingSVG(this.state.byInstance(this.dragInstanceId)!.defId);
    this.ghost.style.display = "block";
    this.moveGhost(e.clientX, e.clientY);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.dragMode === null || e.pointerId !== this.pointerId) return;
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 6) this.moved = true;
    this.moveGhost(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragMode === null || e.pointerId !== this.pointerId) return;
    const mode = this.dragMode;
    const inField = this.pointInField(e.clientX, e.clientY);

    if (mode === "place") {
      if (inField) {
        if (!this.state.place(this.dragDefId, inField.x, inField.y))
          this.toast("Not enough hearts");
      }
    } else if (mode === "move") {
      if (!this.moved) {
        this.openPopup(this.dragInstanceId); // a tap opens the upgrade popup
      } else if (inField) {
        this.state.move(this.dragInstanceId, inField.x, inField.y);
      }
    }
    this.endDrag();
  };

  private endDrag() {
    this.buildingsEl
      .querySelector(".cbuild.dragging")
      ?.classList.remove("dragging");
    this.dragMode = null;
    this.dragDefId = "";
    this.dragInstanceId = -1;
    this.pointerId = null;
    this.moved = false;
    this.ghost.style.display = "none";
  }

  private moveGhost(x: number, y: number) {
    this.ghost.style.left = x + "px";
    this.ghost.style.top = y + "px";
  }

  // Map a client point to normalized field coords, or null if outside.
  private pointInField(cx: number, cy: number): { x: number; y: number } | null {
    const r = this.field.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    const x = clamp(FIELD_INSET, 1 - FIELD_INSET, (cx - r.left) / r.width);
    const y = clamp(FIELD_INSET, 1 - FIELD_INSET, (cy - r.top) / r.height);
    return { x, y };
  }

  private toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("show"), 1400);
  }

  // ---- System: happiness bar + NPC wander ----
  update(dt: number) {
    if (!this.isOpen || this.root.style.display === "none") return;
    this.refreshHappiness();
    this.syncNpcCount();
    this.updateNpcs(dt);
  }

  private syncNpcCount() {
    const target = this.state.npcTarget;
    while (this.npcs.length < target) this.addNpc();
    while (this.npcs.length > target) {
      const npc = this.npcs.pop();
      npc?.el.remove();
    }
  }

  private addNpc() {
    const variant = this.npcs.length % 6;
    const el = document.createElement("div");
    el.className = "cnpc";
    el.innerHTML = npcSVG(variant);
    this.npcsEl.appendChild(el);
    const x = Math.random();
    const y = 0.3 + Math.random() * 0.6;
    const npc: Npc = {
      el,
      x,
      y,
      tx: x,
      ty: y,
      speed: 0.05 + Math.random() * 0.06,
      inside: 0,
      targetIsBuilding: false,
      variant,
    };
    this.assignTarget(npc);
    this.positionNpc(npc);
    this.npcs.push(npc);
  }

  private assignTarget(npc: Npc) {
    const buildings = this.state.placed;
    if (buildings.length > 0 && Math.random() < 0.6) {
      const b = buildings[Math.floor(Math.random() * buildings.length)];
      npc.tx = b.x;
      npc.ty = b.y;
      npc.targetIsBuilding = true;
    } else {
      npc.tx = 0.05 + Math.random() * 0.9;
      npc.ty = 0.3 + Math.random() * 0.65;
      npc.targetIsBuilding = false;
    }
  }

  private updateNpcs(dt: number) {
    for (const npc of this.npcs) {
      if (npc.inside > 0) {
        npc.inside -= dt;
        if (npc.inside <= 0) {
          npc.el.style.opacity = "1";
          this.assignTarget(npc);
        }
        continue;
      }
      const dx = npc.tx - npc.x;
      const dy = npc.ty - npc.y;
      const dist = Math.hypot(dx, dy);
      const step = npc.speed * dt;
      if (dist <= step || dist < 0.005) {
        npc.x = npc.tx;
        npc.y = npc.ty;
        if (npc.targetIsBuilding) {
          npc.inside = 1 + Math.random() * 1.5; // duck inside
          npc.el.style.opacity = "0.15";
        } else {
          this.assignTarget(npc);
        }
      } else {
        npc.x += (dx / dist) * step;
        npc.y += (dy / dist) * step;
      }
      this.positionNpc(npc);
    }
  }

  private positionNpc(npc: Npc) {
    npc.el.style.left = npc.x * 100 + "%";
    npc.el.style.top = npc.y * 100 + "%";
  }
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}
