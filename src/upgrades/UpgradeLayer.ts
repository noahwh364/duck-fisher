import type { System } from "../main";
import type { MergeState } from "../merge/MergeState";
import {
  UpgradeState,
  ATTACHMENTS,
  TRACKS,
  ATTACH_LABEL,
  TRACK_LABEL,
  type Attachment,
} from "./UpgradeState";
import { testTubeSVG, attachmentSVG, clockSVG } from "./icons";
import { heartSVG } from "../merge/icons";

// DOM overlay for the pole-upgrade system. Three pieces, all inside #game:
//   (a) a test-tube toolbar button on the left edge that opens the skill tree,
//   (b) a skill-tree modal panel (unlock + per-track upgrades + activate),
//   (c) an activation bar under the fisherman with one button per unlocked
//       attachment (ready / active countdown / cooldown sweep).
// Full re-render happens on upgradeState/mergeState change; the activation-bar
// timer overlays refresh cheaply each frame via the System `update`.

const STYLE_ID = "upgrade-layer-style";

const CSS = `
#upgrade-toolbar {
  position: absolute; z-index: 14;
  left: 12px; top: 50%; transform: translateY(-50%);
  width: 60px; height: 60px; border-radius: 16px;
  border: 3px solid #7cf0b5; cursor: pointer;
  background: rgba(20,30,55,0.82);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.45);
  font-family: system-ui, -apple-system, sans-serif;
}
#upgrade-toolbar:active { transform: translateY(-50%) translateY(2px); }
#upgrade-toolbar .tico { width: 42px; height: 42px; pointer-events: none; }
#upgrade-toolbar .label {
  position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%);
  background: #7cf0b5; color: #08341f; font-weight: 800; font-size: 9px;
  letter-spacing: 0.04em; text-transform: uppercase;
  border-radius: 999px; padding: 1px 7px; white-space: nowrap;
}

/* Attachment activation bar (bottom-center, above the orders strip). */
#attachment-bar {
  position: absolute; z-index: 13;
  left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 12px) + 108px);
  display: flex; gap: 10px;
  font-family: system-ui, -apple-system, sans-serif;
}
#attachment-bar:empty { display: none; }
.att-btn {
  position: relative; width: 58px; height: 58px; border-radius: 50%;
  border: 3px solid #ffd23f; cursor: pointer;
  background: rgba(20,30,55,0.9);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.45);
  overflow: hidden;
}
.att-btn:active { transform: translateY(2px); }
.att-btn .aico { width: 40px; height: 40px; pointer-events: none; }
.att-btn.ready { border-color: #7cf0b5; }
.att-btn.active { border-color: #7dff9a; box-shadow: 0 0 0 3px #7dff9a, 0 4px 10px rgba(0,0,0,0.45); }
.att-btn.cooling { border-color: #6b7590; cursor: default; filter: grayscale(0.7) brightness(0.7); }
.att-btn .sweep {
  position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
}
.att-btn .timer {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: 16px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.9); pointer-events: none;
}

/* Skill-tree modal. */
#upgrade-panel {
  position: absolute; inset: 0; z-index: 18;
  display: flex; align-items: center; justify-content: center;
  background: rgba(6,10,22,0.62);
  font-family: system-ui, -apple-system, sans-serif; color: #fff;
}
#upgrade-panel.hidden { display: none; }
#upgrade-panel .box {
  width: 88%; max-width: 360px; max-height: 84%;
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #2f5a45, #1e3a2c);
  border: 3px solid #7cf0b5; border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
#upgrade-panel .head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px 8px;
}
#upgrade-panel .head h3 { font-size: 18px; font-weight: 800; }
#upgrade-panel .up-hearts {
  display: flex; align-items: center; gap: 6px;
  background: rgba(0,0,0,0.3); border-radius: 999px;
  padding: 4px 12px 4px 7px; font-weight: 800; font-size: 16px;
}
#upgrade-panel .up-hearts .ico { width: 18px; height: 18px; }
#upgrade-panel .close {
  border: none; cursor: pointer; background: rgba(0,0,0,0.3);
  color: #fff; font-weight: 800; font-size: 16px; line-height: 1;
  width: 30px; height: 30px; border-radius: 999px;
}
#upgrade-panel .scroll { overflow-y: auto; padding: 4px 14px 14px; }

.att-section {
  background: rgba(0,0,0,0.22); border-radius: 14px;
  padding: 10px; margin-bottom: 12px;
}
.att-section .att-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
}
.att-section .att-glyph {
  width: 40px; height: 40px; border-radius: 10px; flex: 0 0 auto;
  background: rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
}
.att-section .att-glyph svg { width: 30px; height: 30px; }
.att-section .att-name { font-weight: 800; font-size: 16px; }
.att-section .att-sub { font-size: 11px; opacity: 0.7; }
.att-section.locked { opacity: 0.96; }

.up-btn {
  border: none; cursor: pointer; border-radius: 10px;
  font-weight: 800; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
}
.up-btn .ico { width: 14px; height: 14px; }
.up-btn.buy { background: #ffd23f; color: #3a2a00; box-shadow: 0 3px 0 #c99700; }
.up-btn.buy:active { transform: translateY(2px); box-shadow: 0 1px 0 #c99700; }
.up-btn.buy:disabled { background: #6b6250; color: #3a3427; box-shadow: none; cursor: default; opacity: 0.8; }
.up-btn.unlock {
  width: 100%; padding: 10px; font-size: 14px;
  background: #7cf0b5; color: #08341f; box-shadow: 0 3px 0 #46b483;
}
.up-btn.unlock:active { transform: translateY(2px); box-shadow: 0 1px 0 #46b483; }
.up-btn.unlock:disabled { background: #5c7a6c; color: #24352c; box-shadow: none; cursor: default; }

.trk-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; border-top: 1px solid rgba(255,255,255,0.08);
}
.trk-row .trk-main { flex: 1; min-width: 0; }
.trk-row .trk-name {
  display: flex; align-items: center; gap: 5px;
  font-size: 13px; font-weight: 700;
}
.trk-row .trk-name .cico { width: 13px; height: 13px; opacity: 0.85; }
.trk-row .trk-val { font-size: 11px; opacity: 0.72; }
.trk-row .pips { display: flex; gap: 3px; margin-top: 3px; }
.trk-row .pip {
  width: 12px; height: 6px; border-radius: 3px;
  background: rgba(255,255,255,0.18);
}
.trk-row .pip.on { background: #7cf0b5; }
.trk-row .up-btn.buy { padding: 7px 10px; font-size: 12px; flex: 0 0 auto; }

/* One-time explanation popup shown when an attachment is unlocked. Sits above
   the skill-tree panel and even the tutorial overlay so it's always readable. */
#upgrade-explain {
  position: absolute; inset: 0; z-index: 55;
  display: flex; align-items: center; justify-content: center;
  background: rgba(6,10,22,0.7); padding: 24px;
  font-family: system-ui, -apple-system, sans-serif; color: #fff;
}
#upgrade-explain.hidden { display: none; }
#upgrade-explain .xbox {
  width: 100%; max-width: 320px; text-align: center;
  background: linear-gradient(180deg, #2f5a45, #1e3a2c);
  border: 3px solid #7cf0b5; border-radius: 18px;
  box-shadow: 0 12px 34px rgba(0,0,0,0.55);
  padding: 20px 20px 18px;
}
#upgrade-explain .xglyph {
  width: 66px; height: 66px; margin: 0 auto 10px;
  border-radius: 16px; background: rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
}
#upgrade-explain .xglyph svg { width: 46px; height: 46px; }
#upgrade-explain .xtag {
  display: inline-block; font-size: 10px; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: #08341f; background: #7cf0b5;
  border-radius: 999px; padding: 2px 10px; margin-bottom: 8px;
}
#upgrade-explain h3 { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
#upgrade-explain p { font-size: 13px; line-height: 1.5; opacity: 0.92; margin-bottom: 10px; }
#upgrade-explain .xhint { font-size: 11px; opacity: 0.68; margin-bottom: 14px; }
#upgrade-explain .xbtn {
  border: none; cursor: pointer; border-radius: 12px;
  background: #ffd23f; color: #3a2a00; font-weight: 800; font-size: 15px;
  padding: 11px 26px; box-shadow: 0 3px 0 #c99700; font-family: inherit;
}
#upgrade-explain .xbtn:active { transform: translateY(2px); box-shadow: 0 1px 0 #c99700; }
`;

