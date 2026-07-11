import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  DirectionalLight,
  AmbientLight,
  Vector3,
  PCFSoftShadowMap,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
} from "three";
import { CONFIG } from "./config";
import { createPool } from "./scene/pool";
import { createBackground } from "./scene/background";
import { createWater } from "./scene/water";
import { createBlackHole } from "./scene/blackhole";
import { createWaterfall } from "./scene/waterfall";
import { createDuckManager } from "./ducks/DuckManager";
import { createCharacter } from "./scene/character";
import { createBasket } from "./scene/basket";
import { createCastController } from "./fishing/CastController";
import { MergeState } from "./merge/MergeState";
import { MergeLayer } from "./merge/MergeLayer";
import { buildDuckSVG, buildChildSVG, heartSVG } from "./merge/icons";
import { UpgradeState, ATTACHMENTS, TRACKS } from "./upgrades/UpgradeState";
import { UpgradeLayer } from "./upgrades/UpgradeLayer";
import { CarnivalState } from "./carnival/CarnivalState";
import { CarnivalLayer } from "./carnival/CarnivalLayer";
import { tentSVG, pondSVG } from "./carnival/icons";
import { TutorialController } from "./tutorial/TutorialController";

const container = document.getElementById("game") as HTMLDivElement;

const renderer = new WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new Scene();

// ---- Isometric orthographic camera ----
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(...CONFIG.camera.position);
camera.lookAt(new Vector3(...CONFIG.camera.lookAt));

// ---- Lights ----
const ambient = new AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const sun = new DirectionalLight(0xfff2d8, 1.1);
sun.position.set(6, 14, 8);
scene.add(sun);

// ---- Background gradient (screen-space) ----
scene.add(createBackground());

