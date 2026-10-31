// Swipe through the cards of one set.
// A card arrives silently with "?" (thinking time). Tap → word + sound, navigation locked meanwhile.
// Then "your turn": the app waits for the child to say something (mic or the parent's button).
import * as audio from "./audio.js";
import * as mic from "./mic.js";
import { makePicture, preloadItem, jump, wiggle, pulse, shake, popLetters, sparks, reduceMotion } from "./fx.js";
import { settings, t, nextTip, nameUrl, markSaid } from "./parent.js";

const mod = (n, m) => ((n % m) + m) % m;
const wait = (ms, signal) => new Promise((res) => {
  const id = setTimeout(() => res("timeout"), ms);
  signal?.addEventListener("abort", () => { clearTimeout(id); res("cancel"); });
});

export function createViewer({ stage, prev, next, btnGrid, grid, gridList, gridClose, tip, colorFor, onChange, praises }) {
  let set = null;
  let index = 0;
  let card = null;
  let busy = false;       // slide animation running
  let speaking = false;   // word/sound playing → navigation locked
  let timers = [];
  let drag = null;
  let lastSpark = 0;
  let gridSet = null;
  let turnAbort = null;

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setSpeaking = (v) => { speaking = v; document.body.classList.toggle("speaking", v); };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function clipsFor(it) {
    const c = [{ url: nameUrl(it.id), text: it.kk }];
    if (it.show) c.push({ url: `assets/audio/s_${it.id}.mp3`, text: it.show }); // «Мұрныңды көрсет!»
    else if (it.sound) c.push({ url: `assets/sounds/${it.id}.mp3` });
    return c;
  }

  // ------------------------------------------------------------ cards
  function buildCard(i) {
    const it = set.items[i];
    const el = document.createElement("div");
    el.className = "card";
    const wrap = document.createElement("div");
    wrap.className = "pic-wrap";
    const pic = makePicture(it);
    wrap.appendChild(pic.el);
    const word = document.createElement("h1");
    word.className = "word ask";
    word.style.setProperty("--len", 3);
    word.innerHTML = "<span>?</span>";
    const turn = document.createElement("div");
    turn.className = "turn";
    turn.innerHTML = `<span class="ear" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 9a4 4 0 1 1 8 0c0 2.5-2 3.3-2.8 4.8-.6 1.2-.4 3-2.2 3.7-1.3.5-2.6-.2-3-1.3"/><path d="M10.5 9.2a1.6 1.6 0 1 1 3 .8"/></svg></span><button type="button" class="said"></button>`;
    turn.querySelector(".said").textContent = "👍 " + t("said");
    const box = document.createElement("div");
    box.className = "word-box";
    box.append(word, turn);
    el.append(wrap, box);
    return { el, wrap, word, turn, pic, item: it, revealed: false };
  }

  function destroyCard(c) {
    c.pic.destroy();
    c.el.remove();
  }

  // "?" turns into the word when the card speaks for the first time
  function reveal(c) {
    if (c.revealed) return;
    c.revealed = true;
    c.word.classList.remove("ask");
    c.word.style.setProperty("--len", [...c.item.kk].length);
    c.word.replaceChildren(...[...c.item.kk].map((ch) => {
      const s = document.createElement("span");
      s.textContent = ch === " " ? " " : ch;
      return s;
    }));
    popLetters(c.word);
  }

  function stopTurn() {
    if (turnAbort) { turnAbort.abort(); turnAbort = null; }
  }

  async function announce(c, delay) {
    clearTimers();
    stopTurn();
    hint(false);
    c.wrap.classList.remove("tap-hint");
    reveal(c);
    setSpeaking(true);
    const ok = await audio.play(clipsFor(c.item), {
      delay,
      gap: 0.35,
      onClip: (i) => { if (i === 0) { jump(c.wrap); pulse(c.word); } else wiggle(c.wrap); },
    });
    if (card !== c) return;
    setSpeaking(false);
    if (!ok) return;
    if (settings.turn !== "off") await yourTurn(c);
    if (card === c) timers.push(setTimeout(() => hint(true), 6000));
  }

  // Hanen "Observe–Wait–Listen": lean in, wait quietly, answer ANY sound right away.
  async function yourTurn(c) {
    const ac = new AbortController();
    turnAbort = ac;
    c.turn.classList.add("on");
    c.wrap.classList.add("listening");
    const said = new Promise((res) => {
      c.turn.querySelector(".said").onclick = (e) => { e.stopPropagation(); res("parent"); };
    });
    const listening = settings.turn === "mic" && mic.supported()
      ? mic.listen(6500, { signal: ac.signal }).then((r) => (r === "error" ? wait(6000, ac.signal) : r))
      : wait(6000, ac.signal);
    const r = await Promise.race([listening, said]);
    ac.abort();
    if (turnAbort === ac) turnAbort = null;
    c.turn.classList.remove("on");
    c.wrap.classList.remove("listening");
    if (card !== c || r === "cancel") return;

    if (r === "voice" || r === "parent") {
      if (r === "parent") markSaid(c.item.id, "kk");
      const b = c.wrap.getBoundingClientRect();
      sparks(b.left + b.width / 2, b.top + b.height / 2, 18);
      audio.sfx("win");
      const p = pick(praises);
      setSpeaking(true);
      await audio.play([{ url: `assets/audio/_${p.key}.mp3`, text: p.text }, { url: nameUrl(c.item.id), text: c.item.kk }], {
        delay: 0.25, gap: 0.25, onClip: (i) => (i === 0 ? wiggle(c.wrap) : (jump(c.wrap), pulse(c.word))),
      });
      if (card === c) setSpeaking(false);
    } else {
      // no answer: simply model the word once more — never a "wrong"
      setSpeaking(true);
      await audio.play([{ url: nameUrl(c.item.id), text: c.item.kk }], { delay: 0.1, onClip: () => { jump(c.wrap); pulse(c.word); } });
      if (card === c) setSpeaking(false);
    }
  }

  function hint(on) { next.classList.toggle("hint", on); }

  function showTip() {
    tip.hidden = !settings.tips;
    if (!settings.tips) return;
    tip.textContent = nextTip();
    tip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
  }

  function show(i, dir = 0, fromX = 0) {
    i = mod(i, set.items.length);
    stopTurn();
    const old = card;
    const nc = buildCard(i);
    index = i;
    card = nc;
    stage.appendChild(nc.el);
    onChange(set, i);
    showTip();

    if (old) {
      busy = true;
      const w = window.innerWidth;
      const out = dir >= 0 ? -1 : 1;
      const rot = out * 12;
      old.el.animate(
        [
          { transform: `translateX(${fromX}px) rotate(${fromX / 25}deg)` },
          { transform: `translateX(${out * w * 1.2}px) rotate(${rot}deg)`, opacity: 0.4 },
        ],
        { duration: reduceMotion ? 1 : 380, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
      ).onfinish = () => destroyCard(old);
      nc.el.animate(
        [{ transform: `translateX(${-out * w}px) rotate(${-rot}deg) scale(.7)` }, { transform: "none" }],
        { duration: reduceMotion ? 1 : 620, easing: "cubic-bezier(.2,1.25,.4,1)", fill: "backwards" }
      ).onfinish = () => { busy = false; };
    }
    preloadItem(set.items[mod(i + 1, set.items.length)]);
    preloadItem(set.items[mod(i - 1, set.items.length)]);
    // the card arrives silently: the child gets time to think "who is this?"
    clearTimers();
    hint(false);
    timers.push(setTimeout(() => { if (card === nc && !speaking && !nc.revealed) nc.wrap.classList.add("tap-hint"); }, 2200));
  }

  function springBack(dx) {
    if (!card || !dx) return;
    card.el.animate(
      [{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }, { transform: "none" }],
      { duration: 380, easing: "cubic-bezier(.2,1.4,.4,1)" }
    );
  }

  function go(step, fromX = 0) {
    if (!card || busy) { springBack(fromX); return; }
    if (speaking) {
      springBack(fromX);
      shake(step > 0 ? next : prev);
      return;
    }
    show(index + step, step, fromX);
  }

  function replay(x, y) {
    if (!card) return;
    const now = performance.now();
    if (now - lastSpark > 160) {
      const r = card.wrap.getBoundingClientRect();
      sparks(x ?? r.left + r.width / 2, y ?? r.top + r.height / 2, 8);
      lastSpark = now;
    }
    if (speaking) { jump(card.wrap); return; } // no "DJ scratching": the clip keeps playing
    announce(card, 0.02);
  }

  // ------------------------------------------------------------ gestures
  stage.addEventListener("pointerdown", (e) => {
    if (drag || busy || !card || e.target.closest("button")) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, moved: false };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id || !card) return;
    let dx = e.clientX - drag.x;
    if (speaking) dx = Math.sign(dx) * Math.min(60, Math.abs(dx) * 0.35); // rubber band while locked
    drag.dx = dx;
    if (Math.abs(e.clientX - drag.x) > 8 || Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    card.el.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, moved, t: t0 } = drag;
    const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
    drag = null;
    if (!card) return;
    card.el.style.transform = "";
    if (!moved) { replay(e.clientX, e.clientY); return; }
    if (speaking) { go(dx < 0 ? 1 : -1, dx); return; }
    if (Math.abs(dx) > Math.min(90, window.innerWidth * 0.18) || (Math.abs(dx) > 30 && v > 0.5)) go(dx < 0 ? 1 : -1, dx);
    else springBack(dx);
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  next.addEventListener("click", () => go(1));
  prev.addEventListener("click", () => go(-1));

  // ------------------------------------------------------------ grid of all cards
  function openGrid() {
    if (speaking) { shake(btnGrid); return; }
    stopTurn();
    if (gridSet !== set) {
      gridList.replaceChildren();
      set.items.forEach((it, i) => {
        const b = document.createElement("button");
        b.className = "tile";
        b.type = "button";
        b.style.setProperty("--tile", colorFor(i));
        b.style.setProperty("--len", [...it.kk].length);
        b.innerHTML = '<img alt="" loading="lazy" draggable="false"><span></span>';
        b.querySelector("img").src = `assets/img/${it.id}.svg`;
        b.querySelector("span").textContent = it.kk;
        b.addEventListener("click", () => {
          closeGrid();
          if (i !== index) show(i, i > index ? 1 : -1); else replay();
        });
        gridList.appendChild(b);
      });
      gridSet = set;
    }
    clearTimers();
    grid.hidden = false;
    const cur = gridList.children[index];
    if (cur) cur.scrollIntoView({ block: "center" });
  }
  function closeGrid() { grid.hidden = true; }
  btnGrid.addEventListener("click", openGrid);
  gridClose.addEventListener("click", closeGrid);

  return {
    open(s, i) {
      this.close();
      set = s;
      show(mod(i, s.items.length));
    },
    close() {
      stopTurn();
      audio.stop();
      clearTimers();
      setSpeaking(false);
      hint(false);
      grid.hidden = true;
      busy = false;
      drag = null;
      tip.hidden = true;
      if (card) { destroyCard(card); card = null; }
      stage.replaceChildren();
    },
    pause() { stopTurn(); audio.stop(); clearTimers(); setSpeaking(false); },
    key(e) {
      if (!grid.hidden) { if (e.key === "Escape") closeGrid(); return; }
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); replay(); }
    },
    recolor() {
      [...gridList.children].forEach((b, i) => b.style.setProperty("--tile", colorFor(i)));
    },
    get set() { return set; },
    get index() { return index; },
  };
}
