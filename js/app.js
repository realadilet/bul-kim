// Menu, routing, session end and the parent zone.
// Routes: "" menu · "#<set>/<item>" viewer · "#game[/<set>]" game.
import * as audio from "./audio.js";
import * as mic from "./mic.js";
import { makePicture } from "./fx.js";
import { createViewer } from "./viewer.js";
import { createQuiz } from "./quiz.js";
import {
  settings, saveSettings, t, holdButton, loadRecordings, recUrl, saveRecording, deleteRecording,
  nameUrl, said, markSaid, logCounts,
} from "./parent.js";

const LIGHT = ["#FFD6A5", "#CAFFBF", "#9BF6FF", "#BDB2FF", "#FFC6FF", "#FDFFB6", "#A0C4FF", "#FFADAD"];
const DARK  = ["#3D2C5E", "#1F4A4F", "#24445E", "#4A2E5C", "#5A2E48", "#4A3D22", "#2A3B6B", "#5A2E2E"];
const GUIDE_URL = "https://github.com/realadilet/bul-kim/blob/main/PARENTS.md";

const $ = (id) => document.getElementById(id);
const darkMq = matchMedia("(prefers-color-scheme: dark)");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const palette = () => (darkMq.matches ? DARK : LIGHT);
const colorFor = (i) => palette()[((i % palette().length) + palette().length) % palette().length];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function setBg(c) {
  document.body.style.setProperty("--bg", c);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", c);
}

let cfg = null;
let phrases = {};
const sets = {};
let screen = "menu";
let started = false;     // first tap happened (audio unlocked)
let fromMenu = false;    // current route was pushed from the menu (Back returns there)
let viewer = null;
let quiz = null;
let praises = [];

// ---------------------------------------------------------------- screens & routing
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
  if (!started || !a || byeOpen) {
    viewer.close();
    quiz.close();
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
  const toMenu = () => { history.replaceState(null, "", location.pathname + location.search); route(); };
  if (!fromMenu) return toMenu();
  fromMenu = false;
  history.back(); // keeps the browser's Back button consistent
  setTimeout(() => { if (location.hash) toMenu(); }, 350); // the entry behind us wasn't the menu
}

// ---------------------------------------------------------------- menu
function buildMenu() {
  const box = $("menu-tiles");
  const tiles = [
    ...cfg.sets.map((s, i) => ({ label: s.kk, item: s.items.find((it) => it.id === s.cover) || s.items[0], color: i + 1, set: s })),
    { label: "Ойын", item: { id: "_game", anim: false }, color: 7, game: true },
  ];
  tiles.forEach((tl) => {
    const b = el("button", "menu-tile" + (tl.game ? " game" : ""));
    b.type = "button";
    b.style.setProperty("--tile", colorFor(tl.color));
    b.dataset.color = tl.color;
    b.append(makePicture(tl.item).el, el("span", "", tl.label));
    b.addEventListener("click", () => {
      if (tl.game) return enter("#game");
      enter(`#${tl.set.id}/${store.get(`bul-kim:${tl.set.id}`) || tl.set.items[0].id}`);
    });
    box.appendChild(b);
  });
}

// ---------------------------------------------------------------- session end: «Сау бол!»
let used = 0;
let lastTick = 0;
let byeOpen = false;
let byePic = null;

setInterval(() => {
  const active = started && !document.hidden && !byeOpen && screen !== "menu" && $("panel").hidden;
  const now = Date.now();
  if (!active) { lastTick = 0; return; }
  if (lastTick) used += now - lastTick;
  lastTick = now;
  if (settings.limit && used >= settings.limit * 60000 && !document.body.classList.contains("speaking") && !audio.playing()) showBye();
}, 1000);

