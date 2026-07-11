import type { System } from "../main";
import type { MergeState } from "../merge/MergeState";
import { ATTACHMENTS, type UpgradeState } from "../upgrades/UpgradeState";
import type { CarnivalState } from "../carnival/CarnivalState";

// Interactive first-play tutorial. Mirrors the pure-logic + DOM-overlay + System
// idiom used elsewhere: it owns a small overlay inside #game (a spotlight that
// dims everything but the highlighted control, plus a text bubble), walks a fixed
// sequence of steps, and advances either when the player performs the real action
// (caught a duck, opened the basket, merged two ducks, ...) or when they tap the
// bubble's button. It never traps the player: every step can be advanced by tap.
//
// main.ts feeds it screen/action events via the notify* methods and instantiates
// it after all the other layers so its overlay sits on top.

const STYLE_ID = "tutorial-layer-style";
const DONE_KEY = "quackpot-tutorial-done";

// Pink is palette index 6 (#f15bb5): the color the walkthrough merges + orders.
const PINK_DUCK = 6;
// Hearts granted at the start of the walkthrough so every guided purchase is
// affordable. Guided path:
//   Automatic unlock  150
// + ring-toss build    40
// + ring-toss upgrade  30
// + cheapest event     50
// = 270, so 400 leaves comfortable headroom (plus the +10 from the order step).
const START_HEARTS = 400;

type Screen = "pond" | "merge" | "carnival";

// How a step auto-advances from a real player action (in addition to its button).
type AutoTrigger =
  | "catch"
  | "openMerge"
  | "merge"
  | "fulfill"
  | "back"
  | "openUpgrades"
  | "buyUpgrade"
  | "unlockAutomatic"
  | "openCarnival"
  | "placeBuilding"
  | "upgradeBuilding"
  | "openEvents"
  | "buyEvent";

interface TutStep {
  id: string;
  text: string;
  // The control to spotlight. Resolved lazily each frame (elements come and go
  // as screens open/close). Undefined = no spotlight.
  target?: () => HTMLElement | null;
  // Optional second control to spotlight simultaneously (e.g. highlight both the
  // merged duck on the grid *and* the order card it should be dragged onto). When
  // both this and `target` resolve, a two-hole cut-out dims everything else.
  target2?: () => HTMLElement | null;
  // Screen this step belongs to; the overlay hides while on any other screen.
  // Undefined = show on any screen.
  screen?: Screen;
  // Real action that advances the step (optional; button always works too).
  auto?: AutoTrigger;
  // Label for the advance button. Steps with an `auto` show a quieter "Skip".
  button?: string;
  // Dim the whole screen behind a centered bubble (for welcome / finish cards).
  dimCenter?: boolean;
  // Place the bubble to the right of the spotlight (instead of above/below), so
  // it doesn't cover content beneath the target (e.g. the grid under the orders).
  side?: boolean;
  // Which cross-screen nav buttons the player may use during this step. The tent
  // / basket / pond buttons are hidden unless their screen is listed, so the
  // walkthrough stays linear (undefined = hide all nav for this step).
  nav?: Screen[];
}

