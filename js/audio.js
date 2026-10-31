// Web Audio playback: clips play back-to-back with exact timing, one sequence at a time.
const AC = window.AudioContext || window.webkitAudioContext;
let ctx = null;
const raw = new Map();      // url -> Promise<ArrayBuffer>
const decoded = new Map();  // url -> Promise<AudioBuffer>
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function prefetch(url) {
  if (!raw.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    });
    p.catch(() => raw.delete(url));
    raw.set(url, p);
  }
  return raw.get(url);
}

function decode(url) {
  if (!ctx) return Promise.reject(new Error("audio locked"));
  if (!decoded.has(url)) {
    const p = prefetch(url).then((b) => new Promise((res, rej) => ctx.decodeAudioData(b.slice(0), res, rej)));
    p.catch(() => decoded.delete(url));
    decoded.set(url, p);
  }
  return decoded.get(url);
}

// Must be called from a tap/click handler (browsers block sound before that).
export function unlock() {
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* optional API */ }
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state !== "running") ctx.resume();
  const s = ctx.createBufferSource();
  s.buffer = ctx.createBuffer(1, 1, 22050);
  s.connect(ctx.destination);
  s.start(0);
}

let cur = null; // { sources, timers, resolve }

export const playing = () => cur !== null;

export function stop() {
  if (!cur) return;
  const c = cur;
  cur = null;
  c.sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
  c.timers.forEach(clearTimeout);
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  c.resolve(false);
}

async function speakFallback(texts, me) {
  if (!("speechSynthesis" in window)) return;
  for (const text of texts) {
    if (cur !== me) return;
    await new Promise((res) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "kk-KZ";
      u.rate = 0.85;
      const kk = speechSynthesis.getVoices().find((v) => /^kk/i.test(v.lang));
      if (kk) u.voice = kk;
      u.onend = u.onerror = res;
      speechSynthesis.speak(u);
      setTimeout(res, 3500);
    });
  }
}

/**
 * Play clips one after another: [{ url, text? }, ...]. Missing files are skipped.
 * delay: seconds before the first clip; gap: pause between clips; onClip(i): clip i starts.
 * Resolves true when everything played, false if interrupted by stop() or another play().
 */
export function play(clips, { delay = 0.05, gap = 0.3, onClip } = {}) {
  stop();
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const me = { sources: [], timers: [], resolve };
  cur = me;
  const finish = () => { if (cur === me) { cur = null; resolve(true); } };

  (async () => {
    let list = [];
    if (ctx) {
      if (ctx.state !== "running") { try { await Promise.race([ctx.resume(), wait(500)]); } catch { /* ignore */ } }
      const res = await Promise.allSettled(clips.map((c) => decode(c.url)));
      if (cur !== me) return;
      list = res.map((r, i) => ({ i, buf: r.status === "fulfilled" ? r.value : null })).filter((x) => x.buf);
    }
    if (!list.length) {
      await speakFallback(clips.map((c) => c.text).filter(Boolean), me);
      finish();
      return;
    }
    const t0 = ctx.currentTime;
    let t = t0 + delay;
    for (const { i, buf } of list) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.connect(ctx.destination);
      s.start(t);
      me.sources.push(s);
      if (onClip) me.timers.push(setTimeout(() => { if (cur === me) onClip(i); }, (t - t0) * 1000));
      t += buf.duration + gap;
    }
    me.timers.push(setTimeout(finish, (t - gap - t0) * 1000 + 80));
  })();
  return done;
}

// Small synthesized effects that play on top of speech.
export function sfx(kind) {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.connect(ctx.destination);

  if (kind === "pop") {
    const len = 0.25;
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = ctx.createBufferSource();
    s.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 500 + Math.random() * 900;
    out.gain.value = 0.35;
    s.connect(f).connect(out);
    s.start(now);
    return;
  }

  const win = kind === "win";
  const notes = win ? [523.25, 659.25, 783.99, 1046.5] : [311, 233];
  out.gain.value = win ? 0.16 : 0.14;
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = win ? "triangle" : "sine";
    o.frequency.value = freq;
    const st = now + i * (win ? 0.09 : 0.14);
    const len = win ? 0.5 : 0.22;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(1, st + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, st + len);
    o.connect(g).connect(out);
    o.start(st);
    o.stop(st + len + 0.05);
  });
}