async function showBye() {
  byeOpen = true;
  viewer.pause();
  quiz.pause();
  const box = $("bye");
  const pics = $("bye-pics");
  pics.replaceChildren();
  byePic?.destroy();
  byePic = makePicture({ id: "_bye", anim: true });
  pics.appendChild(byePic.el);
  // a real-world task: «Үйден допты тап!»
  const homeItems = cfg.sets.filter((s) => s.home).flatMap((s) => s.items);
  const task = homeItems[Math.floor(Math.random() * homeItems.length)];
  const taskEl = $("bye-task");
  taskEl.replaceChildren();
  if (task) {
    const img = el("img");
    img.src = `assets/img/${task.id}.svg`;
    img.alt = "";
    taskEl.append(img, el("span", "", phrases[task.id]?.h || task.kk));
  }
  $("bye-again").textContent = t("again");
  box.hidden = false;
  setBg(colorFor(5));
  await audio.play([{ url: "assets/audio/_bye.mp3", text: cfg.phrases.bye }, task && { url: `assets/audio/h_${task.id}.mp3`, text: phrases[task.id]?.h }].filter(Boolean), { delay: 0.4, gap: 0.6 });
}

function closeBye() {
  byeOpen = false;
  used = 0;
  $("bye").hidden = true;
  byePic?.destroy();
  goHome();
}

// ---------------------------------------------------------------- parent zone
const panel = () => $("panel");
function openPanel(render) {
  audio.stop();
  viewer.pause();
  quiz.pause();
  const body = $("panel-body");
  body.replaceChildren();
  render(body);
  $("panel-title").textContent = render.title ? render.title() : t("parents");
  $("panel-close").setAttribute("aria-label", t("close"));
  panel().hidden = false;
  panel().scrollTop = 0;
}
function closePanel() { panel().hidden = true; micTest?.abort(); }

function segmented(options, value, onPick) {
  const wrap = el("div", "seg");
  options.forEach(([v, label]) => {
    const b = el("button", "", label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(v === value));
    b.addEventListener("click", () => {
      [...wrap.children].forEach((c) => c.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      onPick(v);
    });
    wrap.appendChild(b);
  });
  return wrap;
}

function row(label, control, help) {
  const r = el("div", "prow");
  r.append(el("div", "plabel", label), control);
  if (help) r.appendChild(el("p", "phelp", help));
  return r;
}

let micTest = null;
function renderParent(body) {
  // your turn
  const meter = el("div", "meter");
  const bar = el("i");
  meter.appendChild(bar);
  const status = el("p", "phelp");
  const test = el("button", "pbtn", "🎙 " + t("micTest"));
  test.type = "button";
  test.addEventListener("click", async () => {
    firstTap();
    micTest?.abort();
    micTest = new AbortController();
    status.textContent = t("micOk");
    const r = await mic.listen(8000, {
      signal: micTest.signal,
      onLevel: (db) => { bar.style.width = `${Math.max(0, Math.min(100, (db + 70) * 1.6))}%`; },
    });
    bar.style.width = "0";
    if (r === "error") status.textContent = t("micNo");
    else if (r === "voice") status.textContent = "✓";
  });
  const micBox = el("div", "micbox");
  micBox.append(test, meter, status, el("p", "phelp", t("privacy")));
  micBox.hidden = settings.turn !== "mic";
  body.appendChild(row(t("turn"), segmented([["off", t("off")], ["pause", t("pause")], ["mic", t("mic")]], settings.turn, (v) => {
    settings.turn = v; saveSettings(); micBox.hidden = v !== "mic";
  }), t("turnHelp")));
  if (mic.supported()) body.appendChild(micBox);

  body.appendChild(row(t("limit"), segmented([[5, "5"], [10, "10"], [15, "15"], [20, "20"], [0, t("noLimit")]], settings.limit, (v) => {
    settings.limit = v; saveSettings(); used = 0;
  })));
  body.appendChild(row(t("tips"), segmented([[true, t("on")], [false, t("none")]], settings.tips, (v) => { settings.tips = v; saveSettings(); })));
  body.appendChild(row(t("lang"), segmented([["kk", "Қазақша"], ["ru", "Русский"]], settings.lang, (v) => {
    settings.lang = v; saveSettings(); openPanel(renderParent);
  })));

  const links = el("div", "plinks");
  const rec = el("button", "pbtn big", "🎙 " + t("rec"));
  rec.type = "button";
  rec.disabled = !mic.canRecord();
  rec.addEventListener("click", () => openPanel(renderRec));
  const log = el("button", "pbtn big", "📒 " + t("log"));
  log.type = "button";
  log.addEventListener("click", () => openPanel(renderLog));
  const guide = el("a", "pbtn big", "📖 " + t("guide"));
  guide.href = GUIDE_URL;
  guide.target = "_blank";
  guide.rel = "noopener";
  links.append(rec, log, guide);
  body.appendChild(links);
  const ver = el("p", "phelp version", "v …");
  body.appendChild(ver);
  swVersion().then((v) => { ver.textContent = `v ${v}`; });
}

// the version lives in sw.js (one place to bump on release)
function swVersion() {
  const c = navigator.serviceWorker?.controller;
  if (!c) return Promise.resolve("—");
  return new Promise((res) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => res(e.data);
    c.postMessage("version", [ch.port2]);
    setTimeout(() => res("—"), 800);
  });
}