const CSS = `
#tutorial-layer {
  position: absolute; inset: 0; z-index: 50;
  pointer-events: none;
  font-family: system-ui, -apple-system, sans-serif;
}
#tutorial-layer.hidden { display: none; }

/* Full-screen dim for centered info cards. */
#tutorial-layer .tut-dim {
  position: absolute; inset: 0;
  background: rgba(6,10,22,0.72);
}

/* Spotlight ring: the giant box-shadow dims everything outside its box. */
#tutorial-layer .tut-spot {
  position: absolute; border-radius: 16px;
  border: 3px solid #ffd23f;
  box-shadow: 0 0 0 9999px rgba(6,10,22,0.72),
              0 0 14px 2px rgba(255,210,63,0.8) inset;
  animation: tut-pulse 1.4s ease-in-out infinite;
}
@keyframes tut-pulse {
  0%, 100% { border-color: #ffd23f; }
  50% { border-color: #fff3b0; }
}

/* Two-hole cut-out: an evenodd path dims everything except two rectangular
   holes (a single box-shadow spotlight can only cut one hole). The rings are
   drawn as stroked rects over each hole. */
#tutorial-layer .tut-cutout {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none;
}
#tutorial-layer .tut-cutout-fill { fill: rgba(6,10,22,0.72); }
#tutorial-layer .tut-ring {
  fill: none; stroke: #ffd23f; stroke-width: 3;
  animation: tut-ring-pulse 1.4s ease-in-out infinite;
}
@keyframes tut-ring-pulse {
  0%, 100% { stroke: #ffd23f; }
  50% { stroke: #fff3b0; }
}

/* Text bubble. */
#tutorial-layer .tut-bubble {
  position: absolute; max-width: 250px;
  background: #fff3e0; color: #2a1d0a;
  border-radius: 14px; padding: 12px 14px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.5);
  pointer-events: auto;
}
#tutorial-layer .tut-bubble .tut-text {
  font-size: 15px; font-weight: 700; line-height: 1.3;
}
#tutorial-layer .tut-bubble .tut-actions {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 12px; margin-top: 10px;
}
#tutorial-layer .tut-step {
  font-size: 11px; font-weight: 800; opacity: 0.5;
  margin-right: auto; letter-spacing: 0.04em;
}
#tutorial-layer .tut-skip {
  border: none; background: none; cursor: pointer;
  color: #8a6d3b; font-weight: 800; font-size: 13px;
  text-decoration: underline; font-family: inherit; padding: 2px 4px;
}
#tutorial-layer .tut-btn {
  border: none; cursor: pointer; border-radius: 10px;
  background: #ff5d73; color: #fff; font-weight: 800; font-size: 14px;
  padding: 8px 16px; box-shadow: 0 3px 0 #b53145; font-family: inherit;
}
#tutorial-layer .tut-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #b53145; }

/* Little arrow pointing from the bubble toward the spotlight. */
#tutorial-layer .tut-arrow {
  position: absolute; width: 0; height: 0;
}
#tutorial-layer .tut-bubble.below .tut-arrow {
  top: -9px; border-left: 9px solid transparent; border-right: 9px solid transparent;
  border-bottom: 9px solid #fff3e0;
}
#tutorial-layer .tut-bubble.above .tut-arrow {
  bottom: -9px; border-left: 9px solid transparent; border-right: 9px solid transparent;
  border-top: 9px solid #fff3e0;
}
#tutorial-layer .tut-bubble.beside .tut-arrow {
  left: -9px; border-top: 9px solid transparent; border-bottom: 9px solid transparent;
  border-right: 9px solid #fff3e0;
}
`;

export class TutorialController implements System {
  private root: HTMLDivElement;
  private dim: HTMLDivElement;
  private spot: HTMLDivElement;
  private cutout: SVGSVGElement;
  private cutoutFill: SVGPathElement;
  private ringA: SVGRectElement;
  private ringB: SVGRectElement;
  private bubble: HTMLDivElement;
  private textEl: HTMLDivElement;
  private actionsEl: HTMLDivElement;
  private arrow: HTMLDivElement;

  private steps: TutStep[];
  private index = 0;
  private active = false;
  private screen: Screen = "pond";

  // Set by main.ts: re-applies the per-step nav-button gate (see allowedNav).
  navRefresh?: () => void;

  // Baselines captured when an action step becomes active, so we can tell that
  // the player has *just* done the thing (vs. a pre-existing state).
  private mergeBaseline = 0;
  private heartBaseline = 0;
  private upgradeBaseline = 0;
  private carnivalBaseline = 0;
  private carnivalLevelBaseline = 0;
  private eventsBaseline = 0;

