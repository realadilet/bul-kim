// Offline cache: the code is network-first (updates arrive after deploy),
// pictures/animations/audio are cache-first and all prefetched on install.
const CACHE = "bul-kim-v1";
const CORE = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "vendor/lottie_light.min.js",
  "animals.json",
  "manifest.webmanifest",
  "assets/fonts/nunito-cyrillic-ext.woff2",
  "assets/fonts/nunito-cyrillic.woff2",
  "assets/fonts/nunito-latin.woff2",
  "assets/audio/_intro.mp3",
  "icons/icon-192.png",
];
const CODE = /\.(html|css|js|json|webmanifest)$|\/$/;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    const cfg = await (await fetch("animals.json")).json();
    const urls = cfg.animals.flatMap((a) => [
      `assets/img/${a.id}.svg`,
      `assets/audio/${a.id}.mp3`,
      ...(a.anim ? [`assets/anim/${a.id}.json`] : []),
    ]);
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
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isCode = CODE.test(new URL(req.url).pathname) && !req.url.includes("/assets/anim/");
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