let listSet = null;
function setChips(body, onPick) {
  const chips = el("div", "chips");
  cfg.sets.forEach((s) => {
    const b = el("button", "", s.kk);
    b.type = "button";
    b.setAttribute("aria-pressed", String(s === listSet));
    b.addEventListener("click", () => { listSet = s; onPick(); });
    chips.appendChild(b);
  });
  body.appendChild(chips);
}
function back(body) {
  const b = el("button", "pbtn back", "← " + t("parents"));
  b.type = "button";
  b.addEventListener("click", () => openPanel(renderParent));
  body.appendChild(b);
}

function renderRec(body) {
  listSet = listSet || cfg.sets[0];
  back(body);
  body.appendChild(el("p", "phelp", t("recHelp")));
  setChips(body, () => openPanel(renderRec));
  const list = el("div", "plist");
  let stopper = null;
  for (const it of listSet.items) {
    const r = el("div", "pitem");
    const img = el("img");
    img.src = `assets/img/${it.id}.svg`;
    img.alt = "";
    const recBtn = el("button", "pbtn rec", "● " + t("record"));
    const playBtn = el("button", "pbtn", "▶");
    const delBtn = el("button", "pbtn", "✕");
    [recBtn, playBtn, delBtn].forEach((b) => (b.type = "button"));
    playBtn.setAttribute("aria-label", t("play"));
    delBtn.setAttribute("aria-label", t("del"));
    const sync = () => { const has = !!recUrl(it.id); delBtn.hidden = !has; r.classList.toggle("has", has); };
    playBtn.addEventListener("click", () => { firstTap(); audio.play([{ url: nameUrl(it.id), text: it.kk }]); });
    delBtn.addEventListener("click", async () => { await deleteRecording(it.id); sync(); });
    recBtn.addEventListener("click", async () => {
      firstTap();
      if (stopper) {
        const s = stopper; stopper = null;
        const blob = await s();
        recBtn.classList.remove("on");
        recBtn.textContent = "● " + t("record");
        if (blob.size > 1500) { await saveRecording(it.id, blob); sync(); audio.play([{ url: nameUrl(it.id), text: it.kk }]); }
        return;
      }
      audio.stop();
      try { stopper = await mic.record(4000); } catch { recBtn.textContent = t("micNo"); return; }
      recBtn.classList.add("on");
      recBtn.textContent = "■ " + t("stop");
      setTimeout(() => { if (stopper && recBtn.classList.contains("on")) recBtn.click(); }, 4100);
    });
    sync();
    r.append(img, el("span", "pword", it.kk), recBtn, playBtn, delBtn);
    list.appendChild(r);
  }
  body.appendChild(list);
}
renderRec.title = () => t("rec");