  constructor(
    parent: HTMLElement,
    private merge: MergeState,
    private upgrades: UpgradeState,
    private carnival: CarnivalState
  ) {
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement("style");
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    this.steps = this.buildSteps();

    this.root = document.createElement("div");
    this.root.id = "tutorial-layer";
    this.root.className = "hidden";
    this.root.innerHTML = `
      <div class="tut-dim" style="display:none"></div>
      <div class="tut-spot" style="display:none"></div>
      <svg class="tut-cutout" style="display:none">
        <path class="tut-cutout-fill" fill-rule="evenodd"></path>
        <rect class="tut-ring" data-ring="a"></rect>
        <rect class="tut-ring" data-ring="b"></rect>
      </svg>
      <div class="tut-bubble" style="display:none">
        <div class="tut-arrow"></div>
        <div class="tut-text"></div>
        <div class="tut-actions"></div>
      </div>`;
    parent.appendChild(this.root);

    this.dim = this.root.querySelector(".tut-dim") as HTMLDivElement;
    this.spot = this.root.querySelector(".tut-spot") as HTMLDivElement;
    this.cutout = this.root.querySelector(".tut-cutout") as unknown as SVGSVGElement;
    this.cutoutFill = this.root.querySelector(
      ".tut-cutout-fill"
    ) as unknown as SVGPathElement;
    this.ringA = this.root.querySelector(
      '.tut-ring[data-ring="a"]'
    ) as unknown as SVGRectElement;
    this.ringB = this.root.querySelector(
      '.tut-ring[data-ring="b"]'
    ) as unknown as SVGRectElement;
    this.bubble = this.root.querySelector(".tut-bubble") as HTMLDivElement;
    this.textEl = this.bubble.querySelector(".tut-text") as HTMLDivElement;
    this.actionsEl = this.bubble.querySelector(".tut-actions") as HTMLDivElement;
    this.arrow = this.bubble.querySelector(".tut-arrow") as HTMLDivElement;

    // Advance when the bubble button (or skip link) is tapped.
    this.actionsEl.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest(".tut-btn") || t.closest(".tut-skip")) this.advance();
    });

    // Detect merges / order fulfilments straight from the shared board model,
    // and pole-upgrade purchases / carnival placements from their models.
    this.merge.onChange(() => this.onMergeChange());
    this.upgrades.onChange(() => this.onUpgradeChange());
    this.carnival.onChange(() => this.onCarnivalChange());

    if (!localStorage.getItem(DONE_KEY)) this.start();
  }

  private buildSteps(): TutStep[] {
    const byId = (id: string) => () => document.getElementById(id);
    return [
      {
        id: "welcome",
        screen: "pond",
        dimCenter: true,
        nav: [],
        text: "Welcome to Quackpot! Let's learn the ropes in a few quick steps.",
        button: "Let's go!",
      },
      {
        id: "cast",
        screen: "pond",
        nav: [],
        auto: "catch",
        text: "Drag down anywhere and release to cast your line. Catch a duck!",
      },
      {
        id: "basket",
        screen: "pond",
        target: byId("basket-btn"),
        nav: ["merge"],
        auto: "openMerge",
        text: "Nice catch! Your ducks pile up in the basket. Tap it to open your collection.",
      },
      {
        id: "merge",
        screen: "merge",
        target: byId("merge-grid"),
        nav: [],
        auto: "merge",
        text: "Drag the two pink ducks together to merge them into a level 2 pink duck. Try it!",
      },
      {
        id: "orders",
        screen: "merge",
        // Spotlight the order card, and sit the bubble to its right so it never
        // covers the grid below.
        target: () =>
          document.querySelector(
            "#merge-orders .order-card"
          ) as HTMLElement | null,
        // Also spotlight the merged (level 2) duck the player needs to drag: the
        // first grid cell that carries a level pip.
        target2: () => {
          const cells = document.querySelectorAll("#merge-grid .cell");
          for (const c of cells) {
            if (c.querySelector(".lvl")) return c as HTMLElement;
          }
          return null;
        },
        side: true,
        nav: [],
        auto: "fulfill",
        text: "This customer wants a level 2 pink duck! Drag your merged duck onto their order to earn hearts.",
      },
      {
        id: "back",
        screen: "merge",
        target: byId("pond-btn"),
        nav: ["pond"],
        auto: "back",
        text: "Hearts are your currency. Tap the pond button up here to head back.",
      },
      {
        id: "upgrades",
        screen: "pond",
        target: byId("upgrade-toolbar"),
        nav: [],
        auto: "openUpgrades",
        text: "Open the Pole Lab to unlock a powerful attachment.",
      },
      {
        id: "unlock-automatic",
        screen: "pond",
        target: () =>
          document.querySelector('[data-unlock="automatic"]') as HTMLElement | null,
        nav: [],
        auto: "unlockAutomatic",
        text: "Unlock the Automatic attachment to supercharge your casts.",
      },
      {
        id: "teach-automatic",
        screen: "pond",
        dimCenter: true,
        nav: [],
        button: "Got it",
        text: "Nice! Automatic casts your line for you over and over — no dragging needed. Tap it in the ring under your fisher to switch it on for a while; then it needs a moment to cool down before you can use it again.",
      },
      {
        id: "carnival",
        screen: "pond",
        target: byId("carnival-btn"),
        nav: ["carnival"],
        auto: "openCarnival",
        text: "Now tap the tent to open your carnival grounds.",
      },
      {
        id: "carnival-build",
        screen: "carnival",
        target: byId("carnival-menu"),
        nav: [],
        auto: "placeBuilding",
        text: "Drag the Ring Toss from the menu onto the field to build your first attraction.",
      },
      {
        id: "carnival-earn",
        screen: "carnival",
        // Spotlight the placed building; tapping it opens the upgrade popup.
        target: () =>
          document.querySelector(
            "#carnival-buildings .cbuild"
          ) as HTMLElement | null,
        nav: [],
        auto: "upgradeBuilding",
        button: "Got it",
        text: "Attractions earn hearts over time — even while you're off fishing! Tap your Ring Toss and upgrade it to earn faster.",
      },
      {
        id: "carnival-happiness",
        screen: "carnival",
        target: byId("happy-wrap"),
        nav: [],
        text: "This is your carnival's happiness. The higher it is, the bigger the × multiplier on all the hearts you earn. It slowly drifts down over time, so keep it up!",
        button: "Got it",
      },
      {
        id: "carnival-events",
        screen: "carnival",
        target: byId("carnival-events-btn"),
        nav: [],
        auto: "openEvents",
        text: "Throw a special event to boost happiness fast. Tap Events to see what's on offer.",
      },
      {
        id: "carnival-buy-event",
        screen: "carnival",
        // Highlight the Free Cotton Candy row inside the open events panel.
        target: () =>
          document.querySelector(
            '#carnival-events-panel [data-event="cotton-candy"]'
          ) as HTMLElement | null,
        nav: [],
        auto: "buyEvent",
        text: "Buy the Free Cotton Candy — watch the happiness bar jump!",
      },
      {
        id: "done",
        dimCenter: true,
        nav: [],
        text: "That's everything — go catch some ducks and grow your carnival. Have fun!",
        button: "Finish",
      },
    ];
  }

  // ---- Public control ----
  start() {
    this.active = true;
    this.index = 0;
    // Fund the walkthrough so the upgrade + building steps are affordable, and
    // top up (rather than add) so repeated resets don't stack hearts endlessly.
    if (this.merge.hearts < START_HEARTS)
      this.merge.addHearts(START_HEARTS - this.merge.hearts);
    // Prepopulate a customer order for the exact duck the player will merge, so
    // the fulfil lesson always has a matching request waiting.
    this.merge.setOrder(0, PINK_DUCK, 2);
    this.enterStep();
  }

  reset() {
    localStorage.removeItem(DONE_KEY);
    this.start();
  }

  // Clear the "tutorial completed" flag without restarting mid-session. The dev
  // "Reset All" button calls this and then reloads, so the freshly-constructed
  // game (all state is in-memory) starts over with the walkthrough from step 0.
  clearDoneFlag() {
    localStorage.removeItem(DONE_KEY);
  }

  skip() {
    this.finish();
  }

  private finish() {
    this.active = false;
    this.root.classList.add("hidden");
    localStorage.setItem(DONE_KEY, "1");
    // Restore normal (unrestricted) nav now that the walkthrough is over.
    this.navRefresh?.();
  }

  // Which nav-button screens are allowed right now. null once the tutorial is
  // done (unrestricted); otherwise the current step's whitelist (default none).
  allowedNav(): Screen[] | null {
    return this.active ? this.step.nav ?? [] : null;
  }

  // Whether the walkthrough is currently running (used to suppress the standalone
  // attachment-unlock explainer, since the tutorial teaches it itself).
  isActive(): boolean {
    return this.active;
  }

  private advance() {
    if (!this.active) return;
    this.index++;
    if (this.index >= this.steps.length) {
      this.finish();
      return;
    }
    this.enterStep();
  }

  private get step(): TutStep {
    return this.steps[this.index];
  }

  // Render the current step's bubble content and capture action baselines.
  private enterStep() {
    const s = this.step;

    // The merge step tells the player to merge two same-color ducks, but a fresh
    // catch is random — there's no guarantee they hold a matching pair. Seed two
    // pink ducks so the lesson always has something to merge.
    if (s.id === "merge") this.seedMergePair();

    this.mergeBaseline = this.countMerged();
    this.heartBaseline = this.merge.hearts;
    this.upgradeBaseline = this.upgradeUnlockCount();
    this.carnivalBaseline = this.carnival.placed.length;
    this.carnivalLevelBaseline = this.carnivalLevelSum();
    this.eventsBaseline = this.carnival.eventsBought;

    this.textEl.textContent = s.text;
    const stepNum = `${this.index + 1}/${this.steps.length}`;
    const btn = s.button
      ? `<button class="tut-btn">${s.button}</button>`
      : `<button class="tut-skip">Skip</button>`;
    this.actionsEl.innerHTML = `<span class="tut-step">${stepNum}</span>${btn}`;

    // Apply this step's nav gate (hide buttons that would let the player skip).
    this.navRefresh?.();
  }

  // ---- Notifications from main.ts ----
  notifyCatch() {
    if (this.active && this.step.auto === "catch") this.advance();
  }
  notifyOpenMerge() {
    this.screen = "merge";
    if (this.active && this.step.auto === "openMerge") this.advance();
  }
  notifyCloseMerge() {
    this.screen = "pond";
    if (this.active && this.step.auto === "back") this.advance();
  }
  notifyOpenCarnival() {
    this.screen = "carnival";
    if (this.active && this.step.auto === "openCarnival") this.advance();
  }
  notifyCloseCarnival() {
    this.screen = "pond";
  }

  private onMergeChange() {
    if (!this.active) return;
    if (this.step.auto === "merge" && this.countMerged() > this.mergeBaseline) {
      this.advance();
    } else if (
      this.step.auto === "fulfill" &&
      this.merge.hearts > this.heartBaseline
    ) {
      this.advance();
    }
  }

  private onUpgradeChange() {
    if (!this.active) return;
    const a = this.step.auto;
    if (a === "buyUpgrade" && this.upgradeUnlockCount() > this.upgradeBaseline) {
      this.advance();
    } else if (a === "unlockAutomatic" && this.upgrades.isUnlocked("automatic")) {
      this.advance();
    }
  }

  private onCarnivalChange() {
    if (!this.active) return;
    const a = this.step.auto;
    if (a === "placeBuilding" && this.carnival.placed.length > this.carnivalBaseline) {
      this.advance();
    } else if (
      a === "upgradeBuilding" &&
      this.carnivalLevelSum() > this.carnivalLevelBaseline
    ) {
      this.advance();
    } else if (a === "buyEvent" && this.carnival.eventsBought > this.eventsBaseline) {
      this.advance();
    }
  }

  // Sum of all placed-building levels; a rise means the player upgraded one.
  private carnivalLevelSum(): number {
    let n = 0;
    for (const pb of this.carnival.placed) n += pb.level;
    return n;
  }

  // Number of pole attachments unlocked; buying the first upgrade = unlocking
  // an attachment, so a rise here means the player made their first purchase.
  private upgradeUnlockCount(): number {
    let n = 0;
    for (const a of ATTACHMENTS) if (this.upgrades.isUnlocked(a)) n++;
    return n;
  }

  // Ensure the board holds two level-1 pink ducks so the merge lesson is always
  // doable; skip any already present.
  private seedMergePair() {
    let have = 0;
    for (const c of this.merge.cells)
      if (c && c.colorIndex === PINK_DUCK && c.level === 1) have++;
    for (let i = have; i < 2; i++) this.merge.addDuck(PINK_DUCK);
  }

  // Number of board cells at level >= 2 (i.e. the product of a merge).
  private countMerged(): number {
    let n = 0;
    for (const c of this.merge.cells) if (c && c.level >= 2) n++;
    return n;
  }

  // ---- System: position the overlay each frame ----
  update() {
    if (!this.active) {
      if (!this.root.classList.contains("hidden"))
        this.root.classList.add("hidden");
      return;
    }

    const s = this.step;

    // The "open the Pole Lab" step advances the moment its panel appears.
    if (s.auto === "openUpgrades") {
      const panel = document.getElementById("upgrade-panel");
      if (panel && !panel.classList.contains("hidden")) {
        this.advance();
        return;
      }
    }

    // The "tap Events" step advances the moment the events panel opens.
    if (s.auto === "openEvents") {
      const panel = document.getElementById("carnival-events-panel");
      if (panel && !panel.classList.contains("hidden")) {
        this.advance();
        return;
      }
    }

    // Hide while the player is on a screen this step doesn't belong to.
    if (s.screen && s.screen !== this.screen) {
      this.root.classList.add("hidden");
      return;
    }
    this.root.classList.remove("hidden");

    const parentRect = this.root.getBoundingClientRect();
    const targetRect = rectOf(s.target?.() ?? null);
    const target2Rect = rectOf(s.target2?.() ?? null);

    if (targetRect && target2Rect) {
      this.layoutDualSpotlight(parentRect, targetRect, target2Rect);
    } else if (targetRect) {
      this.layoutSpotlight(parentRect, targetRect, !!s.side);
    } else if (s.dimCenter) {
      this.layoutCentered(parentRect, true);
    } else {
      this.layoutCentered(parentRect, false);
    }
  }

  // Spotlight the target and anchor the bubble beside/above/below it.
  private layoutSpotlight(parentRect: DOMRect, r: DOMRect, side: boolean) {
    this.dim.style.display = "none";
    this.cutout.style.display = "none";
    this.spot.style.display = "block";

    const pad = 8;
    const x = r.left - parentRect.left - pad;
    const y = r.top - parentRect.top - pad;
    const w = r.width + pad * 2;
    const h = r.height + pad * 2;
    this.spot.style.left = `${x}px`;
    this.spot.style.top = `${y}px`;
    this.spot.style.width = `${w}px`;
    this.spot.style.height = `${h}px`;

    this.bubble.style.display = "block";
    this.arrow.style.display = "block";
    const bw = this.bubble.offsetWidth;
    const bh = this.bubble.offsetHeight;

    if (side) {
      // Sit the bubble to the right of the spotlight, vertically centered, so it
      // leaves the area below the target (the grid) completely clear.
      this.bubble.classList.remove("below", "above");
      this.bubble.classList.add("beside");
      let bx = x + w + 12;
      bx = Math.max(8, Math.min(bx, parentRect.width - bw - 8));
      const targetCenterY = y + h / 2;
      let by = targetCenterY - bh / 2;
      by = Math.max(8, Math.min(by, parentRect.height - bh - 8));
      this.bubble.style.left = `${bx}px`;
      this.bubble.style.top = `${by}px`;
      // Point the arrow left, at the target's vertical centre.
      let ay = targetCenterY - by;
      ay = Math.max(14, Math.min(ay, bh - 14));
      this.arrow.style.left = "";
      this.arrow.style.top = `${ay - 9}px`;
      return;
    }

    // Decide whether the bubble sits below or above the highlighted control.
    const targetCenterY = y + h / 2;
    const below = targetCenterY < parentRect.height / 2;
    this.bubble.classList.remove("beside");
    this.bubble.classList.toggle("below", below);
    this.bubble.classList.toggle("above", !below);

    const targetCenterX = x + w / 2;
    let bx = targetCenterX - bw / 2;
    bx = Math.max(8, Math.min(bx, parentRect.width - bw - 8));
    const by = below ? y + h + 12 : y - bh - 12;

    this.bubble.style.left = `${bx}px`;
    this.bubble.style.top = `${Math.max(8, by)}px`;

    // Point the arrow at the target's horizontal centre.
    let ax = targetCenterX - bx;
    ax = Math.max(14, Math.min(ax, bw - 14));
    this.arrow.style.top = "";
    this.arrow.style.left = `${ax - 9}px`;
  }

  // Spotlight two targets at once (order card + merged duck). A single evenodd
  // path dims everything but the two holes; a stroked rect rings each. The bubble
  // sits to the right of the primary target (the order card).
  private layoutDualSpotlight(parentRect: DOMRect, a: DOMRect, b: DOMRect) {
    this.dim.style.display = "none";
    this.spot.style.display = "none";
    this.cutout.style.display = "block";

    const pad = 8;
    const rad = 14;
    const ha = padded(parentRect, a, pad);
    const hb = padded(parentRect, b, pad);
    const W = parentRect.width;
    const H = parentRect.height;

    // Outer rect (full overlay) + two rounded holes; evenodd punches the holes.
    const d =
      `M0 0 H${W} V${H} H0 Z ` +
      roundRectPath(ha.x, ha.y, ha.w, ha.h, rad) +
      " " +
      roundRectPath(hb.x, hb.y, hb.w, hb.h, rad);
    this.cutoutFill.setAttribute("d", d);

    setRing(this.ringA, ha, rad);
    setRing(this.ringB, hb, rad);

    // Bubble beside the primary target (order card), vertically centered.
    this.bubble.style.display = "block";
    this.arrow.style.display = "block";
    const bw = this.bubble.offsetWidth;
    const bh = this.bubble.offsetHeight;
    this.bubble.classList.remove("below", "above");
    this.bubble.classList.add("beside");
    let bx = ha.x + ha.w + 12;
    bx = Math.max(8, Math.min(bx, parentRect.width - bw - 8));
    const targetCenterY = ha.y + ha.h / 2;
    let by = targetCenterY - bh / 2;
    by = Math.max(8, Math.min(by, parentRect.height - bh - 8));
    this.bubble.style.left = `${bx}px`;
    this.bubble.style.top = `${by}px`;
    let ay = targetCenterY - by;
    ay = Math.max(14, Math.min(ay, bh - 14));
    this.arrow.style.left = "";
    this.arrow.style.top = `${ay - 9}px`;
  }

  // Centered info card, optionally over a full-screen dim.
  private layoutCentered(parentRect: DOMRect, dim: boolean) {
    this.spot.style.display = "none";
    this.cutout.style.display = "none";
    this.dim.style.display = dim ? "block" : "none";
    this.arrow.style.display = "none";

    this.bubble.classList.remove("below", "above");
    this.bubble.style.display = "block";
    const bw = this.bubble.offsetWidth;
    const bh = this.bubble.offsetHeight;
    // Welcome/finish sit dead-centre; a non-dim floating hint sits lower so it
    // doesn't cover the pond the player needs to interact with.
    const cy = dim ? parentRect.height / 2 : parentRect.height * 0.62;
    this.bubble.style.left = `${parentRect.width / 2 - bw / 2}px`;
    this.bubble.style.top = `${cy - bh / 2}px`;
  }

  // ---- Debug snapshot ----
  snapshot() {
    return {
      active: this.active,
      index: this.index,
      step: this.active ? this.step.id : null,
      screen: this.screen,
    };
  }
}

// Viewport rect of a laid-out element, or null if it's not currently rendered.
function rectOf(el: HTMLElement | null): DOMRect | null {
  return el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
}

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A padded hole for `r`, expressed in the overlay's local coordinate space.
function padded(parentRect: DOMRect, r: DOMRect, pad: number): Hole {
  return {
    x: r.left - parentRect.left - pad,
    y: r.top - parentRect.top - pad,
    w: r.width + pad * 2,
    h: r.height + pad * 2,
  };
}

// SVG path subpath for a rounded rectangle.
function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return (
    `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} ` +
    `A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

function setRing(ring: SVGRectElement, hole: Hole, rad: number): void {
  ring.setAttribute("x", String(hole.x));
  ring.setAttribute("y", String(hole.y));
  ring.setAttribute("width", String(hole.w));
  ring.setAttribute("height", String(hole.h));
  ring.setAttribute("rx", String(Math.min(rad, hole.w / 2, hole.h / 2)));
}
