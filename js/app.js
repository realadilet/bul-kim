// Menu, routing and shared chrome. Routes: "" menu · "#<set>/<item>" viewer · "#game[/<set>]" game.
import * as audio from "./audio.js";
import { makePicture } from "./fx.js";
import { createViewer } from "./viewer.js";
import { createQuiz } from "./quiz.js";

const LIGHT = ["#FFD6A5", "#CAFFBF", "#9BF6FF", "#BDB2FF", "#FFC6FF", "#FDFFB6", "#A0C4FF", "#FFADAD"];
const DARK  = ["#3D2C5E", "#1F4A4F", "#24445E", "#4A2E5C", "#5A2E48", "#4A3D22", "#2A3B6B", "#5A2E2E"];

const $ = (id) => document.getElementById(id);
const darkMq = matchMedia("(prefers-color-scheme: dark)");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const palette = () => (darkMq.matches ? DARK : LIGHT);
const colorFor = (i) => palette()[((i % palette().length) + palette().length) % palette().length];

function setBg(c) {
  document.body.style.setProperty("--bg", c);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", c);
}

let cfg = null;
const sets = {};
let screen = "menu";
let started = false;     // first tap happened (audio unlocked)
let fromMenu = false;    // current route was pushed from the menu (Back returns there)

const viewer = createViewer({
  stage: $("stage"), prev: $("prev"), next: $("next"),
  btnAuto: $("btn-auto"), btnGrid: $("btn-grid"),
  grid: $("grid"), gridList: $("grid-list"), gridClose: $("grid-close"),
  colorFor,
  onChange(set, i) {
    setBg(colorFor(i));
    store.set(`bul-kim:${set.id}`, set.items[i].id);
    history.replaceState(history.state, "", `#${set.id}/${set.items[i].id}`);
  },
});

let quiz = null;

// ---------------------------------------------------------------- screens
function setScreen(name) {
  screen = name;
  document.body.dataset.screen = name;
  for (const s of ["menu", "viewer", "quiz"]) $(s).hidden = s !== name;
}

function itemIndex(set, id) {
  const i = set.items.findIndex((it) => it.id === id);
  return i < 0 ? 0 : i;
}

function route() {
  const [a, b] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (!started || !a) {
    viewer.close();
    quiz?.close();
    setScreen("menu");
    setBg(colorFor(0));
    return;
  }
  if (a === "game") {
    viewer.close();
    setScreen("quiz");
    quiz.open(b && sets[b] ? [sets[b]] : cfg.sets);
    return;
  }
  const set = sets[a];
  if (!set) { history.replaceState(null, "", location.pathname + location.search); route(); return; }
  quiz.close();
  setScreen("viewer");
  viewer.open(set, itemIndex(set, b || store.get(`bul-kim:${set.id}`)));
}
addEventListener("hashchange", route);

function firstTap() {
  audio.unlock();
  if (!started) {
    started = true;
    keepAwake();
    if (fsEnabled && matchMedia("(pointer: coarse)").matches && !isFs()) toggleFs();
  }
}

function enter(hash) {
  firstTap();
  fromMenu = true;
  if (location.hash === hash) route(); else location.hash = hash;
}

function goHome() {
  if (fromMenu) { fromMenu = false; history.back(); return; }
  history.replaceState(null, "", location.pathname + location.search);
  route();
}

// ---------------------------------------------------------------- menu
function buildMenu() {
  const box = $("menu-tiles");
  const tiles = [
    ...cfg.sets.map((s, i) => ({ label: s.kk, item: s.items.find((it) => it.id === s.cover) || s.items[0], color: i + 1, set: s })),
    { label: "Ойын", item: { id: "_game", anim: false }, color: 7, game: true },
  ];
  tiles.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "menu-tile" + (t.game ? " game" : "");
    b.style.setProperty("--tile", colorFor(t.color));
    b.dataset.color = t.color;
    const label = document.createElement("span");
    label.textContent = t.label;
    b.append(makePicture(t.item).el, label);
    b.addEventListener("click", () => {
      if (t.game) return enter("#game");
      enter(`#${t.set.id}/${store.get(`bul-kim:${t.set.id}`) || t.set.items[0].id}`);
    });
    box.appendChild(b);
  });
}

// ---------------------------------------------------------------- toolbar
$("btn-home").addEventListener("click", goHome);
$("btn-game").addEventListener("click", () => {
  if (document.body.classList.contains("speaking")) return;
  history.replaceState(history.state, "", `#game/${viewer.set.id}`);
  route();
});

const root = document.documentElement;
const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
// iPad Safari draws its own ✕ in the top-left corner in fullscreen: body.fs-ipad moves our Home button below it
const isIPad = /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const syncFs = () => document.body.classList.toggle("fs-ipad", isIPad && !!isFs());
document.addEventListener("fullscreenchange", syncFs);
document.addEventListener("webkitfullscreenchange", syncFs);
function toggleFs() {
  try {
    const p = isFs()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (p && p.catch) p.catch(() => {});
  } catch { /* not allowed */ }
}
if (fsEnabled) {
  $("btn-fs").hidden = false;
  $("btn-fs").addEventListener("click", toggleFs);
}

async function keepAwake() {
  try { if ("wakeLock" in navigator && document.visibilityState === "visible") await navigator.wakeLock.request("screen"); }
  catch { /* not allowed, fine */ }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    viewer.pause();
    quiz?.pause();
  } else if (started) {
    keepAwake();
    if (screen === "quiz") quiz.resume();
  }
});

document.addEventListener("keydown", (e) => {
  if (!started && screen === "menu") return;
  if (screen === "viewer") viewer.key(e);
  else if (screen === "quiz") quiz.key(e);
  if (e.key === "Escape" && screen !== "menu" && $("grid").hidden) goHome();
});

// no long-press menus, pinch zoom or double-tap zoom for little fingers
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

darkMq.addEventListener?.("change", () => {
  document.querySelectorAll(".menu-tile").forEach((b) => b.style.setProperty("--tile", colorFor(+b.dataset.color)));
  viewer.recolor();
  setBg(colorFor(screen === "viewer" ? viewer.index : 0));
});

// ---------------------------------------------------------------- init
async function init() {
  cfg = await fetch("content.json").then((r) => r.json());
  for (const s of cfg.sets) sets[s.id] = s;
  quiz = createQuiz({
    question: $("quiz-q"), options: $("quiz-opts"), praiseEl: $("praise"), canvas: $("fireworks"),
    starsEl: $("stars"), starsN: $("stars-n"), template: cfg.question,
    praises: Object.entries(cfg.phrases).filter(([k]) => k.startsWith("praise")).map(([key, text]) => ({ key, text })),
    colorFor, setBg, store,
  });
  // a shared link like #animals/maimyl opens the menu; that card is where "Жануарлар" starts
  const [a, b] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (sets[a] && b) store.set(`bul-kim:${a}`, b);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  buildMenu();
  route();
}

init();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
