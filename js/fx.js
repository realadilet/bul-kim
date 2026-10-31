// Visual effects: pictures, sparkles, jumps, fireworks.
import { prefetch } from "./audio.js";

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF9F45"];

// ---------------------------------------------------------------- pictures (lottie or static svg)
const lottieData = new Map();
function fetchLottie(id) {
  if (!lottieData.has(id)) {
    const p = fetch(`assets/anim/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
    p.catch(() => lottieData.delete(id));
    lottieData.set(id, p);
  }
  return lottieData.get(id);
}

export function preloadItem(it) {
  if (!it) return;
  if (it.anim) fetchLottie(it.id);
  prefetch(`assets/audio/${it.id}.mp3`);
  if (it.sound) prefetch(`assets/sounds/${it.id}.mp3`);
  new Image().src = `assets/img/${it.id}.svg`;
}

export function makePicture(it, { animate = true } = {}) {
  const el = document.createElement("div");
  el.className = "pic" + (it.selfanim ? " self" : ""); // self: the picture animates itself (no extra bobbing)
  const img = document.createElement("img");
  img.className = "poster";
  img.src = `assets/img/${it.id}.svg`;
  img.alt = "";
  img.draggable = false;
  el.appendChild(img);
  const pic = { el, anim: null, dead: false, destroy() { this.dead = true; if (this.anim) this.anim.destroy(); } };

  if (it.anim && animate && window.lottie && !reduceMotion) {
    fetchLottie(it.id).then((json) => {
      if (pic.dead) return;
      const box = document.createElement("div");
      box.className = "lottie";
      el.appendChild(box);
      try {
        pic.anim = lottie.loadAnimation({
          container: box, renderer: "svg", loop: true, autoplay: true, animationData: json,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
        const ready = () => { if (!pic.dead) el.classList.add("ready"); };
        if (pic.anim.isLoaded) ready(); else pic.anim.addEventListener("DOMLoaded", ready);
      } catch {
        box.remove();
        el.classList.add("static");
      }
    }).catch(() => el.classList.add("static"));
  } else {
    el.classList.add("static");
  }
  return pic;
}

// ---------------------------------------------------------------- small animations
export function jump(el) {
  if (reduceMotion || !el) return;
  el.animate(
    [
      { transform: "none" },
      { transform: "translateY(2%) scale(1.08, .9)", offset: 0.15 },
      { transform: "translateY(-16%) scale(.94, 1.08)", offset: 0.45 },
      { transform: "translateY(0) scale(1.06, .94)", offset: 0.75 },
      { transform: "none" },
    ],
    { duration: 650, easing: "ease-out" }
  );
}

export function wiggle(el) {
  if (reduceMotion || !el) return;
  el.animate(
    [
      { transform: "rotate(0)" }, { transform: "rotate(-7deg) scale(1.04)" }, { transform: "rotate(6deg) scale(1.06)" },
      { transform: "rotate(-5deg) scale(1.04)" }, { transform: "rotate(3deg)" }, { transform: "rotate(0)" },
    ],
    { duration: 900, easing: "ease-in-out" }
  );
}

export function pulse(el) {
  if (reduceMotion || !el) return;
  el.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 520, easing: "ease-out" });
}

export function shake(el) {
  if (!el) return;
  el.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-12px) rotate(-3deg)" }, { transform: "translateX(10px) rotate(3deg)" },
     { transform: "translateX(-8px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
    { duration: 450, easing: "ease-in-out" }
  );
}

export function popLetters(word) {
  if (reduceMotion) return;
  [...word.children].forEach((s, k) => {
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

let alive = 0;
export function sparks(x, y, n = 14) {
  if (reduceMotion || alive > 70) return;
  for (let k = 0; k < n; k++) {
    const s = document.createElement("i");
    s.className = "spark" + (k % 3 === 0 ? " star" : "");
    s.style.setProperty("--sz", 10 + Math.random() * 22 + "px");
    s.style.setProperty("--c", COLORS[k % COLORS.length]);
    document.body.appendChild(s);
    alive++;
    const ang = (Math.PI * 2 * k) / n + Math.random() * 0.5;
    const dist = 80 + Math.random() * 140;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;
    s.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(.3)`, opacity: 1 },
        { transform: `translate(${x + dx}px, ${y + dy}px) scale(1) rotate(${dx}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x + dx * 1.15}px, ${y + dy * 1.15 + 60}px) scale(.6) rotate(${dx * 2}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.4,1)" }
    ).onfinish = () => { s.remove(); alive--; };
  }
}

// Star flies from an element to the counter.
export function flyStar(fromEl, toEl, done) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const s = document.createElement("i");
  s.className = "spark star";
  s.style.setProperty("--sz", "64px");
  s.style.setProperty("--c", "#FFC93C");
  document.body.appendChild(s);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + 18, y1 = b.top + b.height / 2;
  s.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) scale(.2) rotate(0)` },
      { transform: `translate(${x0}px, ${y0 - 60}px) scale(1.4) rotate(90deg)`, offset: 0.35 },
      { transform: `translate(${x1}px, ${y1}px) scale(.45) rotate(360deg)` },
    ],
    { duration: reduceMotion ? 1 : 1100, easing: "cubic-bezier(.4,0,.2,1)" }
  ).onfinish = () => { s.remove(); done && done(); };
}

// ---------------------------------------------------------------- fireworks
const fw = { parts: [], queue: [], running: false, canvas: null, g: null, w: 0, h: 0 };

export function fireworks(canvas, { bursts = 6, spread = 1300, onBurst } = {}) {
  if (reduceMotion) return;
  const now = performance.now();
  for (let i = 0; i < bursts; i++) fw.queue.push({ at: now + i * (spread / bursts) + Math.random() * 120, onBurst });
  if (fw.running) return;
  fw.running = true;
  fw.canvas = canvas;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  fw.w = innerWidth;
  fw.h = innerHeight;
  canvas.width = fw.w * dpr;
  canvas.height = fw.h * dpr;
  fw.g = canvas.getContext("2d");
  fw.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.hidden = false;
  let last = now;
  const frame = (t) => {
    const dt = Math.min(3, (t - last) / 16.67);
    last = t;
    while (fw.queue.length && fw.queue[0].at <= t) burst(fw.queue.shift());
    const g = fw.g;
    g.clearRect(0, 0, fw.w, fw.h);
    for (let i = fw.parts.length - 1; i >= 0; i--) {
      const p = fw.parts[i];
      const drag = Math.pow(0.975, dt);
      p.vx *= drag;
      p.vy = p.vy * drag + 0.07 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) { fw.parts.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, p.life * 1.4);
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.r * (0.6 + p.life * 0.4), 0, 6.283);
      g.fill();
    }
    if (fw.queue.length || fw.parts.length) requestAnimationFrame(frame);
    else { fw.running = false; canvas.hidden = true; }
  };
  requestAnimationFrame(frame);
}

function burst({ onBurst }) {
  const cx = fw.w * (0.15 + Math.random() * 0.7);
  const cy = fw.h * (0.12 + Math.random() * 0.45);
  const col = COLORS[Math.floor(Math.random() * COLORS.length)];
  const col2 = COLORS[Math.floor(Math.random() * COLORS.length)];
  const n = 56;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.2;
    const sp = 3 + Math.random() * 4.5;
    fw.parts.push({
      x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      life: 1, decay: 0.011 + Math.random() * 0.008,
      c: Math.random() < 0.2 ? "#FFFFFF" : (i % 2 ? col : col2), r: 2.5 + Math.random() * 2.5,
    });
  }
  if (onBurst) onBurst();
}
