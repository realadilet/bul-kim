// Voice activity only: is the child making ANY sound? No speech recognition, nothing leaves the device.
import { context } from "./audio.js";

export const supported = () => !!navigator.mediaDevices?.getUserMedia;
export const canRecord = () => supported() && typeof window.MediaRecorder === "function";

async function open() {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
}
const close = (s) => s && s.getTracks().forEach((t) => t.stop());

/**
 * Listen up to `ms`. Resolves "voice" when a sound clearly above the room noise lasts ~0.2 s,
 * "timeout", "cancel" (signal aborted) or "error" (no permission / no audio).
 * onLevel(db, threshold) is called ~25×/s for a level meter.
 */
export async function listen(ms, { signal, onLevel } = {}) {
  const ctx = context();
  if (!ctx) return "error";
  let stream;
  try { stream = await open(); } catch { return "error"; }
  if (signal?.aborted) { close(stream); return "cancel"; }
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const t0 = performance.now();
  let last = t0, hot = 0, floor = -60, n = 0, timer = 0;

  return new Promise((resolve) => {
    const done = (r) => {
      clearTimeout(timer);
      try { src.disconnect(); } catch { /* ignore */ }
      close(stream);
      signal?.removeEventListener("abort", onAbort);
      resolve(r);
    };
    const onAbort = () => done("cancel");
    signal?.addEventListener("abort", onAbort);
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (now - t0 < 400) {            // first 0.4 s: learn the room noise
        floor = n ? (floor * n + db) / (n + 1) : db;
        n++;
      } else {
        const thr = Math.max(floor + 14, -50);
        if (db > thr) hot += dt; else hot = Math.max(0, hot - dt * 0.6);
        onLevel && onLevel(db, thr);
        if (hot > 150) return done("voice");
      }
      if (now - t0 > ms) return done("timeout");
      timer = setTimeout(tick, 40);
    };
    tick();
  });
}

// Record a short clip for the parent's own voice. Returns a stop() that resolves with a Blob.
export async function record(maxMs = 4000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const finished = new Promise((res) => { rec.onstop = () => { close(stream); res(new Blob(chunks, { type: rec.mimeType || type || "audio/webm" })); }; });
  rec.start();
  const auto = setTimeout(() => rec.state === "recording" && rec.stop(), maxMs);
  return () => { clearTimeout(auto); if (rec.state === "recording") rec.stop(); return finished; };
}