// Tracks whose displayed value reads better in seconds (with a clock glyph).
const TIME_TRACKS = new Set(["duration", "cooldown"]);

// One-time "how it works" blurb shown the moment an attachment is unlocked.
const ATTACH_EXPLAIN: Record<Attachment, string> = {
  automatic:
    "Activate it and your line casts itself over and over for a few seconds — no dragging needed. Perfect for hauling in ducks fast. Upgrade its fire rate, reach, and duration.",
  blast:
    "Activate it and every cast fires several lines at once in a wide spread, hooking a whole cluster of ducks in one throw. Upgrade the number of casts, reach, and duration.",
  laser:
    "Activate it and your cast becomes a wide beam that scoops up every duck in its path. Upgrade the beam's width and duration.",
};

export class UpgradeLayer implements System {
  private toolbar: HTMLButtonElement;
  private bar: HTMLDivElement;
  private panel: HTMLDivElement;
  private panelScroll!: HTMLDivElement;
  private heartsEl!: HTMLSpanElement;
  private explain!: HTMLDivElement;

  // Per-attachment activation-bar button elements, for cheap per-frame updates.
  private barBtns: Partial<Record<Attachment, HTMLButtonElement>> = {};

  // Attachments already introduced, so the "how it works" popup fires exactly
  // once per attachment the moment it becomes unlocked (via any code path).
  private seenUnlocked = new Set<Attachment>();

