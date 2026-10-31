(() => {
  "use strict";

  const LIGHT = ["#FFD6A5", "#CAFFBF", "#9BF6FF", "#BDB2FF", "#FFC6FF", "#FDFFB6", "#A0C4FF", "#FFADAD"];
  const DARK  = ["#3D2C5E", "#1F4A4F", "#24445E", "#4A2E5C", "#5A2E48", "#4A3D22", "#2A3B6B", "#5A2E2E"];
  const SPARK = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF9F45"];

  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const darkMq = matchMedia("(prefers-color-scheme: dark)");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let animals = [];
  let index = 0;
  let card = null;          // { el, wrap, animal, word, lottie, a }
  let busy = false;
  let started = false;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  const palette = () => (darkMq.matches ? DARK : LIGHT);
  const colorFor = (i) => palette()[i % palette().length];
  const mod = (n, m) => ((n % m) + m) % m;

  // ---------------------------------------------------------------- audio
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let voice = null;         // currently playing source
  let sayToken = 0;
  const raw = new Map();    // key -> Promise<ArrayBuffer>
  const decoded = new Map();// key -> Promise<AudioBuffer>

  function fetchAudio(key) {
    if (!raw.has(key)) {
      const p = fetch(`assets/audio/${key}.mp3`).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      });
      p.catch(() => raw.delete(key));
      raw.set(key, p);
    }
    return raw.get(key);
  }

  function decode(key) {
    if (!decoded.has(key)) {
      const p = fetchAudio(key).then((buf) => new Promise((res, rej) => ctx.decodeAudioData(buf.slice(0), res, rej)));
      p.catch(() => decoded.delete(key));
      decoded.set(key, p);
    }
    return decoded.get(key);
  }

  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* optional API */ }
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state !== "running") ctx.resume();
    // iOS: a silent one-sample buffer inside the gesture fully unlocks output
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  }

  function stopVoice() {
    if (voice) { try { voice.stop(); } catch { /* already stopped */ } voice = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  // Plays assets/audio/<key>.mp3; falls back to the browser's kk-KZ voice.
  // Resolves with the clip duration in seconds once it starts.
  async function say(key, text) {
    const token = ++sayToken;
    stopVoice();
    try {
      if (!ctx) throw new Error("no audio context");
      if (ctx.state !== "running") await ctx.resume();
      const buf = await decode(key);
      if (token !== sayToken) return 0;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      voice = src;
      return buf.duration;
    } catch {
      if (token !== sayToken || !("speechSynthesis" in window) || !text) return 0;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "kk-KZ";
      u.rate = 0.85;
      const kk = speechSynthesis.getVoices().find((v) => /^kk/i.test(v.lang));
      if (kk) u.voice = kk;
      speechSynthesis.speak(u);
      return 1;
    }
  }

  // ---------------------------------------------------------------- lottie
  const lottieData = new Map();
  function fetchLottie(a) {
    if (!a.anim) return null;
    if (!lottieData.has(a.id)) {
      const p = fetch(`assets/anim/${a.id}.json`).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
      p.catch(() => lottieData.delete(a.id));
      lottieData.set(a.id, p);
    }
    return lottieData.get(a.id);
  }

  function preload(i) {
    const a = animals[mod(i, animals.length)];
    fetchLottie(a);
    fetchAudio(a.id);
    new Image().src = `assets/img/${a.id}.svg`;
  }

  // ---------------------------------------------------------------- cards
  function buildCard(i) {
    const a = animals[i];
    const el = document.createElement("div");
    el.className = "card";

    const wrap = document.createElement("div");
    wrap.className = "animal-wrap";
    const animal = document.createElement("div");
    animal.className = "animal" + (a.anim ? "" : " static");
    const poster = document.createElement("img");
    poster.className = "poster";
    poster.src = `assets/img/${a.id}.svg`;
    poster.alt = a.kk;
    poster.draggable = false;
    animal.appendChild(poster);
    wrap.appendChild(animal);

    const word = document.createElement("h1");
    word.className = "word";
    [...a.kk].forEach((ch) => {
      const s = document.createElement("span");
      s.textContent = ch;
      word.appendChild(s);
    });

    word.style.setProperty("--len", [...a.kk].length);
    const wordBox = document.createElement("div");
    wordBox.className = "word-box";
    wordBox.appendChild(word);
    el.append(wrap, wordBox);
    const c = { el, wrap, animal, word, a, lottie: null, dead: false };

    const data = fetchLottie(a);
    if (data && window.lottie) {
      data.then((json) => {
        if (c.dead) return;
        const box = document.createElement("div");
        box.className = "lottie";
        animal.appendChild(box);
        try {
          const anim = lottie.loadAnimation({
            container: box,
            renderer: "svg",
            loop: true,
            autoplay: !reduceMotion,
            animationData: json,
            rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
          });
          c.lottie = anim;
          const ready = () => { if (!c.dead) animal.classList.add("ready"); };
          if (anim.isLoaded) ready(); else anim.addEventListener("DOMLoaded", ready);
        } catch {
          box.remove();
          animal.classList.add("static");
        }
      }).catch(() => animal.classList.add("static"));
    } else if (a.anim) {
      animal.classList.add("static");
    }
    return c;
  }

  function destroyCard(c) {
    c.dead = true;
    if (c.lottie) c.lottie.destroy();
    c.el.remove();
  }

  function popLetters(c) {
    if (reduceMotion) return;
    [...c.word.children].forEach((s, k) => {
      s.animate(
        [
          { transform: "translateY(60%) scale(.2)", opacity: 0 },
          { transform: "translateY(-12%) scale(1.15)", opacity: 1, offset: 0.7 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 480, delay: 120 + k * 70, easing: "ease-out", fill: "backwards" }
      );
    });
  }

  function jump(c) {
    if (reduceMotion) return;
    c.wrap.animate(
      [
        { transform: "none" },
        { transform: "translateY(2%) scale(1.08, .9)", offset: 0.15 },
        { transform: "translateY(-16%) scale(.94, 1.08)", offset: 0.45 },
        { transform: "translateY(0) scale(1.06, .94)", offset: 0.75 },
        { transform: "none" },
      ],
      { duration: 650, easing: "ease-out" }
    );
    c.word.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }],
      { duration: 520, easing: "ease-out" }
    );
  }

  function sparks(x, y, n = 14) {
    if (reduceMotion) return;
    for (let k = 0; k < n; k++) {
      const s = document.createElement("i");
      s.className = "spark" + (k % 3 === 0 ? " star" : "");
      const sz = 10 + Math.random() * 22;
      s.style.setProperty("--sz", sz + "px");
      s.style.setProperty("--c", SPARK[k % SPARK.length]);
      document.body.appendChild(s);
      const ang = (Math.PI * 2 * k) / n + Math.random() * 0.5;
      const dist = 80 + Math.random() * 140;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      s.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(.3) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${x + dx}px, ${y + dy}px) scale(1) rotate(${dx}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${x + dx * 1.15}px, ${y + dy * 1.15 + 60}px) scale(.6) rotate(${dx * 2}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.4,1)" }
      ).onfinish = () => s.remove();
    }
  }

  function setBg(i) {
    const c = colorFor(i);
    document.body.style.setProperty("--bg", c);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", c);
  }

  function announce(c, delay = 250) {
    const id = c.a.id;
    setTimeout(() => {
      if (card === c && started) say(id, c.a.kk).then((d) => d && jump(c));
    }, delay);
  }

  function show(i, dir = 0, fromX = 0) {
    i = mod(i, animals.length);
    const old = card;
    const next = buildCard(i);
    index = i;
    card = next;
    stage.appendChild(next.el);
    setBg(i);
    store.set("bul-kim:index", String(i));
    history.replaceState(null, "", "#" + next.a.id);

    if (old) {
      busy = true;
      const w = window.innerWidth;
      const out = dir >= 0 ? -1 : 1;
      const rot = out * 12;
      const exit = old.el.animate(
        [
          { transform: `translateX(${fromX}px) rotate(${fromX / 25}deg)` },
          { transform: `translateX(${out * w * 1.2}px) rotate(${rot}deg)`, opacity: 0.4 },
        ],
        { duration: reduceMotion ? 1 : 380, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
      );
      exit.onfinish = () => destroyCard(old);
      next.el.animate(
        [
          { transform: `translateX(${-out * w}px) rotate(${-rot}deg) scale(.7)` },
          { transform: "none" },
        ],
        { duration: reduceMotion ? 1 : 620, easing: "cubic-bezier(.2,1.25,.4,1)", fill: "backwards" }
      ).onfinish = () => { busy = false; };
    }
    popLetters(next);
    preload(i + 1);
    preload(i - 1);
    announce(next, old ? 420 : 250);
    auto.reset();
    idle.reset();
  }

  const go = (step, fromX = 0) => { if (!busy) show(index + step, step, fromX); };

  function replay(x, y) {
    if (!card) return;
    say(card.a.id, card.a.kk);
    jump(card);
    const r = card.wrap.getBoundingClientRect();
    sparks(x ?? r.left + r.width / 2, y ?? r.top + r.height / 2);
    auto.reset();
    idle.reset();
  }

  // ---------------------------------------------------------------- gestures
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (!started || drag || busy || !card) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, moved: false };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    if (Math.abs(drag.dx) > 8 || Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    card.el.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 25}deg)`;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, moved, t } = drag;
    const v = Math.abs(dx) / Math.max(1, performance.now() - t);
    drag = null;
    if (!moved) {
      card.el.style.transform = "";
      replay(e.clientX, e.clientY);
      return;
    }
    if (Math.abs(dx) > Math.min(90, window.innerWidth * 0.18) || (Math.abs(dx) > 30 && v > 0.5)) {
      card.el.style.transform = "";
      go(dx < 0 ? 1 : -1, dx);
    } else {
      const el = card.el;
      el.style.transform = "";
      el.animate(
        [{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }, { transform: "none" }],
        { duration: 350, easing: "cubic-bezier(.2,1.4,.4,1)" }
      );
    }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  $("next").addEventListener("click", () => go(1));
  $("prev").addEventListener("click", () => go(-1));

  document.addEventListener("keydown", (e) => {
    if (!started) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); }
      return;
    }
    if (!$("grid").hidden) { if (e.key === "Escape") closeGrid(); return; }
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); replay(); }
  });

  // no long-press menus, pinch zoom or double-tap zoom for little fingers
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());

  // ---------------------------------------------------------------- idle hint
  const idle = {
    timer: 0,
    reset() {
      clearTimeout(this.timer);
      $("next").classList.remove("hint");
      $("prev").classList.remove("hint");
      this.timer = setTimeout(() => { if (!auto.on) $("next").classList.add("hint"); }, 9000);
    },
  };

  // ---------------------------------------------------------------- auto mode
  const auto = {
    on: false,
    timers: [],
    toggle(force) {
      this.on = force ?? !this.on;
      $("btn-auto").setAttribute("aria-pressed", String(this.on));
      if (this.on) { replay(); } else { this.clear(); }
    },
    clear() { this.timers.forEach(clearTimeout); this.timers = []; },
    reset() {
      this.clear();
      if (!this.on) return;
      const c = card;
      this.timers.push(setTimeout(() => { if (card === c && $("grid").hidden) say(c.a.id, c.a.kk).then(() => jump(c)); }, 3200));
      this.timers.push(setTimeout(() => { if (card === c && $("grid").hidden) go(1); }, 6500));
    },
  };
  $("btn-auto").addEventListener("click", () => auto.toggle());

  // ---------------------------------------------------------------- grid
  function openGrid() {
    const list = $("grid-list");
    if (!list.childElementCount) {
      animals.forEach((a, i) => {
        const b = document.createElement("button");
        b.className = "tile";
        b.type = "button";
        b.style.setProperty("--tile", colorFor(i));
        b.innerHTML = `<img src="assets/img/${a.id}.svg" alt="" loading="lazy" draggable="false"><span></span>`;
        b.querySelector("span").textContent = a.kk;
        b.style.setProperty("--len", [...a.kk].length);
        b.addEventListener("click", () => { closeGrid(); if (i !== index) show(i, i > index ? 1 : -1); else replay(); });
        list.appendChild(b);
      });
    }
    $("grid").hidden = false;
    auto.clear();
    const cur = list.children[index];
    if (cur) cur.scrollIntoView({ block: "center" });
  }
  function closeGrid() { $("grid").hidden = true; auto.reset(); idle.reset(); }
  $("btn-grid").addEventListener("click", openGrid);
  $("grid-close").addEventListener("click", closeGrid);

  // ---------------------------------------------------------------- fullscreen & wake lock
  const root = document.documentElement;
  const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  function toggleFs() {
    const p = isFs()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (p && p.catch) p.catch(() => {});
  }
  if (fsEnabled) {
    $("btn-fs").hidden = false;
    $("btn-fs").addEventListener("click", toggleFs);
  }

  let wake = null;
  async function keepAwake() {
    try { if ("wakeLock" in navigator && document.visibilityState === "visible") wake = await navigator.wakeLock.request("screen"); }
    catch { /* not allowed, fine */ }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (started) { keepAwake(); auto.reset(); }
    } else {
      stopVoice();
      auto.clear();
    }
  });

  darkMq.addEventListener?.("change", () => {
    setBg(index);
    [...$("grid-list").children].forEach((b, i) => b.style.setProperty("--tile", colorFor(i)));
  });

  // ---------------------------------------------------------------- start
  async function start() {
    if (started) return;
    started = true;
    unlockAudio();
    if (fsEnabled && matchMedia("(pointer: coarse)").matches && !isFs()) {
      try { toggleFs(); } catch { /* ignore */ }
    }
    keepAwake();
    $("start").classList.add("leaving");
    setTimeout(() => $("start").remove(), 500);
    const d = await say("_intro", "Сәлем, балақай! Жануарларды көрейік!");
    // say the first animal's name once the greeting is done
    const c = card;
    setTimeout(() => { if (card === c) replay(); }, d ? d * 1000 + 250 : 300);
  }
  $("start-btn").addEventListener("click", start);

  async function init() {
    const cfg = await fetch("animals.json").then((r) => r.json());
    animals = cfg.animals;
    const fromHash = animals.findIndex((a) => a.id === location.hash.slice(1));
    const saved = parseInt(store.get("bul-kim:index") || "0", 10);
    index = fromHash >= 0 ? fromHash : (Number.isFinite(saved) ? mod(saved, animals.length) : 0);
    show(index);
    fetchAudio("_intro");
  }

  addEventListener("hashchange", () => {
    const i = animals.findIndex((a) => a.id === location.hash.slice(1));
    if (i >= 0 && i !== index) show(i, i > index ? 1 : -1);
  });

  init();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