function renderLog(body) {
  listSet = listSet || cfg.sets[0];
  back(body);
  body.appendChild(el("p", "phelp", t("logHelp")));
  const all = cfg.sets.flatMap((s) => s.items.map((it) => it.id));
  const totals = el("p", "ptotal");
  const updateTotals = () => {
    const c = logCounts(all);
    totals.textContent = `${t("total")}: ${c.any} · ${t("kkShort")} ${c.kk} · ${t("ruShort")} ${c.ru}`;
  };
  updateTotals();
  body.appendChild(totals);
  setChips(body, () => openPanel(renderLog));
  const list = el("div", "plist");
  for (const it of listSet.items) {
    const r = el("div", "pitem");
    const img = el("img");
    img.src = `assets/img/${it.id}.svg`;
    img.alt = "";
    const words = el("span", "pword");
    words.append(el("b", "", it.kk), el("small", "", it.ru));
    r.append(img, words);
    for (const [lang, label] of [["kk", t("kkShort")], ["ru", t("ruShort")]]) {
      const b = el("button", "pbtn tick", label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(said(it.id, lang)));
      b.addEventListener("click", () => {
        const on = b.getAttribute("aria-pressed") !== "true";
        markSaid(it.id, lang, on);
        b.setAttribute("aria-pressed", String(on));
        updateTotals();
      });
      r.appendChild(b);
    }
    list.appendChild(r);
  }
  body.appendChild(list);
}
renderLog.title = () => t("log");

// ---------------------------------------------------------------- toolbar & chrome
$("btn-home").addEventListener("click", goHome);
$("btn-game").addEventListener("click", () => {
  if (document.body.classList.contains("speaking") || viewer.set?.quiz === false) return;
  history.replaceState(history.state, "", `#game/${viewer.set.id}`);
  route();
});
holdButton($("btn-parent"), 1200, () => openPanel(renderParent), () => {
  const h = $("hold-hint");
  h.textContent = t("hold");
  h.classList.remove("show");
  void h.offsetWidth;
  h.classList.add("show");
});
holdButton($("bye-again"), 2000, closeBye);
$("panel-close").addEventListener("click", closePanel);

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
    viewer?.pause();
    quiz?.pause();
  } else if (started) {
    keepAwake();
    if (screen === "quiz" && !byeOpen && panel().hidden) quiz.resume();
  }
});

document.addEventListener("keydown", (e) => {
  if (!panel().hidden) { if (e.key === "Escape") closePanel(); return; }
  if (byeOpen || (!started && screen === "menu")) return;
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
  [cfg, phrases] = await Promise.all([
    fetch("content.json").then((r) => r.json()),
    fetch("assets/phrases.json").then((r) => r.json()).catch(() => ({})),
  ]);
  for (const s of cfg.sets) sets[s.id] = s;
  praises = Object.entries(cfg.phrases).filter(([k]) => k.startsWith("praise")).map(([key, text]) => ({ key, text }));
  await loadRecordings();
  viewer = createViewer({
    stage: $("stage"), prev: $("prev"), next: $("next"), btnGrid: $("btn-grid"),
    grid: $("grid"), gridList: $("grid-list"), gridClose: $("grid-close"), tip: $("tip"),
    colorFor, praises, phrases,
    onChange(set, i) {
      setBg(colorFor(i));
      document.body.classList.toggle("no-game", set.quiz === false);
      store.set(`bul-kim:${set.id}`, set.items[i].id);
      history.replaceState(history.state, "", `#${set.id}/${set.items[i].id}`);
    },
  });
  quiz = createQuiz({ question: $("quiz-q"), options: $("quiz-opts"), praiseEl: $("praise"), canvas: $("fireworks"), phrases, colorFor, setBg });
  // a shared link like #animals/maimyl opens the menu; that card is where "Жануарлар" starts
  const [a, b] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (sets[a] && b) store.set(`bul-kim:${a}`, b);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  buildMenu();
  route();
}

init();

// ---------------------------------------------------------------- updates
// The browser checks sw.js in the background; a new VERSION installs and the page reloads on the menu.
let updateReady = false;
function reloadIfIdle() { if (updateReady && screen === "menu" && $("panel").hidden && !byeOpen) location.reload(); }
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  let known = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!known) { known = true; return; } // the very first install just took control: nothing old on screen
    updateReady = true;
    reloadIfIdle();
  });
  addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
      navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage("warm"));
    }).catch(() => {});
  });
}
addEventListener("hashchange", () => setTimeout(reloadIfIdle, 50));