  constructor(
    parent: HTMLElement,
    private state: UpgradeState,
    private merge: MergeState
  ) {
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement("style");
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    // Toolbar button.
    this.toolbar = document.createElement("button");
    this.toolbar.id = "upgrade-toolbar";
    this.toolbar.innerHTML = `<span class="tico">${testTubeSVG()}</span><span class="label">Upgrades</span>`;
    parent.appendChild(this.toolbar);
    this.toolbar.addEventListener("click", () => this.openPanel());

    // Activation bar.
    this.bar = document.createElement("div");
    this.bar.id = "attachment-bar";
    parent.appendChild(this.bar);

    // Skill-tree modal.
    this.panel = document.createElement("div");
    this.panel.id = "upgrade-panel";
    this.panel.className = "hidden";
    this.panel.innerHTML = `
      <div class="box">
        <div class="head">
          <h3>Pole Lab</h3>
          <div class="up-hearts"><span class="ico">${heartSVG()}</span><span id="up-hearts-count">0</span></div>
          <button class="close" data-close-upgrade>×</button>
        </div>
        <div class="scroll" id="upgrade-scroll"></div>
      </div>`;
    parent.appendChild(this.panel);
    this.panelScroll = this.panel.querySelector(
      "#upgrade-scroll"
    ) as HTMLDivElement;
    this.heartsEl = this.panel.querySelector(
      "#up-hearts-count"
    ) as HTMLSpanElement;

    // Panel click delegation (unlock / buy / activate / close).
    this.panel.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-close-upgrade]") || t === this.panel) {
        this.closePanel();
        return;
      }
      const unlockEl = t.closest("[data-unlock]") as HTMLElement | null;
      if (unlockEl) {
        this.state.unlock(unlockEl.dataset.unlock as Attachment);
        return;
      }
      const buyEl = t.closest("[data-buy]") as HTMLElement | null;
      if (buyEl) {
        const [att, track] = (buyEl.dataset.buy as string).split(":");
        this.state.buyUpgrade(att as Attachment, track);
        return;
      }
    });
    // Clicking the dim backdrop closes.
    this.panel.addEventListener("pointerdown", (e) => {
      if (e.target === this.panel) this.closePanel();
    });

    // Activation-bar clicks activate an attachment. stopPropagation on
    // pointerdown so the tap never starts the canvas cast gesture underneath.
    this.bar.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.bar.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(
        ".att-btn"
      ) as HTMLElement | null;
      if (!btn || !btn.dataset.att) return;
      this.state.activate(btn.dataset.att as Attachment);
    });

    // Unlock-explanation popup.
    this.explain = document.createElement("div");
    this.explain.id = "upgrade-explain";
    this.explain.className = "hidden";
    this.explain.innerHTML = `
      <div class="xbox">
        <div class="xglyph"></div>
        <div class="xtag">New Attachment</div>
        <h3 class="xtitle"></h3>
        <p class="xblurb"></p>
        <div class="xhint">Tap it in the ring of buttons under your fisher to switch it on. It runs for a while, then cools down before you can use it again.</div>
        <button class="xbtn">Got it</button>
      </div>`;
    parent.appendChild(this.explain);
    // Don't let a tap fall through to the canvas and start a cast.
    this.explain.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.explain.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t === this.explain || t.closest(".xbtn")) this.hideExplain();
    });

    // Seed the "seen" set with anything already unlocked so only *future*
    // unlocks trigger the popup (nothing fires on initial load).
    for (const a of ATTACHMENTS) if (this.state.isUnlocked(a)) this.seenUnlocked.add(a);

    this.state.onChange(() => {
      this.render();
      this.checkNewUnlocks();
    });
    this.merge.onChange(() => this.render());
    this.render();
  }

  // Show the one-time blurb for any attachment that just became unlocked.
  private checkNewUnlocks() {
    for (const a of ATTACHMENTS) {
      if (this.state.isUnlocked(a) && !this.seenUnlocked.has(a)) {
        this.seenUnlocked.add(a);
        this.showExplain(a);
      }
    }
  }

  private showExplain(att: Attachment) {
    (this.explain.querySelector(".xglyph") as HTMLElement).innerHTML =
      attachmentSVG(att);
    (this.explain.querySelector(".xtitle") as HTMLElement).textContent =
      ATTACH_LABEL[att];
    (this.explain.querySelector(".xblurb") as HTMLElement).textContent =
      ATTACH_EXPLAIN[att];
    this.explain.classList.remove("hidden");
  }

  private hideExplain() {
    this.explain.classList.add("hidden");
  }

  // ---- Show/hide (the merge layer covers everything; hide while it's open) ----
  hide() {
    this.toolbar.style.display = "none";
    this.bar.style.display = "none";
    this.closePanel();
    this.hideExplain();
  }
  show() {
    this.toolbar.style.display = "flex";
    this.bar.style.display = "flex";
  }

  private openPanel() {
    this.renderPanel();
    this.panel.classList.remove("hidden");
  }
  private closePanel() {
    this.panel.classList.add("hidden");
  }
  private get panelOpen(): boolean {
    return !this.panel.classList.contains("hidden");
  }

  // Full render on state change: rebuild the activation bar and (if open) panel.
  private render() {
    this.renderBar();
    if (this.panelOpen) this.renderPanel();
  }

  private renderBar() {
    const unlocked = ATTACHMENTS.filter((a) => this.state.isUnlocked(a));
    this.bar.innerHTML = unlocked
      .map(
        (a) => `
        <button class="att-btn" data-att="${a}" title="${ATTACH_LABEL[a]}">
          <span class="sweep"></span>
          <span class="aico">${attachmentSVG(a)}</span>
          <span class="timer"></span>
        </button>`
      )
      .join("");
    this.barBtns = {};
    for (const a of unlocked) {
      this.barBtns[a] = this.bar.querySelector(
        `[data-att="${a}"]`
      ) as HTMLButtonElement;
    }
    this.refreshBar();
  }

  // Cheap per-frame refresh of the activation-bar button states/timers.
  private refreshBar() {
    for (const a of ATTACHMENTS) {
      const btn = this.barBtns[a];
      if (!btn) continue;
      const timer = btn.querySelector(".timer") as HTMLElement;
      const sweep = btn.querySelector(".sweep") as HTMLElement;
      btn.classList.remove("ready", "active", "cooling");
      if (this.state.isActive(a)) {
        btn.classList.add("active");
        timer.textContent = Math.ceil(this.state.activeRemaining(a)) + "s";
        sweep.style.background = "";
      } else if (this.state.isCoolingDown(a)) {
        btn.classList.add("cooling");
        timer.textContent = Math.ceil(this.state.cooldownRemaining(a)) + "s";
        const frac = this.state.cooldownProgress(a); // 0..1 elapsed
        const deg = Math.round(frac * 360);
        sweep.style.background = `conic-gradient(rgba(124,240,181,0.55) ${deg}deg, rgba(0,0,0,0) 0deg)`;
      } else {
        btn.classList.add("ready");
        timer.textContent = "";
        sweep.style.background = "";
      }
    }
  }

  private renderPanel() {
    this.heartsEl.textContent = String(this.merge.hearts);
    this.panelScroll.innerHTML = ATTACHMENTS.map((a) =>
      this.renderSection(a)
    ).join("");
  }

  private renderSection(att: Attachment): string {
    const unlocked = this.state.isUnlocked(att);
    const glyph = attachmentSVG(att);
    const canUnlock = this.merge.hearts >= this.state.unlockCost(att);

    if (!unlocked) {
      return `
        <div class="att-section locked">
          <div class="att-head">
            <div class="att-glyph">${glyph}</div>
            <div>
              <div class="att-name">${ATTACH_LABEL[att]}</div>
              <div class="att-sub">Locked</div>
            </div>
          </div>
          <button class="up-btn unlock" data-unlock="${att}" ${
            canUnlock ? "" : "disabled"
          }>
            Unlock &nbsp;<span class="ico">${heartSVG()}</span>${this.state.unlockCost(
              att
            )}
          </button>
        </div>`;
    }

    const rows = TRACKS[att].map((tr) => this.renderTrack(att, tr)).join("");

    return `
      <div class="att-section">
        <div class="att-head">
          <div class="att-glyph">${glyph}</div>
          <div>
            <div class="att-name">${ATTACH_LABEL[att]}</div>
            <div class="att-sub">15s active · then cooldown</div>
          </div>
        </div>
        ${rows}
      </div>`;
  }

  private renderTrack(att: Attachment, track: string): string {
    const level = this.state.level(att, track);
    const max = this.state.maxLevel(att, track);
    const cost = this.state.upgradeCost(att, track);
    const isTime = TIME_TRACKS.has(track);
    const value = this.state.trackValue(att, track);
    const valStr = isTime
      ? `${Math.round(value)}s`
      : Number.isInteger(value)
        ? String(value)
        : value.toFixed(2);

    const pips = Array.from({ length: max }, (_, i) =>
      `<span class="pip ${i < level ? "on" : ""}"></span>`
    ).join("");

    const affordable = cost != null && this.merge.hearts >= cost;
    const btn =
      cost == null
        ? `<button class="up-btn buy" disabled>MAX</button>`
        : `<button class="up-btn buy" data-buy="${att}:${track}" ${
            affordable ? "" : "disabled"
          }><span class="ico">${heartSVG()}</span>${cost}</button>`;

    return `
      <div class="trk-row">
        <div class="trk-main">
          <div class="trk-name">
            ${isTime ? `<span class="cico">${clockSVG()}</span>` : ""}${TRACK_LABEL[track] ?? track}
          </div>
          <div class="trk-val">Now: ${valStr} &nbsp;·&nbsp; Lv ${level}/${max}</div>
          <div class="pips">${pips}</div>
        </div>
        ${btn}
      </div>`;
  }

  // ---- System: refresh the activation-bar timers cheaply each frame ----
  update() {
    this.refreshBar();
  }
}
