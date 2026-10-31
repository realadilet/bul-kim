// Game. Two kinds of rounds:
//  • "Мысық қайда?" — three pictures, tap the named one. Wrong tap: calm re-label «Бұл — ит. Мысық қайда?»
//  • every third round: «Алма ма, банан ба?» — a free choice, both answers are fine.
import * as audio from "./audio.js";
import { makePicture, preloadItem, jump, wiggle, fireworks, pulse, sparks } from "./fx.js";
import { nameUrl } from "./parent.js";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const lowerFirst = (s) => s.slice(0, 1).toLowerCase() + s.slice(1);

export function createQuiz({ question, options, praiseEl, canvas, phrases, colorFor, setBg }) {
  let pool = [];
  let round = null;
  let recent = [];
  let pics = [];
  let timers = [];
  let active = false;
  let waiting = false;
  let count = 0;

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setWaiting = (v) => { waiting = v; options.classList.toggle("waiting", v); };
  const P = (it) => phrases[it.id] || {};
  const tail = (it) => (it.show ? { url: `assets/audio/s_${it.id}.mp3`, text: it.show } : it.sound ? { url: `assets/sounds/${it.id}.mp3` } : null);

  function newRound() {
    const set = pick(pool);
    let cands = set.items.filter((it) => !recent.includes(it.id));
    if (!cands.length) cands = set.items;
    const target = pick(cands);
    recent.push(target.id);
    while (recent.length > Math.min(8, set.items.length - 3)) recent.shift();
    const kind = count % 3 === 2 ? "choice" : "find";
    const others = shuffle(set.items.filter((it) => it.id !== target.id && it.emoji !== target.emoji)).slice(0, kind === "choice" ? 1 : 2);
    return { kind, target, opts: shuffle([target, ...others]), wrong: new Set(), solved: false };
  }

  function questionText(r) {
    if (r.kind === "find") return P(r.target).q;
    const [a, b] = r.opts;
    return `${P(a).c.replace(/\?$/, "")}, ${lowerFirst(P(b).c)}`; // «Алма ма, банан ба?»
  }
  function questionClips(r) {
    if (r.kind === "find") return [{ url: `assets/audio/q_${r.target.id}.mp3`, text: P(r.target).q }];
    return r.opts.map((it) => ({ url: `assets/audio/c_${it.id}.mp3`, text: P(it).c }));
  }

  function render() {
    pics.forEach((p) => p.destroy());
    pics = [];
    options.replaceChildren();
    options.dataset.kind = round.kind;
    question.textContent = questionText(round);
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

  async function ask(delay, pre = []) {
    setWaiting(true);
    const r = round;
    await audio.play([...pre, ...questionClips(r)], {
      delay,
      gap: r.kind === "choice" ? 0.12 : 0.45,
      onClip: (i) => { if (i >= pre.length) pulse(question); },
    });
    if (active && round === r && !r.solved) setWaiting(false);
  }

  function next(delay = 0.3) {
    clearTimers();
    count++;
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

  async function finish(r, btn, it, clips, celebrate) {
    r.solved = true;
    setWaiting(true);
    btn.classList.add("right");
    [...options.children].forEach((b) => { if (b !== btn) b.classList.add("gone"); });
    if (celebrate) {
      audio.sfx("win");
      fireworks(canvas, { bursts: 4, spread: 900 });
      showPraise(P(it).f || it.kk);
    } else {
      const b = btn.getBoundingClientRect();
      sparks(b.left + b.width / 2, b.top + b.height / 2, 10);
    }
    const ok = await audio.play(clips.filter(Boolean), {
      delay: 0.4,
      gap: 0.3,
      onClip: (i) => (i === 0 ? jump(btn) : wiggle(btn)),
    });
    if (!active || round !== r) return;
    if (ok) timers.push(setTimeout(() => { if (active && round === r) next(); }, 800));
    else setWaiting(false);
  }

  async function choose(btn, it) {
    if (!active || !round || round.solved) return;
    if (waiting || round.wrong.has(it.id)) return;
    const r = round;

    if (r.kind === "choice") {
      // any answer is right: name it with enthusiasm
      return finish(r, btn, it, [{ url: nameUrl(it.id), text: it.kk }, tail(it)], false);
    }
    if (it.id === r.target.id) {
      // «Мысықты таптың!» + the cat's sound (or «Мұрныңды көрсет!»)
      return finish(r, btn, it, [{ url: `assets/audio/f_${it.id}.mp3`, text: P(it).f }, tail(it)], true);
    }
    // wrong: calm re-label, then the same question again
    r.wrong.add(it.id);
    btn.classList.add("wrong");
    ask(0.25, [{ url: `assets/audio/b_${it.id}.mp3`, text: P(it).b }]);
  }

  return {
    open(sets) {
      this.close();
      pool = sets.filter((s) => s.quiz !== false && s.items.length >= 3);
      active = true;
      recent = [];
      count = 0;
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
