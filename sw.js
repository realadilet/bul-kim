// Offline cache: code is network-first (updates arrive after deploy),
// pictures/animations/audio are cache-first and all prefetched on install.
const CACHE = "bul-kim-v2";
const CORE = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/audio.js",
  "js/fx.js",
  "js/viewer.js",
  "js/quiz.js",
  "vendor/lottie_light.min.js",
  "content.json",
  "manifest.webmanifest",
  "assets/fonts/nunito-cyrillic-ext.woff2",
  "assets/fonts/nunito-cyrillic.woff2",
  "assets/fonts/nunito-latin.woff2",
  "assets/img/_game.svg",
  "icons/icon-192.png",
];
const CODE = /\.(html|css|js|json|webmanifest)$|\/$/;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    const cfg = await (await fetch("content.json")).json();
    const urls = Object.keys(cfg.phrases || {}).map((k) => `assets/audio/_${k}.mp3`);
    for (const s of cfg.sets) {
      for (const it of s.items) {
        urls.push(`assets/img/${it.id}.svg`, `assets/audio/${it.id}.mp3`, `assets/audio/q_${it.id}.mp3`);
        if (it.anim) urls.push(`assets/anim/${it.id}.json`);
        if (it.sound) urls.push(`assets/sounds/${it.id}.mp3`);
      }
    }
    await Promise.allSettled(urls.map((u) => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const isCode = CODE.test(url.pathname) && !url.pathname.includes("/assets/anim/");
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (isCode) {
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch {
        return (await c.match(req, { ignoreSearch: true })) || Response.error();
      }
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  })());
});
