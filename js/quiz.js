// Game: "Мысық қайда?" — three pictures, tap the right one.
import * as audio from "./audio.js";
import { makePicture, preloadItem, jump, wiggle, shake, fireworks, flyStar, pulse } from "./fx.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createQuiz({ question, options, praiseEl, canvas, starsEl, starsN, template, praises, colorFor, setBg, store }) {
  let pool = [];
  let round = null;
  let recent = [];
  let pics = [];
  let timers = [];
  let active = false;
  let waiting = false;
  let stars = parseInt(store.get("bul-kim:stars") || "0", 10) || 0;

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setWaiting = (v) => { waiting = v; options.classList.toggle("waiting", v); };
  const qText = (it) => template.replace("{kk}", it.kk);
  const renderStars = () => { starsN.textContent = String(stars); };

  function newRound() {
    const set = pick(pool);
    let cands = set.items.filter((it) => !recent.includes(it.id));
    if (!cands.length) cands = set.items;
    const target = pick(cands);
    recent.push(target.id);
    while (recent.length > Math.min(8, set.items.length - 3)) recent.shift();
    const others = shuffle(set.items.filter((it) => it.id !== target.id && it.emoji !== target.emoji)).slice(0, 2);
    return { target, opts: shuffle([target, ...others]), wrong: new Set(), solved: false };
  }

  function render() {
    pics.forEach((p) => p.destroy());
    pics = [];
    options.replaceChildren();
    question.textContent = qText(round.target);
    setBg(colorFor(Math.floor(Math.random() * 8)));
    round.opts.forEach((it, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.setAttribute("aria-label", it.kk);
      const pic = makePicture(it);
      pics.push(pic);
      b.appendChild(pic.el);
      const label = document.createElement("span");
      label.className = "opt-label";
      label.textContent = it.kk;
      b.appendChild(label);
      b.addEventListener("click", () => choose(b, it));
      options.appendChild(b);
      b.animate(
        [{ transform: "scale(.3)", opacity: 0 }, { transform: "scale(1.06)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }],
        { duration: 450, delay: k * 110, easing: "ease-out", fill: "backwards" }
      );
      preloadItem(it);
    });
    question.animate([{ transform: "translateY(-30px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 400, easing: "ease-out" });
  }

  async function ask(delay) {
    setWaiting(true);
    const r = round;
    await audio.play([{ url: `assets/audio/q_${r.target.id}.mp3`, text: qText(r.target) }], {
      delay,
      onClip: () => pulse(question),
    });
    if (active && round === r && !r.solved) setWaiting(false);
  }

  function next(delay = 0.3) {
    clearTimers();
    round = newRound();
    render();
    ask(delay + 0.3);
  }

  function showPraise(text) {
    praiseEl.textContent = text;
    praiseEl.classList.remove("show");
    void praiseEl.offsetWidth;
    praiseEl.classList.add("show");
  }

  async function choose(btn, it) {
    if (!active || !round || round.solved) return;
    if (waiting || round.wrong.has(it.id)) { shake(btn); return; }
    const r = round;

    if (it.id === r.target.id) {
      r.solved = true;
      setWaiting(true);
      btn.classList.add("right");
      [...options.children].forEach((b) => { if (b !== btn) b.classList.add("gone"); });
      audio.sfx("win");
      stars++;
      store.set("bul-kim:stars", String(stars));
      const big = stars % 5 === 0;
      fireworks(canvas, { bursts: big ? 12 : 7, spread: big ? 2200 : 1300, onBurst: () => audio.sfx("pop") });
      const p = pick(praises);
      showPraise(p.text);
      flyStar(btn, starsEl, () => { renderStars(); pulse(starsEl); });
      const clips = [{ url: `assets/audio/_${p.key}.mp3`, text: p.text }, { url: `assets/audio/${it.id}.mp3`, text: it.kk }];
      if (it.sound) clips.push({ url: `assets/sounds/${it.id}.mp3` });
      const ok = await audio.play(clips, {
        delay: 0.5,
        gap: 0.3,
        onClip: (i) => { if (i === 1) jump(btn); else if (i === 2) wiggle(btn); },
      });
      if (!active || round !== r) return;
      if (ok) timers.push(setTimeout(() => { if (active && round === r) next(); }, 700));
      else setWaiting(false);
      return;
    }

    // wrong: the picture says its own name, then the question repeats
    r.wrong.add(it.id);
    setWaiting(true);
    btn.classList.add("wrong");
    shake(btn);
    audio.sfx("no");
    const ok = await audio.play([{ url: `assets/audio/${it.id}.mp3`, text: it.kk }], { delay: 0.3 });
    if (!active || round !== r || r.solved) return;
    if (ok) ask(0.4); else setWaiting(false);
  }

  return {
    open(sets) {
      this.close();
      pool = sets.filter((s) => s.items.length >= 3);
      active = true;
      recent = [];
      renderStars();
      next(0.2);
    },
    close() {
      active = false;
      audio.stop();
      clearTimers();
      setWaiting(false);
      pics.forEach((p) => p.destroy());
      pics = [];
      options.replaceChildren();
      praiseEl.classList.remove("show");
      round = null;
    },
    pause() { audio.stop(); clearTimers(); if (round && !round.solved) setWaiting(false); },
    resume() { if (active && round && !round.solved) ask(0.2); else if (active && round && round.solved) next(); },
    key(e) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3 && options.children[n - 1]) options.children[n - 1].click();
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (round && !round.solved && !waiting) ask(0.05); }
    },
  };
}