// ---- Ground ----
const ground = new Mesh(
  new PlaneGeometry(80, 80),
  new MeshStandardMaterial({ color: CONFIG.colors.ground, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.15;
scene.add(ground);

// ---- Pool ----
scene.add(createPool());

// ---- Resize handling: keep the ortho frustum matching the portrait frame ----
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);

  const aspect = w / h;
  const viewH = CONFIG.camera.viewHeight;
  const viewW = viewH * aspect;
  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---- Systems that update each frame ----
export interface System {
  update(dt: number, elapsed: number): void;
}
const systems: System[] = [];
export function addSystem(s: System) {
  systems.push(s);
}

// ---- Water, black hole, waterfall ----
const water = createWater();
scene.add(water.mesh);
addSystem(water.system);

const blackHole = createBlackHole();
scene.add(blackHole.group);
addSystem(blackHole.system);

const waterfall = createWaterfall();
scene.add(waterfall.group);
addSystem(waterfall.system);

// ---- Ducks ----
const ducks = createDuckManager(scene);
addSystem(ducks);

// ---- Character + basket ----
const character = createCharacter();
scene.add(character.group);
const basket = createBasket();
scene.add(basket.group);

// ---- Merge layer (second screen) ----
const mergeState = new MergeState();

const mergeLayer = new MergeLayer(container, mergeState);

// ---- Pole upgrades (test-tube skill tree) ----
const upgradeState = new UpgradeState(mergeState);
addSystem(upgradeState);
const upgradeLayer = new UpgradeLayer(container, upgradeState, mergeState);
addSystem(upgradeLayer);

// ---- Carnival building layer (passive-heart economy) ----
const carnivalState = new CarnivalState(mergeState);
addSystem(carnivalState);
const carnivalLayer = new CarnivalLayer(container, carnivalState, mergeState);
addSystem(carnivalLayer);

// ---- Interactive first-play tutorial (overlay on top of everything) ----
const tutorial = new TutorialController(
  container,
  mergeState,
  upgradeState,
  carnivalState
);
addSystem(tutorial);

// Persistent cross-layer navigation cluster, pinned to the upper-right corner on
// every screen. It shows the two buttons that jump to the layers you're NOT on:
// pond -> Basket + Carnival; merge -> Pond + Carnival; carnival -> Pond + Basket.
const navCluster = document.createElement("div");
navCluster.id = "nav-cluster";
container.appendChild(navCluster);

// Pond (return to fishing). Hidden while already on the pond.
const pondBtn = document.createElement("button");
pondBtn.id = "pond-btn";
pondBtn.title = "Pond";
pondBtn.innerHTML = `<span class="nico">${pondSVG()}</span>`;
navCluster.appendChild(pondBtn);
pondBtn.addEventListener("click", () => goPond());

// Basket (opens the merge layer) with a live catch count.
const basketBtn = document.createElement("button");
basketBtn.id = "basket-btn";
basketBtn.title = "Basket";
basketBtn.innerHTML = `
  <span class="nico">${buildDuckSVG(0, 1)}</span>
  <span id="basket-count" class="bcount">0</span>
`;
navCluster.appendChild(basketBtn);
basketBtn.addEventListener("click", () => openMerge());

// Carnival tent.
const carnivalBtn = document.createElement("button");
carnivalBtn.id = "carnival-btn";
carnivalBtn.title = "Carnival";
carnivalBtn.innerHTML = `<span class="nico">${tentSVG()}</span>`;
navCluster.appendChild(carnivalBtn);
carnivalBtn.addEventListener("click", () => openCarnival());

// Taps on the nav buttons must never reach the pond canvas and start a cast.
for (const b of [pondBtn, basketBtn, carnivalBtn])
  b.addEventListener("pointerdown", (e) => e.stopPropagation());

// "Basket full!" popup shown on the fishing layer when the grid fills up.
const fullPopup = document.createElement("div");
fullPopup.id = "basket-full-popup";
fullPopup.innerHTML = `<div class="arrow">▲</div><div class="bubble">Basket full!<br/>Merge to continue</div>`;
fullPopup.style.display = "none";
container.appendChild(fullPopup);

// Orders strip on the fishing layer, in the space beneath the fisherman. Mirrors
// the merge-layer orders so the player can see what's wanted while fishing.
const fishingOrders = document.createElement("div");
fishingOrders.id = "fishing-orders";
container.appendChild(fishingOrders);

function renderFishingOrders() {
  fishingOrders.innerHTML =
    `<div class="fo-title">Orders</div>` +
    `<div class="fo-row">` +
    mergeState.orders
      .map(
        (o) => `
        <div class="fo-card">
          <div class="fo-npc">${buildChildSVG(o.npc)}</div>
          <div class="fo-want">
            ${buildDuckSVG(o.colorIndex, o.level)}
            <span class="fo-badge">L${o.level}</span>
          </div>
          <div class="fo-reward"><span class="ico">${heartSVG()}</span>${o.reward}</div>
        </div>`
      )
      .join("") +
    `</div>`;
}
mergeState.onChange(renderFishingOrders);
renderFishingOrders();

injectMergeUiStyles();

// ---- Dev console (debug-only quick actions) ----
const devConsole = document.createElement("div");
devConsole.id = "dev-console";
devConsole.innerHTML = `
  <div class="dc-title">DEV</div>
  <button class="dc-btn" id="dev-add-hearts">+100 ${heartSVG()}</button>
  <button class="dc-btn" id="dev-reset-cd">Reset CDs</button>
  <button class="dc-btn dc-danger" id="dev-reset-all">Reset All</button>
`;
container.appendChild(devConsole);
(devConsole.querySelector("#dev-add-hearts") as HTMLButtonElement).addEventListener(
  "click",
  () => {
    mergeState.addHearts(100);
    updateBasketBadge();
  }
);
(devConsole.querySelector("#dev-reset-cd") as HTMLButtonElement).addEventListener(
  "click",
  () => upgradeState.resetCooldowns()
);
// Wipe all progress: clear the persisted tutorial flag and reload. Every state
// model (hearts, grid, upgrades, carnival) is in-memory, so a fresh load starts
// the game — and the tutorial — over from scratch.
(devConsole.querySelector("#dev-reset-all") as HTMLButtonElement).addEventListener(
  "click",
  () => {
    tutorial.clearDoneFlag();
    location.reload();
  }
);

// Upper-left toggle so the dev console doesn't permanently block the top of the
// screen. Stays put across every screen (sits above all layers). Console starts
// hidden; the button shows/hides it.
devConsole.style.display = "none";
const devToggle = document.createElement("button");
devToggle.id = "dev-toggle";
devToggle.title = "Toggle dev console";
devToggle.textContent = "DEV";
container.appendChild(devToggle);
devToggle.addEventListener("pointerdown", (e) => e.stopPropagation());
devToggle.addEventListener("click", () => {
  const show = devConsole.style.display === "none";
  devConsole.style.display = show ? "flex" : "none";
  devToggle.classList.toggle("on", show);
});

injectDevConsoleStyles();

function updateBasketBadge() {
  const countEl = document.getElementById("basket-count");
  if (countEl) countEl.textContent = String(mergeState.filled);
}

function mergeSnapshot() {
  return {
    open: mergeLayer.isOpen,
    filled: mergeState.filled,
    full: mergeState.isFull(),
    hearts: mergeState.hearts,
    orders: mergeState.orders.map((o) => ({
      color: o.colorIndex,
      level: o.level,
      reward: o.reward,
    })),
    cells: mergeState.cells.map((c) =>
      c ? { color: c.colorIndex, level: c.level } : null
    ),
    storage: {
      unlocked: mergeState.storageUnlocked,
      capacity: mergeState.storageCapacity,
      filled: mergeState.storageFilled,
      nextSlotCost: mergeState.storageUnlocked
        ? mergeState.nextStorageSlotCost()
        : null,
      slots: mergeState.storage.map((c) =>
        c ? { color: c.colorIndex, level: c.level } : null
      ),
    },
  };
}

// The three screens share one persistent nav cluster; each transition closes the
// layer we're leaving, opens the one we're entering, and updates which two nav
// buttons show (you never see a button to the screen you're already on).
type Screen = "pond" | "merge" | "carnival";
let currentScreen: Screen = "pond";

function refreshNav() {
  // During the tutorial, each step whitelists which screens the player may jump
  // to (allowedNav returns null once the tutorial is done -> unrestricted). This
  // keeps the walkthrough linear: e.g. the tent stays hidden until the upgrade
  // step is actually completed, so buying an upgrade can't be skipped.
  const allow = tutorial.allowedNav();
  const ok = (s: Screen) => allow === null || allow.includes(s);
  pondBtn.style.display =
    currentScreen !== "pond" && ok("pond") ? "flex" : "none";
  basketBtn.style.display =
    currentScreen !== "merge" && ok("merge") ? "flex" : "none";
  carnivalBtn.style.display =
    currentScreen !== "carnival" && ok("carnival") ? "flex" : "none";
}

function openMerge() {
  if (currentScreen === "merge") return;
  if (currentScreen === "carnival") {
    carnivalLayer.close();
    tutorial.notifyCloseCarnival();
  }
  mergeLayer.open();
  currentScreen = "merge";
  fullPopup.style.display = "none";
  fishingOrders.style.display = "none";
  upgradeLayer.hide();
  refreshNav();
  tutorial.notifyOpenMerge();
}
function closeMerge() {
  if (currentScreen !== "merge") return;
  mergeLayer.close();
  currentScreen = "pond";
  fishingOrders.style.display = "";
  upgradeLayer.show();
  refreshNav();
  tutorial.notifyCloseMerge();
}

function openCarnival() {
  if (currentScreen === "carnival") return;
  if (currentScreen === "merge") {
    mergeLayer.close();
    tutorial.notifyCloseMerge();
  }
  carnivalLayer.open();
  currentScreen = "carnival";
  fullPopup.style.display = "none";
  fishingOrders.style.display = "none";
  upgradeLayer.hide();
  refreshNav();
  tutorial.notifyOpenCarnival();
}
function closeCarnival() {
  if (currentScreen !== "carnival") return;
  carnivalLayer.close();
  currentScreen = "pond";
  fishingOrders.style.display = "";
  upgradeLayer.show();
  refreshNav();
  tutorial.notifyCloseCarnival();
}

// The pond nav button: return to fishing from whichever layer is open.
function goPond() {
  if (currentScreen === "merge") closeMerge();
  else if (currentScreen === "carnival") closeCarnival();
}

// Let the tutorial re-apply its per-step nav gate whenever it changes steps.
// (Wired here, after refreshNav + the nav buttons exist; the controller's own
// constructor kicks off step 0, and this initial refreshNav applies its gate.)
tutorial.navRefresh = refreshNav;

// While the walkthrough runs it teaches each attachment itself, so suppress the
// standalone unlock explainer to avoid a double-explanation.
upgradeLayer.suppressExplain = () => tutorial.isActive();

// Start on the pond: show Basket + Carnival, hide the Pond button.
refreshNav();

// A caught duck lands in the basket -> place it on the merge grid. Returns
// whether it was accepted; if not (grid + storage both full) the cast controller
// bounces the duck off the basket and off the screen.
function onCollect(colorIndex: number): boolean {
  const ok = mergeState.addDuck(colorIndex);
  updateBasketBadge();
  if (!ok && !mergeLayer.isOpen) {
    fullPopup.style.display = "block";
  }
  tutorial.notifyCatch();
  return ok;
}

// ---- Casting ----
const cast = createCastController({
  canvas: renderer.domElement,
  scene,
  camera,
  character,
  ducks,
  basketDrop: basket.dropPoint,
  basketObject: basket.group,
  scoreEl: document.getElementById("score"),
  onCollect,
  onOpenMerge: () => openMerge(),
  upgrades: upgradeState,
});
addSystem(cast);

export {
  ducks,
  character,
  basket,
  cast,
  mergeState,
  mergeLayer,
  upgradeState,
  carnivalState,
  carnivalLayer,
  tutorial,
};

// CSS for the fishing-layer basket button + basket-full popup.
function injectMergeUiStyles() {
  if (document.getElementById("merge-ui-style")) return;
  const st = document.createElement("style");
  st.id = "merge-ui-style";
  st.textContent = `
    /* Persistent cross-layer nav cluster, upper-right on every screen. Sits above
       the layers (z 20) but below the tutorial (z 50) and dev console. */
    #nav-cluster {
      position: absolute; z-index: 30;
      top: calc(env(safe-area-inset-top, 12px) + 8px); right: 10px;
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
    }
    #nav-cluster button {
      position: relative; padding: 0;
      width: 52px; height: 52px; border-radius: 15px;
      border: 3px solid #ffd23f; cursor: pointer;
      background: rgba(20,30,55,0.82);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.45);
    }
    #nav-cluster button:active { transform: translateY(2px); }
    #nav-cluster .nico { width: 40px; height: 40px; pointer-events: none; display: block; }
    #pond-btn { border-color: #4ecdc4; }
    #carnival-btn { border-color: #ff8fa3; }
    #basket-btn .bcount {
      position: absolute; top: -8px; right: -8px;
      min-width: 20px; height: 20px; padding: 0 5px;
      background: #ff4d6d; color: #fff; font-weight: 800; font-size: 12px;
      border-radius: 999px; border: 2px solid #14213d;
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    /* "Basket full!" hint drops down from under the relocated basket button. */
    #basket-full-popup {
      position: absolute; z-index: 16;
      right: 12px; top: calc(env(safe-area-inset-top, 12px) + 8px + 52px + 2px);
      display: flex; flex-direction: column; align-items: flex-end;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: none;
    }
    #basket-full-popup .bubble {
      background: #ffd23f; color: #3a2a00; font-weight: 800;
      font-size: 14px; text-align: center; line-height: 1.25;
      border-radius: 12px; padding: 8px 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    }
    #basket-full-popup .arrow {
      color: #ffd23f; font-size: 18px; margin-right: 16px; margin-bottom: -2px;
    }
    /* Orders strip beneath the fisherman on the fishing layer. */
    #fishing-orders {
      position: absolute; z-index: 12;
      left: 8px; right: 8px;
      bottom: calc(env(safe-area-inset-bottom, 12px) + 12px);
      pointer-events: none;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #fishing-orders .fo-title {
      color: #ffd23f; font-weight: 800; font-size: 12px;
      letter-spacing: 0.06em; text-transform: uppercase;
      margin: 0 0 4px 4px; text-shadow: 0 2px 4px rgba(0,0,0,0.6);
    }
    #fishing-orders .fo-row {
      display: flex; gap: 6px; justify-content: flex-start;
    }
    #fishing-orders .fo-card {
      flex: 1 1 0; min-width: 0; max-width: 92px;
      background: rgba(12,20,40,0.7);
      border: 2px solid rgba(255,255,255,0.16);
      border-radius: 12px; padding: 4px;
      display: flex; flex-direction: column; align-items: center; gap: 1px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.4);
    }
    #fishing-orders .fo-npc { width: 30px; height: 30px; }
    #fishing-orders .fo-want {
      position: relative; width: 42px; height: 42px;
      background: rgba(0,0,0,0.25); border-radius: 9px;
    }
    #fishing-orders .fo-badge {
      position: absolute; right: -3px; bottom: -3px;
      background: #ffd23f; color: #3a2a00; font-weight: 800;
      font-size: 10px; border-radius: 999px; padding: 0 5px;
      border: 2px solid #0c1428;
    }
    #fishing-orders .fo-reward {
      display: flex; align-items: center; gap: 3px;
      color: #fff; font-size: 11px; font-weight: 700;
    }
    #fishing-orders .fo-reward .ico { width: 13px; height: 13px; }
  `;
  document.head.appendChild(st);
}

// CSS for the dev console (top-center quick-action panel).
function injectDevConsoleStyles() {
  if (document.getElementById("dev-console-style")) return;
  const st = document.createElement("style");
  st.id = "dev-console-style";
  st.textContent = `
    #dev-console {
      position: absolute; z-index: 60;
      top: calc(env(safe-area-inset-top, 8px) + 8px); left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 8px;
      background: rgba(8,12,24,0.82);
      border: 2px solid #ff5d73; border-radius: 12px;
      padding: 5px 8px;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 10px rgba(0,0,0,0.45);
    }
    #dev-console .dc-title {
      color: #ff5d73; font-weight: 800; font-size: 11px;
      letter-spacing: 0.1em;
    }
    #dev-console .dc-btn {
      display: inline-flex; align-items: center; gap: 4px;
      border: none; cursor: pointer;
      background: #ff5d73; color: #fff; font-weight: 800; font-size: 13px;
      border-radius: 8px; padding: 6px 10px; box-shadow: 0 2px 0 #b53145;
      font-family: inherit;
    }
    #dev-console .dc-btn:active { transform: translateY(2px); box-shadow: 0 0 0 #b53145; }
    #dev-console .dc-btn svg { width: 15px; height: 15px; }
    /* Destructive action stands apart from the pink utility buttons. */
    #dev-console .dc-btn.dc-danger { background: #7a2130; box-shadow: 0 2px 0 #3d0f18; }
    #dev-console .dc-btn.dc-danger:active { box-shadow: 0 0 0 #3d0f18; }

    #dev-toggle {
      position: absolute; z-index: 61;
      top: calc(env(safe-area-inset-top, 8px) + 8px); left: 8px;
      border: 2px solid #ff5d73; cursor: pointer;
      background: rgba(8,12,24,0.82); color: #ff5d73;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 800; font-size: 11px; letter-spacing: 0.1em;
      border-radius: 10px; padding: 6px 9px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.45);
    }
    #dev-toggle:active { transform: translateY(2px); }
    #dev-toggle.on { background: #ff5d73; color: #fff; }
  `;
  document.head.appendChild(st);
}

// ---- Loop ----
let last = performance.now();
let elapsed = 0;
let frameCount = 0;
function step(dt: number) {
  elapsed += dt;
  frameCount++;
  for (const s of systems) s.update(dt, elapsed);
  renderer.render(scene, camera);
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  step(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for headless verification.
(window as unknown as { __game: unknown }).__game = {
  get frame() {
    return frameCount;
  },
  get duckCount() {
    return ducks.ducks.length;
  },
  get sceneChildren() {
    return scene.children.length;
  },
  // Manually advance the sim (for headless verification when rAF is paused).
  tick(dt = 1 / 60, steps = 1) {
    for (let i = 0; i < steps; i++) step(dt);
    return frameCount;
  },
  get cast() {
    return cast.debug;
  },
  debugCast(dx: number, dy: number) {
    cast.debugCast(dx, dy);
    return cast.debug;
  },
  debugCastAt(x: number, z: number) {
    cast.debugCastAt(x, z);
    return cast.debug;
  },
  debugLandAt(x: number, z: number) {
    cast.debugLandAt(x, z);
    return cast.debug;
  },
  debugAim(dx: number, dy: number) {
    cast.debugAim(dx, dy);
    return cast.debug;
  },
  // NDC (-1..1, y up) screen positions of key points, for headless layout checks.
  get screen() {
    const proj = (v: Vector3) => {
      const p = v.clone().project(camera);
      return { x: +p.x.toFixed(2), y: +p.y.toFixed(2) };
    };
    return {
      player: proj(new Vector3(...CONFIG.player.anchor).setY(1.0)),
      basket: proj(basket.dropPoint.clone()),
      rodTip: proj(character.getRodTipWorld()),
      poolCenter: proj(new Vector3(0, 0, 0)),
      poolFar: proj(new Vector3(0, 0, -CONFIG.pool.depth / 2)),
    };
  },
  get duckStates() {
    return ducks.ducks.map((d) => ({
      state: d.state,
      x: +d.position.x.toFixed(2),
      y: +d.position.y.toFixed(2),
      z: +d.position.z.toFixed(2),
      r: +Math.hypot(d.position.x, d.position.z).toFixed(2),
    }));
  },
  // ---- Merge-layer debug helpers ----
  get merge() {
    return mergeSnapshot();
  },
  openMerge() {
    openMerge();
    return mergeSnapshot();
  },
  closeMerge() {
    closeMerge();
    return mergeSnapshot();
  },
  // Drop a duck of the given color onto the grid (simulates a catch).
  addDuck(colorIndex = 0) {
    onCollect(colorIndex);
    return mergeSnapshot();
  },
  // Merge/move cell `from` onto cell `to`.
  mergeDrop(from: number, to: number) {
    const r = mergeState.drop(from, to);
    updateBasketBadge();
    return r;
  },
  // Fulfil order `idx` with the item at cell `from`.
  fulfill(idx: number, from: number) {
    const ok = mergeState.fulfillWith(idx, from);
    updateBasketBadge();
    return { ok, hearts: mergeState.hearts };
  },
  // ---- Storage debug helpers ----
  grantHearts(n = 100) {
    mergeState.addHearts(n);
    updateBasketBadge();
    return mergeSnapshot();
  },
  storageUnlock() {
    const ok = mergeState.unlockStorage();
    return { ok, storage: mergeSnapshot().storage, hearts: mergeState.hearts };
  },
  storageBuy() {
    const ok = mergeState.buyStorageSlot();
    return { ok, storage: mergeSnapshot().storage, hearts: mergeState.hearts };
  },
  store(from: number) {
    const r = mergeState.storeFromGrid(from);
    updateBasketBadge();
    return { r, storage: mergeSnapshot().storage };
  },
  retrieve(i: number) {
    const r = mergeState.retrieveToGrid(i);
    updateBasketBadge();
    return { r, storage: mergeSnapshot().storage };
  },
  // ---- Upgrade debug helpers ----
  get upg() {
    return upgradeState.snapshot();
  },
  upgAttachments() {
    return ATTACHMENTS.map((a) => ({ att: a, tracks: TRACKS[a] }));
  },
  upgUnlock(att: (typeof ATTACHMENTS)[number]) {
    const ok = upgradeState.unlock(att);
    return { ok, hearts: mergeState.hearts, snapshot: upgradeState.snapshot() };
  },
  upgBuy(att: (typeof ATTACHMENTS)[number], track: string) {
    const cost = upgradeState.upgradeCost(att, track);
    const ok = upgradeState.buyUpgrade(att, track);
    return {
      ok,
      cost,
      level: upgradeState.level(att, track),
      value: upgradeState.trackValue(att, track),
      nextCost: upgradeState.upgradeCost(att, track),
      hearts: mergeState.hearts,
    };
  },
  upgActivate(att: (typeof ATTACHMENTS)[number]) {
    const ok = upgradeState.activate(att);
    return {
      ok,
      active: upgradeState.isActive(att),
      remaining: upgradeState.activeRemaining(att),
    };
  },
  // ---- Carnival debug helpers ----
  get carnival() {
    return carnivalState.snapshot();
  },
  carnivalOpen() {
    openCarnival();
    return carnivalState.snapshot();
  },
  carnivalClose() {
    closeCarnival();
    return carnivalState.snapshot();
  },
  carnivalPlace(defId: string, x = 0.5, y = 0.5) {
    const ok = carnivalState.place(defId, x, y);
    return { ok, snapshot: carnivalState.snapshot() };
  },
  carnivalUpgrade(instanceId: number) {
    const ok = carnivalState.upgrade(instanceId);
    return { ok, snapshot: carnivalState.snapshot() };
  },
  carnivalEvent(eventId: string) {
    const ok = carnivalState.buyEvent(eventId);
    return { ok, snapshot: carnivalState.snapshot() };
  },
  carnivalSetHappiness(n: number) {
    carnivalState.setHappiness(n);
    return carnivalState.snapshot();
  },
  // ---- Tutorial debug helpers ----
  get tutorial() {
    return tutorial.snapshot();
  },
  tutorialReset() {
    tutorial.reset();
    return tutorial.snapshot();
  },
  tutorialSkip() {
    tutorial.skip();
    return tutorial.snapshot();
  },
};

export { scene, camera, renderer, container };
